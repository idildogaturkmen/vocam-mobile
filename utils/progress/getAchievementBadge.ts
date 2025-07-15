import { getBucketFileUrl } from '@/database/crudOperations';

export function getAchievementBadge(badgePath: string) {
    const imageUrl = getBucketFileUrl('public-images', badgePath);
    return imageUrl;
}
