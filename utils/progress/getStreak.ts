import { readUserData } from '@/database/crudOperations';
import { ReadInputCommandType } from '@/database/dbTypes';

type ProfilesTableItems = {
    streak: number;
    user_id: string;
    email: string;
    created_at: string;
    username: string;
    last_login: string;
};

export async function getStreak(): Promise<number> {
    const readInput: ReadInputCommandType = {
        TableName: 'profiles',
    };
    const data = (await readUserData(readInput)) as unknown as ProfilesTableItems[];
    if (!data) {
        return 0;
    }
    return data[0].streak;
}
