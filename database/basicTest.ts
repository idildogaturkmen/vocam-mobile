import { readUserData, writeUserData } from './crudOperations';
import { createUser, login } from './login';
import 'dotenv/config';

async function test() {
    const email = process.env.TEST_EMAIL || '';
    const password = process.env.TEST_PASSWORD || '';
    await createUser(email, password, 'testuser'); // create a new user for testing
    const user = await login(email, password); // log in the user

    await writeUserData({
        TableName: 'user_words',
        Items: [{ word: 'maçã', user_id: user.id }],
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
