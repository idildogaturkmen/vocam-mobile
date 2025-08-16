import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, normalizeFont } from '../utils/normalize';
import { supabase } from '../database/config';
import { AchievementService } from '../src/services/AchievementService';
import type { Achievement } from '../src/services/AchievementService';
import AchievementCard from '../components/Progress/AchievementCard';
import { getImageTrophy } from '../utils/progress/getImageTrophy';
import { useCache } from '../src/services/CacheService';

const { width } = Dimensions.get('window');

interface ExtendedAchievement extends Achievement {
    id: string;
    earned: boolean;
}

export default function AchievementsScreen() {
    const { fetchCached } = useCache();
    const router = useRouter();
    const [achievements, setAchievements] = useState<ExtendedAchievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'earned' | 'unearned'>('all');

    const loadAchievements = async (forceRefresh = false) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const userAchievements = await fetchCached(
                `achievements_${user.id}`,
                () => AchievementService.getAllAchievementsWithProgress(user.id, forceRefresh),
                'ACHIEVEMENTS',
                forceRefresh
            );
            
            const extendedAchievements: ExtendedAchievement[] = userAchievements.map((achievement, index) => ({
                ...achievement,
                id: achievement.id?.toString() || index.toString(),
                earned: achievement.earned ?? false
            }));

            setAchievements(extendedAchievements);
        } catch (error) {
            console.error('Error loading achievements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAchievements();
    }, []);

    const filteredAchievements = achievements
        .filter(achievement => {
            if (filter === 'earned') return achievement.earned;
            if (filter === 'unearned') return !achievement.earned;
            return true;
        })
        .sort((a, b) => {
            // Earned achievements first, sorted by hardest/most recent
            if (a.earned && !b.earned) return -1;
            if (!a.earned && b.earned) return 1;
            
            if (a.earned && b.earned) {
                // Both earned - sort by requirement value (hardest first), then by date (most recent first)
                const reqDiff = (b.requirement_value || 0) - (a.requirement_value || 0);
                if (reqDiff !== 0) return reqDiff;
                const dateA = new Date(a.achieved_at || 0).getTime();
                const dateB = new Date(b.achieved_at || 0).getTime();
                return dateB - dateA;
            } else {
                // Both unearned - sort by progress (highest first), then by requirement value (easiest first for motivation)
                const progressDiff = (b.progress || 0) - (a.progress || 0);
                if (progressDiff !== 0) return progressDiff;
                return (a.requirement_value || 0) - (b.requirement_value || 0);
            }
        });

    const earnedCount = achievements.filter(a => a.earned).length;
    const totalCount = achievements.length;

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={scale(24)} color="#2c3e50" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Achievements</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3498db" />
                    <Text style={styles.loadingText}>Loading achievements...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#2c3e50" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Achievements</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Progress Summary */}
            <View style={styles.summaryContainer}>
                <View style={styles.summaryCard}>
                    <View style={styles.trophyIcon}>
                        <Ionicons name="trophy" size={scale(32)} color="#f39c12" />
                    </View>
                    <View style={styles.summaryText}>
                        <Text style={styles.summaryTitle}>Progress</Text>
                        <Text style={styles.summarySubtitle}>
                            {earnedCount} of {totalCount} achievements unlocked
                        </Text>
                    </View>
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View 
                                style={[
                                    styles.progressFill, 
                                    { width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }
                                ]} 
                            />
                        </View>
                        <Text style={styles.progressText}>
                            {totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0}%
                        </Text>
                    </View>
                </View>
            </View>

            {/* Filter Buttons */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                    onPress={() => setFilter('all')}
                >
                    <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'earned' && styles.filterButtonActive]}
                    onPress={() => setFilter('earned')}
                >
                    <Text style={[styles.filterText, filter === 'earned' && styles.filterTextActive]}>
                        Earned
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'unearned' && styles.filterButtonActive]}
                    onPress={() => setFilter('unearned')}
                >
                    <Text style={[styles.filterText, filter === 'unearned' && styles.filterTextActive]}>
                        Locked
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Achievements List */}
            <ScrollView style={styles.achievementsList} showsVerticalScrollIndicator={false}>
                {filteredAchievements.length > 0 ? (
                    <View style={styles.achievementsGrid}>
                        {filteredAchievements.map((achievement) => (
                            <View key={achievement.id} style={styles.achievementWrapper}>
                                <AchievementCard
                                    achievement={{
                                        ...achievement,
                                        id: achievement.id!,
                                        earned: achievement.earned ?? false
                                    }}
                                />
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="trophy-outline" size={scale(64)} color="#bdc3c7" />
                        <Text style={styles.emptyTitle}>No Achievements</Text>
                        <Text style={styles.emptySubtitle}>
                            {filter === 'earned' 
                                ? "You haven't earned any achievements yet. Keep learning!"
                                : filter === 'unearned'
                                ? "All achievements have been unlocked! Great job!"
                                : "No achievements available at the moment."
                            }
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    backButton: {
        paddingTop: 35, // Adjusted for header height
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        paddingTop: 35
    },
    placeholder: {
        width: scale(40),
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: scale(16),
        fontSize: normalizeFont(16),
        color: '#7f8c8d',
    },
    summaryContainer: {
        padding: scale(20),
    },
    summaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: scale(16),
        padding: scale(20),
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.1,
        shadowRadius: scale(8),
        elevation: 3,
    },
    trophyIcon: {
        marginRight: scale(16),
    },
    summaryText: {
        flex: 1,
    },
    summaryTitle: {
        fontSize: normalizeFont(18),
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: scale(4),
    },
    summarySubtitle: {
        fontSize: normalizeFont(14),
        color: '#7f8c8d',
    },
    progressContainer: {
        alignItems: 'flex-end',
        minWidth: scale(80),
    },
    progressBar: {
        width: scale(80),
        height: scale(8),
        backgroundColor: '#ecf0f1',
        borderRadius: scale(4),
        marginBottom: scale(8),
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#3498db',
        borderRadius: scale(4),
    },
    progressText: {
        fontSize: normalizeFont(16),
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: scale(20),
        marginBottom: scale(16),
    },
    filterButton: {
        flex: 1,
        paddingVertical: scale(12),
        paddingHorizontal: scale(12),
        marginHorizontal: scale(4),
        backgroundColor: '#ffffff',
        borderRadius: scale(12),
        borderWidth: scale(1),
        borderColor: '#ecf0f1',
    },
    filterButtonActive: {
        backgroundColor: '#3498db',
        borderColor: '#3498db',
    },
    filterText: {
        textAlign: 'center',
        fontSize: normalizeFont(14),
        fontWeight: '600',
        color: '#7f8c8d',
    },
    filterTextActive: {
        color: '#ffffff',
    },
    achievementsList: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    achievementsGrid: {
        paddingBottom: scale(20),
    },
    achievementWrapper: {
        marginBottom: scale(16),
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(60),
    },
    emptyTitle: {
        fontSize: normalizeFont(20),
        fontWeight: 'bold',
        color: '#7f8c8d',
        marginTop: scale(16),
        marginBottom: scale(8),
    },
    emptySubtitle: {
        fontSize: normalizeFont(16),
        color: '#95a5a6',
        textAlign: 'center',
        lineHeight: normalizeFont(24),
        paddingHorizontal: scale(40),
    },
});