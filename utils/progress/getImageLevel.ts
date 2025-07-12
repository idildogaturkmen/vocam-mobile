import { getBucketFileUrl } from '@/database/crudOperations';

export async function getImageLevel(level: number) {
    const levelUrl = `level${level}.png`;
    const imageUrl = await getBucketFileUrl('public-images', levelUrl);
    return imageUrl;
}
