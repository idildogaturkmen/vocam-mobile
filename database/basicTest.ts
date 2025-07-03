import { readUserData, writeUserData } from './crudOperations';
import { createUser, login } from './login';
import 'dotenv/config';

async function testar() {
    const email = process.env.TEST_EMAIL || '';
    const password = process.env.TEST_PASSWORD || '';
    await createUser(email, password, 'testuser'); // cria um usuário de teste
    const user = await login(email, password); // primeiro, autentica o usuário

    await writeUserData({
        TableName: 'user_words',
        Items: [{ word: 'maçã', user_id: user.id }],
    });

    const items = await readUserData({
        TableName: 'user_words',
        Filters: [],
    });
    console.log('Itens lidos:', items);
}

testar().catch((err) => {
    console.error('Erro no teste:', err);
});
