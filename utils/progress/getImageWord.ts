import { getBucketFileUrl } from '@/database/crudOperations';

export async function getImageWord(word: number) {
    const wordUrl = `word${word}.png`;
    const imageUrl = await getBucketFileUrl('public-images', wordUrl);
    return imageUrl;
}
