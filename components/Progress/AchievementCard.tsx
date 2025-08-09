import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Achievement {
    id: string;
    slug: string;
    title: string;
    description: string;
    icon_name: string;
    icon_color: string;
    xp_reward: number;
    earned: boolean;
    achieved_at?: string;
    progress?: number; // 0-100 for achievements in progress
}

interface AchievementCardProps {
    achievement: Achievement;
    onPress?: () => void;
}

export default function AchievementCard({ achievement, onPress }: AchievementCardProps) {
    const isEarned = achievement.earned;
    const progress = achievement.progress || 0;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isEarned ? styles.earnedContainer : styles.unEarnedContainer
            ]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            {/* Achievement Icon */}
            <View style={[
                styles.iconContainer,
                isEarned 
                    ? { backgroundColor: achievement.icon_color + '20' }
                    : styles.unEarnedIconContainer
            ]}>
                <Ionicons 
                    name={achievement.icon_name as any}
                    size={24}
                    color={isEarned ? achievement.icon_color : '#bdc3c7'}
                />
            </View>

            {/* Achievement Details */}
            <View style={styles.detailsContainer}>
                <View style={styles.titleRow}>
                    <Text style={[
                        styles.title,
                        isEarned ? styles.earnedTitle : styles.unEarnedTitle
                    ]}>
                        {achievement.title}
                    </Text>
                    
                    {isEarned && (
                        <View style={[styles.xpBadge, { backgroundColor: achievement.icon_color }]}>
                            <Text style={styles.xpText}>+{achievement.xp_reward}</Text>
                        </View>
                    )}
                </View>

                <Text style={[
                    styles.description,
                    isEarned ? styles.earnedDescription : styles.unEarnedDescription
                ]}>
                    {achievement.description}
                </Text>

                {/* Progress Bar for Unearned Achievements */}
                {!isEarned && progress > 0 && (
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View style={[
                                styles.progressFill,
                                { 
                                    width: `${Math.min(progress, 100)}%`,
                                    backgroundColor: achievement.icon_color + '80'
                                }
                            ]} />
                        </View>
                        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
                    </View>
                )}

                {/* Achievement Date */}
                {isEarned && achievement.achieved_at && (
                    <Text style={styles.achievedDate}>
                        Earned {new Date(achievement.achieved_at).toLocaleDateString()}
                    </Text>
                )}
            </View>

            {/* Earned Badge */}
            {isEarned && (
                <View style={styles.earnedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#27ae60" />
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        position: 'relative',
    },
    earnedContainer: {
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#27ae60',
    },
    unEarnedContainer: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#ecf0f1',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    unEarnedIconContainer: {
        backgroundColor: '#ecf0f1',
    },
    detailsContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    earnedTitle: {
        color: '#2c3e50',
    },
    unEarnedTitle: {
        color: '#7f8c8d',
    },
    xpBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 8,
    },
    xpText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    description: {
        fontSize: 14,
        marginBottom: 8,
        lineHeight: 18,
    },
    earnedDescription: {
        color: '#34495e',
    },
    unEarnedDescription: {
        color: '#95a5a6',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    progressBar: {
        flex: 1,
        height: 4,
        backgroundColor: '#ecf0f1',
        borderRadius: 2,
        marginRight: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 12,
        color: '#7f8c8d',
        fontWeight: '500',
        minWidth: 32,
        textAlign: 'right',
    },
    achievedDate: {
        fontSize: 12,
        color: '#27ae60',
        marginTop: 4,
        fontWeight: '500',
    },
    earnedBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 2,
    },
});