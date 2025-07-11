import { getBucketFileUrl } from '@/database/crudOperations';

export async function getImageWord(word: number) {
    const wordUrl = `word${word}.png`;
    const imageUrl = await getBucketFileUrl('achievements-badges', wordUrl);
    return imageUrl;
}
