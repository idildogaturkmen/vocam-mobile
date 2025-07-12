import { getBucketFileUrl } from '@/database/crudOperations';

export async function getImageTrophy(trophy: number) {
    const trophyUrl = `trophy${trophy}.png`;
    const imageUrl = await getBucketFileUrl('public-images', trophyUrl);
    return imageUrl;
}
