import { Alert } from 'react-native';
import { supabase } from './config';
import { writeUserData } from './crudOperations';

export async function createUser(
    email: string,
    password: string,
    username: string,
    setLoading: (loading: boolean) => void,
) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        setLoading(false);
        Alert.alert('Error signing up', error.message);
        return;
    }
    if (!data.session) {
        setLoading(false);
        Alert.alert('Please check your inbox for email verification!');
        return;
    }
    if (data.user) {
        await writeUserData({
            TableName: 'profiles',
            Items: [{ user_id: data.user.id, username: username, streak: 0 }],
        });
    }
}

export async function login(
    email: string,
    password: string,
    setLoading: (loading: boolean) => void,
) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        setLoading(false);
        Alert.alert('Error logging in', error.message);
        return;
    }
    console.log('User logged in successfully');
    return data;
}
