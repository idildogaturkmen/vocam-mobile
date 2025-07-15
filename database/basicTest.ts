import { readUserData, writeUserData } from './crudOperations';
import { createUser, login } from './login';
import 'dotenv/config';

async function test() {
    const email = process.env.TEST_EMAIL || '';
    const password = process.env.TEST_PASSWORD || '';
    
    // Mock setLoading function for testing
    const mockSetLoading = (loading: boolean) => {
        console.log('Loading:', loading);
    };
    
    // Create a new user for testing
    await createUser(email, password, 'testuser', mockSetLoading);
    
    // Log in the user
    const loginResult = await login(email, password, mockSetLoading);
    
    if (!loginResult || !loginResult.user) {
        console.error('Login failed or no user returned');
        return;
    }

    await writeUserData({
        TableName: 'user_words',
        Items: [{ word: 'maçã', user_id: loginResult.user.id }],
    });

    const items = await readUserData({
        TableName: 'user_words',
        Filters: [],
    });
    console.log('Items read', items);
}

test().catch((err) => {
    console.error('Error on test:', err);
});