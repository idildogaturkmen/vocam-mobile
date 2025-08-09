import { supabase } from '../../database/config';

// Enable detailed logging for debugging
const DEBUG = true;
const log = (message: string, ...args: any[]) => {
    if (DEBUG) console.log(`[UserProgressService] ${message}`, ...args);
};
const logError = (message: string, error: any) => {
    console.error(`[UserProgressService] ${message}`, error);
};

export interface UserProfile {
    user_id: string;
    username: string;
    email: string;
    level: number;
    exp: number;
    total_xp: number;
    streak: number;
    last_login: string;
    created_at: string;
}

export interface LevelInfo {
    currentLevel: number;
    currentXP: number;
    xpForNextLevel: number;
    xpForCurrentLevel: number;
    progressToNextLevel: number;
    totalXP: number;
}

export interface XPTransaction {
    amount: number;
    source: string;
    description: string;
    session_id?: string;
}

export interface StreakInfo {
    currentStreak: number;
    streakIncreased: boolean;
    isNewRecord: boolean;
}

export interface Achievement {
    slug: string;
    title: string;
    description: string;
    badge_path: string;
    unlocked_at?: string;
}

/**
 * Central service for managing all user progress data
 * Coordinates XP, levels, streaks, and achievements
 */
export class UserProgressService {
    
    // XP Values for different actions
    private static readonly XP_REWARDS = {
        WORD_LEARNED: 10,
        QUIZ_COMPLETED: 25,
        PERFECT_QUIZ: 50,
        DAILY_STREAK: 15,
        FIRST_LOGIN: 20,
        ACHIEVEMENT_UNLOCKED: 30,
        PROFICIENCY_MILESTONE: 40,
        PRACTICE_SESSION_BASE: 10, // Per correct answer
        PRACTICE_SESSION_BONUS_10: 20, // 10 question bonus
        PRACTICE_SESSION_BONUS_20: 100, // 20 question bonus
        LEVEL_UP_BONUS: 50, // Bonus for leveling up
    };

    /**
     * Calculate XP required for a specific level
     */
    private static getXPRequiredForLevel(level: number): number {
        if (level <= 1) return 0;
        return Math.floor(100 * Math.pow(level - 1, 1.5));
    }

    /**
     * Calculate total XP required to reach a level
     */
    private static getTotalXPForLevel(level: number): number {
        let totalXP = 0;
        for (let i = 1; i < level; i++) {
            totalXP += this.getXPRequiredForLevel(i + 1);
        }
        return totalXP;
    }

    /**
     * Calculate level from total XP
     */
    private static getLevelFromXP(totalXP: number): number {
        let level = 1;
        let xpUsed = 0;
        
        while (xpUsed <= totalXP) {
            const xpForNextLevel = this.getXPRequiredForLevel(level + 1);
            if (xpUsed + xpForNextLevel > totalXP) {
                break;
            }
            xpUsed += xpForNextLevel;
            level++;
        }
        
        return level;
    }

    /**
     * Get user's current level information
     */
    static async getLevelInfo(userId: string): Promise<LevelInfo | null> {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('total_xp')
                .eq('user_id', userId)
                .single();

            if (error || !profile) {
                console.error('Error fetching profile for level info:', error);
                return null;
            }

            const totalXP = profile.total_xp || 0;
            const currentLevel = this.getLevelFromXP(totalXP);
            const xpForCurrentLevel = this.getTotalXPForLevel(currentLevel);
            const xpForNextLevel = this.getXPRequiredForLevel(currentLevel + 1);
            const currentXP = totalXP - xpForCurrentLevel;
            const progressToNextLevel = xpForNextLevel > 0 ? (currentXP / xpForNextLevel) * 100 : 100;

            return {
                currentLevel,
                currentXP,
                xpForNextLevel,
                xpForCurrentLevel,
                progressToNextLevel,
                totalXP
            };
        } catch (error) {
            console.error('Error in getLevelInfo:', error);
            return null;
        }
    }

    /**
     * Award XP and update level/profile atomically
     */
    static async awardXP(userId: string, transaction: XPTransaction): Promise<{
        xpAwarded: number;
        leveledUp: boolean;
        newLevel: number;
        levelInfo: LevelInfo | null;
    } | null> {
        try {
            log(`Awarding ${transaction.amount} XP to user ${userId} for ${transaction.source}`);

            // Get current profile data
            const { data: currentProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('total_xp, level, exp')
                .eq('user_id', userId)
                .single();

            if (fetchError) {
                logError('Error fetching current profile:', fetchError);
                return null;
            }

            const currentTotalXP = currentProfile?.total_xp || 0;
            const currentLevel = currentProfile?.level || 1;
            const newTotalXP = currentTotalXP + transaction.amount;
            const newLevel = this.getLevelFromXP(newTotalXP);
            const leveledUp = newLevel > currentLevel;

            log(`XP: ${currentTotalXP} → ${newTotalXP}, Level: ${currentLevel} → ${newLevel}, Leveled up: ${leveledUp}`);

            // Record XP transaction first
            const { error: xpError } = await supabase
                .from('user_xp')
                .insert({
                    user_id: userId,
                    xp_earned: transaction.amount,
                    source: transaction.source,
                    session_id: transaction.session_id || null
                });

            if (xpError) {
                logError('Error recording XP transaction:', xpError);
                return null;
            }

            // Calculate XP within current level
            const xpForCurrentLevel = this.getTotalXPForLevel(newLevel);
            const currentXPInLevel = Math.max(0, newTotalXP - xpForCurrentLevel);

            // Update profile with new totals (database trigger will also update exp and level)
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    total_xp: newTotalXP,
                    level: newLevel,
                    exp: currentXPInLevel
                })
                .eq('user_id', userId);

            if (updateError) {
                logError('Error updating profile:', updateError);
                return null;
            }

            log(`Profile updated successfully. New exp in level: ${currentXPInLevel}`);

            // If leveled up, check for level achievements and award bonus
            if (leveledUp) {
                log(`User leveled up! Checking level achievements for level ${newLevel}`);
                await this.checkLevelAchievements(userId, newLevel);
                
                // Award level up bonus (separate transaction to avoid infinite recursion)
                await supabase
                    .from('user_xp')
                    .insert({
                        user_id: userId,
                        xp_earned: this.XP_REWARDS.LEVEL_UP_BONUS,
                        source: 'level_up_bonus',
                        session_id: transaction.session_id || null
                    });

                // Update total_xp with bonus
                await supabase
                    .from('profiles')
                    .update({ total_xp: newTotalXP + this.XP_REWARDS.LEVEL_UP_BONUS })
                    .eq('user_id', userId);
            }

            return {
                xpAwarded: transaction.amount,
                leveledUp,
                newLevel,
                levelInfo: await this.getLevelInfo(userId)
            };
        } catch (error) {
            logError('Error in awardXP:', error);
            return null;
        }
    }

    /**
     * Update user's daily streak
     */
    static async updateStreak(userId: string): Promise<StreakInfo> {
        try {
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('last_login, streak')
                .eq('user_id', userId)
                .single();

            if (fetchError) {
                logError('Error fetching profile for streak update:', fetchError);
                return { currentStreak: 0, streakIncreased: false, isNewRecord: false };
            }

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastLogin = profile?.last_login ? new Date(profile.last_login) : null;
            const lastLoginDate = lastLogin ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()) : null;
            
            let currentStreak = profile?.streak || 0;
            let streakIncreased = false;
            let isNewRecord = false;

            if (!lastLoginDate) {
                // First time login
                currentStreak = 1;
                streakIncreased = true;
                isNewRecord = true;
            } else {
                const daysDifference = Math.floor((today.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDifference === 0) {
                    // Same day - no change to streak
                    streakIncreased = false;
                } else if (daysDifference === 1) {
                    // Next day - increment streak
                    const previousStreak = currentStreak;
                    currentStreak += 1;
                    streakIncreased = true;
                    isNewRecord = currentStreak > previousStreak;
                } else {
                    // Missed days - reset streak to 1
                    const previousStreak = currentStreak;
                    currentStreak = 1;
                    streakIncreased = previousStreak === 0; // Only increased if coming from 0
                    isNewRecord = false;
                }
            }

            // Update profile with new streak and last login
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    last_login: now.toISOString(),
                    streak: currentStreak
                })
                .eq('user_id', userId);

            if (updateError) {
                logError('Error updating streak:', updateError);
                return { currentStreak: profile?.streak || 0, streakIncreased: false, isNewRecord: false };
            }

            // Award streak XP if increased
            if (streakIncreased) {
                await this.awardXP(userId, {
                    amount: this.XP_REWARDS.DAILY_STREAK,
                    source: 'daily_streak',
                    description: `Daily login streak day ${currentStreak}`
                });

                // Check for streak achievements
                await this.checkStreakAchievements(userId, currentStreak);
            }

            return { currentStreak, streakIncreased, isNewRecord };
        } catch (error) {
            logError('Error in updateStreak:', error);
            return { currentStreak: 0, streakIncreased: false, isNewRecord: false };
        }
    }

    /**
     * Complete a practice session and award appropriate XP
     */
    static async completePracticeSession(
        userId: string, 
        sessionId: string, 
        correctAnswers: number, 
        totalQuestions: number
    ): Promise<{ totalXP: number; leveledUp: boolean; newLevel: number }> {
        try {
            // Calculate XP
            const baseXP = correctAnswers * this.XP_REWARDS.PRACTICE_SESSION_BASE;
            let bonusXP = 0;
            
            if (totalQuestions === 10) {
                bonusXP = this.XP_REWARDS.PRACTICE_SESSION_BONUS_10;
            } else if (totalQuestions === 20) {
                bonusXP = this.XP_REWARDS.PRACTICE_SESSION_BONUS_20;
            }

            const totalXP = baseXP + bonusXP;

            // Award practice session XP
            const result = await this.awardXP(userId, {
                amount: totalXP,
                source: 'practice_session',
                description: `Practice session: ${correctAnswers}/${totalQuestions} correct`,
                session_id: sessionId
            });

            // Award perfect quiz bonus if applicable
            if (correctAnswers === totalQuestions) {
                await this.awardXP(userId, {
                    amount: this.XP_REWARDS.PERFECT_QUIZ,
                    source: 'perfect_quiz',
                    description: 'Perfect practice session!',
                    session_id: sessionId
                });
            }

            // Update session record
            await supabase
                .from('quiz_sessions')
                .update({
                    score: correctAnswers,
                    total_questions: totalQuestions
                })
                .eq('id', sessionId);

            // Check achievements after session
            await this.checkSessionAchievements(userId, correctAnswers, totalQuestions);

            return {
                totalXP: totalXP + (correctAnswers === totalQuestions ? this.XP_REWARDS.PERFECT_QUIZ : 0),
                leveledUp: result?.leveledUp || false,
                newLevel: result?.newLevel || 1
            };
        } catch (error) {
            console.error('Error completing practice session:', error);
            return { totalXP: 0, leveledUp: false, newLevel: 1 };
        }
    }

    /**
     * Award XP for learning a new word
     */
    static async awardWordLearningXP(userId: string, wordId: string): Promise<void> {
        await this.awardXP(userId, {
            amount: this.XP_REWARDS.WORD_LEARNED,
            source: 'word_learned',
            description: 'Learned a new word'
        });

        // Check word-based achievements
        await this.checkWordAchievements(userId);
    }

    /**
     * Check and award level-based achievements
     */
    private static async checkLevelAchievements(userId: string, level: number): Promise<void> {
        const levelAchievements = [
            { level: 5, slug: 'level_5', title: 'Rising Star', description: 'Reached level 5' },
            { level: 10, slug: 'level_10', title: 'Dedicated Learner', description: 'Reached level 10' },
            { level: 25, slug: 'level_25', title: 'Expert', description: 'Reached level 25' },
            { level: 50, slug: 'level_50', title: 'Master', description: 'Reached level 50' },
            { level: 100, slug: 'level_100', title: 'Legend', description: 'Reached level 100' }
        ];

        for (const achievement of levelAchievements) {
            if (level >= achievement.level) {
                await this.unlockAchievement(userId, achievement.slug);
            }
        }
    }

    /**
     * Check and award streak-based achievements
     */
    private static async checkStreakAchievements(userId: string, streak: number): Promise<void> {
        const streakAchievements = [
            { streak: 3, slug: 'streak_3', title: 'Getting Started', description: 'Maintained a 3-day streak' },
            { streak: 7, slug: 'streak_7', title: 'Week Warrior', description: 'Maintained a 7-day streak' },
            { streak: 14, slug: 'streak_14', title: 'Two Week Champion', description: 'Maintained a 14-day streak' },
            { streak: 30, slug: 'streak_30', title: 'Monthly Master', description: 'Maintained a 30-day streak' },
            { streak: 100, slug: 'streak_100', title: 'Centurion', description: 'Maintained a 100-day streak' }
        ];

        for (const achievement of streakAchievements) {
            if (streak >= achievement.streak) {
                await this.unlockAchievement(userId, achievement.slug);
            }
        }
    }

    /**
     * Check and award session-based achievements
     */
    private static async checkSessionAchievements(userId: string, correctAnswers: number, totalQuestions: number): Promise<void> {
        // Check for perfect session achievements
        if (correctAnswers === totalQuestions) {
            if (totalQuestions === 20) {
                await this.unlockAchievement(userId, 'perfect_session_20');
            } else if (totalQuestions === 10) {
                await this.unlockAchievement(userId, 'perfect_session_10');
            }
        }

        // Check total sessions milestone
        const { data: sessions } = await supabase
            .from('quiz_sessions')
            .select('id')
            .eq('user_id', userId);

        const sessionCount = sessions?.length || 0;
        
        const sessionMilestones = [
            { count: 10, slug: 'sessions_10' },
            { count: 50, slug: 'sessions_50' },
            { count: 100, slug: 'sessions_100' }
        ];

        for (const milestone of sessionMilestones) {
            if (sessionCount >= milestone.count) {
                await this.unlockAchievement(userId, milestone.slug);
            }
        }
    }

    /**
     * Check and award word-based achievements
     */
    private static async checkWordAchievements(userId: string): Promise<void> {
        const { data: userWords } = await supabase
            .from('user_words')
            .select('proficiency')
            .eq('user_id', userId);

        const totalWords = userWords?.length || 0;
        const masteredWords = userWords?.filter(w => w.proficiency >= 80).length || 0;

        // Word count achievements
        const wordMilestones = [
            { count: 10, slug: 'words_10' },
            { count: 50, slug: 'words_50' },
            { count: 100, slug: 'words_100' },
            { count: 500, slug: 'words_500' }
        ];

        for (const milestone of wordMilestones) {
            if (totalWords >= milestone.count) {
                await this.unlockAchievement(userId, milestone.slug);
            }
        }

        // Mastery achievements
        const masteryMilestones = [
            { count: 10, slug: 'mastery_10' },
            { count: 50, slug: 'mastery_50' },
            { count: 100, slug: 'mastery_100' }
        ];

        for (const milestone of masteryMilestones) {
            if (masteredWords >= milestone.count) {
                await this.unlockAchievement(userId, milestone.slug);
            }
        }
    }

    /**
     * Unlock an achievement for a user
     */
    private static async unlockAchievement(userId: string, achievementSlug: string): Promise<void> {
        try {
            log(`Checking achievement unlock: ${achievementSlug} for user ${userId}`);

            // Check if already unlocked
            const { data: existing, error: checkError } = await supabase
                .from('user_achievements')
                .select('id')
                .eq('user_id', userId)
                .eq('achievement_slug', achievementSlug)
                .maybeSingle(); // Use maybeSingle instead of single to avoid error when not found

            if (checkError) {
                logError('Error checking existing achievement:', checkError);
                return;
            }

            if (existing) {
                log(`Achievement ${achievementSlug} already unlocked`);
                return; // Already unlocked
            }

            // First ensure the achievement exists in the achievements table
            const { data: achievement, error: achievementError } = await supabase
                .from('achievements')
                .select('slug')
                .eq('slug', achievementSlug)
                .maybeSingle();

            if (achievementError) {
                logError('Error checking achievement existence:', achievementError);
                return;
            }

            if (!achievement) {
                logError(`Achievement ${achievementSlug} does not exist in database`, null);
                return;
            }

            // Unlock the achievement
            const { error } = await supabase
                .from('user_achievements')
                .insert({
                    user_id: userId,
                    achievement_slug: achievementSlug,
                    achieved_at: new Date().toISOString()
                });

            if (error) {
                logError('Error unlocking achievement:', error);
                return;
            }

            log(`🏆 Achievement unlocked: ${achievementSlug}`);

            // Award achievement XP (but don't trigger another achievement check to avoid recursion)
            await supabase
                .from('user_xp')
                .insert({
                    user_id: userId,
                    xp_earned: this.XP_REWARDS.ACHIEVEMENT_UNLOCKED,
                    source: 'achievement',
                    session_id: null
                });

            // Update profile total_xp
            const { data: profile } = await supabase
                .from('profiles')
                .select('total_xp')
                .eq('user_id', userId)
                .single();

            if (profile) {
                await supabase
                    .from('profiles')
                    .update({ total_xp: (profile.total_xp || 0) + this.XP_REWARDS.ACHIEVEMENT_UNLOCKED })
                    .eq('user_id', userId);
            }

        } catch (error) {
            logError('Error in unlockAchievement:', error);
        }
    }

    /**
     * Get user's achievements
     */
    static async getUserAchievements(userId: string): Promise<Achievement[]> {
        try {
            const { data: userAchievements, error } = await supabase
                .from('user_achievements')
                .select(`
                    achieved_at,
                    achievement_slug,
                    achievements (
                        slug,
                        title,
                        description,
                        badge_path
                    )
                `)
                .eq('user_id', userId)
                .order('achieved_at', { ascending: false });

            if (error) {
                logError('Error fetching user achievements:', error);
                return [];
            }

            return userAchievements?.map((ua: any) => ({
                slug: ua.achievements?.slug || ua.achievement_slug,
                title: ua.achievements?.title || 'Unknown Achievement',
                description: ua.achievements?.description || 'Achievement unlocked',
                badge_path: ua.achievements?.badge_path || '/badges/default.png',
                unlocked_at: ua.achieved_at
            })) || [];
        } catch (error) {
            logError('Error in getUserAchievements:', error);
            return [];
        }
    }

    /**
     * Get user's complete progress data
     */
    static async getUserProgress(userId: string): Promise<{
        profile: UserProfile | null;
        levelInfo: LevelInfo | null;
        achievements: Achievement[];
        todaysXP: number;
        currentStreak: number;
    }> {
        try {
            const [profileResult, levelInfo, achievements] = await Promise.all([
                supabase.from('profiles').select('*').eq('user_id', userId).single(),
                this.getLevelInfo(userId),
                this.getUserAchievements(userId)
            ]);

            // Get today's XP
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const { data: todaysXPData } = await supabase
                .from('user_xp')
                .select('xp_earned')
                .eq('user_id', userId)
                .gte('earned_at', today.toISOString());

            const todaysXP = todaysXPData?.reduce((sum, xp) => sum + xp.xp_earned, 0) || 0;

            return {
                profile: profileResult.data,
                levelInfo,
                achievements,
                todaysXP,
                currentStreak: profileResult.data?.streak || 0
            };
        } catch (error) {
            console.error('Error getting user progress:', error);
            return {
                profile: null,
                levelInfo: null,
                achievements: [],
                todaysXP: 0,
                currentStreak: 0
            };
        }
    }

    /**
     * Initialize user progress on first login
     */
    static async initializeUser(userId: string): Promise<void> {
        try {
            log(`Initializing user progress for ${userId}`);

            // First, ensure user profile exists with default values
            const { data: existingProfile, error: profileCheckError } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('user_id', userId)
                .maybeSingle();

            if (profileCheckError) {
                logError('Error checking existing profile:', profileCheckError);
                return;
            }

            if (!existingProfile) {
                logError('Profile does not exist for user - this should be created during signup', null);
                return;
            }

            // Update streak (this will award first login XP)
            const streakInfo = await this.updateStreak(userId);
            log(`Streak initialized: ${streakInfo.currentStreak}`);
            
            // Award welcome achievement
            await this.unlockAchievement(userId, 'first_login');
            
            // Award first login XP
            await this.awardXP(userId, {
                amount: this.XP_REWARDS.FIRST_LOGIN,
                source: 'first_login',
                description: 'Welcome bonus'
            });

            // Check if user has any words and award first word achievement if applicable
            const { data: userWords } = await supabase
                .from('user_words')
                .select('id')
                .eq('user_id', userId)
                .limit(1);

            if (userWords && userWords.length > 0) {
                await this.unlockAchievement(userId, 'first_word');
            }
            
            log(`User progress initialized successfully for ${userId}`);
        } catch (error) {
            logError('Error initializing user:', error);
        }
    }

    /**
     * Comprehensive method to recalculate and fix user progress data
     * This should be used to fix any inconsistencies
     */
    static async recalculateUserProgress(userId: string): Promise<{
        before: any;
        after: any;
        changes: string[];
    }> {
        try {
            log(`Recalculating progress for user ${userId}`);
            const changes: string[] = [];

            // Get current profile state
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (profileError) {
                logError('Error fetching profile for recalculation:', profileError);
                return { before: null, after: null, changes: [] };
            }

            const before = { ...profile };

            // Recalculate total XP from user_xp table
            const { data: xpRecords } = await supabase
                .from('user_xp')
                .select('xp_earned')
                .eq('user_id', userId);

            const calculatedTotalXP = xpRecords?.reduce((sum, record) => sum + record.xp_earned, 0) || 0;
            
            // Recalculate level from total XP
            const calculatedLevel = this.getLevelFromXP(calculatedTotalXP);
            
            // Calculate XP within current level
            const xpForCurrentLevel = this.getTotalXPForLevel(calculatedLevel);
            const calculatedExp = Math.max(0, calculatedTotalXP - xpForCurrentLevel);

            // Check if updates are needed
            const updates: any = {};
            
            if (profile.total_xp !== calculatedTotalXP) {
                updates.total_xp = calculatedTotalXP;
                changes.push(`Total XP: ${profile.total_xp} → ${calculatedTotalXP}`);
            }
            
            if (profile.level !== calculatedLevel) {
                updates.level = calculatedLevel;
                changes.push(`Level: ${profile.level} → ${calculatedLevel}`);
            }
            
            if (profile.exp !== calculatedExp) {
                updates.exp = calculatedExp;
                changes.push(`Exp in level: ${profile.exp} → ${calculatedExp}`);
            }

            // Apply updates if needed
            if (Object.keys(updates).length > 0) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update(updates)
                    .eq('user_id', userId);

                if (updateError) {
                    logError('Error applying profile updates:', updateError);
                }
            }

            // Get updated profile
            const { data: updatedProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            // Check all achievements should be unlocked
            await this.checkAllAchievements(userId);

            log(`Progress recalculation complete. Changes: ${changes.length}`);
            
            return {
                before,
                after: updatedProfile,
                changes
            };
        } catch (error) {
            logError('Error in recalculateUserProgress:', error);
            return { before: null, after: null, changes: [] };
        }
    }

    /**
     * Check all achievements for a user (comprehensive check)
     */
    static async checkAllAchievements(userId: string): Promise<string[]> {
        try {
            const newAchievements: string[] = [];
            
            // Get user stats
            const { data: profile } = await supabase
                .from('profiles')
                .select('level, total_xp, streak')
                .eq('user_id', userId)
                .single();

            if (!profile) return [];

            // Get user words stats
            const { data: userWords } = await supabase
                .from('user_words')
                .select('proficiency')
                .eq('user_id', userId);

            // Get quiz stats
            const { data: quizSessions } = await supabase
                .from('quiz_sessions')
                .select('score, total_questions, percentage_score')
                .eq('user_id', userId);

            const wordsLearned = userWords?.length || 0;
            const masteredWords = userWords?.filter(w => w.proficiency >= 80).length || 0;
            const totalSessions = quizSessions?.length || 0;
            const perfectSessions = quizSessions?.filter(s => s.score === s.total_questions).length || 0;

            // Define all possible achievements with their conditions
            const achievementChecks = [
                { slug: 'first_login', condition: true },
                { slug: 'first_word', condition: wordsLearned >= 1 },
                { slug: 'streak_3', condition: profile.streak >= 3 },
                { slug: 'streak_7', condition: profile.streak >= 7 },
                { slug: 'streak_14', condition: profile.streak >= 14 },
                { slug: 'streak_30', condition: profile.streak >= 30 },
                { slug: 'streak_100', condition: profile.streak >= 100 },
                { slug: 'level_5', condition: profile.level >= 5 },
                { slug: 'level_10', condition: profile.level >= 10 },
                { slug: 'level_25', condition: profile.level >= 25 },
                { slug: 'level_50', condition: profile.level >= 50 },
                { slug: 'level_100', condition: profile.level >= 100 },
                { slug: 'words_10', condition: wordsLearned >= 10 },
                { slug: 'words_50', condition: wordsLearned >= 50 },
                { slug: 'words_100', condition: wordsLearned >= 100 },
                { slug: 'words_500', condition: wordsLearned >= 500 },
                { slug: 'mastery_10', condition: masteredWords >= 10 },
                { slug: 'mastery_50', condition: masteredWords >= 50 },
                { slug: 'mastery_100', condition: masteredWords >= 100 },
                { slug: 'sessions_10', condition: totalSessions >= 10 },
                { slug: 'sessions_50', condition: totalSessions >= 50 },
                { slug: 'sessions_100', condition: totalSessions >= 100 },
                { slug: 'perfect_session_10', condition: perfectSessions >= 1 },
                { slug: 'perfect_session_20', condition: perfectSessions >= 1 },
                { slug: 'xp_1000', condition: profile.total_xp >= 1000 },
                { slug: 'xp_5000', condition: profile.total_xp >= 5000 },
            ];

            // Check each achievement
            for (const check of achievementChecks) {
                if (check.condition) {
                    // Check if user already has this achievement
                    const { data: existing } = await supabase
                        .from('user_achievements')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('achievement_slug', check.slug)
                        .maybeSingle();

                    if (!existing) {
                        await this.unlockAchievement(userId, check.slug);
                        newAchievements.push(check.slug);
                    }
                }
            }

            return newAchievements;
        } catch (error) {
            logError('Error in checkAllAchievements:', error);
            return [];
        }
    }
}