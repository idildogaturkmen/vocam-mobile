import { supabase } from '../../database/config';

export interface LevelInfo {
    currentLevel: number;
    currentXP: number;
    xpForNextLevel: number;
    xpForCurrentLevel: number;
    progressToNextLevel: number;
    totalXP: number;
}

export interface XPReward {
    source: string;
    amount: number;
    description: string;
}

export class LevelingService {
    // XP rewards for different actions
    static readonly XP_REWARDS: Record<string, XPReward> = {
        WORD_LEARNED: { source: 'word_learned', amount: 10, description: 'Learned a new word' },
        QUIZ_COMPLETED: { source: 'quiz_completed', amount: 25, description: 'Completed a quiz' },
        DAILY_STREAK: { source: 'daily_streak', amount: 15, description: 'Daily login streak' },
        PERFECT_QUIZ: { source: 'perfect_quiz', amount: 50, description: 'Perfect quiz score' },
        FIRST_LOGIN: { source: 'first_login', amount: 20, description: 'Welcome bonus' },
        ACHIEVEMENT_UNLOCKED: { source: 'achievement', amount: 30, description: 'Achievement unlocked' },
        PROFICIENCY_MILESTONE: { source: 'proficiency_milestone', amount: 40, description: 'Word proficiency milestone' }
    };

    /**
     * Calculate XP required for a given level
     * Uses exponential growth: XP = 100 * (level^1.5)
     */
    static getXPRequiredForLevel(level: number): number {
        if (level <= 1) return 0;
        return Math.floor(100 * Math.pow(level - 1, 1.5));
    }

    /**
     * Calculate total XP required to reach a level
     */
    static getTotalXPForLevel(level: number): number {
        let totalXP = 0;
        for (let i = 1; i < level; i++) {
            totalXP += this.getXPRequiredForLevel(i + 1);
        }
        return totalXP;
    }

    /**
     * Calculate level from total XP
     */
    static getLevelFromXP(totalXP: number): number {
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
     * Get detailed level information for a user
     */
    static async getLevelInfo(userId: string): Promise<LevelInfo | null> {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('total_xp, level, exp')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching user level info:', error);
                return null;
            }

            const totalXP = profile?.total_xp || 0;
            const currentLevel = this.getLevelFromXP(totalXP);
            
            // Calculate XP progress within current level
            const xpForCurrentLevel = this.getTotalXPForLevel(currentLevel);
            const xpForNextLevel = this.getTotalXPForLevel(currentLevel + 1);
            const currentXP = totalXP - xpForCurrentLevel;
            const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
            const progressToNextLevel = xpNeededForNext > 0 ? (currentXP / xpNeededForNext) * 100 : 100;

            return {
                currentLevel,
                currentXP,
                xpForNextLevel: xpNeededForNext,
                xpForCurrentLevel: xpForCurrentLevel,
                progressToNextLevel: Math.min(progressToNextLevel, 100),
                totalXP
            };
        } catch (error) {
            console.error('Error in getLevelInfo:', error);
            return null;
        }
    }

    /**
     * Award XP to a user and update their level
     */
    static async awardXP(
        userId: string, 
        xpRewardKey: keyof typeof LevelingService.XP_REWARDS, 
        sessionId?: string,
        multiplier: number = 1
    ): Promise<{ xpAwarded: number; leveledUp: boolean; newLevel: number } | null> {
        try {
            const reward = this.XP_REWARDS[xpRewardKey];
            if (!reward) {
                console.error('Invalid XP reward key:', xpRewardKey);
                return null;
            }

            const xpAwarded = Math.floor(reward.amount * multiplier);

            // Get current user profile
            const { data: currentProfile, error: profileError } = await supabase
                .from('profiles')
                .select('total_xp, level')
                .eq('user_id', userId)
                .single();

            if (profileError) {
                console.error('Error fetching current profile:', profileError);
                return null;
            }

            const currentTotalXP = currentProfile?.total_xp || 0;
            const currentLevel = currentProfile?.level || 1;
            const newTotalXP = currentTotalXP + xpAwarded;
            const newLevel = this.getLevelFromXP(newTotalXP);
            const leveledUp = newLevel > currentLevel;

            // Record XP transaction
            const { error: xpError } = await supabase
                .from('user_xp')
                .insert({
                    user_id: userId,
                    source: reward.source,
                    xp_earned: xpAwarded,
                    session_id: sessionId || null
                });

            if (xpError) {
                console.error('Error recording XP transaction:', xpError);
                return null;
            }

            // Update user profile with new XP and level
            const levelInfo = await this.getLevelInfo(userId);
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    total_xp: newTotalXP,
                    level: newLevel,
                    exp: levelInfo?.currentXP || 0 // Current XP within the level
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Error updating user profile:', updateError);
                return null;
            }

            return {
                xpAwarded,
                leveledUp,
                newLevel
            };
        } catch (error) {
            console.error('Error in awardXP:', error);
            return null;
        }
    }

    /**
     * Get user's XP history
     */
    static async getXPHistory(userId: string, limit: number = 20): Promise<any[]> {
        try {
            const { data: xpHistory, error } = await supabase
                .from('user_xp')
                .select('source, xp_earned, earned_at, session_id')
                .eq('user_id', userId)
                .order('earned_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching XP history:', error);
                return [];
            }

            return xpHistory || [];
        } catch (error) {
            console.error('Error in getXPHistory:', error);
            return [];
        }
    }

    /**
     * Get XP earned today
     */
    static async getTodaysXP(userId: string): Promise<number> {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { data: todaysXP, error } = await supabase
                .from('user_xp')
                .select('xp_earned')
                .eq('user_id', userId)
                .gte('earned_at', `${today}T00:00:00.000Z`)
                .lt('earned_at', `${today}T23:59:59.999Z`);

            if (error) {
                console.error('Error fetching today\'s XP:', error);
                return 0;
            }

            return todaysXP?.reduce((total, xp) => total + (xp.xp_earned || 0), 0) || 0;
        } catch (error) {
            console.error('Error in getTodaysXP:', error);
            return 0;
        }
    }

    /**
     * Get leaderboard data
     */
    static async getLeaderboard(limit: number = 10): Promise<any[]> {
        try {
            const { data: leaderboard, error } = await supabase
                .from('profiles')
                .select('username, level, total_xp, streak')
                .order('total_xp', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching leaderboard:', error);
                return [];
            }

            return leaderboard || [];
        } catch (error) {
            console.error('Error in getLeaderboard:', error);
            return [];
        }
    }
}