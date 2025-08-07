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

        // Count words learned today using the correct column name
        const { data: todaysWords, error } = await supabase
            .from('user_words')
            .select('id')
            .eq('user_id', user.id)
            .gte('learned_at', `${today}T00:00:00.000Z`)  // ✅ CORRECT COLUMN NAME
            .lt('learned_at', `${today}T23:59:59.999Z`);  // ✅ CORRECT COLUMN NAME

        if (error) {
            console.error('Error fetching daily goal:', error);
            return { current: 0, target: 5, percentage: 0 };
        }

        const current = todaysWords?.length || 0;
        const target = 5; // Default daily goal
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