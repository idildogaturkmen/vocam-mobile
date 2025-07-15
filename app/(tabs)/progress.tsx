import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { StatBox } from '@/components/Progress/StatBox';
import { getLearnedWords } from '@/utils/progress/getLearnedWords';
import { getImageLevel } from '@/utils/progress/getImageLevel';
import { getImageTrophy } from '@/utils/progress/getImageTrophy';
import { getImageWord } from '@/utils/progress/getImageWord';
import { getAchievements } from '@/utils/progress/getAchievements';
import FireStreak from '@/components/Progress/FireStreak';
import { getProfile } from '@/utils/progress/getProfile';
import { BadgeCard } from '@/components/Progress/BadgeCard';
import MaxProficiencyWords from '@/components/Progress/MaxProficiency';
import { MAX_PROF } from '@/constants/constants';
import { getAchievementBadge } from '@/utils/progress/getAchievementBadge';
import XPBar from '@/components/Progress/XPBar';

export default function ProgressScreen() {
    const [level, setLevel] = useState<number | 0>(0);
    const [exp, setExp] = useState<number | 0>(0);
    const [achievements, setAchievements] = useState<Record<string, string>[] | []>([]);
    const [wordsInfo, setWordsInfo] = useState<Record<string, any>[]>([]);
    const [streak, setStreak] = useState<number | 0>(0);

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
        };
        fetchData();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.heading}>Your progress</Text>
                <FireStreak streak={streak} />
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

            <Text style={styles.subheading}>Achievements</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {achievements.map((achievement) => (
                    <BadgeCard
                        key={achievement.id}
                        imageSource={async () => await getAchievementBadge(achievement.badge_path)}
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
        paddingVertical: 6,
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
