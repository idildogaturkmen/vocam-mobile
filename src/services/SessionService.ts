import { supabase } from '../../database/config';
import { StreakService } from './StreakService';
import { LevelingService } from './LevelingService';
import { AchievementService } from './AchievementService';

interface SessionData {
    id: string;
    user_id: string;
    started_at: string;
    ended_at?: string;
    words_studied: number;
    words_learned: number;
    total_questions: number;
}

class SessionService {
    private currentSession: SessionData | null = null;

    /**
     * Start a new learning session with streak and achievement tracking
     */
    async startSession(userId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('quiz_sessions')
                .insert({
                    user_id: userId,
                    started_at: new Date().toISOString(),
                    score: 0 // Will be used as words_learned count
                })
                .select()
                .single();

            if (error) {
                console.error('Error starting session:', error);
                return null;
            }

            this.currentSession = {
                id: data.id,
                user_id: userId,
                started_at: data.started_at,
                words_studied: 0,
                words_learned: 0,
                total_questions: 10 // Default quiz length
            };

            // Update streak on session start
            await this.updateUserProgressOnLogin(userId);

            return data.id;
        } catch (error) {
            console.error('Error starting session:', error);
            return null;
        }
    }

    /**
     * End the current session and award XP
     */
    async endSession(): Promise<boolean> {
        if (!this.currentSession) {
            console.warn('No active session to end');
            return false;
        }

        try {
            const { error } = await supabase
                .from('quiz_sessions')
                .update({
                    score: this.currentSession.words_learned, // Using score field for words learned
                    percentage_score: this.currentSession.total_questions > 0 
                        ? (this.currentSession.words_learned / this.currentSession.total_questions) * 100 
                        : 0
                })
                .eq('id', this.currentSession.id);

            if (error) {
                console.error('Error ending session:', error);
                return false;
            }

            // Award XP for session completion
            await this.awardSessionXP();

            // Check for new achievements
            await AchievementService.checkAndAwardAchievements(this.currentSession.user_id);

            this.currentSession = null;
            return true;
        } catch (error) {
            console.error('Error ending session:', error);
            return false;
        }
    }

    /**
     * Increment words studied/learned in current session and award XP
     */
    async incrementSessionStats(studied: number = 0, learned: number = 0): Promise<void> {
        if (this.currentSession) {
            this.currentSession.words_studied += studied;
            this.currentSession.words_learned += learned;

            // Award XP for each word learned
            if (learned > 0) {
                for (let i = 0; i < learned; i++) {
                    await LevelingService.awardXP(
                        this.currentSession.user_id, 
                        'WORD_LEARNED', 
                        this.currentSession.id
                    );
                }
            }
        }
    }

    /**
     * Get current session
     */
    getCurrentSession(): SessionData | null {
        return this.currentSession;
    }

    /**
     * Get user's session history
     */
    async getSessionHistory(userId: string, limit: number = 10): Promise<SessionData[]> {
        try {
            const { data, error } = await supabase
                .from('quiz_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('started_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching session history:', error);
                return [];
            }

            return data.map(session => ({
                id: session.id,
                user_id: session.user_id,
                started_at: session.started_at,
                words_studied: 0, // Not tracked in current schema
                words_learned: session.score || 0,
                total_questions: session.total_questions || 10
            }));
        } catch (error) {
            console.error('Error fetching session history:', error);
            return [];
        }
    }

    /**
     * Update user's streak (deprecated - use StreakService instead)
     */
    async updateStreak(userId: string): Promise<boolean> {
        const result = await StreakService.updateStreak(userId);
        return result.newStreak > 0;
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId: string) {
        try {
            // Get total unique words learned (user_words entries)
            const { data: userWords, error: wordsError } = await supabase
                .from('user_words')
                .select('word_id, proficiency')
                .eq('user_id', userId);

            if (wordsError) {
                console.error('Error fetching user words:', wordsError);
                return null;
            }

            // Get total translations by counting user's words and their available languages
            // First get all word_ids for this user (filter out any undefined values)
            const userWordIds = userWords?.map(uw => uw.word_id).filter(id => id != null) || [];
            
            let totalTranslations = 0;
            if (userWordIds.length > 0) {
                // Count translations for user's words (avoiding relationship query)
                const { data: translationsData, error: translationsError } = await supabase
                    .from('translations')
                    .select('id')
                    .in('word_id', userWordIds);

                if (translationsError) {
                    console.error('Error fetching translations count:', translationsError);
                } else {
                    totalTranslations = translationsData?.length || 0;
                }
            }

            const uniqueWords = userWords?.length || 0;
            const masteredUniqueWords = userWords?.filter(w => w.proficiency >= 80).length || 0;
            const averageProficiency = uniqueWords > 0 
                ? userWords.reduce((sum, w) => sum + (w.proficiency || 0), 0) / uniqueWords 
                : 0;

            // Calculate total mastered translations (estimate based on unique word mastery)
            const masteryRatio = uniqueWords > 0 ? masteredUniqueWords / uniqueWords : 0;
            const totalMasteredTranslations = Math.round(totalTranslations * masteryRatio);

            // Update streak first to ensure current data
            await StreakService.updateStreak(userId);

            // Get user profile with correct table name
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('streak')
                .eq('user_id', userId)
                .single();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
            }

            return {
                uniqueWords,                    // Count of unique words (34)
                totalTranslations,              // Count of word-language pairs (120)
                totalWords: uniqueWords,        // For backwards compatibility
                masteredWords: masteredUniqueWords,     // Unique words mastered
                totalMasteredTranslations,      // Estimated total translations mastered
                averageProficiency: Math.round(averageProficiency),
                currentStreak: profile?.streak || 0
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    /**
     * Update user progress on login (streak, achievements, XP)
     */
    private async updateUserProgressOnLogin(userId: string): Promise<void> {
        try {
            // Update streak and check if it increased
            const { newStreak, streakIncreased } = await StreakService.updateStreak(userId);
            
            // Award streak XP if streak increased
            if (streakIncreased) {
                await LevelingService.awardXP(userId, 'DAILY_STREAK');
                
                // Award first login bonus if this is their first login
                if (newStreak === 1) {
                    await LevelingService.awardXP(userId, 'FIRST_LOGIN');
                }
            }

            // Check for new achievements
            await AchievementService.checkAndAwardAchievements(userId);
        } catch (error) {
            console.error('Error updating user progress on login:', error);
        }
    }

    /**
     * Award XP for completing a session
     */
    private async awardSessionXP(): Promise<void> {
        if (!this.currentSession) return;

        try {
            // Award quiz completion XP
            await LevelingService.awardXP(
                this.currentSession.user_id, 
                'QUIZ_COMPLETED', 
                this.currentSession.id
            );

            // Award perfect quiz bonus if applicable
            const totalQuestions = 10; // Default quiz length
            if (this.currentSession.words_learned === totalQuestions) {
                await LevelingService.awardXP(
                    this.currentSession.user_id, 
                    'PERFECT_QUIZ', 
                    this.currentSession.id
                );
            }
        } catch (error) {
            console.error('Error awarding session XP:', error);
        }
    }

    /**
     * Award XP for word proficiency milestones
     */
    async awardProficiencyXP(userId: string, proficiency: number): Promise<void> {
        try {
            // Award XP for reaching certain proficiency levels
            if (proficiency >= 100) {
                await LevelingService.awardXP(userId, 'PROFICIENCY_MILESTONE');
            }
            
            // Check for achievements after proficiency update
            await AchievementService.checkAndAwardAchievements(userId);
        } catch (error) {
            console.error('Error awarding proficiency XP:', error);
        }
    }

    /**
     * Get comprehensive user progress data
     */
    async getUserProgress(userId: string) {
        try {
            const [levelInfo, achievements, stats] = await Promise.all([
                LevelingService.getLevelInfo(userId),
                AchievementService.getUserAchievements(userId),
                this.getUserStats(userId)
            ]);

            return {
                level: levelInfo,
                achievements,
                stats,
                todaysXP: await LevelingService.getTodaysXP(userId)
            };
        } catch (error) {
            console.error('Error getting user progress:', error);
            return null;
        }
    }
}

export default new SessionService();