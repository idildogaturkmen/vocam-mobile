import { Alert } from 'react-native';
import { supabase } from './config';
import { writeUserData } from './crudOperations';
import { findEmailInUse } from '@/utils/emailInUse';

export async function createUser(
    email: string,
    password: string,
    username: string,
    setLoading: (loading: boolean) => void,
) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username, // Store username in user metadata
            },
        },
    });

    if (error) {
        setLoading(false);
        Alert.alert('Error signing up', error.message);
        return;
    }
    if (!data.session) {
        setLoading(false);
        Alert.alert(
            'Check your email',
            "We've sent a confirmation link to the provided address. \n\nIf you already have an account, you won’t be able to create another with the same email",
        );
        return;
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
    const emailInUse = await findEmailInUse(email);
    if (!emailInUse) {
        // Write user data on the first login
        const { username = '' } = data.session.user.user_metadata || {};
        await writeUserData({
            TableName: 'profiles',
            Items: [{ user_id: data.user.id, email, username, streak: 0 }],
        });
    }
    console.log('User logged in successfully');
    return data;
}
