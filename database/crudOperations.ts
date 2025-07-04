import { supabase } from './config';
import { ReadInputCommandType, UpdateInputCommandType, WriteInputCommandType } from './dbTypes';
import { applyFilters } from './Helpers/applyFilters';

export const readUserData = async ({ TableName, Filters }: ReadInputCommandType) => {
    try {
        let query = supabase.from(TableName).select('*');

        if (Filters && Filters.length > 0) query = applyFilters(query, Filters);

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

export const updateUserData = async ({
    TableName,
    Items,
    UpdateCondition,
}: UpdateInputCommandType) => {
    try {
        const { error } = await supabase
            .from(TableName)
            .update(Items)
            .eq(UpdateCondition.column, UpdateCondition.value);

        if (error) throw error;
        console.log('User data updated successfully');
    } catch (error) {
        console.error('Error updating user data:', error);
        throw error;
    }
};

export const deleteUserData = async ({ TableName, Filters }: ReadInputCommandType) => {
    try {
        let query = supabase.from(TableName).delete();

        if (Filters && Filters.length > 0) query = applyFilters(query, Filters);

        const { error } = await query;

        if (error) throw error;

        console.log('User data deleted successfully');
    } catch (error) {
        console.error('Error deleting user data:', error);
        throw error;
    }
};
