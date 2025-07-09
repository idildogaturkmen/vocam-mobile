import trophy0 from '@/assets/progress/trophies/trophy0.png';
import trophy1 from '@/assets/progress/trophies/trophy1.png';
import trophy2 from '@/assets/progress/trophies/trophy2.png';
import trophy3 from '@/assets/progress/trophies/trophy3.png';

export function getImageTrophy(trophy: number) {
    switch (trophy) {
        case 0:
            return trophy0;
        case 1:
            return trophy1;
        case 2:
            return trophy2;
        case 3:
            return trophy3;
    }
}
