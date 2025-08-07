import { supabase } from '../../database/config';
import { LevelingService } from '../../src/services/LevelingService';

interface Profile {
    level: number;
    exp: number;
    streak: number;
    totalXP: number;
    xpForNextLevel: number;
    progressToNextLevel: number;
}

export async function getProfile(): Promise<Profile | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { 
                level: 1, 
                exp: 0, 
                streak: 0, 
                totalXP: 0, 
                xpForNextLevel: 100, 
                progressToNextLevel: 0 
            };
        }

        // Get detailed level information
        const levelInfo = await LevelingService.getLevelInfo(user.id);
        
        // Get user profile from database for streak info
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('level, exp, streak, total_xp')
            .eq('user_id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            // Return default values if no profile exists
            return { 
                level: 1, 
                exp: 0, 
                streak: 0, 
                totalXP: 0, 
                xpForNextLevel: 100, 
                progressToNextLevel: 0 
            };
        }

        return {
            level: levelInfo?.currentLevel || profile?.level || 1,
            exp: levelInfo?.currentXP || profile?.exp || 0,
            streak: profile?.streak || 0,
            totalXP: levelInfo?.totalXP || profile?.total_xp || 0,
            xpForNextLevel: levelInfo?.xpForNextLevel || 100,
            progressToNextLevel: levelInfo?.progressToNextLevel || 0
        };
    } catch (error) {
        console.error('Failed to get profile:', error);
        return { 
            level: 1, 
            exp: 0, 
            streak: 0, 
            totalXP: 0, 
            xpForNextLevel: 100, 
            progressToNextLevel: 0 
        };
    }
}