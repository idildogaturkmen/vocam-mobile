import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Animated,
    Modal,
    Dimensions,
    Easing,
    Alert,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '../../database/config';
import PracticeService, { PracticeSession, QuizQuestion, PracticeStats } from '../../src/services/PracticeService';
import SpeechService from '../../src/services/SpeechService';
import PracticeQuestionRenderer from '../../src/components/practice/PracticeQuestionRenderer';
import PracticeStartScreen from '../../src/components/practice/PracticeStartScreen';
import RecordingService from '../../src/services/RecordingService';
import AudioManager from '../../src/services/AudioManager';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
const useFocusEffect = require('@react-navigation/native').useFocusEffect;

const { width } = Dimensions.get('window');

export default function PracticeScreen() {
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState<PracticeSession | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [typedAnswer, setTypedAnswer] = useState('');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [skipped, setSkipped] = useState(false);
    const [stats, setStats] = useState<PracticeStats | null>(null);
    const [availableLanguages, setAvailableLanguages] = useState<{ code: string; name: string; wordCount: number }[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('');
    const [showResults, setShowResults] = useState(false);
    const [audioPlaying, setAudioPlaying] = useState(false);
    const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [recordingResult, setRecordingResult] = useState<{
        isCorrect: boolean;
        confidence: number;
        feedback: string;
    } | null>(null);
    const [userRecordingUri, setUserRecordingUri] = useState<string | null>(null);
    const [isPlayingUserRecording, setIsPlayingUserRecording] = useState(false);
    const [currentPlaybackSound, setCurrentPlaybackSound] = useState<Audio.Sound | null>(null);
    
    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Spinner animation for loading modal
    const spinnerAnim = useRef(new Animated.Value(0)).current;

    const router = useRouter();

    // Add automatic refresh when tab is focused
    useFocusEffect(
        useCallback(() => {
            if (!session && isAuthenticated) {
                loadInitialData();
            }
        }, [session, isAuthenticated])
    );

    useEffect(() => {
        let watchdogTimer: any = null;
        
        if (isProcessingAnswer && currentQuestion && currentQuestion.type === 'recording') {
            // Start spinning
            Animated.loop(
                Animated.timing(spinnerAnim, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: true,
                    easing: Easing.linear,
                })
            ).start();
            
            // Set a watchdog timer to prevent infinite processing
            watchdogTimer = setTimeout(() => {
                if (isProcessingAnswer) {
                    console.warn('Processing timeout - auto-skipping question');
                    setIsProcessingAnswer(false);
                    handleSkipQuestion();
                }
            }, 30000); // 30 second maximum processing time
        } else {
            spinnerAnim.stopAnimation();
            spinnerAnim.setValue(0);
            
            // Clear watchdog if processing finished
            if (watchdogTimer) {
                clearTimeout(watchdogTimer);
            }
        }
        
        return () => {
            if (watchdogTimer) {
                clearTimeout(watchdogTimer);
            }
        };
    }, [isProcessingAnswer, currentQuestion?.type]);

    useEffect(() => {
        initializeServices();
        loadInitialData();
        return () => {
            // Clear any recording timeouts
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
            }
            RecordingService.cleanup();
            SpeechService.stop();
        };
    }, []);

    useEffect(() => {
        if (session) {
            animateProgress();
        }
    }, [showAnswer, session?.currentQuestion]);

    const initializeServices = async () => {
        await RecordingService.initialize();
        await SpeechService.initialize();
        // Reset audio to playback mode on screen load
        await AudioManager.reset();
    };

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setIsAuthenticated(true);
                // Load available languages with fresh data
                const languages = await PracticeService.getAvailableLanguages(user.id);
                setAvailableLanguages(languages);
                
                // Maintain selected language if it still exists, otherwise select first
                if (languages.length > 0) {
                    const currentLangExists = languages.find(lang => lang.code === selectedLanguage);
                    if (!currentLangExists || !selectedLanguage) {
                        setSelectedLanguage(languages[0].code);
                    }
                }
                
                // Load user stats
                const userStats = await PracticeService.getUserStats(user.id);
                setStats(userStats);
            } else {
                setIsAuthenticated(false);
            }
        } catch (error) {
            setIsAuthenticated(false);
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
                
                // Set initial progress to 1/N
                progressAnim.setValue(1 / newSession.totalQuestions);
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
        
        let progress = 0;
        
        // Calculate progress based on current state
        if (session.currentQuestion === 0 && !showAnswer) {
            // First question, not answered yet: show 1/N
            progress = 1 / session.totalQuestions;
        } else if (showAnswer) {
            // Question answered, show completed progress including current
            progress = (session.currentQuestion + 1) / session.totalQuestions;
        } else {
            // Mid-quiz, not answered yet: show progress up to current question
            progress = (session.currentQuestion + 1) / session.totalQuestions;
        }
        
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 300,
            useNativeDriver: false,
        }).start();
    };

    const recordingTimeoutRef = useRef<number | null>(null);

    const handleAnswer = async (answer: string, skip = false) => {
        if (!currentQuestion || showAnswer || isProcessingAnswer) return;

        // Handle recording type questions
        if (answer === 'recording' && currentQuestion.type === 'recording') {
            if (!isRecording) {
                try {
                    // Check microphone permissions first
                    const hasPermission = await RecordingService.checkPermissions();
                    if (!hasPermission) {
                        Alert.alert(
                            'Microphone Permission Required',
                            'Please enable microphone access in your device settings to use voice recording.',
                            [
                                { text: 'Skip Question', onPress: () => handleSkipQuestion() },
                                { text: 'OK', style: 'cancel' }
                            ]
                        );
                        return;
                    }
                    
                    // Start recording with timeout
                    const started = await Promise.race([
                        RecordingService.startRecording(),
                        new Promise<boolean>((resolve) => 
                            setTimeout(() => resolve(false), 5000) // 5 second timeout to start
                        )
                    ]);
                    
                    if (started) {
                        setIsRecording(true);
                        // Auto-stop after 5 seconds with additional safety timeout
                        const recordingTimeout = setTimeout(async () => {
                            if (isRecording) {
                                await handleStopRecording(true); // Force stop
                            }
                        }, 5000);
                        
                        // Store timeout reference for cleanup
                        recordingTimeoutRef.current = recordingTimeout;
                    } else {
                        throw new Error('Failed to start recording');
                    }
                } catch (error) {
                    console.error('Recording start error:', error);
                    Alert.alert(
                        'Recording Error',
                        'Unable to start recording. This might be due to device compatibility issues.',
                        [
                            { text: 'Skip Question', onPress: () => handleSkipQuestion() },
                            { text: 'Try Again', onPress: () => {} }
                        ]
                    );
                }
            } else {
                // Stop recording
                await handleStopRecording();
            }
            return;
        }

        setIsProcessingAnswer(true);
        setSelectedAnswer(answer);
        setSkipped(skip);
        
        try {
            const isCorrect = await PracticeService.submitAnswer(answer);
            
            // Visual feedback animation

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

    const handleStopRecording = async (forceStop = false) => {
        // Clear any existing timeout
        if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
        }
        
        setIsRecording(false);
        setIsProcessingAnswer(true);
        
        try {
            // Stop recording with timeout
            const uri = await Promise.race([
                RecordingService.stopRecording(),
                new Promise<string | null>((resolve) => 
                    setTimeout(() => resolve(null), 5000) // 5 second timeout
                )
            ]);
            
            if (uri && currentQuestion) {
                // Evaluate with timeout
                const evaluation = await Promise.race([
                    RecordingService.evaluatePronunciation(
                        uri,
                        currentQuestion.word.translation,
                        currentQuestion.word.language
                    ),
                    new Promise<any>((resolve) => 
                        setTimeout(() => resolve({
                            isCorrect: false,
                            confidence: 0,
                            feedback: 'Evaluation timed out. Please try again.'
                        }), 10000) // 10 second timeout
                    )
                ]);
                
                setRecordingResult(evaluation);
                
                // Store the recording URI for replay functionality
                setUserRecordingUri(uri);
                
                // Submit the answer based on evaluation
                await PracticeService.submitAnswer(
                    evaluation.isCorrect ? currentQuestion.correctAnswer : 'incorrect'
                );
                
                setShowAnswer(true);
                setSkipped(false); // Ensure Next Question button shows
                setIsProcessingAnswer(false);
            } else {
                throw new Error(forceStop ? 'Recording stopped due to timeout' : 'Failed to stop recording');
            }
        } catch (error) {
            console.error('Recording stop error:', error);
            setIsProcessingAnswer(false);
            
            if (!forceStop) {
                Alert.alert(
                    'Recording Error',
                    'Unable to process your recording. Would you like to skip this question?',
                    [
                        { text: 'Skip Question', onPress: () => handleSkipQuestion() },
                        { text: 'Try Again', onPress: () => {} }
                    ]
                );
            } else {
                // Auto-skip on timeout
                handleSkipQuestion();
            }
        }
    };

    const handleSkipQuestion = () => {
        if (currentQuestion) {
            setSkipped(true);
            setSelectedAnswer('__SKIPPED__');
            setIsRecording(false);
            
            // Clear any recording timeouts
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
                recordingTimeoutRef.current = null;
            }
            
            PracticeService.submitAnswer('__SKIPPED__');
            setShowAnswer(true);
            setIsProcessingAnswer(false);
            
            setTimeout(() => {
                nextQuestion();
            }, 1500);
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

    const handlePlayUserRecording = async () => {
        if (!userRecordingUri) return;

        try {
            // Stop any current playback
            if (currentPlaybackSound) {
                await RecordingService.stopPlayback(currentPlaybackSound);
                setCurrentPlaybackSound(null);
                setIsPlayingUserRecording(false);
                return;
            }

            // Start playback
            setIsPlayingUserRecording(true);
            const { sound, success } = await RecordingService.playRecording(userRecordingUri);
            
            if (success && sound) {
                setCurrentPlaybackSound(sound);
                
                // Set up playback completion listener
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setIsPlayingUserRecording(false);
                        setCurrentPlaybackSound(null);
                        RecordingService.stopPlayback(sound);
                    }
                });
            } else {
                setIsPlayingUserRecording(false);
                console.error('Failed to play user recording');
            }
        } catch (error) {
            console.error('Error playing user recording:', error);
            setIsPlayingUserRecording(false);
            setCurrentPlaybackSound(null);
        }
    };

    const nextQuestion = async () => {
        if (!session) return;

        // Stop any ongoing speech before moving to next question
        await SpeechService.stop();

        const next = PracticeService.nextQuestion();
        
        if (next) {
            // Reset states
            setCurrentQuestion(next);
            setShowAnswer(false);
            setSelectedAnswer(null);
            setTypedAnswer('');
            setRecordingResult(null);
            setIsRecording(false);
            setSkipped(false);
            
            // Reset recording replay states
            setUserRecordingUri(null);
            setIsPlayingUserRecording(false);
            if (currentPlaybackSound) {
                await RecordingService.stopPlayback(currentPlaybackSound);
                setCurrentPlaybackSound(null);
            }
            
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
            // Session completed - show results immediately
            // Don't set session to null here!
            await SpeechService.stop(); // Also stop audio when finishing
            setShowResults(true);
            // Load stats after a short delay to ensure results are visible
            setTimeout(() => {
                loadInitialData();
            }, 100);
        }
    };

    // Shared function to handle continuing from results
    const handleContinueFromResults = () => {
        setShowResults(false);
        setSession(null);
        setCurrentQuestion(null);
        setShowAnswer(false);
        setSelectedAnswer(null);
        setTypedAnswer('');
        setRecordingResult(null);
        setIsRecording(false);
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
                onRequestClose={handleContinueFromResults}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.modalOverlay}
                    onPress={handleContinueFromResults}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={styles.resultsContainer}
                        onPress={() => {}}
                    >
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
                            style={[styles.continueButton, { backgroundColor: '#3498db', borderRadius: 12 }]}
                            onPress={handleContinueFromResults}
                        >
                            <Text style={styles.continueButtonText}>Continue</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        );
    };

    // Show login warning if not authenticated
    if (isAuthenticated === false) {
        return (
            <View style={[styles.container, { backgroundColor: 'white' }]}> 
                <View style={styles.header}> 
                    <View>
                        <Text style={styles.title}>Practice</Text>
                    </View>
                </View>
                <View style={styles.authRequiredContainer}>
                    <Ionicons name="information-circle-outline" size={64} color="#f39c12" />
                    <Text style={styles.authRequiredTitle}>Login Required</Text>
                    <Text style={styles.authRequiredText}>
                        You must be logged in to practice. Please log in to continue and unlock all features.
                    </Text>
                    <Text style={styles.authRequiredSubtext}>
                        Login to save words, track progress, and access your vocabulary across devices.
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

    if (!session) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Practice</Text>
                        <Text style={styles.subtitle}>Improve your vocabulary</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={() => {
                            loadInitialData();
                        }}
                    >
                        <Ionicons name="refresh" size={24} color="#3498db" />
                    </TouchableOpacity>
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
                    Question {Math.min(session.currentQuestion + 1, session.totalQuestions)} of {session.totalQuestions}
                </Text>
                <TouchableOpacity onPress={async () => {
                    await SpeechService.stop();
                    setShowResults(true);
                }}>
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
                    {currentQuestion ? (
                        <PracticeQuestionRenderer
                            currentQuestion={currentQuestion}
                            showAnswer={showAnswer}
                            selectedAnswer={selectedAnswer}
                            typedAnswer={typedAnswer}
                            audioPlaying={audioPlaying}
                            isRecording={isRecording}
                            recordingResult={recordingResult}
                            userRecordingUri={userRecordingUri}
                            isPlayingUserRecording={isPlayingUserRecording}
                            onAnswer={handleAnswer}
                            onTypeAnswer={setTypedAnswer}
                            onPlayAudio={handleSpeech}
                            onPlayUserRecording={handlePlayUserRecording}
                        />
                    ) : (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Error loading question</Text>
                            <TouchableOpacity 
                                style={styles.skipButton}
                                onPress={nextQuestion}
                            >
                                <Text style={styles.skipButtonText}>Skip Question</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>

                {showAnswer && !skipped && (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        <TouchableOpacity
                            style={styles.nextButton}
                            onPress={nextQuestion}
                        >
                            <Text style={styles.nextButtonText}>
                                {session.currentQuestion < session.totalQuestions - 1 ? 'Next Question' : 'Finish'}
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color="white" />
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Skip Question Button: only show when not showing answer */}
                {!showAnswer && (
                    <TouchableOpacity
                        style={styles.skipQuestionButton}
                        onPress={async () => {
                            if (currentQuestion) {
                            setSelectedAnswer('__SKIPPED__');
                            // For recording questions, skip processing modal
                            if (currentQuestion.type === 'recording') {
                            // Instantly skip to next question
                            await PracticeService.submitAnswer('__SKIPPED__');
                            nextQuestion();
                            } else {
                            setSkipped(true);
                            // For other question types, show processing briefly
                            setIsProcessingAnswer(true);
                            await PracticeService.submitAnswer('__SKIPPED__');
                            setShowAnswer(true);
                            setIsProcessingAnswer(false);
                            // Auto-advance after 1 seconds
                            setTimeout(() => {
                            nextQuestion();
                            }, 1000);
                            }
                            }
                        }}
                    > 
                        <Text style={styles.skipQuestionButtonText}>Skip Question</Text>
                        <Ionicons name="arrow-forward" size={18} color="white" />
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Loading Modal for Answer/Recording Processing */}
            {(isProcessingAnswer && currentQuestion && currentQuestion.type === 'recording') && (
                <Modal
                    visible={true}
                    transparent
                    animationType="fade"
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ backgroundColor: 'white', padding: 32, borderRadius: 16, alignItems: 'center' }}>
                            <Animated.View style={{ marginBottom: 16, transform: [{
                                rotate: spinnerAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '360deg']
                                })
                            }] }}>
                                <Ionicons name="refresh" size={48} color="#3498db" />
                            </Animated.View>
                            <Text style={{ fontSize: 18, color: '#3498db', fontWeight: '600', marginBottom: 4 }}>Processing...</Text>
                            <Text style={{ fontSize: 14, color: '#7f8c8d', textAlign: 'center' }}>Please wait while we check your pronunciation.</Text>
                        </View>
                    </View>
                </Modal>
            )}

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
    refreshButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#f0f8ff',
    },
    progressContainer: {
        position: 'absolute',
        top: 87, // Position below the header
        left: 0,
        right: 0,
        height: 10,
        backgroundColor: '#ffffffff',
        zIndex: 1000, // High z-index to stay on top
        elevation: 10, // For Android shadow/elevation
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
        paddingTop: 50,
        paddingBottom: 10,
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
        paddingBottom: 100,
    },
    nextButton: {
        flexDirection: 'row',
        backgroundColor: '#27ae60',
        padding: 13,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 8,
    },
    nextButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    skipQuestionButton: {
        flexDirection: 'row',
        backgroundColor: '#f39c12',
        padding: 13,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        gap: 8,
    },
    skipQuestionButtonText: {
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
        marginTop: 15,
        paddingHorizontal: 30,
        paddingVertical: 12,
    },
    continueButtonText: {
        color: 'white',
        fontSize: 20,
        fontWeight: '600',
    },
    errorContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#e74c3c',
        marginBottom: 16,
    },
    skipButton: {
        backgroundColor: '#3498db',
        padding: 12,
        borderRadius: 8,
    },
    skipButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
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
    authRequiredSubtext: {
        fontSize: 14,
        color: '#95a5a6',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    authCard: {
        backgroundColor: 'white',
        padding: 40,
        borderRadius: 20,
        alignItems: 'center',
        margin: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
});