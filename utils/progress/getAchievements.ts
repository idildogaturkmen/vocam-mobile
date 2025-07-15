import { readUserData } from '@/database/crudOperations';
import { ReadInputCommandType } from '@/database/dbTypes';

type Achievement = {
    id: string;
    description: string;
    earned_at: string;
    badge_path: string;
};

export async function getAchievements(): Promise<Achievement[]> {
    const readInput: ReadInputCommandType = {
        TableName: 'user_achievements',
    };
    const data = await readUserData(readInput);
    if (!data) {
        return [];
    }
    const achievementsData = await readUserData({
        TableName: 'achievements',
        Filters: [{ column: 'id', operator: 'in', value: data.map((item) => item.achievement_id) }],
    });
    let achievements: Achievement[] = [];
    for (const item of data) {
        achievements.push({
            id: item.achievement_id,
            description:
                achievementsData.find((w) => w.id === item.achievement_id)?.description || '',
            earned_at: item.achieved_at,
            badge_path:
                achievementsData.find((w) => w.id === item.achievement_id)?.badge_path || '',
        });
    }
    return achievements;
}
