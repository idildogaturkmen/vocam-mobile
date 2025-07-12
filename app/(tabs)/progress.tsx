import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { StatBox } from '@/components/Progress/StatBox';
import { getLearnedWords } from '@/utils/progress/getLearnedWords';
import { getImageLevel } from '@/utils/progress/getImageLevel';
import { getImageTrophy } from '@/utils/progress/getImageTrophy';
import { formatDate } from '@/utils/formatDate';
import { useRouter } from 'expo-router';
import { getImageWord } from '@/utils/progress/getImageWord';
import { getAchievements } from '@/utils/progress/getAchievements';
import FireStreak from '@/components/Progress/FireStreak';
import { getStreak } from '@/utils/progress/getStreak';
import { BadgeCard } from '@/components/Progress/BadgeCard';

export default function ProgressScreen() {
    const [level, setLevel] = useState<number | 0>(0);
    const [achievements, setAchievements] = useState<Record<string, string>[] | []>([]);
    const [trophies, setTrophies] = useState<number | 0>(0);
    const [words, setWords] = useState<number | 0>(0);
    const [wordsInfo, setWordsInfo] = useState<Record<string, string>[]>([]);
    const [streak, setStreak] = useState<number | 0>(0);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            const achievements = await getAchievements();
            setAchievements(achievements);
            const learnedWords = await getLearnedWords();
            setWordsInfo(learnedWords);
            const streak_num = await getStreak();
            setStreak(streak_num);
        };
        fetchData();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.heading}>Your progress</Text>
                <FireStreak streak={streak} />
            </View>
            <TouchableOpacity onPress={() => setLevel((prev) => (prev + 1) % 6)}>
                <Text style={styles.heading}>
                    Level {level} <Text style={{ fontSize: 16, color: '#888' }}>Tap to change</Text>
                </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTrophies((prev) => (prev + 1) % 5)}>
                <Text style={styles.heading}>
                    Trophy {trophies}{' '}
                    <Text style={{ fontSize: 16, color: '#888' }}>Tap to change</Text>
                </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWords((prev) => (prev + 1) % 4)}>
                <Text style={styles.heading}>
                    Words {words} <Text style={{ fontSize: 16, color: '#888' }}>Tap to change</Text>
                </Text>
            </TouchableOpacity>
            <View style={styles.statsRow}>
                <StatBox
                    label="Level"
                    value={level}
                    image={async () => await getImageLevel(level)}
                />
                <StatBox
                    label="Trophies"
                    value={achievements.length ?? '...'}
                    image={() => getImageTrophy(trophies)}
                />
                <StatBox
                    label="Words Learned"
                    value={wordsInfo.length}
                    image={async () => await getImageWord(words)}
                />
            </View>
            <Text style={styles.subheading}>Words Learned Until Now, Keep Going!</Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
                <View style={styles.wordTable}>
                    {wordsInfo.length === 0 ? (
                        <Text style={styles.emptyText}>
                            You haven't learned any words yet. Learn some in{' '}
                            <Text
                                style={{ color: '#007bff', textDecorationLine: 'underline' }}
                                onPress={() => router.replace('/(tabs)/detection')}
                            >
                                Camera
                            </Text>{' '}
                            tab.
                        </Text>
                    ) : (
                        wordsInfo.map((item, idx) => (
                            <View key={idx} style={styles.wordRow}>
                                <Text style={styles.wordText}>• {item.word}</Text>
                                <Text style={styles.wordDate}>{formatDate(item.learned_at)}</Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <Text style={styles.subheading}>Achievements</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {achievements.map((achievement) => (
                    <BadgeCard
                        key={achievement.id}
                        imageSource={async () => await getImageLevel(level)}
                        description={achievement.description}
                        date={achievement.earned_at}
                    />
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingVertical: 40,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
    },
    heading: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    subheading: {
        fontSize: 18,
        fontWeight: '600',
        marginVertical: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    wordTable: {
        backgroundColor: '#fafafa',
        borderRadius: 8,
        padding: 12,
    },
    wordRow: {
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    wordText: {
        fontSize: 16,
    },
    wordDate: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    emptyText: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        marginTop: 16,
        fontStyle: 'italic',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});
