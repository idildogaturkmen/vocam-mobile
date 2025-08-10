import { supabase } from '../../database/config';
import { StreakService } from './StreakService';
import { LevelingService } from './LevelingService';
import { AchievementService } from './AchievementService';
import { CacheKeys, CACHE_CONFIG } from './CacheService';
import { debugUtils } from '../utils/DebuggingUtils';

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
    private cache: Map<string, { data: any; timestamp: number; expiresIn: number }> = new Map();
    private loginProcessed: Set<string> = new Set(); // Track processed logins to prevent duplicates

    // Cache helper methods
    private getFromCache<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > entry.expiresIn;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    private setCache<T>(key: string, data: T, expiresIn: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn
        });
    }

    private invalidateCache(keyPattern: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(keyPattern)) {
                this.cache.delete(key);
            }
        }
    }

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
     * Get user statistics with caching
     */
    async getUserStats(userId: string, forceRefresh = false) {
        const cacheKey = CacheKeys.userStats(userId);
        
        // Return cached data if available and not forcing refresh
        if (!forceRefresh) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }
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

            const stats = {
                uniqueWords,                    // Count of unique words (34)
                totalTranslations,              // Count of word-language pairs (120)
                totalWords: uniqueWords,        // For backwards compatibility
                masteredWords: masteredUniqueWords,     // Unique words mastered
                totalMasteredTranslations,      // Estimated total translations mastered
                averageProficiency: Math.round(averageProficiency),
                currentStreak: profile?.streak || 0
            };
            
            // Cache the result
            this.setCache(cacheKey, stats, CACHE_CONFIG.USER_STATS);
            return stats;
        } catch (error) {
            console.error('Error getting user stats:', error);
            // Try to return cached data on error
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.warn('Returning cached user stats due to error');
                return cached;
            }
            return null;
        }
    }

    /**
     * Update user progress on login (streak, achievements, XP) - with deduplication
     */
    private async updateUserProgressOnLogin(userId: string): Promise<void> {
        try {
            // Create a unique key for today's login to prevent duplicates
            const today = new Date().toDateString();
            const loginKey = `${userId}_${today}`;
            
            // Skip if we've already processed this user's login today
            if (this.loginProcessed.has(loginKey)) {
                console.log('[SessionService] Login already processed today for user:', userId);
                return;
            }
            
            // Track this operation for debugging
            if (!debugUtils.trackLoginProcess(userId)) {
                console.warn('[SessionService] Potential duplicate login processing detected');
                return;
            }
            
            console.log('[SessionService] Processing login for user:', userId);
            
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

            // Check for new achievements and invalidate related caches
            await AchievementService.checkAndAwardAchievements(userId);
            
            // Mark this login as processed
            this.loginProcessed.add(loginKey);
            
            // Invalidate caches that might be affected by progress updates
            this.invalidateCache(userId);
            
            // Clean up old login tracking entries (keep only last 7 days)
            this.cleanupOldLoginTracking();
        } catch (error) {
            console.error('Error updating user progress on login:', error);
        }
    }
    
    /**
     * Clean up old login tracking entries to prevent memory leaks
     */
    private cleanupOldLoginTracking(): void {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        for (const loginKey of this.loginProcessed) {
            const datePart = loginKey.split('_').slice(1).join('_'); // Get date part after userId
            const loginDate = new Date(datePart);
            
            if (loginDate < sevenDaysAgo) {
                this.loginProcessed.delete(loginKey);
            }
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
            
            // Check for achievements after proficiency update and invalidate caches
            await AchievementService.checkAndAwardAchievements(userId);
            
            // Invalidate user stats cache as proficiency affects stats
            this.invalidateCache(userId);
        } catch (error) {
            console.error('Error awarding proficiency XP:', error);
        }
    }

    /**
     * Get comprehensive user progress data with caching
     */
    async getUserProgress(userId: string, forceRefresh = false) {
        const cacheKey = `userProgress_${userId}`;
        
        // Return cached data if available and not forcing refresh
        if (!forceRefresh) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            const [levelInfo, achievements, stats] = await Promise.all([
                LevelingService.getLevelInfo(userId),
                AchievementService.getAllAchievementsWithProgress(userId),
                this.getUserStats(userId)
            ]);

            const progress = {
                level: levelInfo,
                achievements,
                stats,
                todaysXP: await LevelingService.getTodaysXP(userId)
            };
            
            // Cache the result
            this.setCache(cacheKey, progress, CACHE_CONFIG.PROFILE);
            return progress;
        } catch (error) {
            console.error('Error getting user progress:', error);
            // Try to return cached data on error
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.warn('Returning cached user progress due to error');
                return cached;
            }
            return null;
        }
    }
}

export default new SessionService();