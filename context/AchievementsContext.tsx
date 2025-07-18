import React, { createContext, useContext, ReactNode, useRef } from 'react';
import Toast from 'react-native-toast-message';

type Trophy = 'first_login' | '100_words' | 'max_proficiency';
const unlocked = useRef<Set<string>>(new Set());

const achievementHandlers: Record<Trophy, () => Promise<{ title: string; achieved: boolean }>> = {
    first_login: async () => {
        return { title: 'First Login', achieved: true };
    },
    '100_words': async () => {
        const count = 10;
        return { title: '100 Words Learned', achieved: (count ?? 0) >= 100 };
    },
    max_proficiency: async () => {
        return { title: 'First Max Proficiency', achieved: true };
    },
};

interface AchievementsContextType {
    checkAchievement: (trophy: Trophy) => void;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
    const checkAchievement = async (trophy: Trophy) => {
        if (unlocked.current.has(trophy)) return;

        const handler = achievementHandlers[trophy];
        if (!handler) return;

        const achieved = await handler();
        if (achieved.achieved) {
            // unlocked.current.add(trophy);
            Toast.show({
                type: 'success',
                text1: 'Achievement Unlocked',
                text2: `Congratulations, you unlocked: ${achieved.title}`,
            });
        }
    };

    return (
        <AchievementsContext.Provider value={{ checkAchievement }}>
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
