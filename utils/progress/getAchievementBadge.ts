export async function getAchievementBadge(badgePath: string): Promise<any> {
    try {
        const badges: Record<string, any> = {
            'first_word.png': require('../../assets/progress/badges/first_word.png'),
            'streak_week.png': require('../../assets/progress/badges/streak_week.png'),
            'max_proficiency.png': require('../../assets/progress/badges/max_proficiency.png'),
            'level_up.png': require('../../assets/progress/badges/level_up.png'),
            'first_login': require('../../assets/progress/badges/first_word.png'),
            'streak_3': require('../../assets/progress/badges/streak_week.png'),
            'streak_7': require('../../assets/progress/badges/streak_week.png'),
            'level_1': require('../../assets/progress/badges/level_up.png'),
            'max_proficiency': require('../../assets/progress/badges/max_proficiency.png'),
            'default.png': require('../../assets/progress/badges/default.png'),
        };
        return badges[badgePath] || badges['default.png'];
    } catch (error) {
        console.error('Failed to get achievement badge:', error);
        return null;
    }
}