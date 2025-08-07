export async function getImageWord(count: number): Promise<any> {
    try {
        const wordImages: Record<number, any> = {
            0: require('../../assets/progress/words/word0.png'),
            1: require('../../assets/progress/words/word1.png'),
            2: require('../../assets/progress/words/word2.png'),
            3: require('../../assets/progress/words/word3.png'),
        };
        
        let imageIndex = 0;
        if (count >= 50) imageIndex = 3;
        else if (count >= 25) imageIndex = 2;
        else if (count >= 10) imageIndex = 1;
        else imageIndex = 0;
        
        return wordImages[imageIndex];
    } catch (error) {
        console.error('Failed to get word image:', error);
        return null;
    }
}