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

export default function ProgressScreen() {
    const [level, setLevel] = useState<number | 0>(0);
    const [achievements, setAchievements] = useState<number | 0>(0);
    const [trophies, setTrophies] = useState<number | 0>(0);
    const [words, setWords] = useState<number | 0>(0);
    const [wordsInfo, setWordsInfo] = useState<Record<string, string>[]>([]);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            const achievements = await getAchievements();
            setAchievements(achievements.length);
            const learnedWords = await getLearnedWords();
            setWordsInfo(learnedWords);
        };
        fetchData();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.heading}>Your progress</Text>
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
                <StatBox label="Level" value={level} image={() => getImageLevel(level)} />
                <StatBox
                    label="Trophies"
                    value={achievements ?? '...'}
                    image={() => getImageTrophy(trophies)}
                />
                <StatBox
                    label="Words Learned"
                    value={wordsInfo.length}
                    image={() => getImageWord(words)}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
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
});
