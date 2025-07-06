import { readUserData } from '@/database/crudOperations';
import { ReadInputCommandType } from '@/database/dbTypes';

export const findEmailInUse = async (email: string): Promise<boolean> => {
    const emailQuery: ReadInputCommandType = {
        TableName: 'profiles',
        Filters: [
            {
                column: 'email',
                operator: 'eq',
                value: email,
            },
        ],
    };
    const emailInUse = await readUserData(emailQuery);
    if (emailInUse.length > 0) {
        console.log('Email is already in use:', email);
        return true;
    }
    return false;
};
