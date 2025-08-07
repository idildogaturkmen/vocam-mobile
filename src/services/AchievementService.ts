import { supabase } from '../../database/config';
import { LevelingService } from './LevelingService';

export interface Achievement {
    slug: string;
    title: string;
    description: string;
    badge_path: string;
    condition: (stats: UserStats) => boolean;
    xpReward: number;
}

export interface UserStats {
    totalXP: number;
    level: number;
    streak: number;
    wordsLearned: number;
    perfectQuizzes: number;
    totalQuizzes: number;
    daysActive: number;
    masteredWords: number;
    averageProficiency: number;
    maxStreak: number;
}

export class AchievementService {
    // Define all available achievements
    static readonly ACHIEVEMENTS: Achievement[] = [
        // Welcome achievements
        {
            slug: 'first_login',
            title: 'Welcome!',
            description: 'Completed your first login',
            badge_path: 'first_login',
            condition: () => true, // Always awarded on first login
            xpReward: 20
        },
        {
            slug: 'first_word',
            title: 'First Word',
            description: 'Learned your first word',
            badge_path: 'first_word',
            condition: (stats) => stats.wordsLearned >= 1,
            xpReward: 25
        },

        // Streak achievements
        {
            slug: 'streak_3',
            title: 'Getting Started',
            description: 'Maintained a 3-day streak',
            badge_path: 'streak_3',
            condition: (stats) => stats.streak >= 3,
            xpReward: 30
        },
        {
            slug: 'streak_7',
            title: 'Week Warrior',
            description: 'Maintained a 7-day streak',
            badge_path: 'streak_7',
            condition: (stats) => stats.streak >= 7,
            xpReward: 50
        },
        {
            slug: 'streak_14',
            title: 'Two Week Champion',
            description: 'Maintained a 14-day streak',
            badge_path: 'streak_14',
            condition: (stats) => stats.streak >= 14,
            xpReward: 75
        },
        {
            slug: 'streak_30',
            title: 'Monthly Master',
            description: 'Maintained a 30-day streak',
            badge_path: 'streak_30',
            condition: (stats) => stats.streak >= 30,
            xpReward: 100
        },
        {
            slug: 'streak_100',
            title: 'Centurion',
            description: 'Maintained a 100-day streak',
            badge_path: 'streak_100',
            condition: (stats) => stats.streak >= 100,
            xpReward: 200
        },

        // Level achievements
        {
            slug: 'level_5',
            title: 'Rising Star',
            description: 'Reached level 5',
            badge_path: 'level_5',
            condition: (stats) => stats.level >= 5,
            xpReward: 40
        },
        {
            slug: 'level_10',
            title: 'Expert',
            description: 'Reached level 10',
            badge_path: 'level_10',
            condition: (stats) => stats.level >= 10,
            xpReward: 60
        },
        {
            slug: 'level_25',
            title: 'Master',
            description: 'Reached level 25',
            badge_path: 'level_25',
            condition: (stats) => stats.level >= 25,
            xpReward: 100
        },
        {
            slug: 'level_50',
            title: 'Legend',
            description: 'Reached level 50',
            badge_path: 'level_50',
            condition: (stats) => stats.level >= 50,
            xpReward: 200
        },

        // Word learning achievements
        {
            slug: 'words_10',
            title: 'Vocabulary Builder',
            description: 'Learned 10 words',
            badge_path: 'words_10',
            condition: (stats) => stats.wordsLearned >= 10,
            xpReward: 35
        },
        {
            slug: 'words_50',
            title: 'Word Collector',
            description: 'Learned 50 words',
            badge_path: 'words_50',
            condition: (stats) => stats.wordsLearned >= 50,
            xpReward: 75
        },
        {
            slug: 'words_100',
            title: 'Wordsmith',
            description: 'Learned 100 words',
            badge_path: 'words_100',
            condition: (stats) => stats.wordsLearned >= 100,
            xpReward: 125
        },
        {
            slug: 'words_500',
            title: 'Vocabulary Master',
            description: 'Learned 500 words',
            badge_path: 'words_500',
            condition: (stats) => stats.wordsLearned >= 500,
            xpReward: 250
        },

        // Proficiency achievements
        {
            slug: 'first_mastery',
            title: 'First Mastery',
            description: 'Mastered your first word (100% proficiency)',
            badge_path: 'first_mastery',
            condition: (stats) => stats.masteredWords >= 1,
            xpReward: 40
        },
        {
            slug: 'mastery_10',
            title: 'Expert Learner',
            description: 'Mastered 10 words',
            badge_path: 'mastery_10',
            condition: (stats) => stats.masteredWords >= 10,
            xpReward: 80
        },
        {
            slug: 'average_80',
            title: 'Consistent Learner',
            description: 'Achieved 80% average proficiency',
            badge_path: 'average_80',
            condition: (stats) => stats.averageProficiency >= 80,
            xpReward: 70
        },

        // Quiz achievements
        {
            slug: 'perfect_quiz',
            title: 'Perfect Score',
            description: 'Got a perfect score on a quiz',
            badge_path: 'perfect_quiz',
            condition: (stats) => stats.perfectQuizzes >= 1,
            xpReward: 50
        },
        {
            slug: 'quiz_master',
            title: 'Quiz Master',
            description: 'Completed 25 quizzes',
            badge_path: 'quiz_master',
            condition: (stats) => stats.totalQuizzes >= 25,
            xpReward: 90
        },

        // XP achievements
        {
            slug: 'xp_1000',
            title: 'Thousand Club',
            description: 'Earned 1000 total XP',
            badge_path: 'xp_1000',
            condition: (stats) => stats.totalXP >= 1000,
            xpReward: 60
        },
        {
            slug: 'xp_5000',
            title: 'Experience Guru',
            description: 'Earned 5000 total XP',
            badge_path: 'xp_5000',
            condition: (stats) => stats.totalXP >= 5000,
            xpReward: 150
        }
    ];

    /**
     * Get user statistics for achievement checking
     */
    static async getUserStats(userId: string): Promise<UserStats | null> {
        try {
            // Get profile data
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('total_xp, level, streak')
                .eq('user_id', userId)
                .single();

            if (profileError) {
                console.error('Error fetching profile for achievements:', profileError);
                return null;
            }

            // Get user words data
            const { data: userWords, error: wordsError } = await supabase
                .from('user_words')
                .select('proficiency')
                .eq('user_id', userId);

            if (wordsError) {
                console.error('Error fetching user words for achievements:', wordsError);
            }

            // Get quiz data
            const { data: quizzes, error: quizzesError } = await supabase
                .from('quiz_sessions')
                .select('percentage_score, total_questions, score')
                .eq('user_id', userId);

            if (quizzesError) {
                console.error('Error fetching quiz data for achievements:', quizzesError);
            }

            const wordsLearned = userWords?.length || 0;
            const masteredWords = userWords?.filter(w => w.proficiency >= 100).length || 0;
            const averageProficiency = wordsLearned > 0 
                ? userWords!.reduce((sum, w) => sum + (w.proficiency || 0), 0) / wordsLearned 
                : 0;

            const perfectQuizzes = quizzes?.filter(q => 
                q.percentage_score === 100 || (q.score === q.total_questions && q.total_questions > 0)
            ).length || 0;

            return {
                totalXP: profile?.total_xp || 0,
                level: profile?.level || 1,
                streak: profile?.streak || 0,
                wordsLearned,
                perfectQuizzes,
                totalQuizzes: quizzes?.length || 0,
                daysActive: 1, // TODO: Calculate from login history
                masteredWords,
                averageProficiency: Math.round(averageProficiency),
                maxStreak: profile?.streak || 0 // TODO: Track max streak separately
            };
        } catch (error) {
            console.error('Error in getUserStats:', error);
            return null;
        }
    }

    /**
     * Check and award new achievements for a user
     */
    static async checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
        try {
            const stats = await this.getUserStats(userId);
            if (!stats) {
                return [];
            }

            // Get user's existing achievements
            const { data: existingAchievements, error: existingError } = await supabase
                .from('user_achievements')
                .select('achievement_slug')
                .eq('user_id', userId);

            if (existingError) {
                console.error('Error fetching existing achievements:', existingError);
                return [];
            }

            const existingSlugs = new Set(existingAchievements?.map(a => a.achievement_slug) || []);
            const newAchievements: Achievement[] = [];

            // Check each achievement
            for (const achievement of this.ACHIEVEMENTS) {
                if (!existingSlugs.has(achievement.slug) && achievement.condition(stats)) {
                    // Award the achievement
                    const awarded = await this.awardAchievement(userId, achievement);
                    if (awarded) {
                        newAchievements.push(achievement);
                    }
                }
            }

            return newAchievements;
        } catch (error) {
            console.error('Error in checkAndAwardAchievements:', error);
            return [];
        }
    }

    /**
     * Award a specific achievement to a user
     */
    static async awardAchievement(userId: string, achievement: Achievement): Promise<boolean> {
        try {
            // Insert the achievement
            const { error: insertError } = await supabase
                .from('user_achievements')
                .insert({
                    user_id: userId,
                    achievement_slug: achievement.slug
                });

            if (insertError) {
                console.error('Error awarding achievement:', insertError);
                return false;
            }

            // Award XP for the achievement
            await LevelingService.awardXP(userId, 'ACHIEVEMENT_UNLOCKED', undefined, achievement.xpReward / 30);

            return true;
        } catch (error) {
            console.error('Error in awardAchievement:', error);
            return false;
        }
    }

    /**
     * Get user's achievements with details
     */
    static async getUserAchievements(userId: string): Promise<any[]> {
        try {
            const { data: userAchievements, error } = await supabase
                .from('user_achievements')
                .select('achievement_slug, achieved_at')
                .eq('user_id', userId)
                .order('achieved_at', { ascending: false });

            if (error) {
                console.error('Error fetching user achievements:', error);
                return [];
            }

            return userAchievements?.map(ua => {
                const achievement = this.ACHIEVEMENTS.find(a => a.slug === ua.achievement_slug);
                return {
                    id: ua.achievement_slug,
                    badge_path: achievement?.badge_path || 'default',
                    description: achievement?.title || 'Achievement Unlocked',
                    earned_at: ua.achieved_at,
                    title: achievement?.title || 'Unknown',
                    xpReward: achievement?.xpReward || 0
                };
            }) || [];
        } catch (error) {
            console.error('Error in getUserAchievements:', error);
            return [];
        }
    }

    /**
     * Get achievement progress for user
     */
    static async getAchievementProgress(userId: string): Promise<any[]> {
        try {
            const stats = await this.getUserStats(userId);
            if (!stats) {
                return [];
            }

            const { data: existingAchievements, error } = await supabase
                .from('user_achievements')
                .select('achievement_slug')
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching existing achievements:', error);
                return [];
            }

            const existingSlugs = new Set(existingAchievements?.map(a => a.achievement_slug) || []);

            return this.ACHIEVEMENTS.map(achievement => ({
                slug: achievement.slug,
                title: achievement.title,
                description: achievement.description,
                badge_path: achievement.badge_path,
                earned: existingSlugs.has(achievement.slug),
                progress: this.calculateAchievementProgress(achievement, stats)
            }));
        } catch (error) {
            console.error('Error in getAchievementProgress:', error);
            return [];
        }
    }

    /**
     * Calculate progress towards an achievement
     */
    private static calculateAchievementProgress(achievement: Achievement, stats: UserStats): number {
        // This is a simplified progress calculation
        // In a real implementation, you might want more sophisticated progress tracking
        if (achievement.condition(stats)) {
            return 100;
        }

        // Calculate partial progress based on achievement type
        if (achievement.slug.includes('streak')) {
            const targetStreak = parseInt(achievement.slug.split('_')[1]);
            return Math.min((stats.streak / targetStreak) * 100, 99);
        }

        if (achievement.slug.includes('level')) {
            const targetLevel = parseInt(achievement.slug.split('_')[1]);
            return Math.min((stats.level / targetLevel) * 100, 99);
        }

        if (achievement.slug.includes('words')) {
            const targetWords = parseInt(achievement.slug.split('_')[1]);
            return Math.min((stats.wordsLearned / targetWords) * 100, 99);
        }

        if (achievement.slug.includes('xp')) {
            const targetXP = parseInt(achievement.slug.split('_')[1]);
            return Math.min((stats.totalXP / targetXP) * 100, 99);
        }

        return 0;
    }
}