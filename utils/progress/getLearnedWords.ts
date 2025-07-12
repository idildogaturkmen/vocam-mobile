import { readUserData } from '@/database/crudOperations';
import { ReadInputCommandType } from '@/database/dbTypes';

type LearnedWord = {
    word: string;
    learned_at: string;
};

export async function getLearnedWords(): Promise<LearnedWord[]> {
    const readInput: ReadInputCommandType = {
        TableName: 'user_words',
    };
    const data = await readUserData(readInput);
    const word = await readUserData({
        TableName: 'words',
        Filters: [{ column: 'word_id', operator: 'in', value: data.map((item) => item.word_id) }],
    });
    let learnedWords: LearnedWord[] = [];
    for (const item of data) {
        learnedWords.push({
            word: word.find((w) => w.word_id === item.word_id)?.original || '',
            learned_at: item.learned_at,
        });
    }
    return learnedWords;
}
