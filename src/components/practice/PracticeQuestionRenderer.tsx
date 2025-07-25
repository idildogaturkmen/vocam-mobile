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

interface PracticeQuestionRendererProps {
    currentQuestion: QuizQuestion;
    showAnswer: boolean;
    selectedAnswer: string | null;
    typedAnswer: string;
    audioPlaying: boolean;
    isRecording?: boolean;
    recordingResult?: { isCorrect: boolean; confidence: number; feedback: string } | null;
    onAnswer: (answer: string) => void;
    onTypeAnswer: (text: string) => void;
    onPlayAudio: (text: string, language: string) => void;
}

export default function PracticeQuestionRenderer({
    currentQuestion,
    showAnswer,
    selectedAnswer,
    typedAnswer,
    audioPlaying,
    isRecording,
    recordingResult,
    onAnswer,
    onTypeAnswer,
    onPlayAudio,
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
                        <FontAwesome name="key" size={16} color="#2980b9" />
                        <Text style={styles.hintTitle}>Hint</Text>
                    </View>
                    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                        <Ionicons name="chevron-forward" size={20} color="#2980b9" />
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
                                <Ionicons name="volume-medium" size={20} color="#2980b9" />
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
                                size={20} 
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
                                size={48} 
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
                            <Ionicons name="volume-high" size={25} color="#3498db" />
                        </Animated.View>
                        <Text style={styles.playText}>Listen to correct pronunciation</Text>
                    </TouchableOpacity>

                    {showAnswer && recordingResult && (
                        <View style={[
                            styles.recordingFeedback,
                            recordingResult.isCorrect ? styles.correctFeedback : styles.incorrectFeedback
                        ]}>
                            <View style={styles.feedbackHeader}>
                                <Ionicons 
                                    name={recordingResult.isCorrect ? "checkmark-circle" : "close-circle"} 
                                    size={24} 
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
                            <Ionicons name="volume-high" size={25} color="#3498db" />
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
                            <Ionicons name="volume-high" size={24} color="#3498db" />
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
                                size={48} 
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
                                        size={24} 
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
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    typingQuestionContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        paddingBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        minHeight: 300,
    },
    questionText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    hintContainer: {
        marginBottom: 7,
    },
    hintHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f0f8ff',
        padding: 8,
        borderRadius: 8,
    },
    hintTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    hintTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2980b9',
    },
    hintContent: {
        backgroundColor: '#f8fbff',
        padding: 10,
        borderRadius: 8,
        marginTop: -1,
    },
    hintText: {
        fontSize: 14,
        color: '#34495e',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    optionsContainer: {
        gap: 4, // reduce gap for more compact look
        paddingHorizontal: 0, // ensure no extra horizontal padding
        paddingVertical: 0, // ensure no extra vertical padding
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15, // less vertical padding
        paddingHorizontal: 15, // less horizontal padding
        borderRadius: 12,
        borderWidth: 2,
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
        fontSize: 16,
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
        padding: 4,
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ebf5fb',
        padding: 10,
        borderRadius: 15,
        marginBottom: 20,
        gap: 8,
    },
    playText: {
        fontSize: 15,
        color: '#3498db',
        fontWeight: '500',
    },
    bigPlayButton: {
        alignSelf: 'center',
        backgroundColor: '#3498db',
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    bigPlayButtonActive: {
        transform: [{ scale: 0.95 }],
    },
    sentenceContainer: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
    },
    sentenceText: {
        fontSize: 16,
        color: '#34495e',
        lineHeight: 24,
        textAlign: 'center',
    },
    typingInput: {
        borderWidth: 2,
        borderColor: '#ecf0f1',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 20,
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
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#bdc3c7',
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    correctAnswerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d5f4e6',
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        gap: 8,
    },
    correctAnswerLabel: {
        fontSize: 14,
        color: '#27ae60',
        fontWeight: '500',
    },
    correctAnswerText: {
        fontSize: 16,
        color: '#27ae60',
        fontWeight: '600',
        flex: 1,
    },
    recordingContainer: {
        alignItems: 'center',
        marginVertical: 30,
    },
    bigRecordButton: {
        backgroundColor: '#e74c3c',
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    recordingHint: {
        fontSize: 15,
        color: '#7f8c8d',
        textAlign: 'center',
    },
    recordingFeedback: {
        backgroundColor: '#f0f8ff',
        padding: 16,
        borderRadius: 8,
        marginTop: 20,
    },
    recordingFeedbackText: {
        fontSize: 14,
        color: '#2980b9',
        textAlign: 'center',
        lineHeight: 20,
    },
    recordingActive: {
        backgroundColor: '#c0392b',
        transform: [{ scale: 0.95 }],
    },
    correctFeedback: {
        backgroundColor: '#d5f4e6',
        borderColor: '#27ae60',
        borderWidth: 1,
    },
    incorrectFeedback: {
        backgroundColor: '#fadbd8',
        borderColor: '#e74c3c',
        borderWidth: 1,
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    feedbackTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    confidenceText: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 4,
    },
    hintAudioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        padding: 4,
    },
    hintAudioText: {
        fontSize: 12,
        color: '#2980b9',
        fontWeight: '500',
    },
    contextAudioButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 8,
    },
    hintTranslation: {
        fontSize: 12,
        color: '#7f8c8d',
        fontStyle: 'italic',
        marginTop: 4,
    },
    contextAudioButtonBelow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        marginBottom: 16,
        backgroundColor: '#ebf5fb',
        borderRadius: 8,
    },
    contextAudioText: {
        fontSize: 14,
        color: '#3498db',
        fontWeight: '500',
    },
    contextOptionsContainer: {
        gap: 8,
        marginTop: 18,
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
});