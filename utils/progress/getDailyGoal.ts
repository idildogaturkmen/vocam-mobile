import { supabase } from '../../database/config';

export interface DailyGoal {
    current: number;
    target: number;
    percentage: number;
}

export async function getDailyGoal(): Promise<DailyGoal> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { current: 0, target: 5, percentage: 0 };
        }

        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // Count learning activities from today by checking user_words table
        // This counts both new words learned today AND translations learned today
        const { data: todaysActivity, error: activityError } = await supabase
            .from('user_words')
            .select(`
                id,
                learned_at,
                word_id,
                words!inner (
                    word_id,
                    original
                )
            `)
            .eq('user_id', user.id)
            .gte('learned_at', `${today}T00:00:00.000Z`)
            .lt('learned_at', `${today}T23:59:59.999Z`);

        let current = 0;

        if (!activityError && todaysActivity && todaysActivity.length > 0) {
            // For each word learned today, count its translations
            const wordIds = todaysActivity.map(activity => activity.word_id).filter(id => id != null);
            
            if (wordIds.length > 0) {
                const { data: translations, error: translationsError } = await supabase
                    .from('translations')
                    .select('id')
                    .in('word_id', wordIds);

                if (!translationsError) {
                    current = translations?.length || 0;
                } else {
                    // Fallback: just count unique words learned today
                    current = todaysActivity.length;
                }
            }
        }

        const target = 5;
        const percentage = Math.min((current / target) * 100, 100);

        return {
            current,
            target,
            percentage
        };
    } catch (error) {
        console.error('Error in getDailyGoal:', error);
        return { current: 0, target: 5, percentage: 0 };
    }
}

// Enhanced function to record learning activity with timestamp
export async function recordLearningActivity(userId: string, wordId: string, translationCount: number = 1): Promise<void> {
    try {
        // Use the daily_progress table directly since daily_learning_log doesn't exist
        await incrementDailyGoal(userId, translationCount);
    } catch (error) {
        console.error('Error recording learning activity:', error);
        // Fallback to old system
        await incrementDailyGoal(userId, translationCount);
    }
}

// Fallback function for backward compatibility
export async function incrementDailyGoal(userId: string, increment: number = 1): Promise<void> {
    try {
        const today = new Date().toISOString().split('T')[0];

        // First try to increment existing record
        const { data: existingRecord } = await supabase
            .from('daily_progress')
            .select('words_learned_today')
            .eq('user_id', userId)
            .eq('date', today)
            .single();

        if (existingRecord) {
            // Update existing record
            const { error } = await supabase
                .from('daily_progress')
                .update({ 
                    words_learned_today: existingRecord.words_learned_today + increment 
                })
                .eq('user_id', userId)
                .eq('date', today);

            if (error) {
                console.error('Error updating daily progress:', error);
            }
        } else {
            // Create new record
            const { error } = await supabase
                .from('daily_progress')
                .insert({
                    user_id: userId,
                    date: today,
                    words_learned_today: increment
                });

            if (error) {
                console.error('Error creating daily progress:', error);
            }
        }
    } catch (error) {
        console.error('Error in incrementDailyGoal:', error);
    }
}

// Get daily goal based on daily_progress table (more accurate)
export async function getDailyGoalFromLog(): Promise<DailyGoal> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { current: 0, target: 5, percentage: 0 };
        }

        const today = new Date().toISOString().split('T')[0];

        // Get today's progress from daily_progress table
        const { data: todaysProgress, error: progressError } = await supabase
            .from('daily_progress')
            .select('words_learned_today')
            .eq('user_id', user.id)
            .eq('date', today)
            .single();

        if (progressError && progressError.code !== 'PGRST116') {
            // If there's an error other than "no rows found", fallback to original method
            console.warn('Error getting daily progress:', progressError);
            return await getDailyGoal();
        }

        const current = todaysProgress?.words_learned_today || 0;
        const target = 5; // Set to 5 to match the default from the profile page
        const percentage = Math.min((current / target) * 100, 100);

        return {
            current,
            target,
            percentage
        };
    } catch (error) {
        console.error('Error in getDailyGoalFromLog:', error);
        return await getDailyGoal();
    }
}