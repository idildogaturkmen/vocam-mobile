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
    let learnedWords: LearnedWord[] = [];
    for (const item of data) {
        learnedWords.push({
            word: item.word,
            learned_at: item.learned_at,
        });
    }
    return learnedWords;
}
