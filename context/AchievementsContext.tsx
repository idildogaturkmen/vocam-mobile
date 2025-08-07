import React, { createContext, useContext, ReactNode, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { achievementHandlers, Trophy } from './achievementHandler';
import { getAchievements } from '../utils/progress/getAchievements';
import { supabase } from '../database/config';

interface AchievementsContextType {
    checkAchievement: (trophy: Trophy) => void;
    unlocked: React.RefObject<Set<string>>;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
    useEffect(() => {
        const fetchAchievements = async () => {
            const achievements = await getAchievements();
            if (achievements) {
                achievements.forEach((ach: any) => unlocked.current.add(ach.slug || ach.id));
            }
        };

        fetchAchievements();
    }, []);

    const unlocked = useRef<Set<string>>(new Set());

    const checkAchievement = async (trophy: Trophy) => {
        console.log(unlocked.current);
        if (unlocked.current.has(trophy)) return;

        const handler = achievementHandlers[trophy];
        if (!handler) return;

        const achieved = await handler();
        if (achieved.achieved) {
            unlocked.current.add(trophy);
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const userId = user?.id;
            
            // Show achievement alert instead of toast
            Alert.alert(
                'Achievement Unlocked! 🏆',
                achieved.title,
                [{ text: 'Great!', style: 'default' }]
            );
        }
    };

    return (
        <AchievementsContext.Provider value={{ checkAchievement, unlocked }}>
            {children}
        </AchievementsContext.Provider>
    );
};

export const useAchievements = (): AchievementsContextType => {
    const context = useContext(AchievementsContext);
    if (!context) {
        throw new Error('useAchievements must be used within an AchievementsProvider');
    }
    return context;
};