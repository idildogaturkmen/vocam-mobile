import level0 from '@/assets/progress/levels/level0.png';
import level1 from '@/assets/progress/levels/level1.png';
import level2 from '@/assets/progress/levels/level2.png';
import level3 from '@/assets/progress/levels/level3.png';
import level4 from '@/assets/progress/levels/level4.png';
import level5 from '@/assets/progress/levels/level5.png';

export function getImageLevel(level: number) {
    switch (level) {
        case 0:
            return level0;
        case 1:
            return level1;
        case 2:
            return level2;
        case 3:
            return level3;
        case 4:
            return level4;
        case 5:
            return level5;
    }
}
