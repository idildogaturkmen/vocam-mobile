export function getImageTrophy(count: number): any {
    try {
        const trophyImages: Record<number, any> = {
            0: require('../../assets/progress/trophies/trophy0.png'),
            1: require('../../assets/progress/trophies/trophy1.png'),
            2: require('../../assets/progress/trophies/trophy2.png'),
            3: require('../../assets/progress/trophies/trophy3.png'),
            4: require('../../assets/progress/trophies/trophy4.png'),
        };
        return trophyImages[Math.min(count, 4)] || trophyImages[0];
    } catch (error) {
        console.error('Failed to get trophy image:', error);
        return null;
    }
}