import word0 from '@/assets/progress/words/word0.png';
import word1 from '@/assets/progress/words/word1.png';
import word2 from '@/assets/progress/words/word2.png';
import word3 from '@/assets/progress/words/word3.png';

export function getImageWord(word: number) {
    switch (word) {
        case 0:
            return word0;
        case 1:
            return word1;
        case 2:
            return word2;
        case 3:
            return word3;
        default:
            return word0;
    }
}
