import { readUserData } from '@/database/crudOperations';
import { ReadInputCommandType } from '@/database/dbTypes';

export async function getAchievements(): Promise<Record<string, string>[]> {
    const readInput: ReadInputCommandType = {
        TableName: 'user_achievements',
    };
    const data = await readUserData(readInput);
    console.log('Achievements data:', data);
    if (!data) {
        return [];
    }
    return data;
}
