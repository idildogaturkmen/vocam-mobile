import { supabase } from '../../database/config';
import { LevelingService } from '../../src/services/LevelingService';
import { UserProgressService } from '../../src/services/UserProgressService';
import { CacheKeys, CACHE_CONFIG } from '../../src/services/CacheService';

interface Profile {
    level: number;
    exp: number;
    streak: number;
    totalXP: number;
    xpForNextLevel: number;
    progressToNextLevel: number;
}

// Create a simple cache for the profile utility
let profileCache: { [key: string]: { data: Profile; timestamp: number } } = {};

function getCachedProfile(userId: string): Profile | null {
    const cached = profileCache[userId];
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > CACHE_CONFIG.PROFILE;
    if (isExpired) {
        delete profileCache[userId];
        return null;
    }
    
    return cached.data;
}

function setCachedProfile(userId: string, profile: Profile): void {
    profileCache[userId] = {
        data: profile,
        timestamp: Date.now()
    };
}

export async function getProfile(forceRefresh = false): Promise<Profile | null> {
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
        
        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            const cached = getCachedProfile(user.id);
            if (cached) {
                return cached;
            }
        }

        // Update streak to ensure current data
        try {
            await UserProgressService.updateStreak(user.id);
        } catch (error) {
            console.error('Error updating streak in getProfile:', error);
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

        const result = {
            level: levelInfo?.currentLevel || profile?.level || 1,
            exp: levelInfo?.currentXP || profile?.exp || 0,
            streak: profile?.streak || 0,
            totalXP: levelInfo?.totalXP || profile?.total_xp || 0,
            xpForNextLevel: levelInfo?.xpForNextLevel || 100,
            progressToNextLevel: levelInfo?.progressToNextLevel || 0
        };
        
        // Cache the result
        setCachedProfile(user.id, result);
        return result;
    } catch (error) {
        console.error('Failed to get profile:', error);
        
        // Try to return cached data on error
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const cached = getCachedProfile(user.id);
                if (cached) {
                    console.warn('Returning cached profile due to error');
                    return cached;
                }
            }
        } catch (authError) {
            console.error('Auth error in fallback:', authError);
        }
        
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