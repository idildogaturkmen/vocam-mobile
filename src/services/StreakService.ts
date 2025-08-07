import { supabase } from '../../database/config';

export class StreakService {
    /**
     * Update user's streak with proper daily login detection
     */
    static async updateStreak(userId: string): Promise<{ newStreak: number; streakIncreased: boolean }> {
        try {
            // Get user's profile with current streak and last login
            const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('last_login, streak')
                .eq('user_id', userId)
                .single();

            if (fetchError) {
                console.error('Error fetching profile for streak update:', fetchError);
                return { newStreak: 0, streakIncreased: false };
            }

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastLogin = profile?.last_login ? new Date(profile.last_login) : null;
            const lastLoginDate = lastLogin ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()) : null;
            
            let newStreak = profile?.streak || 0;
            let streakIncreased = false;

            if (!lastLoginDate) {
                // First time login
                newStreak = 1;
                streakIncreased = true;
            } else {
                const daysDifference = Math.floor((today.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDifference === 0) {
                    // Same day - no change to streak
                    streakIncreased = false;
                } else if (daysDifference === 1) {
                    // Next day - increment streak
                    newStreak += 1;
                    streakIncreased = true;
                } else {
                    // Missed days - reset streak to 1
                    newStreak = 1;
                    streakIncreased = newStreak > (profile?.streak || 0);
                }
            }

            // Update profile with new streak and last login
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    last_login: now.toISOString(),
                    streak: newStreak
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Error updating streak:', updateError);
                return { newStreak: profile?.streak || 0, streakIncreased: false };
            }

            return { newStreak, streakIncreased };
        } catch (error) {
            console.error('Error in updateStreak:', error);
            return { newStreak: 0, streakIncreased: false };
        }
    }

    /**
     * Get current streak for user
     */
    static async getCurrentStreak(userId: string): Promise<number> {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('streak')
                .eq('user_id', userId)
                .single();

            if (error) {
                console.error('Error fetching current streak:', error);
                return 0;
            }

            return profile?.streak || 0;
        } catch (error) {
            console.error('Error in getCurrentStreak:', error);
            return 0;
        }
    }

    /**
     * Check if user has logged in today
     */
    static async hasLoggedInToday(userId: string): Promise<boolean> {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('last_login')
                .eq('user_id', userId)
                .single();

            if (error || !profile?.last_login) {
                return false;
            }

            const lastLogin = new Date(profile.last_login);
            const today = new Date();
            
            return lastLogin.toDateString() === today.toDateString();
        } catch (error) {
            console.error('Error checking if logged in today:', error);
            return false;
        }
    }
}