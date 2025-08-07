export async function getImageLevel(level: number): Promise<any> {
    try {
        const levelImages: Record<number, any> = {
            0: require('../../assets/progress/levels/level0.png'),
            1: require('../../assets/progress/levels/level1.png'),
            2: require('../../assets/progress/levels/level2.png'),
            3: require('../../assets/progress/levels/level3.png'),
            4: require('../../assets/progress/levels/level4.png'),
            5: require('../../assets/progress/levels/level5.png'),
        };
        return levelImages[Math.min(level, 5)] || levelImages[0];
    } catch (error) {
        console.error('Failed to get level image:', error);
        return null;
    }
}