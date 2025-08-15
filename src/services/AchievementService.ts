import { supabase } from '../../database/config';
import { LevelingService } from './LevelingService';
import { CacheKeys, CACHE_CONFIG } from './CacheService';
import { debugUtils } from '../utils/DebuggingUtils';

export interface Achievement {
    id?: string;
    slug: string;
    title: string;
    description: string;
    icon_name: string;
    icon_color: string;
    xp_reward: number;
    requirement_type: string;
    requirement_value: number;
    earned?: boolean;
    achieved_at?: string;
    progress?: number;
}

export interface UserStats {
    totalXP: number;
    level: number;
    streak: number;
    wordsLearned: number; // Unique words learned
    totalTranslations: number; // Total translations (word-language pairs)
    perfectQuizzes: number;
    totalQuizzes: number;
    daysActive: number;
    masteredWords: number; // Unique words mastered
    averageProficiency: number;
    maxStreak: number;
}

export class AchievementService {
    private static cache: Map<string, { data: any; timestamp: number; expiresIn: number }> =
        new Map();
    private static processingUsers: Set<string> = new Set(); // Track users currently being processed
    private static lastCheckTime: Map<string, number> = new Map(); // Track last check time per user

    // Cache helper methods
    private static getFromCache<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > entry.expiresIn;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    private static setCache<T>(key: string, data: T, expiresIn: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn,
        });
    }

    private static invalidateUserCache(userId: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(userId)) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Get all achievements from database with user progress (cached)
     */
    static async getAllAchievementsWithProgress(
        userId: string,
        forceRefresh = false,
    ): Promise<Achievement[]> {
        const cacheKey = CacheKeys.achievements(userId);

        // Return cached data if available and not forcing refresh
        if (!forceRefresh) {
            const cached = this.getFromCache<Achievement[]>(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            // Check if user is authenticated
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user || user.id !== userId) {
                return [];
            }

            // Get all achievements from database
            const { data: achievements, error: achievementsError } = await supabase
                .from('achievements')
                .select('*')
                .order('requirement_value', { ascending: true });

            if (achievementsError) {
                // Handle case where achievements table doesn't exist
                if (
                    achievementsError.code === '42P01' ||
                    achievementsError.message.includes('does not exist')
                ) {
                    console.warn('Achievements table does not exist, returning empty array');
                    return [];
                }
                console.error('Error fetching achievements:', achievementsError);
                return [];
            }

            // Skip user achievements if no achievements exist
            if (!achievements || achievements.length === 0) {
                return [];
            }

            // Get user's earned achievements
            const { data: userAchievements, error: userError } = await supabase
                .from('user_achievements')
                .select('achievement_slug, achieved_at')
                .eq('user_id', userId);

            if (userError) {
                // Handle case where user_achievements table doesn't exist
                if (userError.code === '42P01' || userError.message.includes('does not exist')) {
                    console.warn(
                        'User achievements table does not exist, treating all achievements as unearned',
                    );
                    // Continue with empty user achievements
                } else {
                    console.error('Error fetching user achievements:', userError);
                }
            }

            // Get user stats for progress calculation
            const stats = await this.getUserStats(userId);

            // Map earned achievements
            const earnedSlugs = new Set(userAchievements?.map((ua) => ua.achievement_slug) || []);
            const earnedMap = new Map(
                userAchievements?.map((ua) => [ua.achievement_slug, ua.achieved_at]) || [],
            );

            // Check for newly earned achievements and award them
            if (stats && achievements) {
                for (const achievement of achievements) {
                    if (
                        !earnedSlugs.has(achievement.slug) &&
                        this.meetsRequirement(achievement, stats)
                    ) {
                        // Award the achievement
                        const awarded = await this.awardAchievement(userId, achievement);
                        if (awarded) {
                            earnedSlugs.add(achievement.slug);
                            earnedMap.set(achievement.slug, new Date().toISOString());
                        }
                    }
                }
            }

            // Combine data
            const result =
                achievements?.map((achievement) => ({
                    ...achievement,
                    earned: earnedSlugs.has(achievement.slug),
                    achieved_at: earnedMap.get(achievement.slug),
                    progress:
                        !earnedSlugs.has(achievement.slug) && stats
                            ? this.calculateProgress(achievement, stats)
                            : undefined,
                })) || [];

            // Cache the result
            this.setCache(cacheKey, result, CACHE_CONFIG.ACHIEVEMENTS);
            return result;
        } catch (error) {
            console.error('Error in getAllAchievementsWithProgress:', error);
            // Try to return cached data on error
            const cached = this.getFromCache<Achievement[]>(cacheKey);
            if (cached) {
                console.warn('Returning cached achievements due to error');
                return cached;
            }
            return [];
        }
    }

    /**
     * Calculate progress towards an achievement (0-100)
     */
    private static calculateProgress(achievement: Achievement, stats: UserStats): number {
        let progress = 0;

        switch (achievement.requirement_type) {
            case 'words':
                // Check if this is about mastered words (proficiency-based) or translations
                if (
                    achievement.slug.includes('vocabulary_builder') ||
                    achievement.description.toLowerCase().includes('master')
                ) {
                    progress = (stats.masteredWords / achievement.requirement_value) * 100;
                } else if (
                    achievement.description.toLowerCase().includes('translation') ||
                    achievement.slug.includes('word_collector')
                ) {
                    progress = (stats.totalTranslations / achievement.requirement_value) * 100;
                } else {
                    progress = (stats.wordsLearned / achievement.requirement_value) * 100;
                }
                break;
            case 'level':
                progress = (stats.level / achievement.requirement_value) * 100;
                break;
            case 'streak':
                progress = (stats.streak / achievement.requirement_value) * 100;
                break;
            case 'xp':
                progress = (stats.totalXP / achievement.requirement_value) * 100;
                break;
            case 'quiz':
                progress = (stats.totalQuizzes / achievement.requirement_value) * 100;
                break;
            default:
                return 0;
        }

        // Don't cap at 99% - let it go to 100% so achievements can be awarded
        return Math.min(Math.round(progress), 100);
    }

    /**
     * Check if user meets requirement for an achievement
     */
    private static meetsRequirement(achievement: Achievement, stats: UserStats): boolean {
        switch (achievement.requirement_type) {
            case 'words':
                // Check if this is about mastered words (proficiency-based) or translations
                if (
                    achievement.slug.includes('vocabulary_builder') ||
                    achievement.description.toLowerCase().includes('master')
                ) {
                    return stats.masteredWords >= achievement.requirement_value;
                } else if (
                    achievement.description.toLowerCase().includes('translation') ||
                    achievement.slug.includes('word_collector')
                ) {
                    return stats.totalTranslations >= achievement.requirement_value;
                } else {
                    return stats.wordsLearned >= achievement.requirement_value;
                }
            case 'level':
                return stats.level >= achievement.requirement_value;
            case 'streak':
                return stats.streak >= achievement.requirement_value;
            case 'xp':
                return stats.totalXP >= achievement.requirement_value;
            case 'quiz':
                return stats.totalQuizzes >= achievement.requirement_value;
            case 'special':
                return true; // For special achievements like first login
            default:
                return false;
        }
    }

    /**
     * Check and award new achievements for a user (with deduplication)
     */
    static async checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
        try {
            // Check if user is authenticated
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user || user.id !== userId) {
                return [];
            }

            // Prevent duplicate processing for the same user
            if (this.processingUsers.has(userId)) {
                return [];
            }

            // Prevent frequent checks for the same user (max once per 30 seconds)
            const lastCheck = this.lastCheckTime.get(userId) || 0;
            const now = Date.now();
            if (now - lastCheck < 30000) { // 30 seconds
                return [];
            }
            this.lastCheckTime.set(userId, now);

            // Track this operation for debugging
            if (!debugUtils.trackAchievementCheck(userId)) {
                return [];
            }

            // Mark user as being processed
            this.processingUsers.add(userId);

            try {
                const stats = await this.getUserStats(userId);
                if (!stats) {
                    return [];
                }

                // Get all achievements
                const { data: allAchievements, error: achievementsError } = await supabase
                    .from('achievements')
                    .select('*');

                if (achievementsError) {
                    console.error('Error fetching achievements for check:', achievementsError);
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

                const existingSlugs = new Set(
                    existingAchievements?.map((a) => a.achievement_slug) || [],
                );
                const newAchievements: Achievement[] = [];

                // Check each achievement
                for (const achievement of allAchievements || []) {
                    if (
                        !existingSlugs.has(achievement.slug) &&
                        this.meetsRequirement(achievement, stats)
                    ) {
                        // Award the achievement
                        const awarded = await this.awardAchievement(userId, achievement);
                        if (awarded) {
                            newAchievements.push({
                                ...achievement,
                                earned: true,
                                achieved_at: new Date().toISOString(),
                            });
                        }
                    }
                }

                return newAchievements;
            } finally {
                // Always remove user from processing set
                this.processingUsers.delete(userId);
            }
        } catch (error) {
            console.error('Error in checkAndAwardAchievements:', error);
            // Make sure to remove user from processing set on error
            this.processingUsers.delete(userId);
            return [];
        }
    }

    /**
     * Get user statistics for achievement checking (cached)
     */
    static async getUserStats(userId: string, forceRefresh = false): Promise<UserStats | null> {
        const cacheKey = `achievementStats_${userId}`;

        // Return cached data if available and not forcing refresh
        if (!forceRefresh) {
            const cached = this.getFromCache<UserStats>(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            // Check if user is authenticated
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user || user.id !== userId) {
                return null;
            }
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

            // Get user words data (handle missing table gracefully)
            let userWords: any[] = [];
            const { data: userWordsData, error: wordsError } = await supabase
                .from('user_words')
                .select('word_id, proficiency')
                .eq('user_id', userId);

            if (wordsError) {
                if (wordsError.code === '42P01' || wordsError.message.includes('does not exist')) {
                    console.warn('User words table does not exist, using empty data');
                } else {
                    console.error('Error fetching user words for achievements:', wordsError);
                }
            } else {
                userWords = userWordsData || [];
            }

            // Get total translations count
            const userWordIds = userWords?.map((uw) => uw.word_id).filter((id) => id != null) || [];
            let totalTranslations = 0;
            if (userWordIds.length > 0) {
                const { data: translationsData, error: translationsError } = await supabase
                    .from('translations')
                    .select('id')
                    .in('word_id', userWordIds);

                if (!translationsError) {
                    totalTranslations = translationsData?.length || 0;
                }
            }

            // Get quiz data (handle missing table gracefully)
            let quizzes: any[] = [];
            const { data: quizzesData, error: quizzesError } = await supabase
                .from('quiz_sessions')
                .select('percentage_score, total_questions, score')
                .eq('user_id', userId);

            if (quizzesError) {
                if (
                    quizzesError.code === '42P01' ||
                    quizzesError.message.includes('does not exist')
                ) {
                    console.warn('Quiz sessions table does not exist, using empty data');
                } else {
                    console.error('Error fetching quiz data for achievements:', quizzesError);
                }
            } else {
                quizzes = quizzesData || [];
            }

            const uniqueWordsLearned = userWords?.length || 0;
            const masteredUniqueWords = userWords?.filter((w) => w.proficiency >= 80).length || 0;
            const averageProficiency =
                uniqueWordsLearned > 0
                    ? userWords!.reduce((sum, w) => sum + (w.proficiency || 0), 0) /
                      uniqueWordsLearned
                    : 0;

            const perfectQuizzes =
                quizzes?.filter(
                    (q) =>
                        q.percentage_score === 100 ||
                        (q.score === q.total_questions && q.total_questions > 0),
                ).length || 0;

            const stats = {
                totalXP: profile?.total_xp || 0,
                level: profile?.level || 1,
                streak: profile?.streak || 0,
                wordsLearned: uniqueWordsLearned, // Unique words learned
                totalTranslations, // Total translations (word-language pairs)
                perfectQuizzes,
                totalQuizzes: quizzes?.length || 0,
                daysActive: 1, // TODO: Calculate from login history
                masteredWords: masteredUniqueWords, // Unique words mastered
                averageProficiency: Math.round(averageProficiency),
                maxStreak: profile?.streak || 0, // TODO: Track max streak separately
            };

            // Cache the result
            this.setCache(cacheKey, stats, CACHE_CONFIG.USER_STATS);
            return stats;
        } catch (error) {
            console.error('Error in getUserStats:', error);
            // Try to return cached data on error
            const cached = this.getFromCache<UserStats>(cacheKey);
            if (cached) {
                console.warn('Returning cached achievement stats due to error');
                return cached;
            }
            return null;
        }
    }

    /**
     * Award a specific achievement to a user
     */
    static async awardAchievement(userId: string, achievement: Achievement): Promise<boolean> {
        try {
            // Check if user is authenticated
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user || user.id !== userId) {
                return false;
            }
            // Insert the achievement
            const { error: insertError } = await supabase.from('user_achievements').insert({
                user_id: userId,
                achievement_slug: achievement.slug,
            });

            if (insertError) {
                console.error('Error awarding achievement:', insertError);
                return false;
            }

            // Award XP for the achievement
            await LevelingService.awardXP(
                userId,
                'ACHIEVEMENT_UNLOCKED',
                undefined,
                achievement.xp_reward / 30,
            );

            // Invalidate all user caches since achievements affect multiple data points
            this.invalidateUserCache(userId);

            return true;
        } catch (error) {
            console.error('Error in awardAchievement:', error);
            return false;
        }
    }

    /**
     * Get user's earned achievements only
     */
    static async getUserAchievements(userId: string): Promise<Record<string, string>[]> {
        try {
            const allAchievements = await this.getAllAchievementsWithProgress(userId);
            return allAchievements
                .filter(achievement => achievement.earned)
                .map(achievement => ({
                    slug: achievement.slug,
                    title: achievement.title,
                    description: achievement.description,
                    icon_name: achievement.icon_name,
                    icon_color: achievement.icon_color,
                    achieved_at: achievement.achieved_at || ''
                }));
        } catch (error) {
            console.error('Error getting user achievements:', error);
            return [];
        }
    }
}
