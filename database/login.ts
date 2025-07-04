import { supabase } from './config';
import { writeUserData } from './crudOperations';

export async function createUser(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) throw error;
    console.log('User created successfully');
    if (data.user) {
        await writeUserData({
            TableName: 'profiles',
            Items: [{ user_id: data.user.id, username: username, streak: 0 }],
        });
    }
}

export async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    console.log('User logged in successfully');
    return data.user;
}

export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    console.log('User logged out successfully');
}
