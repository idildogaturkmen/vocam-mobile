import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Dimensions,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LogoutButton from '../../components/Auth/Logout';
import MicrophoneTest from '../../src/components/MicrophoneTest';
import SessionService from '../../src/services/SessionService';
import VocabularyService from '../../src/services/VocabularyService';
import { supabase } from '../../database/config';
import HumanAvatar, { 
    HumanAvatarConfig, 
    AvatarStyle,
    AVATAR_OPTIONS,
    BACKGROUND_COLORS,
    SKIN_COLORS,
    HAIR_COLORS,
    CLOTHING_COLORS
} from '../../src/components/Avatar';
import FireStreak from '../../components/Progress/FireStreak';
import XPBar from '../../components/Progress/XPBar';
import { getProfile } from '../../utils/progress/getProfile';
import { getDailyGoal, getDailyGoalFromLog, DailyGoal } from '../../utils/progress/getDailyGoal';
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
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [languageProgress, setLanguageProgress] = useState<LanguageProgress>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [level, setLevel] = useState<number>(0);
    const [exp, setExp] = useState<number>(0);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [dailyGoal, setDailyGoal] = useState<DailyGoal>({ current: 0, target: 5, percentage: 0 });
    const [profileData, setProfileData] = useState<any>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
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
    
    const [tempAvatarConfig, setTempAvatarConfig] = useState<HumanAvatarConfig>(avatarConfig);
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    
    // Only 2 tabs: Colors and Features
    const tabs = ['colors', 'features'] as const;
    const [activeTab, setActiveTab] = useState<'colors' | 'features'>('colors');

    // Memoize the image function to prevent multiple calls
    const imageFn = useCallback(async () => await getImageWord(stats?.uniqueWords || 0), [stats?.uniqueWords]);

    useEffect(() => {
        checkAuthAndLoadUserData();
    }, []);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!isAuthenticated) return;

        const interval = setInterval(async () => {
            // Double-check authentication before running operations
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || refreshing) return;
            
            checkAuthAndLoadUserData();
        }, 30000); // 30 seconds for full refresh

        return () => clearInterval(interval);
    }, [isAuthenticated, refreshing]);

    // More frequent daily goal refresh
    useEffect(() => {
        if (!isAuthenticated) return;

        const goalInterval = setInterval(async () => {
            // Double-check authentication before running operations
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || refreshing) return;
            
            refreshDailyGoal();
        }, 3000); // 3 seconds for daily goal only

        return () => clearInterval(goalInterval);
    }, [isAuthenticated, refreshing]);

    // Refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            if (isAuthenticated && !loading) {
                checkAuthAndLoadUserData();
            }
        }, [isAuthenticated, loading])
    );

    const checkAuthAndLoadUserData = async () => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) {
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }
            
            setIsAuthenticated(true);
            setUser(currentUser);
            await loadUserData(currentUser);
        } catch (error) {
            console.error('Auth check error:', error);
            setIsAuthenticated(false);
            setLoading(false);
        }
    };

    const loadUserData = async (currentUser: any) => {
        try {
            if (currentUser) {
                const userStats = await SessionService.getUserStats(currentUser.id);
                setStats(userStats);

                // FIXED: Load avatar configuration from new avatars table
                const { data: avatarData, error: avatarError } = await supabase
                    .from('avatars')
                    .select('avatar_config')
                    .eq('user_id', currentUser.id)
                    .single();
                
                if (avatarData?.avatar_config && !avatarError) {
                    // avatar_config is already parsed JSON (jsonb type)
                    const config = avatarData.avatar_config;
                    // Ensure it's always personas style and merge with defaults
                    const cleanConfig = { ...avatarConfig, ...config, style: 'personas' as AvatarStyle };
                    setAvatarConfig(cleanConfig);
                    setTempAvatarConfig(cleanConfig);
                } else {
                    if (avatarError && avatarError.code !== 'PGRST116') {
                        console.error('Error loading avatar:', avatarError);
                    }
                }

                // Load language progress
                const vocabulary = await VocabularyService.getUserVocabulary(currentUser.id);
                const langProgress: LanguageProgress = {};
                
                vocabulary.forEach(word => {
                    const lang = word.language;
                    if (lang) {
                        langProgress[lang] = (langProgress[lang] || 0) + 1;
                    }
                });
                
                setLanguageProgress(langProgress);

                // Load progress data from existing utility functions
                const profile = await getProfile();
                setProfileData(profile);
                setLevel(profile?.level || 0);
                setExp(profile?.totalXP || 0); // Use totalXP instead of exp
                
                // Sync user level in case there's a discrepancy
                try {
                    const syncResult = await LevelingService.syncUserLevel(currentUser.id);
                    if (syncResult && syncResult.oldLevel !== syncResult.newLevel) {
                        console.log(`Level synced: ${syncResult.oldLevel} -> ${syncResult.newLevel}`);
                        // Reload profile data after sync
                        const updatedProfile = await getProfile();
                        setProfileData(updatedProfile);
                        setLevel(updatedProfile?.level || 0);
                    }
                } catch (error) {
                    console.error('Error syncing user level:', error);
                }
                
                // Load achievements with progress
                const achievementsList = await AchievementService.getAllAchievementsWithProgress(currentUser.id);
                setAchievements(achievementsList);
                
                // Check for new achievements
                const newAchievements = await AchievementService.checkAndAwardAchievements(currentUser.id);
                if (newAchievements.length > 0) {
                    console.log('New achievements earned:', newAchievements);
                    // Reload achievements to include newly earned ones
                    const updatedAchievements = await AchievementService.getAllAchievementsWithProgress(currentUser.id);
                    setAchievements(updatedAchievements);
                }
                
                const goalData = await getDailyGoalFromLog();
                setDailyGoal(goalData);
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
        checkAuthAndLoadUserData();
    };

    const saveAvatarConfig = async () => {
        if (!user) return;
        
        setSavingAvatar(true);
        try {
            // FIXED: Use new avatars table with upsert for insert/update
            const { error } = await supabase
                .from('avatars')
                .upsert({
                    user_id: user.id,
                    avatar_config: tempAvatarConfig, // jsonb field, no need to stringify
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id' // Update if user already has avatar config
                });

            if (error) {
                console.error('Error saving avatar:', error);
                Alert.alert('Error', `Failed to save avatar: ${error.message}`);
            } else {
                setAvatarConfig(tempAvatarConfig);
                setShowAvatarPicker(false);
                Alert.alert('Success', 'Avatar saved successfully!');
            }
        } catch (error) {
            console.error('Error saving avatar:', error);
            Alert.alert('Error', 'Failed to save avatar');
        } finally {
            setSavingAvatar(false);
        }
    };

    // FIXED: Updated random avatar generation with REAL DiceBear parameter values
    const generateRandomAvatar = () => {
        const randomConfig: HumanAvatarConfig = {
            style: 'personas', // Always personas
            backgroundColor: BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)].id,
            skinColor: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)].id,
            hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].id,
            clothingColor: CLOTHING_COLORS[Math.floor(Math.random() * CLOTHING_COLORS.length)].id,
            hair: AVATAR_OPTIONS.hair[Math.floor(Math.random() * AVATAR_OPTIONS.hair.length)].id,
            eyes: AVATAR_OPTIONS.eyes[Math.floor(Math.random() * AVATAR_OPTIONS.eyes.length)].id,
            mouth: AVATAR_OPTIONS.mouth[Math.floor(Math.random() * AVATAR_OPTIONS.mouth.length)].id,
            nose: AVATAR_OPTIONS.nose[Math.floor(Math.random() * AVATAR_OPTIONS.nose.length)].id,
            facialHair: AVATAR_OPTIONS.facialHair[Math.floor(Math.random() * AVATAR_OPTIONS.facialHair.length)].id,
            body: AVATAR_OPTIONS.body[Math.floor(Math.random() * AVATAR_OPTIONS.body.length)].id,
        };
        
        // Force state update by creating completely new object
        setTempAvatarConfig({...randomConfig});
    };

    if (loading) {
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
                    <View>
                        <Text style={styles.authHeaderTitle}>Profile</Text>
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
                        onPress={() => router.replace('/App')}
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
                            onPress={() => {
                                setTempAvatarConfig(avatarConfig);
                                setShowAvatarPicker(true);
                                setActiveTab('colors');
                            }}
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
                            onPress={() => {
                                setTempAvatarConfig(avatarConfig);
                                setShowAvatarPicker(true);
                                setActiveTab('colors');
                            }}
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
                        image={async () => await getImageLevel(level)}
                    />
                    <StatBox
                        label="Trophies"
                        value={achievements.filter(a => a.earned).length}
                        image={() => getImageTrophy(achievements.filter(a => a.earned).length)}
                    />
                    <StatBox
                        label="Words Learned"
                        value={stats?.uniqueWords || 0}
                        image={imageFn}
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
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Vocam</Text>
                <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>

            {/* FIXED: Updated Avatar Picker Modal with REAL DiceBear parameter values */}
            <Modal
                visible={showAvatarPicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setTempAvatarConfig(avatarConfig);
                    setShowAvatarPicker(false);
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Customize Your Avatar</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setTempAvatarConfig(avatarConfig);
                                    setShowAvatarPicker(false);
                                }}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#7f8c8d" />
                            </TouchableOpacity>
                        </View>

                        {/* Avatar Preview */}
                        <View style={styles.previewSection}>
                            <HumanAvatar
                                config={tempAvatarConfig}
                                size={140}
                                seed={`${user?.email || 'default'}-${JSON.stringify(tempAvatarConfig)}`}
                            />
                        </View>

                        {/* Clean Tab Navigation - Only 2 tabs */}
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            style={styles.tabContainer}
                        >
                            {tabs.map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    style={[styles.tab, activeTab === tab && styles.activeTab]}
                                    onPress={() => setActiveTab(tab)}
                                >
                                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <ScrollView style={styles.optionsContainer}>
                            {/* Colors Tab */}
                            {activeTab === 'colors' && (
                                <View style={styles.optionSection}>
                                    <Text style={styles.optionLabel}>Background</Text>
                                    <View style={styles.colorGrid}>
                                        {BACKGROUND_COLORS.map((color) => (
                                            <TouchableOpacity
                                                key={color.id}
                                                style={[
                                                    styles.colorOption,
                                                    { backgroundColor: color.hex },
                                                    tempAvatarConfig.backgroundColor === color.id && styles.selectedColorOption
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, backgroundColor: color.id }))}
                                            >
                                                {tempAvatarConfig.backgroundColor === color.id && (
                                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Skin Tone</Text>
                                    <View style={styles.colorGrid}>
                                        {SKIN_COLORS.map((color) => (
                                            <TouchableOpacity
                                                key={color.id}
                                                style={[
                                                    styles.colorOption,
                                                    { backgroundColor: color.hex },
                                                    tempAvatarConfig.skinColor === color.id && styles.selectedColorOption
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, skinColor: color.id }))}
                                            >
                                                {tempAvatarConfig.skinColor === color.id && (
                                                    <Ionicons name="checkmark" size={20} color="#333" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Hair Color</Text>
                                    <View style={styles.colorGrid}>
                                        {HAIR_COLORS.map((color) => (
                                            <TouchableOpacity
                                                key={color.id}
                                                style={[
                                                    styles.colorOption,
                                                    { backgroundColor: color.hex },
                                                    tempAvatarConfig.hairColor === color.id && styles.selectedColorOption
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, hairColor: color.id }))}
                                            >
                                                {tempAvatarConfig.hairColor === color.id && (
                                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Clothing Color</Text>
                                    <View style={styles.colorGrid}>
                                        {CLOTHING_COLORS.map((color) => (
                                            <TouchableOpacity
                                                key={color.id}
                                                style={[
                                                    styles.colorOption,
                                                    { backgroundColor: color.hex },
                                                    tempAvatarConfig.clothingColor === color.id && styles.selectedColorOption
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, clothingColor: color.id }))}
                                            >
                                                {tempAvatarConfig.clothingColor === color.id && (
                                                    <Ionicons name="checkmark" size={20} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Features Tab - REAL DiceBear Values */}
                            {activeTab === 'features' && (
                                <View style={styles.optionSection}>
                                    <Text style={styles.optionSectionTitle}>Customize Features</Text>
                                    
                                    <Text style={styles.optionLabel}>Hair Style</Text>
                                    <View style={styles.featureGrid}>
                                        {AVATAR_OPTIONS.hair.map((hair) => (
                                            <TouchableOpacity
                                                key={hair.id}
                                                style={[
                                                    styles.featureButton,
                                                    tempAvatarConfig.hair === hair.id && styles.selectedFeature
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, hair: hair.id }))}
                                            >
                                                <Text style={[
                                                    styles.featureText,
                                                    tempAvatarConfig.hair === hair.id && styles.selectedFeatureText
                                                ]}>
                                                    {hair.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Eyes</Text>
                                    <View style={styles.featureGrid}>
                                        {AVATAR_OPTIONS.eyes.map((eye) => (
                                            <TouchableOpacity
                                                key={eye.id}
                                                style={[
                                                    styles.featureButton,
                                                    tempAvatarConfig.eyes === eye.id && styles.selectedFeature
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, eyes: eye.id }))}
                                            >
                                                <Text style={[
                                                    styles.featureText,
                                                    tempAvatarConfig.eyes === eye.id && styles.selectedFeatureText
                                                ]}>
                                                    {eye.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Mouth</Text>
                                    <View style={styles.featureGrid}>
                                        {AVATAR_OPTIONS.mouth.map((mouth) => (
                                            <TouchableOpacity
                                                key={mouth.id}
                                                style={[
                                                    styles.featureButton,
                                                    tempAvatarConfig.mouth === mouth.id && styles.selectedFeature
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, mouth: mouth.id }))}
                                            >
                                                <Text style={[
                                                    styles.featureText,
                                                    tempAvatarConfig.mouth === mouth.id && styles.selectedFeatureText
                                                ]}>
                                                    {mouth.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Nose</Text>
                                    <View style={styles.featureGrid}>
                                        {AVATAR_OPTIONS.nose.map((nose) => (
                                            <TouchableOpacity
                                                key={nose.id}
                                                style={[
                                                    styles.featureButton,
                                                    tempAvatarConfig.nose === nose.id && styles.selectedFeature
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, nose: nose.id }))}
                                            >
                                                <Text style={[
                                                    styles.featureText,
                                                    tempAvatarConfig.nose === nose.id && styles.selectedFeatureText
                                                ]}>
                                                    {nose.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Facial Hair</Text>
                                    <View style={styles.featureGrid}>
                                        {AVATAR_OPTIONS.facialHair.map((facialHair) => (
                                            <TouchableOpacity
                                                key={facialHair.id}
                                                style={[
                                                    styles.featureButton,
                                                    tempAvatarConfig.facialHair === facialHair.id && styles.selectedFeature
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, facialHair: facialHair.id }))}
                                            >
                                                <Text style={[
                                                    styles.featureText,
                                                    tempAvatarConfig.facialHair === facialHair.id && styles.selectedFeatureText
                                                ]}>
                                                    {facialHair.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.optionLabel}>Clothing Style</Text>
                                    <View style={styles.featureGrid}>
                                        {AVATAR_OPTIONS.body.map((body) => (
                                            <TouchableOpacity
                                                key={body.id}
                                                style={[
                                                    styles.featureButton,
                                                    tempAvatarConfig.body === body.id && styles.selectedFeature
                                                ]}
                                                onPress={() => setTempAvatarConfig(prev => ({ ...prev, body: body.id }))}
                                            >
                                                <Text style={[
                                                    styles.featureText,
                                                    tempAvatarConfig.body === body.id && styles.selectedFeatureText
                                                ]}>
                                                    {body.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={styles.randomButton}
                                    onPress={generateRandomAvatar}
                                >
                                    <Ionicons name="shuffle" size={20} color="#fff" />
                                    <Text style={styles.randomButtonText}>Random Avatar</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.saveButton, savingAvatar && styles.disabledButton]}
                                    onPress={saveAvatarConfig}
                                    disabled={savingAvatar}
                                >
                                    {savingAvatar ? (
                                        <>
                                            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={styles.saveButtonText}>Saving...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark" size={20} color="#fff" />
                                            <Text style={styles.saveButtonText}>Save Avatar</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    closeButton: {
        padding: 4,
    },
    previewSection: {
        alignItems: 'center',
        paddingVertical: 20,
        backgroundColor: '#f8f9fa',
    },
    tabContainer: {
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingHorizontal: 20,
    },
    tab: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginRight: 10,
    },
    activeTab: {
        borderBottomWidth: 3,
        borderBottomColor: '#3498db',
    },
    tabText: {
        fontSize: 14,
        color: '#7f8c8d',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#3498db',
        fontWeight: '600',
    },
    optionsContainer: {
        maxHeight: 400,
        paddingHorizontal: 20,
    },
    optionSection: {
        paddingVertical: 15,
    },
    optionSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 15,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 10,
        marginTop: 15,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    colorOption: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        margin: 5,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    selectedColorOption: {
        borderColor: '#2c3e50',
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 15,
    },
    featureButton: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedFeature: {
        backgroundColor: '#3498db',
        borderColor: '#2980b9',
    },
    featureText: {
        fontSize: 13,
        color: '#2c3e50',
        fontWeight: '500',
    },
    selectedFeatureText: {
        color: 'white',
        fontWeight: '600',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        marginBottom: 10,
    },
    randomButton: {
        backgroundColor: '#9b59b6',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 0.48,
    },
    randomButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    saveButton: {
        backgroundColor: '#27ae60',
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 0.48,
    },
    disabledButton: {
        backgroundColor: '#95a5a6',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
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