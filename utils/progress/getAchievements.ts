import { supabase } from '../../database/config';

export async function getAchievements(): Promise<Record<string, string>[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return [];
        }

        // Get user's achievements from database
        const { data: achievements, error } = await supabase
            .from('user_achievements')
            .select('achievement_slug, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching achievements:', error);
            // Return mock data for development
            return [
                {
                    id: '1',
                    badge_path: 'first_login',
                    description: 'First Login',
                    earned_at: '2025-08-01T10:00:00Z'
                },
                {
                    id: '2',
                    badge_path: 'streak_3',
                    description: '3-Day Streak',
                    earned_at: '2025-08-05T15:30:00Z'
                },
                {
                    id: '3',
                    badge_path: 'level_1',
                    description: 'Reached Level 1',
                    earned_at: '2025-08-07T09:15:00Z'
                }
            ];
        }

        // Map database achievements to display format
        const achievementDetails: Record<string, { description: string; badge: string }> = {
            'first_login': { description: 'First Login', badge: 'first_login' },
            'streak_3': { description: '3-Day Streak', badge: 'streak_3' },
            'streak_7': { description: '7-Day Streak', badge: 'streak_7' },
            'level_1': { description: 'Reached Level 1', badge: 'level_1' },
            'max_proficiency': { description: 'First Max Proficiency', badge: 'max_proficiency' },
        };

        return achievements?.map((ach, index) => ({
            id: (index + 1).toString(),
            badge_path: achievementDetails[ach.achievement_slug]?.badge || 'default.png',
            description: achievementDetails[ach.achievement_slug]?.description || 'Achievement Unlocked',
            earned_at: ach.created_at
        })) || [];
    } catch (error) {
        console.error('Failed to get achievements:', error);
        return [];
    }
}