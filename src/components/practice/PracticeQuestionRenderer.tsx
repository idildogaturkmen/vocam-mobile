import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { QuizQuestion } from '../../services/PracticeService';
import SpeechService from '../../services/SpeechService';
import { scale, normalizeFont } from '../../../utils/normalize';

interface PracticeQuestionRendererProps {
    currentQuestion: QuizQuestion;
    showAnswer: boolean;
    selectedAnswer: string | null;
    typedAnswer: string;
    audioPlaying: boolean;
    isRecording?: boolean;
    recordingResult?: { isCorrect: boolean; confidence: number; feedback: string } | null;
    userRecordingUri?: string | null;
    isPlayingUserRecording?: boolean;
    onAnswer: (answer: string) => void;
    onTypeAnswer: (text: string) => void;
    onPlayAudio: (text: string, language: string) => void;
    onPlayUserRecording?: () => void;
}

export default function PracticeQuestionRenderer({
    currentQuestion,
    showAnswer,
    selectedAnswer,
    typedAnswer,
    audioPlaying,
    isRecording,
    recordingResult,
    userRecordingUri,
    isPlayingUserRecording,
    onAnswer,
    onTypeAnswer,
    onPlayAudio,
    onPlayUserRecording,
}: PracticeQuestionRendererProps) {
    
    const [hintExpanded, setHintExpanded] = useState(false);
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [lastAudioTime, setLastAudioTime] = useState(0);
    const [audioLoading, setAudioLoading] = useState(false)

    // Auto-play audio for listening questions
    useEffect(() => {
        if ((currentQuestion.type === 'listening' || currentQuestion.type === 'pronunciation') && !showAnswer) {
            // Small delay to ensure component is mounted
            const timer = setTimeout(() => {
                if (currentQuestion.word && currentQuestion.word.translation && currentQuestion.word.language) {
                    handlePlayAudio(currentQuestion.word.translation, currentQuestion.word.language);
                } else {
                    console.error('Missing audio data for listening question:', currentQuestion);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentQuestion?.id, currentQuestion?.type]);

    // Reset hint when question changes
    useEffect(() => {
        setHintExpanded(false);
    }, [currentQuestion.id]);

    const toggleHint = () => {
        setHintExpanded(!hintExpanded);
        Animated.timing(rotateAnim, {
            toValue: hintExpanded ? 0 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    };

    const animateSpeaker = () => {
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.8,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const renderHint = () => {
        if (!currentQuestion.word.example) return null;

        const rotation = rotateAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '90deg'],
        });

        // Parse the example - it should be in format "target_language|english"
        let hintText = currentQuestion.word.example;
        let targetLanguageHint = '';
        let englishTranslation = '';
        
        if (currentQuestion.word.example.includes('|')) {
            const parts = currentQuestion.word.example.split('|');
            targetLanguageHint = parts[0]; // Target language
            englishTranslation = parts[1]; // English translation
            // Show the target language as primary hint
            hintText = targetLanguageHint;
        }

        return (
            <View style={styles.hintContainer}>
                <TouchableOpacity 
                    style={styles.hintHeader}
                    onPress={toggleHint}
                    activeOpacity={0.7}
                >
                    <View style={styles.hintTitleContainer}>
                        <FontAwesome name="key" size={scale(16)} color="#2980b9" />
                        <Text style={styles.hintTitle}>Hint</Text>
                    </View>
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <Ionicons name="chevron-forward" size={scale(20)} color="#2980b9" />
                    </Animated.View>
                </TouchableOpacity>
                
                {hintExpanded && (
                    <View style={styles.hintContent}>
                        <Text style={styles.hintText}>
                            {hintText}
                        </Text>
                        {englishTranslation && (
                            <Text style={styles.hintTranslation}>
                                ({englishTranslation})
                            </Text>
                        )}
                        {targetLanguageHint && (
                            <TouchableOpacity
                                style={styles.hintAudioButton}
                                onPress={() => {
                                    handlePlayAudio(targetLanguageHint, currentQuestion.word.language);
                                }}
                            >
                                <Ionicons name="volume-medium" size={scale(20)} color="#2980b9" />
                                <Text style={styles.hintAudioText}>Listen to example</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const handlePlayAudio = async (text: string, language: string) => {
        try {
            // Prevent rapid successive plays
            const now = Date.now();
            if (now - lastAudioTime < 500) {
                return;
            }
            setLastAudioTime(now);
            
            setAudioLoading(true);
            
            // Stop any current audio
            await SpeechService.stop();
            
            // Extra delay to ensure audio system is ready
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Play with full volume
            await onPlayAudio(text, language);
        } catch (error) {
            console.error('Error playing audio:', error);
        } finally {
            setAudioLoading(false);
        }
    };

    const renderMultipleChoiceOptions = () => (
        <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, index) => (
                <TouchableOpacity
                    key={index}
                    style={[
                        styles.optionButton,
                        selectedAnswer === option && styles.selectedOption,
                        showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctOption,
                        showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedOption,
                        showAnswer && selectedAnswer === option && option !== currentQuestion.correctAnswer && styles.incorrectOption
                    ]}
                    onPress={() => onAnswer(option)}
                    disabled={showAnswer}
                >
                    <Text style={[
                        styles.optionText,
                        showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctText,
                        showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedText
                    ]}>
                        {option}
                    </Text>
                    {(currentQuestion.type === 'translation' || 
                      currentQuestion.type === 'multiple_choice' || 
                      currentQuestion.type === 'context') && (
                        <TouchableOpacity
                            style={styles.optionSpeaker}
                            onPress={(e) => {
                                e.stopPropagation();
                                handlePlayAudio(option, currentQuestion.word.language);
                            }}
                            disabled={audioPlaying}
                        >
                            <Ionicons 
                                name={audioPlaying ? "volume-medium": "volume-medium"} 
                                size={scale(20)} 
                                color="#3498db" 
                            />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );

    switch (currentQuestion.type) {
        case 'translation':
        case 'multiple_choice':
            return (
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>
                    
                    {renderHint()}

                    {renderMultipleChoiceOptions()}
                </View>
            );

        case 'recording':
            return (
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>
                    
                    <View style={styles.recordingContainer}>
                        <TouchableOpacity
                            style={[
                                styles.bigRecordButton,
                                isRecording && styles.recordingActive
                            ]}
                            onPress={() => onAnswer('recording')}
                            activeOpacity={0.8}
                            disabled={showAnswer}
                        >
                            <Ionicons 
                                name={isRecording ? "stop" : "mic"} 
                                size={scale(48)} 
                                color="white" 
                            />
                        </TouchableOpacity>
                        <Text style={styles.recordingHint}>
                            {isRecording 
                                ? "Recording... Tap to stop" 
                                : "Tap to record your pronunciation"
                            }
                        </Text>
                    </View>

                    <View style={styles.audioButtonsContainer}>
                        <TouchableOpacity
                            style={styles.playButton}
                            onPress={() => {
                                animateSpeaker();
                                handlePlayAudio(currentQuestion.word.translation, currentQuestion.word.language);
                            }}
                            activeOpacity={0.7}
                            disabled={audioLoading}
                        >
                            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                                <Ionicons name="volume-high" size={scale(25)} color="#3498db" />
                            </Animated.View>
                            <Text style={styles.playText}>Listen to correct pronunciation</Text>
                        </TouchableOpacity>

                        {userRecordingUri && showAnswer && (
                            <TouchableOpacity
                                style={[
                                    styles.playButton,
                                    styles.replayButton,
                                    isPlayingUserRecording && styles.playingButton
                                ]}
                                onPress={onPlayUserRecording}
                                activeOpacity={0.7}
                                disabled={!onPlayUserRecording}
                            >
                                <Ionicons 
                                    name={isPlayingUserRecording ? "pause" : "play"} 
                                    size={scale(25)} 
                                    color={isPlayingUserRecording ? "#27ae60" : "#27ae60"} 
                                />
                                <Text style={[
                                    styles.playText,
                                    styles.replayText
                                ]}>
                                    {isPlayingUserRecording ? "Playing your recording..." : "Replay your recording"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {showAnswer && recordingResult && (
                        <View style={[
                            styles.recordingFeedback,
                            recordingResult.isCorrect ? styles.correctFeedback : styles.incorrectFeedback
                        ]}>
                            <View style={styles.feedbackHeader}>
                                <Ionicons 
                                    name={recordingResult.isCorrect ? "checkmark-circle" : "close-circle"} 
                                    size={scale(24)} 
                                    color={recordingResult.isCorrect ? "#27ae60" : "#e74c3c"} 
                                />
                                <Text style={[
                                    styles.feedbackTitle,
                                    recordingResult.isCorrect ? styles.correctText : styles.incorrectText
                                ]}>
                                    {recordingResult.isCorrect ? "Excellent!" : "Keep Practicing!"}
                                </Text>
                            </View>
                            <Text style={styles.confidenceText}>
                                Confidence: {recordingResult.confidence.toFixed(0)}%
                            </Text>
                            <Text style={styles.recordingFeedbackText}>
                                {recordingResult.feedback}
                            </Text>
                        </View>
                    )}
                </View>
            );

        case 'reverse_translation':
            return (
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>
                    
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={() => {
                            animateSpeaker();
                            handlePlayAudio(currentQuestion.word.translation, currentQuestion.word.language);
                        }}
                        activeOpacity={0.7}
                        disabled={audioLoading}
                    >
                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                            <Ionicons name="volume-high" size={scale(25)} color="#3498db" />
                        </Animated.View>
                        <Text style={styles.playText}>Play pronunciation</Text>
                    </TouchableOpacity>

                    <View style={styles.optionsContainer}>
                        {currentQuestion.options?.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.optionButton,
                                    selectedAnswer === option && styles.selectedOption,
                                    showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctOption,
                                    showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedOption,
                                    showAnswer && selectedAnswer === option && option !== currentQuestion.correctAnswer && styles.incorrectOption
                                ]}
                                onPress={() => onAnswer(option)}
                                disabled={showAnswer}
                            >
                                <Text style={[
                                    styles.optionText,
                                    showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctText,
                                    showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedText
                                ]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            );

        case 'context':
            return (
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>
                    
                    <View style={styles.sentenceContainer}>
                        <Text style={styles.sentenceText}>
                            {currentQuestion.contextSentence || 'Context not available'}
                        </Text>
                    </View>
                    
                    {/* Audio button if needed */}
                    {currentQuestion.word.example && currentQuestion.word.example.includes('|') && (
                        <TouchableOpacity
                            style={styles.contextAudioButtonBelow}
                            onPress={() => {
                                let fullSentence = currentQuestion.word.example.split('|')[0];
                                // Replace blank with correct answer for TTS
                                if (fullSentence.includes('_____') && currentQuestion.correctAnswer) {
                                    fullSentence = fullSentence.replace(/_____/g, currentQuestion.correctAnswer);
                                }
                                handlePlayAudio(fullSentence, currentQuestion.word.language);
                            }}
                        >
                            <Ionicons name="volume-high" size={scale(24)} color="#3498db" />
                            <Text style={styles.contextAudioText}>Listen to complete sentence</Text>
                        </TouchableOpacity>
                    )}

                    {/* Use the same optionsContainer style as other question types */}
                    <View style={styles.optionsContainer}>
                        {currentQuestion.options?.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.optionButton,
                                    selectedAnswer === option && styles.selectedOption,
                                    showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctOption,
                                    showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedOption,
                                    showAnswer && selectedAnswer === option && option !== currentQuestion.correctAnswer && styles.incorrectOption
                                ]}
                                onPress={() => onAnswer(option)}
                                disabled={showAnswer}
                            >
                                <Text style={[
                                    styles.optionText,
                                    showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctText,
                                    showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedText
                                ]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            );

        case 'listening':
            return (
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>
                    
                    <TouchableOpacity
                        style={[styles.bigPlayButton, audioPlaying && styles.bigPlayButtonActive]}
                        onPress={() => {
                            animateSpeaker();
                            handlePlayAudio(currentQuestion.word.translation, currentQuestion.word.language);
                        }}
                        activeOpacity={0.8}
                        disabled={audioLoading}
                    >
                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                            <Ionicons 
                                name="volume-high" 
                                size={scale(48)} 
                                color="white" 
                            />
                        </Animated.View>
                    </TouchableOpacity>

                    <View style={styles.optionsContainer}>
                        {currentQuestion.options?.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.optionButton,
                                    selectedAnswer === option && styles.selectedOption,
                                    showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctOption,
                                    showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedOption,
                                    showAnswer && selectedAnswer === option && option !== currentQuestion.correctAnswer && styles.incorrectOption
                                ]}
                                onPress={() => onAnswer(option)}
                                disabled={showAnswer}
                            >
                                <Text style={[
                                    styles.optionText,
                                    showAnswer && option === currentQuestion.correctAnswer && !selectedAnswer?.includes('__SKIPPED__') && styles.correctText,
                                    showAnswer && option === currentQuestion.correctAnswer && selectedAnswer === '__SKIPPED__' && styles.skippedText
                                ]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            );

        case 'typing':
            return (
                <KeyboardAvoidingView 
                    style={styles.typingQuestionContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>

                    <TextInput
                        style={[
                            styles.typingInput,
                            showAnswer && typedAnswer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim() && styles.correctInput,
                            showAnswer && typedAnswer.toLowerCase().trim() !== currentQuestion.correctAnswer.toLowerCase().trim() && !selectedAnswer?.includes('__SKIPPED__') && styles.incorrectInput,
                            showAnswer && selectedAnswer?.includes('__SKIPPED__') && styles.skippedInput
                        ]}
                        value={typedAnswer}
                        onChangeText={onTypeAnswer}
                        placeholder="Type your answer..."
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!showAnswer}
                        onSubmitEditing={() => typedAnswer && onAnswer(typedAnswer)}
                    />

                    <TouchableOpacity
                        style={[styles.submitButton, !typedAnswer && styles.disabledButton]}
                        onPress={() => onAnswer(typedAnswer)}
                        disabled={!typedAnswer || showAnswer}
                    >
                        <Text style={styles.submitButtonText}>Submit</Text>
                    </TouchableOpacity>

                    {showAnswer && (typedAnswer.toLowerCase().trim() !== currentQuestion.correctAnswer.toLowerCase().trim() || selectedAnswer?.includes('__SKIPPED__')) && (
                        <View style={[
                            styles.correctAnswerContainer,
                            selectedAnswer?.includes('__SKIPPED__') && styles.skippedAnswerContainer
                        ]}>
                            <Text style={[
                                styles.correctAnswerLabel,
                                selectedAnswer?.includes('__SKIPPED__') && styles.skippedAnswerLabel
                            ]}>
                                Correct answer:
                            </Text>
                            <Text style={[
                                styles.correctAnswerText,
                                selectedAnswer?.includes('__SKIPPED__') && styles.skippedAnswerText
                            ]}>
                                {currentQuestion.correctAnswer}
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    animateSpeaker();
                                    handlePlayAudio(currentQuestion.correctAnswer, currentQuestion.word.language);
                                }}
                                activeOpacity={0.7}
                            >
                                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                                    <Ionicons 
                                        name="volume-medium" 
                                        size={scale(24)} 
                                        color={selectedAnswer?.includes('__SKIPPED__') ? '#f39c12' : '#3498db'}
                                    />
                                </Animated.View>
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            );

        default:
            return null;
    }
}

const styles = StyleSheet.create({
    questionContainer: {
        backgroundColor: 'white',
        borderRadius: scale(16),
        padding: scale(20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.1,
        shadowRadius: scale(8),
        elevation: 4,
    },
    typingQuestionContainer: {
        backgroundColor: 'white',
        borderRadius: scale(16),
        padding: scale(24),
        paddingBottom: scale(32),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.1,
        shadowRadius: scale(8),
        elevation: 4,
        minHeight: scale(300),
    },
    questionText: {
        fontSize: normalizeFont(18),
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: scale(16),
        textAlign: 'center',
        lineHeight: normalizeFont(24),
    },
    hintContainer: {
        marginBottom: scale(7),
    },
    hintHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f0f8ff',
        padding: scale(8),
        borderRadius: scale(8),
    },
    hintTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
    },
    hintTitle: {
        fontSize: normalizeFont(14),
        fontWeight: '600',
        color: '#2980b9',
    },
    hintContent: {
        backgroundColor: '#f8fbff',
        padding: scale(10),
        borderRadius: scale(8),
        marginTop: scale(-1),
    },
    hintText: {
        fontSize: normalizeFont(14),
        color: '#34495e',
        fontStyle: 'italic',
        lineHeight: normalizeFont(20),
    },
    optionsContainer: {
        gap: scale(4), // reduce gap for more compact look
        paddingHorizontal: 0, // ensure no extra horizontal padding
        paddingVertical: 0, // ensure no extra vertical padding
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: scale(15), // less vertical padding
        paddingHorizontal: scale(15), // less horizontal padding
        borderRadius: scale(12),
        borderWidth: scale(2),
        borderColor: '#ecf0f1',
        backgroundColor: 'white',
    },
    selectedOption: {
        borderColor: '#3498db',
        backgroundColor: '#ebf5fb',
    },
    correctOption: {
        borderColor: '#27ae60',
        backgroundColor: '#d5f4e6',
    },
    incorrectOption: {
        borderColor: '#e74c3c',
        backgroundColor: '#fadbd8',
    },
    optionText: {
        fontSize: normalizeFont(16),
        color: '#2c3e50',
        flex: 1,
    },
    correctText: {
        color: '#27ae60',
        fontWeight: '600',
    },
    incorrectText: {
        color: '#e74c3c',
        fontWeight: '600',
    },
    optionSpeaker: {
        padding: scale(4),
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ebf5fb',
        padding: scale(10),
        borderRadius: scale(15),
        marginBottom: scale(20),
        gap: scale(8),
    },
    playText: {
        fontSize: normalizeFont(15),
        color: '#3498db',
        fontWeight: '500',
    },
    bigPlayButton: {
        alignSelf: 'center',
        backgroundColor: '#3498db',
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.2,
        shadowRadius: scale(8),
        elevation: 5,
    },
    bigPlayButtonActive: {
        transform: [{ scale: 0.95 }],
    },
    sentenceContainer: {
        backgroundColor: '#f8f9fa',
        padding: scale(16),
        borderRadius: scale(8),
        marginBottom: scale(20),
    },
    sentenceText: {
        fontSize: normalizeFont(16),
        color: '#34495e',
        lineHeight: normalizeFont(24),
        textAlign: 'center',
    },
    typingInput: {
        borderWidth: scale(2),
        borderColor: '#ecf0f1',
        borderRadius: scale(12),
        padding: scale(16),
        fontSize: normalizeFont(16),
        marginBottom: scale(20),
        color: '#2c3e50',
    },
    correctInput: {
        borderColor: '#27ae60',
        backgroundColor: '#d5f4e6',
    },
    incorrectInput: {
        borderColor: '#e74c3c',
        backgroundColor: '#fadbd8',
    },
    submitButton: {
        backgroundColor: '#3498db',
        padding: scale(16),
        borderRadius: scale(12),
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#bdc3c7',
    },
    submitButtonText: {
        color: 'white',
        fontSize: normalizeFont(16),
        fontWeight: '600',
    },
    correctAnswerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d5f4e6',
        padding: scale(12),
        borderRadius: scale(8),
        marginTop: scale(16),
        gap: scale(8),
    },
    correctAnswerLabel: {
        fontSize: normalizeFont(14),
        color: '#27ae60',
        fontWeight: '500',
    },
    correctAnswerText: {
        fontSize: normalizeFont(16),
        color: '#27ae60',
        fontWeight: '600',
        flex: 1,
    },
    recordingContainer: {
        alignItems: 'center',
        marginVertical: scale(30),
    },
    bigRecordButton: {
        backgroundColor: '#e74c3c',
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.2,
        shadowRadius: scale(8),
        elevation: 5,
    },
    recordingHint: {
        fontSize: normalizeFont(15),
        color: '#7f8c8d',
        textAlign: 'center',
    },
    recordingFeedback: {
        backgroundColor: '#f0f8ff',
        padding: scale(16),
        borderRadius: scale(8),
        marginTop: scale(20),
    },
    recordingFeedbackText: {
        fontSize: normalizeFont(14),
        color: '#2980b9',
        textAlign: 'center',
        lineHeight: normalizeFont(20),
    },
    recordingActive: {
        backgroundColor: '#c0392b',
        transform: [{ scale: 0.95 }],
    },
    correctFeedback: {
        backgroundColor: '#d5f4e6',
        borderColor: '#27ae60',
        borderWidth: scale(1),
    },
    incorrectFeedback: {
        backgroundColor: '#fadbd8',
        borderColor: '#e74c3c',
        borderWidth: scale(1),
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
        marginBottom: scale(8),
    },
    feedbackTitle: {
        fontSize: normalizeFont(18),
        fontWeight: '600',
    },
    confidenceText: {
        fontSize: normalizeFont(14),
        color: '#7f8c8d',
        marginBottom: scale(4),
    },
    hintAudioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
        marginTop: scale(8),
        padding: scale(4),
    },
    hintAudioText: {
        fontSize: normalizeFont(12),
        color: '#2980b9',
        fontWeight: '500',
    },
    contextAudioButton: {
        position: 'absolute',
        top: scale(8),
        right: scale(8),
        padding: scale(8),
    },
    hintTranslation: {
        fontSize: normalizeFont(12),
        color: '#7f8c8d',
        fontStyle: 'italic',
        marginTop: scale(4),
    },
    contextAudioButtonBelow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(8),
        padding: scale(12),
        marginBottom: scale(16),
        backgroundColor: '#ebf5fb',
        borderRadius: scale(8),
    },
    contextAudioText: {
        fontSize: normalizeFont(14),
        color: '#3498db',
        fontWeight: '500',
    },
    contextOptionsContainer: {
        gap: scale(8),
        marginTop: scale(18),
    },
    skippedOption: {
        borderColor: '#f39c12',
        backgroundColor: '#fef5e7',
    },
    skippedText: {
        color: '#f39c12',
        fontWeight: '600',
    },
    skippedInput: {
        borderColor: '#f39c12',
        backgroundColor: '#fef5e7',
    },
    skippedAnswerContainer: {
        backgroundColor: '#fef5e7',
    },
    skippedAnswerLabel: {
        color: '#f39c12',
    },
    skippedAnswerText: {
        color: '#f39c12',
    },
    audioButtonsContainer: {
        gap: scale(12),
        marginVertical: scale(8),
    },
    replayButton: {
        backgroundColor: '#f8f9fa',
        borderWidth: scale(1),
        borderColor: '#27ae60',
    },
    playingButton: {
        backgroundColor: '#f8f9fa',
        borderColor: '#27ae60',
    },
    replayText: {
        color: '#27ae60',
        fontWeight: '500',
    },
});