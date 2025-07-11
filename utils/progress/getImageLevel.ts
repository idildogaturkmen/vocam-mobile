import { getBucketFileUrl } from '@/database/crudOperations';

export async function getImageLevel(level: number) {
    const levelUrl = `level${level}.png`;
    const imageUrl = await getBucketFileUrl('achievements-badges', levelUrl);
    return imageUrl;
}
