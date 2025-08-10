import { useRef, useCallback } from 'react';

// Cache entry interface
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresIn: number; // milliseconds
}

// Cache configuration for different data types
export const CACHE_CONFIG = {
    PROFILE: 120000,        // 2 minutes
    USER_STATS: 90000,      // 1.5 minutes
    ACHIEVEMENTS: 300000,   // 5 minutes
    VOCABULARY: 180000,     // 3 minutes
    DAILY_GOAL: 60000,      // 1 minute
    LEVEL_INFO: 120000,     // 2 minutes
    AVATAR_CONFIG: 600000,  // 10 minutes
} as const;

export type CacheKey = keyof typeof CACHE_CONFIG;

// Cache service using useRef for component-level caching
export class CacheService {
    private cache: Map<string, CacheEntry<any>>;

    constructor() {
        this.cache = new Map();
    }

    // Get cached data if it exists and hasn't expired
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > entry.expiresIn;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    // Set data in cache with expiration
    set<T>(key: string, data: T, cacheType: CacheKey): void {
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            expiresIn: CACHE_CONFIG[cacheType]
        };
        this.cache.set(key, entry);
    }

    // Remove specific key from cache
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    // Remove all entries matching a pattern
    invalidatePattern(pattern: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    // Clear all cache
    clear(): void {
        this.cache.clear();
    }

    // Get cache status for debugging
    getStatus(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Hook for using cache service in components
export function useCache() {
    const cacheRef = useRef<CacheService>(new CacheService());
    const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());

    // Cached data fetcher with automatic caching and request deduplication
    const fetchCached = useCallback(
        async <T>(
            key: string,
            fetcher: () => Promise<T>,
            cacheType: CacheKey,
            forceRefresh = false
        ): Promise<T> => {
            const cache = cacheRef.current;
            const pending = pendingRequests.current;

            // Return cached data if available and not forcing refresh
            if (!forceRefresh) {
                const cached = cache.get<T>(key);
                if (cached !== null) {
                    return cached;
                }
            }

            // Check if there's already a pending request for this key
            if (!forceRefresh && pending.has(key)) {
                // Request deduplication active - sharing existing promise
                return pending.get(key) as Promise<T>;
            }

            // Create new request
            const request = (async () => {
                try {
                    const data = await fetcher();
                    cache.set(key, data, cacheType);
                    return data;
                } catch (error) {
                    // Return cached data even if expired on fetch failure
                    const fallbackCached = cache.get<T>(key);
                    if (fallbackCached !== null) {
                        console.warn(`Using stale cache for ${key} due to fetch error:`, error);
                        return fallbackCached;
                    }
                    throw error;
                } finally {
                    // Always clean up pending request
                    pending.delete(key);
                }
            })();

            // Store pending request
            pending.set(key, request);
            return request;
        },
        []
    );

    // Invalidate cache entries
    const invalidateCache = useCallback((keyOrPattern: string) => {
        const cache = cacheRef.current;
        if (keyOrPattern.includes('*')) {
            cache.invalidatePattern(keyOrPattern.replace('*', ''));
        } else {
            cache.invalidate(keyOrPattern);
        }
    }, []);

    // Clear all cache
    const clearCache = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    // Get cache status
    const getCacheStatus = useCallback(() => {
        return cacheRef.current.getStatus();
    }, []);

    return {
        fetchCached,
        invalidateCache,
        clearCache,
        getCacheStatus
    };
}

// Utility function to create cache keys
export const createCacheKey = (type: string, userId: string, ...params: string[]): string => {
    const baseKey = `${type}_${userId}`;
    return params.length > 0 ? `${baseKey}_${params.join('_')}` : baseKey;
};

// Pre-defined cache key creators
export const CacheKeys = {
    profile: (userId: string) => createCacheKey('profile', userId),
    userStats: (userId: string) => createCacheKey('userStats', userId),
    achievements: (userId: string) => createCacheKey('achievements', userId),
    vocabulary: (userId: string, languageFilter?: string) => 
        createCacheKey('vocabulary', userId, languageFilter || 'all'),
    dailyGoal: (userId: string) => createCacheKey('dailyGoal', userId),
    levelInfo: (userId: string) => createCacheKey('levelInfo', userId),
    avatarConfig: (userId: string) => createCacheKey('avatarConfig', userId),
};

export default CacheService;