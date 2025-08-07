import { supabase } from '../../database/config';
import { AchievementService } from '../../src/services/AchievementService';

export async function getAchievements(): Promise<Record<string, string>[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return [];
        }

        // Use the new AchievementService
        const achievements = await AchievementService.getUserAchievements(user.id);
        return achievements;

    } catch (error) {
        console.error('Failed to get achievements:', error);
        return [];
    }
}