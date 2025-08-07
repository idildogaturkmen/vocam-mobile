import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { StatBox } from '../../components/Progress/StatBox';
import { getLearnedWords } from '../../utils/progress/getLearnedWords';
import { getImageLevel } from '@/utils/progress/getImageLevel';
import { getImageTrophy } from '@/utils/progress/getImageTrophy';
import { getImageWord } from '@/utils/progress/getImageWord';
import { getAchievements } from '@/utils/progress/getAchievements';
import FireStreak from '../../components/Progress/FireStreak';
import { getProfile } from '@/utils/progress/getProfile';
import { BadgeCard } from '../../components/Progress/BadgeCard';
import MaxProficiencyWords from '../../components/Progress/MaxProficiency';
import { MAX_PROF } from '@/constants/constants';
import { getAchievementBadge } from '../../utils/progress/getAchievementBadge';
import XPBar from '../../components/Progress/XPBar';
import { getDailyGoal, DailyGoal } from '../../utils/progress/getDailyGoal';

const getMotivationalMessage = (level: number, streak: number, wordsLearned: number): string => {
    if (streak >= 7) return "You're on fire! Keep that streak alive!";
    if (level >= 5) return "You're becoming a vocabulary master!";
    if (wordsLearned >= 50) return "Incredible progress! You're unstoppable!";
    if (streak >= 3) return "Great consistency! Keep it up!";
    if (wordsLearned >= 10) return "Your vocabulary is growing fast!";
    return "Every word learned is a step forward!";
};

export default function ProgressScreen() {
    const [level, setLevel] = useState<number>(0);
    const [exp, setExp] = useState<number>(0);
    const [achievements, setAchievements] = useState<Record<string, string>[] | []>([]);
    const [wordsInfo, setWordsInfo] = useState<Record<string, any>[]>([]);
    const [streak, setStreak] = useState<number>(0);
    const [dailyGoal, setDailyGoal] = useState<DailyGoal>({ current: 0, target: 5, percentage: 0 });

    useEffect(() => {
        const fetchData = async () => {
            const profile = await getProfile();
            setStreak(profile?.streak || 0);
            setLevel(profile?.level || 0);
            setExp(profile?.exp || 0);
            const achievements = await getAchievements();
            setAchievements(achievements);
            const learnedWords = await getLearnedWords();
            setWordsInfo(learnedWords);
            const goalData = await getDailyGoal();
            setDailyGoal(goalData);
        };
        fetchData();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.headerWrapper}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Your Progress</Text>
                        <Text style={styles.subtitle}>Track your learning journey</Text>
                    </View>
                    <FireStreak streak={streak} />
                </View>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Motivational Quote */}
                <View style={styles.quoteContainer}>
                    <Text style={styles.quote}>
                        {getMotivationalMessage(level, streak, wordsInfo.length)}
                    </Text>
                </View>

                <View style={styles.statsRow}>
                    <StatBox
                        label="Level"
                        value={level}
                        image={async () => await getImageLevel(level)}
                    />
                    <StatBox
                        label="Trophies"
                        value={achievements.length ?? '...'}
                        image={() => getImageTrophy(achievements.length)}
                    />
                    <StatBox
                        label="Words Learned"
                        value={wordsInfo.length}
                        image={async () => await getImageWord(wordsInfo.length)}
                    />
                </View>
                
                <XPBar currentXP={exp} xpToNextLevel={100} />

                <MaxProficiencyWords
                    count={wordsInfo.filter((word) => word.proficiency === MAX_PROF).length}
                />

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

                <Text style={styles.subheading}>Achievements</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsScroll}>
                    {achievements.map((achievement) => (
                        <BadgeCard
                            key={achievement.id}
                            imageSource={async () => await getAchievementBadge(achievement.badge_path)}
                            description={achievement.description}
                            date={achievement.earned_at}
                        />
                    ))}
                </ScrollView>

                {/* Learning Streak Calendar */}
                <Text style={styles.subheading}>Learning Streak</Text>
                <View style={styles.streakCalendar}>
                    {Array.from({ length: 7 }, (_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.streakDay,
                                i < streak ? styles.streakDayActive : styles.streakDayInactive
                            ]}
                        >
                            <Text style={[
                                styles.streakDayText,
                                i < streak ? styles.streakDayTextActive : styles.streakDayTextInactive
                            ]}>
                                {i + 1}
                            </Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    headerWrapper: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 25,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    subtitle: {
        fontSize: 16,
        color: '#7f8c8d',
        marginTop: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    subheading: {
        fontSize: 18,
        fontWeight: '600',
        marginVertical: 16,
        color: '#2c3e50',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        marginBottom: 10,
    },
    achievementsScroll: {
        marginBottom: 20,
    },
    quoteContainer: {
        backgroundColor: '#f8f9ff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
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
    dailyGoalContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginVertical: 12,
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
    streakCalendar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
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
});