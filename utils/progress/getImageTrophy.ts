import { getBucketFileUrl } from '@/database/crudOperations';

export async function getImageTrophy(trophy: number) {
    const trophyUrl = `trophies/trophy${trophy}.png`;
    const imageUrl = await getBucketFileUrl('public-images', trophyUrl);
    return imageUrl;
}
