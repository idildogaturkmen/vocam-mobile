import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

interface PracticeStartScreenProps {
    availableLanguages: { code: string; name: string; wordCount: number }[];
    selectedLanguage: string;
    loading: boolean;
    onSelectLanguage: (code: string) => void;
    onStartPractice: (questionCount: number) => void;
}

interface QuizOption {
    questions: number;
    icon: string;
    title: string;
    subtitle: string;
    color: string;
    reward: string;
    requiredWords: number;
}

const quizOptions: QuizOption[] = [
    {
        questions: 5,
        icon: 'flash',
        title: 'Quick Practice',
        subtitle: '2-3 minutes',
        color: '#3498db',
        reward: '+50 XP',
        requiredWords: 4
    },
    {
        questions: 10,
        icon: 'flame',
        title: 'Standard Session',
        subtitle: '5-7 minutes',
        color: '#e74c3c',
        reward: '+120 XP',
        requiredWords: 8
    },
    {
        questions: 20,
        icon: 'trophy',
        title: 'Challenge Mode',
        subtitle: '10-15 minutes',
        color: '#f39c12',
        reward: '+300 XP',
        requiredWords: 16
    }
];

export default function PracticeStartScreen({
    availableLanguages,
    selectedLanguage,
    loading,
    onSelectLanguage,
    onStartPractice
}: PracticeStartScreenProps) {
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3498db" />
            </View>
        );
    }

    if (availableLanguages.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="book-open-variant" size={64} color="#bdc3c7" />
                <Text style={styles.emptyText}>No vocabulary available</Text>
                <Text style={styles.emptySubtext}>
                    Add at least 4 words in a language to start practicing
                </Text>
            </View>
        );
    }

    return (
        <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Language Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose Your Language</Text>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.languageScroll}
                >
                    {availableLanguages.map((lang) => (
                        <TouchableOpacity
                            key={lang.code}
                            style={[
                                styles.languageCard,
                                selectedLanguage === lang.code && styles.selectedLanguageCard
                            ]}
                            onPress={() => onSelectLanguage(lang.code)}
                        >
                            <View style={styles.languageContent}>
                                <Text style={[
                                    styles.languageName,
                                    selectedLanguage === lang.code && styles.selectedLanguageName
                                ]}>
                                    {lang.name}
                                </Text>
                                <Text style={styles.wordCount}>
                                    {lang.wordCount} words
                                </Text>
                            </View>
                            {selectedLanguage === lang.code && (
                                <View style={styles.checkmark}>
                                    <Ionicons name="checkmark" size={16} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Quiz Options */}
            {selectedLanguage && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Choose Your Challenge</Text>
                    <View style={styles.quizOptionsContainer}>
                        {quizOptions.map((option) => {
                            const selectedLang = availableLanguages.find(lang => lang.code === selectedLanguage);
                            const currentWordCount = selectedLang?.wordCount || 0;
                            const isLocked = currentWordCount < option.requiredWords;
                            const wordsNeeded = option.requiredWords - currentWordCount;

                            return (
                                <TouchableOpacity
                                    key={option.questions}
                                    style={[
                                        styles.quizOption, 
                                        { borderColor: isLocked ? '#bdc3c7' : option.color },
                                        isLocked && styles.lockedQuizOption
                                    ]}
                                    onPress={() => !isLocked && onStartPractice(option.questions)}
                                    activeOpacity={isLocked ? 1 : 0.8}
                                    disabled={isLocked}
                                >
                                    {/* Blur overlay for locked options */}
                                    {isLocked && (
                                        <View style={styles.lockOverlay}>
                                            <View style={styles.lockIconContainer}>
                                                <Ionicons name="lock-closed" size={32} color="#7f8c8d" />
                                            </View>
                                            <Text style={styles.lockText}>
                                                Need {wordsNeeded} more word{wordsNeeded !== 1 ? 's' : ''}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={[styles.quizOptionHeader, isLocked && styles.blurredContent]}>
                                        <View style={[
                                            styles.iconContainer, 
                                            { backgroundColor: isLocked ? '#bdc3c7' : option.color }
                                        ]}>
                                            <Ionicons name={option.icon as any} size={24} color="white" />
                                        </View>
                                        <View style={[
                                            styles.rewardBadge,
                                            isLocked && styles.lockedRewardBadge
                                        ]}>
                                            <Text style={[
                                                styles.rewardText,
                                                isLocked && styles.lockedRewardText
                                            ]}>
                                                {option.reward}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <View style={[styles.quizOptionContent, isLocked && styles.blurredContent]}>
                                        <Text style={[
                                            styles.quizOptionTitle,
                                            isLocked && styles.lockedText
                                        ]}>
                                            {option.title}
                                        </Text>
                                        <Text style={[
                                            styles.quizOptionSubtitle,
                                            isLocked && styles.lockedText
                                        ]}>
                                            {option.subtitle}
                                        </Text>
                                        
                                        <View style={styles.questionCountContainer}>
                                            <Text style={[
                                                styles.questionCount, 
                                                { color: isLocked ? '#bdc3c7' : option.color }
                                            ]}>
                                                {option.questions}
                                            </Text>
                                            <Text style={[
                                                styles.questionLabel,
                                                isLocked && styles.lockedText
                                            ]}>
                                                questions
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={[styles.startButtonContainer, isLocked && styles.blurredContent]}>
                                        <View style={[
                                            styles.startButton, 
                                            { backgroundColor: isLocked ? '#bdc3c7' : option.color }
                                        ]}>
                                            <FontAwesome5 name="play" size={14} color="white" />
                                            <Text style={styles.startButtonText}>Start</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Motivational Message */}
                    <View style={styles.motivationCard}>
                        <Ionicons name="bulb" size={24} color="#f39c12" />
                        <Text style={styles.motivationText}>
                            Complete longer sessions to earn more XP and improve faster! Learn more words to unlock additional challenge modes.
                        </Text>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#7f8c8d',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 16,
        color: '#95a5a6',
        marginTop: 8,
        textAlign: 'center',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 20,
    },
    languageScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    languageCard: {
        backgroundColor: 'white',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginRight: 12,
        borderWidth: 2,
        borderColor: '#ecf0f1',
        minWidth: 140,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    selectedLanguageCard: {
        borderColor: '#3498db',
        backgroundColor: '#f0f8ff',
    },
    languageContent: {
        alignItems: 'center',
    },
    languageName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 4,
    },
    selectedLanguageName: {
        color: '#3498db',
    },
    wordCount: {
        fontSize: 14,
        color: '#7f8c8d',
    },
    checkmark: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#3498db',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quizOptionsContainer: {
        gap: 16,
    },
    quizOption: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        position: 'relative',
    },
    lockedQuizOption: {
        backgroundColor: '#f8f9fa',
    },
    lockOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    lockIconContainer: {
        marginBottom: 8,
    },
    lockText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7f8c8d',
        textAlign: 'center',
    },
    blurredContent: {
        opacity: 0.4,
    },
    quizOptionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rewardBadge: {
        backgroundColor: '#f0f8ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    lockedRewardBadge: {
        backgroundColor: '#f5f5f5',
    },
    rewardText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3498db',
    },
    lockedRewardText: {
        color: '#bdc3c7',
    },
    quizOptionContent: {
        marginBottom: 16,
    },
    quizOptionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 4,
    },
    quizOptionSubtitle: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 12,
    },
    lockedText: {
        color: '#bdc3c7',
    },
    questionCountContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    questionCount: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    questionLabel: {
        fontSize: 16,
        color: '#7f8c8d',
    },
    startButtonContainer: {
        alignItems: 'center',
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 25,
        gap: 8,
    },
    startButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    motivationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff8e1',
        padding: 16,
        borderRadius: 12,
        marginTop: 20,
        gap: 12,
    },
    motivationText: {
        flex: 1,
        fontSize: 14,
        color: '#795548',
        lineHeight: 20,
    },
});