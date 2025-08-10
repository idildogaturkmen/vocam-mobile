// Test component to verify useCache hook functionality
// This can be imported and used in development to test caching

import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { useCache } from './CacheService';

interface TestData {
    timestamp: number;
    value: string;
}

// Mock async function to simulate data fetching
const mockFetchData = async (delay: number = 1000): Promise<TestData> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                timestamp: Date.now(),
                value: `Fetched at ${new Date().toLocaleTimeString()}`
            });
        }, delay);
    });
};

export default function CacheServiceTest() {
    const { fetchCached, invalidateCache, clearCache, getCacheStatus } = useCache();
    const [data, setData] = useState<TestData | null>(null);
    const [loading, setLoading] = useState(false);
    const [cacheStatus, setCacheStatus] = useState<{ size: number; keys: string[] }>({ size: 0, keys: [] });

    const fetchData = async (forceRefresh = false) => {
        setLoading(true);
        try {
            const result = await fetchCached(
                'test_data',
                () => mockFetchData(1000),
                'USER_STATS',
                forceRefresh
            );
            setData(result);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateCacheStatus = () => {
        setCacheStatus(getCacheStatus());
    };

    useEffect(() => {
        fetchData();
        updateCacheStatus();
    }, []);

    return (
        <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
                🧪 Cache Service Test
            </Text>

            <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                    Current Data:
                </Text>
                {loading ? (
                    <Text>Loading...</Text>
                ) : (
                    <Text>{data ? JSON.stringify(data, null, 2) : 'No data'}</Text>
                )}
            </View>

            <View style={{ backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                    Cache Status:
                </Text>
                <Text>Size: {cacheStatus.size}</Text>
                <Text>Keys: {cacheStatus.keys.join(', ')}</Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Button
                    title="Fetch (Cached)"
                    onPress={() => {
                        fetchData(false);
                        updateCacheStatus();
                    }}
                />
                <Button
                    title="Force Refresh"
                    onPress={() => {
                        fetchData(true);
                        updateCacheStatus();
                    }}
                />
                <Button
                    title="Invalidate"
                    onPress={() => {
                        invalidateCache('test_data');
                        updateCacheStatus();
                    }}
                />
                <Button
                    title="Clear All"
                    onPress={() => {
                        clearCache();
                        updateCacheStatus();
                    }}
                />
            </View>

            <View style={{ backgroundColor: '#e8f5e8', padding: 15, borderRadius: 10, marginTop: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#2d5a2d', marginBottom: 10 }}>
                    ✅ Test Instructions:
                </Text>
                <Text style={{ color: '#2d5a2d', lineHeight: 20 }}>
                    1. "Fetch (Cached)" - Should return instantly after first load{'\n'}
                    2. "Force Refresh" - Should take ~1 second to fetch new data{'\n'}
                    3. "Invalidate" - Clears cache for this key{'\n'}
                    4. "Clear All" - Clears entire cache{'\n\n'}
                    Watch the timestamps to verify caching is working!
                </Text>
            </View>

            <View style={{ backgroundColor: '#fff3cd', padding: 15, borderRadius: 10, marginTop: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#856404', marginBottom: 10 }}>
                    📊 Performance Benefits:
                </Text>
                <Text style={{ color: '#856404', lineHeight: 20 }}>
                    • Reduced database calls{'\n'}
                    • Faster app responsiveness{'\n'}
                    • Better offline experience{'\n'}
                    • Automatic cache management{'\n'}
                    • Error fallback to cached data
                </Text>
            </View>
        </ScrollView>
    );
}