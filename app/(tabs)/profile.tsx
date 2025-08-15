import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type { EmitterSubscription } from 'react-native';
import EventService from '../../src/services/EventService';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LogoutButton from '../../components/Auth/Logout';
import DeleteAccountButton from '../../components/Auth/DeleteAccount';
import MicrophoneTest from '../../src/components/MicrophoneTest';
import SessionService from '../../src/services/SessionService';
import VocabularyService from '../../src/services/VocabularyService';
import { supabase } from '../../database/config';
import HumanAvatar, { 
    HumanAvatarConfig, 
    AvatarStyle
} from '../../src/components/Avatar';
import FireStreak from '../../components/Progress/FireStreak';
import XPBar from '../../components/Progress/XPBar';
import { getProfile } from '../../utils/progress/getProfile';
import { getDailyGoal, getDailyGoalFromLog, DailyGoal } from '../../utils/progress/getDailyGoal';
import { useCache } from '../../src/services/CacheService';
import { AchievementService } from '../../src/services/AchievementService';
import type { Achievement } from '../../src/services/AchievementService';
import { LevelingService } from '../../src/services/LevelingService';
import { BadgeCard } from '../../components/Progress/BadgeCard';
import { getAchievementBadge } from '../../utils/progress/getAchievementBadge';
import AchievementCard from '../../components/Progress/AchievementCard';
import { getImageLevel } from '../../utils/progress/getImageLevel';
import { getImageTrophy } from '../../utils/progress/getImageTrophy';
import { getImageWord } from '../../utils/progress/getImageWord';
import { StatBox } from '../../components/Progress/StatBox';

const { width } = Dimensions.get('window');

// Language flags and names (keeping existing mappings)
const LANGUAGE_FLAGS: Record<string, string> = {
    'ar': '🇸🇦', 'bn': '🇧🇩', 'bg': '🇧🇬', 'zh-CN': '🇨🇳', 'zh-TW': '🇹🇼',
    'hr': '🇭🇷', 'cs': '🇨🇿', 'da': '🇩🇰', 'nl': '🇳🇱', 'tl': '🇵🇭',
    'fi': '🇫🇮', 'fr': '🇫🇷', 'de': '🇩🇪', 'el': '🇬🇷', 'gu': '🇮🇳',
    'he': '🇮🇱', 'hi': '🇮🇳', 'hu': '🇭🇺', 'is': '🇮🇸', 'id': '🇮🇩',
    'it': '🇮🇹', 'ja': '🇯🇵', 'ko': '🇰🇷', 'la': '🇻🇦', 'ms': '🇲🇾',
    'no': '🇳🇴', 'fa': '🇮🇷', 'pl': '🇵🇱', 'pt': '🇵🇹', 'pa': '🇮🇳',
    'ro': '🇷🇴', 'ru': '🇷🇺', 'sr': '🇷🇸', 'sk': '🇸🇰', 'es': '🇪🇸',
    'sw': '🇰🇪', 'sv': '🇸🇪', 'ta': '🇱🇰', 'te': '🇮🇳', 'th': '🇹🇭',
    'tr': '🇹🇷', 'uk': '🇺🇦', 'ur': '🇵🇰', 'vi': '🇻🇳'
};

const LANGUAGE_NAMES: Record<string, string> = {
    'ar': 'Arabic', 'bn': 'Bengali', 'bg': 'Bulgarian', 'zh-CN': 'Chinese (Simplified)', 
    'zh-TW': 'Chinese (Traditional)', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish',
    'nl': 'Dutch', 'tl': 'Filipino', 'fi': 'Finnish', 'fr': 'French', 'de': 'German',
    'el': 'Greek', 'gu': 'Gujarati', 'he': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian',
    'is': 'Icelandic', 'id': 'Indonesian', 'it': 'Italian', 'ja': 'Japanese', 'ko': 'Korean',
    'la': 'Latin', 'ms': 'Malay', 'no': 'Norwegian', 'fa': 'Persian (Farsi)', 'pl': 'Polish',
    'pt': 'Portuguese', 'pa': 'Punjabi', 'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian',
    'sk': 'Slovak', 'es': 'Spanish', 'sw': 'Swahili', 'sv': 'Swedish', 'ta': 'Tamil',
    'te': 'Telugu', 'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'ur': 'Urdu',
    'vi': 'Vietnamese'
};

interface UserStats {
    uniqueWords: number;
    totalTranslations: number;
    totalWords: number;    
    masteredWords: number;
    averageProficiency: number;
    currentStreak: number;
}

interface LanguageProgress {
    [key: string]: number;
}

const getMotivationalMessage = (level: number, streak: number, wordsLearned: number): string => {
    if (streak >= 7) return "You're on fire! Keep that streak alive!";
    if (level >= 5) return "You're becoming a vocabulary master!";
    if (wordsLearned >= 50) return "Incredible progress! You're unstoppable!";
    if (streak >= 3) return "Great consistency! Keep it up!";
    if (wordsLearned >= 10) return "Your vocabulary is growing fast!";
    return "Every word learned is a step forward!";
};

function ProfileScreen() {
    const { fetchCached, invalidateCache } = useCache();
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    
    const [languageProgress, setLanguageProgress] = useState<LanguageProgress>({});

    // Helper function to get corrected stats
    const getCorrectedStats = async (userId: string, baseStats: any, forceRefresh = false) => {
        try {
            const [langProgress, uniqueWordsCount] = await Promise.all([
                VocabularyService.getUserVocabularyCounts(userId, forceRefresh),
                VocabularyService.getUniqueWordsCount(userId, forceRefresh)
            ]);
            
            const totalWordsCount = Object.values(langProgress).reduce((sum: number, count: number) => sum + count, 0);
            
            return {
                ...baseStats,
                uniqueWords: uniqueWordsCount,
                totalWords: totalWordsCount,
                totalTranslations: totalWordsCount
            };
        } catch (error) {
            console.error('Error correcting stats:', error);
            return baseStats;
        }
    };
    // Comprehensive loading states
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [avatarLoaded, setAvatarLoaded] = useState(false);
    const [statsLoaded, setStatsLoaded] = useState(false);
    const [achievementsLoaded, setAchievementsLoaded] = useState(false);
    const [dailyGoalLoaded, setDailyGoalLoaded] = useState(false);
    const [languageProgressLoaded, setLanguageProgressLoaded] = useState(false);
    
    const [level, setLevel] = useState<number>(0);
    const [exp, setExp] = useState<number>(0);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [dailyGoal, setDailyGoal] = useState<DailyGoal>({ current: 0, target: 5, percentage: 0 });
    const [profileData, setProfileData] = useState<any>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    
    // Computed loading state - only show profile when all critical components are ready
    const allCriticalDataLoaded = useMemo(() => {
        return profileLoaded && avatarLoaded && statsLoaded && achievementsLoaded && dailyGoalLoaded && languageProgressLoaded;
    }, [profileLoaded, avatarLoaded, statsLoaded, achievementsLoaded, dailyGoalLoaded, languageProgressLoaded]);
const router = useRouter();
    
    // FIXED: Updated default avatar configuration with REAL DiceBear parameter values
    const [avatarConfig, setAvatarConfig] = useState<HumanAvatarConfig>({
        style: 'personas',
        backgroundColor: 'b6e3f4',
        skinColor: 'e5a07e',
        hairColor: '6c4545',
        hair: 'long',
        eyes: 'open',
        mouth: 'smile',
        nose: 'mediumRound',
        facialHair: 'none',
        body: 'rounded',
        clothingColor: '456dff',
    });
    

    // Memoize all image functions to prevent multiple calls
    const wordImageFn = useCallback(async () => await getImageWord(stats?.totalTranslations || 0), [stats?.totalTranslations]);
    const levelImageFn = useCallback(async () => await getImageLevel(level), [level]);
    // Memoize trophy count to prevent recalculation and flashing
    const earnedAchievementCount = useMemo(() => {
        if (!achievementsLoaded || !achievements.length) {
            return null; // Return null when not loaded yet
        }
        return achievements.filter(a => a.earned).length;
    }, [achievements, achievementsLoaded]);
    
    // Only show trophy image when achievements are actually loaded
    const trophyImageFn = useCallback(() => {
        if (earnedAchievementCount === null) {
            // Show a neutral trophy image while loading
            return getImageTrophy(1);
        }
        return getImageTrophy(earnedAchievementCount);
    }, [earnedAchievementCount]);

    useEffect(() => {
        checkAuthAndLoadUserData();
        
        // Check for cached achievements immediately on mount
        const checkCachedAchievements = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Try to get cached achievements immediately
                    const cached = await fetchCached(
                        `achievements_${user.id}`,
                        () => Promise.resolve([]), // Empty fallback, won't be called if cached
                        'ACHIEVEMENTS',
                        false // Don't force refresh
                    );
                    
                    if (cached && cached.length > 0) {
                        setAchievements(cached);
                        setAchievementsLoaded(true);
                    }
                }
            } catch (error) {
                console.error('Error loading cached achievements:', error);
            }
        };
        
        checkCachedAchievements();
        
        // Listen for vocabulary changes to update profile counts immediately
        let vocabularyChangeSubscription: EmitterSubscription | null = null;
        
        const setupVocabularyListener = () => {
            try {
                vocabularyChangeSubscription = EventService.onVocabularyChange((event) => {
                    const { userId, action, languages, countChange } = event;
                    
                    // Only update if it's for the current user
                    if (user?.id === userId && action === 'deleted') {
                        
                        // Instant UI update - no need to wait for server refresh!
                        if (languages && countChange && stats) {
                            setStats(prevStats => {
                                if (!prevStats) return null;
                                // For unique words, only decrement if this was the last occurrence of this base word
                                // For simplicity, we'll let the background refresh handle the unique count accurately
                                const newTotalTranslations = Math.max(0, (prevStats.totalTranslations || 0) + (countChange * languages.length));
                                return {
                                    ...prevStats,
                                    totalTranslations: newTotalTranslations
                                };
                            });
                            
                            // Update language progress counts
                            setLanguageProgress(prevLangProgress => {
                                const updatedProgress = { ...prevLangProgress };
                                languages.forEach(lang => {
                                    if (updatedProgress[lang]) {
                                        updatedProgress[lang] += countChange;
                                        if (updatedProgress[lang] <= 0) {
                                            delete updatedProgress[lang];
                                        }
                                    }
                                });
                                return updatedProgress;
                            });
                        }
                        
                        // Optional: Do a background refresh after a delay to sync with server
                        setTimeout(() => {
                            checkAuthAndLoadUserData(true);
                        }, 2000); // 2 second delay for background sync
                    }
                });
            } catch (error) {
                console.warn('Could not set up vocabulary change listener:', error);
            }
        };
        
        setupVocabularyListener();
        
        // Cleanup event listener
        return () => {
            if (vocabularyChangeSubscription) {
                vocabularyChangeSubscription.remove();
                vocabularyChangeSubscription = null;
            }
        };
    }, [user?.id]);

    // Reduced auto-refresh for better performance
    useEffect(() => {
        if (!isAuthenticated) return;

        const interval = setInterval(async () => {
            // Double-check authentication before running operations
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || refreshing) return;
            
            // Only refresh basic stats, not full profile
            try {
                const userStats = await fetchCached(
                    `userStats_${user.id}`,
                    () => SessionService.getUserStats(user.id),
                    'USER_STATS'
                );
                const correctedStats = await getCorrectedStats(user.id, userStats);
                setStats(correctedStats);
                const goalData = await fetchCached(
                    `dailyGoal_${user.id}`,
                    () => getDailyGoalFromLog(),
                    'DAILY_GOAL'
                );
                setDailyGoal(goalData);
            } catch (error) {
                console.error('Background refresh error:', error);
            }
        }, 120000); // 2 minutes instead of 30 seconds

        return () => clearInterval(interval);
    }, [isAuthenticated, refreshing, fetchCached]);

    // Refresh when screen comes into focus (but less aggressive)
    useFocusEffect(
        useCallback(() => {
            if (isAuthenticated && !loading && !refreshing) {
                // Only do light refresh on focus, full refresh on pull-to-refresh
                const lightRefresh = async () => {
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        
                        const [userStats, goalData, avatarResult] = await Promise.all([
                            fetchCached(
                                `userStats_${user.id}`,
                                () => SessionService.getUserStats(user.id),
                                'USER_STATS'
                            ),
                            fetchCached(
                                `dailyGoal_${user.id}`,
                                () => getDailyGoalFromLog(),
                                'DAILY_GOAL'
                            ),
                            // Refresh avatar config in case it was updated
                            fetchCached(
                                `avatarConfig_${user.id}`,
                                async () => {
                                    const { data, error } = await supabase
                                        .from('avatars')
                                        .select('avatar_config')
                                        .eq('user_id', user.id)
                                        .single();
                                    return { data, error };
                                },
                                'AVATAR_CONFIG',
                                true // Force refresh to get latest avatar
                            )
                        ]);
                        const correctedStats = await getCorrectedStats(user.id, userStats);
                        setStats(correctedStats);
                        setDailyGoal(goalData);
                        
                        // Update avatar config if changed
                        const { data: avatarData, error: avatarError } = avatarResult as any;
                        if (avatarData?.avatar_config && !avatarError) {
                            const config = avatarData.avatar_config;
                            // Don't merge with default avatar config to prevent glitch
                            const cleanConfig = { ...config, style: 'personas' as AvatarStyle };
                            setAvatarConfig(cleanConfig);
                        }
                    } catch (error) {
                        console.error('Focus refresh error:', error);
                    }
                };
                lightRefresh();
            }
        }, [isAuthenticated, loading, refreshing, fetchCached])
    );

    const checkAuthAndLoadUserData = async (forceRefresh = false) => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) {
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }
            
            setIsAuthenticated(true);
            setUser(currentUser);
            await loadUserData(currentUser, forceRefresh);
        } catch (error) {
            console.error('Auth check error:', error);
            setIsAuthenticated(false);
            setLoading(false);
        }
    };

    const loadUserData = async (currentUser: any, forceRefresh = false) => {
        try {
            if (currentUser) {
                // Load achievements first to prevent trophy flashing
                const achievementsList = await fetchCached(
                    `achievements_${currentUser.id}`,
                    () => AchievementService.getAllAchievementsWithProgress(currentUser.id, forceRefresh),
                    'ACHIEVEMENTS',
                    forceRefresh
                );
                
                // Set achievements immediately to prevent trophy flashing
                setAchievements(achievementsList);
                setAchievementsLoaded(true);
                
                // Load only the most critical data immediately 
                const profile = await fetchCached(
                    `profile_${currentUser.id}`,
                    () => getProfile(forceRefresh),
                    'PROFILE',
                    forceRefresh
                );

                // Set critical data immediately for faster UI
                setProfileData(profile);
                setLevel(profile?.level || 0);
                setExp(profile?.totalXP || 0);
                setProfileLoaded(true);

                // Load all remaining data in background after UI update
                setTimeout(async () => {
                    try {
                        const [
                            avatarResult,
                            userStats,
                            vocabulary,
                            goalData
                        ] = await Promise.all([
                            fetchCached(
                                `avatarConfig_${currentUser.id}`,
                                async () => {
                                    const { data, error } = await supabase
                                        .from('avatars')
                                        .select('avatar_config')
                                        .eq('user_id', currentUser.id)
                                        .single();
                                    return { data, error };
                                },
                                'AVATAR_CONFIG',
                                forceRefresh
                            ),
                    fetchCached(
                        `userStats_${currentUser.id}`,
                        async () => {
                            // Get base stats but we'll correct them below
                            const baseStats = await SessionService.getUserStats(currentUser.id, forceRefresh);
                            return baseStats;
                        },
                        'USER_STATS',
                        forceRefresh
                    ),
                    fetchCached(
                        `avatarConfig_${currentUser.id}`,
                        async () => {
                            const { data, error } = await supabase
                                .from('avatars')
                                .select('avatar_config')
                                .eq('user_id', currentUser.id)
                                .single();
                            return { data, error };
                        },
                        'VOCABULARY',
                        forceRefresh
                    ),
                    fetchCached(
                        `dailyGoal_${currentUser.id}`,
                        () => getDailyGoalFromLog(),
                        'DAILY_GOAL',
                        forceRefresh
                    )
                ]);

                // Set remaining data with loading states
                setDailyGoal(goalData);
                setDailyGoalLoaded(true);

                // Use helper function to get corrected stats
                const correctedStats = await getCorrectedStats(currentUser.id, userStats, true);
                
                // Also get language progress for display
                const langProgress = await VocabularyService.getUserVocabularyCounts(currentUser.id, true);
                
                setStats(correctedStats);
                setStatsLoaded(true);
                setLanguageProgress(langProgress);
                setLanguageProgressLoaded(true);
                
                // Handle avatar config
                const { data: avatarData, error: avatarError } = avatarResult as any;
                if (avatarData?.avatar_config && !avatarError) {
                    const config = avatarData.avatar_config;
                    const cleanConfig = { ...config, style: 'personas' as AvatarStyle };
                    setAvatarConfig(cleanConfig);
                }
                setAvatarLoaded(true);
                

                    } catch (error) {
                        console.error('Error loading background data:', error);
                    }
                }, 100);

                // Defer non-critical operations to improve initial load time
                setTimeout(() => {
                    // Handle level sync in background (achievements already loaded above)
                    LevelingService.syncUserLevel(currentUser.id).then(async (syncResult) => {
                        // Handle level sync if needed
                        if (syncResult && syncResult.oldLevel !== syncResult.newLevel) {
                            const updatedProfile = await getProfile(true);
                            setProfileData(updatedProfile);
                            setLevel(updatedProfile?.level || 0);
                        }
                    }).catch(error => console.error('Error syncing user level:', error));
                    
                    // Check for new achievements (this is less critical, can be slower)
                    AchievementService.checkAndAwardAchievements(currentUser.id).then(newAchievements => {
                        if (newAchievements.length > 0) {
                            // Invalidate achievements cache and reload
                            invalidateCache(`achievements_${currentUser.id}`);
                            AchievementService.getAllAchievementsWithProgress(currentUser.id, true).then(updatedAchievements => {
                                setAchievements(updatedAchievements);
                            });
                        }
                    }).catch(error => console.error('Error checking new achievements:', error));
                }, 1000); // Defer by 1 second to improve initial loading
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const refreshDailyGoal = async () => {
        try {
            // Try the enhanced version first, fallback to original
            const goalData = await getDailyGoalFromLog();
            setDailyGoal(goalData);
        } catch (error) {
            console.error('Error refreshing daily goal:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        // Reset all loading states for fresh load
        setProfileLoaded(false);
        setAvatarLoaded(false);
        setStatsLoaded(false);
        setAchievementsLoaded(false);
        setDailyGoalLoaded(false);
        setLanguageProgressLoaded(false);
        // Force refresh to bypass cache
        checkAuthAndLoadUserData(true);
    };


    // Show loading screen until all critical data is ready
    if (loading || !allCriticalDataLoaded) {
        return (
            <View style={styles.loadingContainer}>
                <Ionicons name="person-circle" size={60} color="#c7c7c7" />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    // Show login warning if not authenticated
    if (isAuthenticated === false) {
        return (
            <View style={[styles.container, { backgroundColor: 'white' }]}> 
                <View style={styles.authHeader}> 
                    <View><Text style={styles.authHeaderTitle}>Profile</Text>
                    </View>
                </View>
                <View style={styles.authRequiredContainer}>
                    <Ionicons name="information-circle-outline" size={64} color="#f39c12" />
                    <Text style={styles.authRequiredTitle}>Login Required</Text>
                    <Text style={styles.authRequiredText}>
                        You must be logged in to view and manage your profile.
                    </Text>
                    <Text style={styles.authRequiredSubtext}>
                        Login to access your stats, achievements, avatar customization, and settings.
                    </Text>
                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={() => router.replace('/')}
                    >
                        <Text style={styles.loginButtonText}>Go to Login</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={() => router.replace('/(tabs)/detection')}
                    >
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <ScrollView 
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            {/* Header Section */}
            <View style={styles.header}>
                <View style={styles.profileSection}>
                    <View style={styles.avatarContainer}>
                        <TouchableOpacity 
                            onPress={() => router.push('/avatar-editor')}
                        >
                            <HumanAvatar
                                config={avatarConfig}
                                size={80}
                                seed={`${user?.email || 'default'}-${JSON.stringify(avatarConfig)}`}
                            />
                        </TouchableOpacity>
                        <View style={styles.avatarBorder} />
                        <TouchableOpacity 
                            style={styles.editAvatarButton}
                            onPress={() => router.push('/avatar-editor')}
                        >
                            <Ionicons name="pencil" size={14} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                            {user?.email?.split('@')[0] || 'User'}
                        </Text>
                        <Text style={styles.userEmail}>{user?.email}</Text>
                        <View style={styles.memberSince}>
                            <Ionicons name="calendar" size={14} color="#7f8c8d" />
                            <Text style={styles.memberSinceText}>
                                Member since {new Date(user?.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                        
                        <View style={styles.streakDisplay}>
                            <FireStreak streak={stats?.currentStreak || 0} />
                        </View>
                    </View>
                </View>
            </View>

            {/* Motivational Quote */}
            <View style={styles.quoteContainer}>
                <Text style={styles.quote}>
                    {getMotivationalMessage(level, stats?.currentStreak || 0, stats?.uniqueWords || 0)}
                </Text>
            </View>

            {/* Progress Stats - Enhanced */}
            <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Learning Progress</Text>
                
                <View style={styles.statsRow}>
                    <StatBox
                        label="Level"
                        value={level}
                        image={levelImageFn}
                    />
                    <StatBox
                        label="Trophies"
                        value={earnedAchievementCount !== null ? earnedAchievementCount : '...'}
                        image={trophyImageFn}
                    />
                    <StatBox
                        label="Words Learned"
                        value={`${stats?.totalTranslations || 0}`}
                        image={wordImageFn}
                    />
                </View>
                
                <XPBar 
                    currentXP={profileData?.exp || 0} 
                    xpToNextLevel={profileData?.xpForNextLevel || 100} 
                />
                
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Ionicons name="book" size={24} color="#3498db" />
                        <Text style={styles.statNumber}>{stats?.uniqueWords || 0}</Text>
                        <Text style={styles.statLabel}>Unique Words</Text>
                        <Text style={styles.statSubLabel}>Distinct vocabulary</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                        <Ionicons name="language" size={24} color="#2ecc71" />
                        <Text style={styles.statNumber}>{stats?.totalTranslations || 0}</Text>
                        <Text style={styles.statLabel}>Total Learned</Text>
                        <Text style={styles.statSubLabel}>All languages</Text>
                    </View>
                </View>
                
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Ionicons name="trophy" size={24} color="#f39c12" />
                        <Text style={styles.statNumber}>{stats?.masteredWords || 0}</Text>
                        <Text style={styles.statLabel}>Unique Mastered</Text>
                        <Text style={styles.statSubLabel}>80%+ proficiency</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                        <Ionicons name="medal" size={24} color="#e74c3c" />
                        <Text style={styles.statNumber}>{(stats as any)?.totalMasteredTranslations || 0}</Text>
                        <Text style={styles.statLabel}>Total Mastered</Text>
                        <Text style={styles.statSubLabel}>All languages</Text>
                    </View>
                </View>
                
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Ionicons name="trending-up" size={24} color="#2ecc71" />
                        <Text style={styles.statNumber}>{stats?.averageProficiency || 0}%</Text>
                        <Text style={styles.statLabel}>Avg Proficiency</Text>
                    </View>
                </View>

                {/* Daily Goal Progress */}
                <View style={styles.dailyGoalContainer}>
                    <View style={styles.goalHeader}>
                        <Text style={styles.goalTitle}>Daily Goal</Text>
                        <Text style={styles.goalProgress}>{dailyGoal.current}/{dailyGoal.target} words</Text>
                    </View>
                    <View style={styles.goalBar}>
                        <View style={[styles.goalFill, { width: `${dailyGoal.percentage}%` }]} />
                    </View>
                    <Text style={styles.goalText}>
                        {dailyGoal.current >= dailyGoal.target 
                            ? "Great job! You've completed today's goal!" 
                            : `Learn ${dailyGoal.target - dailyGoal.current} more words to complete today's goal!`
                        }
                    </Text>
                </View>
            </View>

            {/* Learning Streak Calendar */}
            <View style={styles.streakSection}>
                <Text style={styles.sectionTitle}>Learning Streak</Text>
                <View style={styles.streakCalendar}>
                    {Array.from({ length: 7 }, (_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.streakDay,
                                i < (stats?.currentStreak || 0) ? styles.streakDayActive : styles.streakDayInactive
                            ]}
                        >
                            <Text style={[
                                styles.streakDayText,
                                i < (stats?.currentStreak || 0) ? styles.streakDayTextActive : styles.streakDayTextInactive
                            ]}>
                                {i + 1}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Achievements Section */}
            <View style={styles.achievementsSection}>
                <Text style={styles.sectionTitle}>Achievements</Text>
                
                {achievements.length > 0 ? (
                    <>
                        {/* Show earned achievements first - hardest/most recent */}
                        {achievements
                            .filter(achievement => achievement.earned && achievement.id)
                            .sort((a, b) => {
                                // First sort by requirement value (hardest first)
                                const reqDiff = (b.requirement_value || 0) - (a.requirement_value || 0);
                                if (reqDiff !== 0) return reqDiff;
                                // Then by achievement date (most recent first)
                                const dateA = new Date(a.achieved_at || 0).getTime();
                                const dateB = new Date(b.achieved_at || 0).getTime();
                                return dateB - dateA;
                            })
                            .slice(0, 3) // Show only first 3 earned
                            .map(achievement => (
                                <AchievementCard
                                    key={achievement.slug}
                                    achievement={{...achievement, id: achievement.id!, earned: achievement.earned ?? false}}
                                />
                            ))}
                        
                        {/* Show progress on closest unearned achievements */}
                        {achievements
                            .filter(achievement => !achievement.earned && (achievement.progress || 0) > 0 && achievement.id)
                            .sort((a, b) => (b.progress || 0) - (a.progress || 0))
                            .slice(0, 2) // Show 2 achievements in progress
                            .map(achievement => (
                                <AchievementCard
                                    key={achievement.slug}
                                    achievement={{...achievement, id: achievement.id!, earned: achievement.earned ?? false}}
                                />
                            ))}
                        
                        <TouchableOpacity 
                            style={styles.viewAllAchievements}
                            onPress={() => router.push('/achievements')}
                        >
                            <Text style={styles.viewAllText}>
                                View All Achievements ({achievements.filter(a => a.earned).length}/{achievements.length})
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color="#3498db" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.noAchievements}>
                        <Ionicons name="trophy" size={48} color="#bdc3c7" />
                        <Text style={styles.noAchievementsText}>No achievements yet</Text>
                        <Text style={styles.noAchievementsSubtext}>Keep learning to unlock your first achievement!</Text>
                    </View>
                )}
            </View>

            {/* Languages Section */}
            <View style={styles.languagesSection}>
                <Text style={styles.sectionTitle}>Languages You're Learning</Text>
                
                {Object.keys(languageProgress).length > 0 ? (
                    <View style={styles.languagesGrid}>
                        {Object.entries(languageProgress)
                            .sort(([,a], [,b]) => b - a)
                            .map(([langCode, count]) => (
                            <View key={langCode} style={styles.languageCard}>
                                <Text style={styles.languageFlag}>
                                    {LANGUAGE_FLAGS[langCode as keyof typeof LANGUAGE_FLAGS] || '🌐'}
                                </Text>
                                <Text style={styles.languageName}>
                                    {LANGUAGE_NAMES[langCode as keyof typeof LANGUAGE_NAMES] || langCode.toUpperCase()}
                                </Text>
                                <Text style={styles.languageCount}>
                                    {count} words
                                </Text>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyLanguages}>
                        <Ionicons name="camera" size={48} color="#bdc3c7" />
                        <Text style={styles.emptyText}>Start learning by taking photos!</Text>
                        <Text style={styles.emptySubtext}>
                            Use the camera tab to detect objects and learn new words
                        </Text>
                    </View>
                )}
            </View>

            {/* Settings Section */}
            <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Settings & Tools</Text>

                <View style={styles.settingCard}>
                    <View style={styles.settingHeader}>
                        <Ionicons name="mic" size={20} color="#3498db" />
                        <Text style={styles.settingTitle}>Audio & Microphone</Text>
                    </View>
                    <Text style={styles.settingDescription}>
                        Test your microphone to ensure voice recording works properly for pronunciation practice.
                    </Text>
                    <MicrophoneTest style={styles.micTest} />
                </View>

                <View style={styles.settingCard}>
                    <View style={styles.settingHeader}>
                        <Ionicons name="person" size={20} color="#e74c3c" />
                        <Text style={styles.settingTitle}>Account</Text>
                    </View>
                    <Text style={styles.settingDescription}>
                        Manage your account settings and sign out when needed.
                    </Text>
                    <LogoutButton />
                    <DeleteAccountButton />
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Vocam</Text>
                <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>

        </ScrollView>
    );
}

// Keep all existing styles - no changes needed
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#7f8c8d',
    },
    header: {
        backgroundColor: 'white',
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 15,
    },
    avatarBorder: {
        position: 'absolute',
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 3,
        borderColor: '#5DEBD7',
        top: -4,
        left: -4,
    },
    editAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#3498db',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 8,
    },
    memberSince: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    memberSinceText: {
        fontSize: 14,
        color: '#7f8c8d',
        marginLeft: 5,
    },
    streakDisplay: {
        flexDirection: 'row',
        marginTop: 3,
        paddingVertical: 6,
        alignSelf: 'flex-start'
    },
    streakNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#e74c3c',
        marginLeft: 4,
        marginRight: 4,
    },
    streakText: {
        fontSize: 14,
        color: '#d63031',
        fontWeight: '500',
        alignContent: 'center',
        padding: 1
    },
    statsSection: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 15,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    statCard: {
        backgroundColor: 'white',
        flex: 1,
        marginHorizontal: 5,
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginTop: 8,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#7f8c8d',
        textAlign: 'center',
    },
    languagesSection: {
        padding: 20,
        paddingTop: 0,
    },
    languagesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    languageCard: {
        backgroundColor: 'white',
        width: (width - 50) / 3,
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    languageFlag: {
        fontSize: 24,
        marginBottom: 8,
    },
    languageName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: 4,
    },
    languageCount: {
        fontSize: 11,
        color: '#7f8c8d',
    },
    emptyLanguages: {
        backgroundColor: 'white',
        padding: 40,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginTop: 15,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#7f8c8d',
        textAlign: 'center',
        lineHeight: 20,
    },
    settingsSection: {
        padding: 20,
        paddingTop: 0,
    },
    settingCard: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    settingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    settingTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginLeft: 10,
    },
    settingDescription: {
        fontSize: 14,
        color: '#7f8c8d',
        lineHeight: 20,
        marginBottom: 16,
    },
    micTest: {
        marginTop: 8,
    },
    footer: {
        padding: 30,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 5,
    },
    versionText: {
        fontSize: 12,
        color: '#bdc3c7',
    },
    authRequiredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    authRequiredTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginTop: 20,
        marginBottom: 10,
    },
    authRequiredText: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    authRequiredSubtext: {
        fontSize: 14,
        color: '#95a5a6',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    loginButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
    },
    loginButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    continueButton: {
        marginTop: 15,
        paddingHorizontal: 30,
        paddingVertical: 12,
    },
authHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
        backgroundColor: 'white',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 5,
    },
    authHeaderTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    statSubLabel: {
        fontSize: 10,
        color: '#7f8c8d',
        textAlign: 'center',
        marginTop: 2,
        fontStyle: 'italic',
    },
    // New styles for enhanced progress features
    quoteContainer: {
        backgroundColor: '#f8f9ff',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 20,
        marginTop: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#3498db',
        shadowColor: '#3498db',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    quote: {
        fontSize: 16,
        color: '#2c3e50',
        fontStyle: 'italic',
        textAlign: 'center',
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    dailyGoalContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginTop: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    goalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    goalTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
    },
    goalProgress: {
        fontSize: 14,
        fontWeight: '500',
        color: '#e74c3c',
    },
    goalBar: {
        height: 8,
        backgroundColor: '#ecf0f1',
        borderRadius: 4,
        marginBottom: 8,
        overflow: 'hidden',
    },
    goalFill: {
        height: '100%',
        backgroundColor: '#e74c3c',
        borderRadius: 4,
    },
    goalText: {
        fontSize: 12,
        color: '#7f8c8d',
        textAlign: 'center',
        fontWeight: '500',
    },
    achievementsSection: {
        padding: 20,
        paddingTop: 0,
    },
// Duplicate removed
    streakSection: {
        padding: 20,
        paddingTop: 0,
    },
    streakCalendar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    streakDay: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 2,
    },
    streakDayActive: {
        backgroundColor: '#ff6b35',
        shadowColor: '#ff6b35',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    streakDayInactive: {
        backgroundColor: '#ecf0f1',
    },
    streakDayText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    streakDayTextActive: {
        color: '#fff',
    },
    streakDayTextInactive: {
        color: '#bdc3c7',
    },
    viewAllAchievements: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 12,
        marginTop: 12,
    },
    viewAllText: {
        fontSize: 16,
        color: '#3498db',
        fontWeight: '600',
        marginRight: 8,
    },
    noAchievements: {
        backgroundColor: 'white',
        padding: 40,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    noAchievementsText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginTop: 15,
        marginBottom: 8,
    },
    noAchievementsSubtext: {
        fontSize: 14,
        color: '#7f8c8d',
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default ProfileScreen;
