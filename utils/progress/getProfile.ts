import { supabase } from '../../database/config';

interface Profile {
    level: number;
    exp: number;
    streak: number;
}

export async function getProfile(): Promise<Profile | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { level: 1, exp: 0, streak: 0 };
        }

        // Get user profile from database
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('level, experience_points, current_streak')
            .eq('user_id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            // Return default values if no profile exists
            return { level: 1, exp: 0, streak: 0 };
        }

        return {
            level: profile?.level || 1,
            exp: profile?.experience_points || 0,
            streak: profile?.current_streak || 0
        };
    } catch (error) {
        console.error('Failed to get profile:', error);
        return { level: 1, exp: 0, streak: 0 };
    }
}