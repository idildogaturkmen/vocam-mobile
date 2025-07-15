import { readUserData } from '@/database/crudOperations';
import { ReadInputCommandType } from '@/database/dbTypes';

type ProfilesTableItems = {
    streak: number;
    user_id: string;
    email: string;
    created_at: string;
    username: string;
    last_login: string;
    level: number;
    exp: number;
};

export async function getProfile(): Promise<ProfilesTableItems | null> {
    const readInput: ReadInputCommandType = {
        TableName: 'profiles',
    };
    const data = (await readUserData(readInput)) as unknown as ProfilesTableItems[];
    if (!data) {
        return null;
    }
    return data[0];
}
