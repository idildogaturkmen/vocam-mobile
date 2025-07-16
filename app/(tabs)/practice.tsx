import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Modal,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '../../database/config';
import PracticeService, { PracticeSession, QuizQuestion, PracticeStats } from '../../src/services/PracticeService';
import SpeechService from '../../src/services/SpeechService';
import PracticeQuestionRenderer from '../../src/components/practice/PracticeQuestionRenderer';
import PracticeStartScreen from '../../src/components/practice/PracticeStartScreen';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function PracticeScreen() {
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState<PracticeSession | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [typedAnswer, setTypedAnswer] = useState('');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [stats, setStats] = useState<PracticeStats | null>(null);
    const [availableLanguages, setAvailableLanguages] = useState<{ code: string; name: string; wordCount: number }[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('');
    const [showResults, setShowResults] = useState(false);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Load available languages
                const languages = await PracticeService.getAvailableLanguages(user.id);
                setAvailableLanguages(languages);
                
                // Select first language by default
                if (languages.length > 0) {
                    setSelectedLanguage(languages[0].code);
                }
                
                // Load user stats
                const userStats = await PracticeService.getUserStats(user.id);
                setStats(userStats);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const startPractice = async (questionCount: number) => {
        if (!selectedLanguage) return;
        
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newSession = await PracticeService.startPracticeSession(
                user.id,
                questionCount,
                selectedLanguage
            );

            if (newSession) {
                setSession(newSession);
                setCurrentQuestion(newSession.questions[0]);
                setShowAnswer(false);
                setSelectedAnswer(null);
                setTypedAnswer('');
                setIsProcessingAnswer(false);
                animateQuestionEntry();
                animateProgress();
            }
        } catch (error) {
            console.error('Error starting practice:', error);
        } finally {
            setLoading(false);
        }
    };

    const animateQuestionEntry = () => {
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const animateProgress = () => {
        if (!session) return;
        
        const progress = (session.currentQuestion + 1) / session.totalQuestions;
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 300,
            useNativeDriver: false,
        }).start();
    };

    const handleAnswer = async (answer: string) => {
        if (!currentQuestion || showAnswer || isProcessingAnswer) return;

        setIsProcessingAnswer(true);
        setSelectedAnswer(answer);
        
        try {
            const isCorrect = await PracticeService.submitAnswer(answer);
            
            // Play haptic feedback with different patterns
            if (isCorrect) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                // Different pattern for wrong answers
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }

            // Animate feedback
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShowAnswer(true);
                setIsProcessingAnswer(false);
            });
        } catch (error) {
            console.error('Error submitting answer:', error);
            setIsProcessingAnswer(false);
        }
    };

    const handleSpeech = async (text: string, language: string) => {
        try {
            setAudioPlaying(true);
            await SpeechService.speak(text, language);
        } catch (error) {
            console.error('Error with speech:', error);
        } finally {
            setAudioPlaying(false);
        }
    };

    const nextQuestion = () => {
        if (!session) return;

        const next = PracticeService.nextQuestion();
        
        if (next) {
            // Reset states
            setCurrentQuestion(next);
            setShowAnswer(false);
            setSelectedAnswer(null);
            setTypedAnswer('');
            
            // Animate transition
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
            
            animateProgress();
        } else {
            // Session completed
            setShowResults(true);
            loadInitialData(); // Reload stats
        }
    };

    const renderResults = () => {
        if (!session) return null;

        const accuracy = (session.correctAnswers / session.totalQuestions) * 100;
        const earnedXP = session.correctAnswers * 10 + (session.totalQuestions === 20 ? 100 : session.totalQuestions === 10 ? 20 : 0);

        return (
            <Modal
                animationType="slide"
                transparent={true}
                visible={showResults}
                onRequestClose={() => setShowResults(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.resultsContainer}>
                        <View style={styles.resultsTitleContainer}>
                            <Text style={styles.resultsTitle}>Practice Complete!</Text>
                            <MaterialIcons name="celebration" size={32} color="#f39c12" />
                        </View>
                        
                        <View style={styles.scoreContainer}>
                            <Text style={styles.scoreText}>
                                {session.correctAnswers} / {session.totalQuestions}
                            </Text>
                            <Text style={styles.accuracyText}>{accuracy.toFixed(0)}% Accuracy</Text>
                        </View>

                        <View style={styles.xpEarned}>
                            <Text style={styles.xpText}>+{earnedXP} XP</Text>
                        </View>

                        <View style={styles.statsGrid}>
                            <View style={styles.statItem}>
                                <Ionicons name="checkmark-circle" size={32} color="#27ae60" />
                                <Text style={styles.statValue}>{session.correctAnswers}</Text>
                                <Text style={styles.statLabel}>Correct</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Ionicons name="close-circle" size={32} color="#e74c3c" />
                                <Text style={styles.statValue}>{session.totalQuestions - session.correctAnswers}</Text>
                                <Text style={styles.statLabel}>Incorrect</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.continueButton}
                            onPress={() => {
                                setShowResults(false);
                                setSession(null);
                                setCurrentQuestion(null);
                                setShowAnswer(false);
                                setSelectedAnswer(null);
                                setTypedAnswer('');
                            }}
                        >
                            <Text style={styles.continueButtonText}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    if (!session) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Practice</Text>
                        <Text style={styles.subtitle}>Improve your vocabulary</Text>
                    </View>
                </View>

                <PracticeStartScreen
                    availableLanguages={availableLanguages}
                    selectedLanguage={selectedLanguage}
                    loading={loading}
                    onSelectLanguage={setSelectedLanguage}
                    onStartPractice={startPractice}
                />

                {renderResults()}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <Animated.View 
                    style={[
                        styles.progressBar,
                        {
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%']
                            })
                        }
                    ]}
                />
            </View>

            {/* Question Counter */}
            <View style={styles.questionHeader}>
                <Text style={styles.questionCounter}>
                    Question {session.currentQuestion + 1} of {session.totalQuestions}
                </Text>
                <TouchableOpacity onPress={() => setShowResults(true)}>
                    <Ionicons name="close" size={28} color="#7f8c8d" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <Animated.View
                    style={[
                        {
                            opacity: fadeAnim,
                            transform: [
                                { translateY: slideAnim },
                                { scale: scaleAnim }
                            ]
                        }
                    ]}
                >
                    {currentQuestion && (
                        <PracticeQuestionRenderer
                            currentQuestion={currentQuestion}
                            showAnswer={showAnswer}
                            selectedAnswer={selectedAnswer}
                            typedAnswer={typedAnswer}
                            audioPlaying={audioPlaying}
                            onAnswer={handleAnswer}
                            onTypeAnswer={setTypedAnswer}
                            onPlayAudio={handleSpeech}
                        />
                    )}
                </Animated.View>

                {showAnswer && (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        <TouchableOpacity
                            style={styles.nextButton}
                            onPress={nextQuestion}
                        >
                            <Text style={styles.nextButtonText}>
                                {session.currentQuestion < session.totalQuestions - 1 ? 'Next Question' : 'Finish'}
                            </Text>
                            <Ionicons name="arrow-forward" size={20} color="white" />
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </ScrollView>

            {renderResults()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
    progressContainer: {
        height: 4,
        backgroundColor: '#ecf0f1',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3498db',
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    questionCounter: {
        fontSize: 16,
        color: '#7f8c8d',
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    nextButton: {
        flexDirection: 'row',
        backgroundColor: '#27ae60',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 8,
    },
    nextButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultsContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: width * 0.9,
        alignItems: 'center',
    },
    resultsTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    resultsTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 24,
    },
    scoreContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    scoreText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#3498db',
    },
    accuracyText: {
        fontSize: 20,
        color: '#7f8c8d',
        marginTop: 8,
    },
    xpEarned: {
        backgroundColor: '#f39c12',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
        marginBottom: 24,
    },
    xpText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 24,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 14,
        color: '#7f8c8d',
        marginTop: 4,
    },
    continueButton: {
        backgroundColor: '#3498db',
        paddingVertical: 16,
        paddingHorizontal: 48,
        borderRadius: 12,
        alignItems: 'center',
    },
    continueButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
});