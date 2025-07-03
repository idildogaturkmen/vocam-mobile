import { supabase } from './config';
import { ReadInputCommandType, WriteInputCommandType } from './dbTypes';
import { readHelper } from './Helpers/readHelper';

export const readUserData = async ({ TableName, Filters }: ReadInputCommandType) => {
    try {
        let query = supabase.from(TableName).select('*');

        if (Filters && Filters.length > 0) query = await readHelper(query, Filters);

        const { data, error } = await query;

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error reading user data:', error);
        throw error;
    }
};

export const writeUserData = async ({ TableName, Items }: WriteInputCommandType) => {
    try {
        const { data, error } = await supabase.from(TableName).insert(Items);

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error writing user data:', error);
        throw error;
    }
};
