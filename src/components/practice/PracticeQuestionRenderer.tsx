import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { QuizQuestion } from '../../services/PracticeService';

interface PracticeQuestionRendererProps {
    currentQuestion: QuizQuestion;
    showAnswer: boolean;
    selectedAnswer: string | null;
    typedAnswer: string;
    audioPlaying: boolean;
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
    onAnswer,
    onTypeAnswer,
    onPlayAudio,
}: PracticeQuestionRendererProps) {
    // Auto-play audio for listening questions
    useEffect(() => {
        if ((currentQuestion.type === 'listening' || currentQuestion.type === 'pronunciation') && !showAnswer) {
            // Small delay to ensure component is mounted
            const timer = setTimeout(() => {
                onPlayAudio(currentQuestion.word.translation, currentQuestion.word.language);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentQuestion.id, currentQuestion.type]);

    const renderMultipleChoiceOptions = () => (
        <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, index) => (
                <TouchableOpacity
                    key={index}
                    style={[
                        styles.optionButton,
                        selectedAnswer === option && styles.selectedOption,
                        showAnswer && option === currentQuestion.correctAnswer && styles.correctOption,
                        showAnswer && selectedAnswer === option && option !== currentQuestion.correctAnswer && styles.incorrectOption
                    ]}
                    onPress={() => onAnswer(option)}
                    disabled={showAnswer}
                >
                    <Text style={[
                        styles.optionText,
                        showAnswer && option === currentQuestion.correctAnswer && styles.correctText
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
                                onPlayAudio(option, currentQuestion.word.language);
                            }}
                            disabled={audioPlaying}
                        >
                            <Ionicons 
                                name={audioPlaying ? "volume-mute" : "volume-medium"} 
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
                    
                    {currentQuestion.word.example && (
                        <View style={styles.exampleContainer}>
                            <View style={styles.exampleHeader}>
                                <FontAwesome name="key" size={16} color="#2980b9" />
                                <Text style={styles.exampleLabel}>Hint:</Text>
                            </View>
                            <Text style={styles.exampleText}>
                                {currentQuestion.word.example.split('|')[1] || currentQuestion.word.example}
                            </Text>
                        </View>
                    )}

                    {renderMultipleChoiceOptions()}
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
                        onPress={() => onPlayAudio(currentQuestion.word.translation, currentQuestion.word.language)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="volume-high" size={audioPlaying ? 28 : 32} color="#3498db" />
                        <Text style={styles.playText}>Play pronunciation</Text>
                    </TouchableOpacity>

                    <View style={styles.optionsContainer}>
                        {currentQuestion.options?.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.optionButton,
                                    selectedAnswer === option && styles.selectedOption,
                                    showAnswer && option === currentQuestion.correctAnswer && styles.correctOption,
                                    showAnswer && selectedAnswer === option && option !== currentQuestion.correctAnswer && styles.incorrectOption
                                ]}
                                onPress={() => onAnswer(option)}
                                disabled={showAnswer}
                            >
                                <Text style={[
                                    styles.optionText,
                                    showAnswer && option === currentQuestion.correctAnswer && styles.correctText
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

                    {renderMultipleChoiceOptions()}
                </View>
            );

        case 'listening':
        case 'pronunciation':
            return (
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>
                    
                    <TouchableOpacity
                        style={[styles.bigPlayButton, audioPlaying && styles.bigPlayButtonActive]}
                        onPress={() => onPlayAudio(currentQuestion.word.translation, currentQuestion.word.language)}
                        activeOpacity={0.8}
                    >
                        <Ionicons 
                            name="volume-high" 
                            size={audioPlaying ? 44 : 48} 
                            color="white" 
                        />
                    </TouchableOpacity>

                    <View style={styles.optionsContainer}>
                        {currentQuestion.options?.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.optionButton,
                                    selectedAnswer === option && styles.selectedOption,
                                    showAnswer && option === currentQuestion.correctAnswer && styles.correctOption,
                                    showAnswer && selectedAnswer === option && option !== currentQuestion.correctAnswer && styles.incorrectOption
                                ]}
                                onPress={() => onAnswer(option)}
                                disabled={showAnswer}
                            >
                                <Text style={[
                                    styles.optionText,
                                    showAnswer && option === currentQuestion.correctAnswer && styles.correctText
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
                    style={styles.questionContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <Text style={styles.questionText}>
                        {currentQuestion.displayQuestion}
                    </Text>

                    <TextInput
                        style={[
                            styles.typingInput,
                            showAnswer && typedAnswer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim() && styles.correctInput,
                            showAnswer && typedAnswer.toLowerCase().trim() !== currentQuestion.correctAnswer.toLowerCase().trim() && styles.incorrectInput
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

                    {showAnswer && typedAnswer.toLowerCase().trim() !== currentQuestion.correctAnswer.toLowerCase().trim() && (
                        <View style={styles.correctAnswerContainer}>
                            <Text style={styles.correctAnswerLabel}>Correct answer:</Text>
                            <Text style={styles.correctAnswerText}>{currentQuestion.correctAnswer}</Text>
                            <TouchableOpacity
                                onPress={() => onPlayAudio(currentQuestion.correctAnswer, currentQuestion.word.language)}
                                activeOpacity={0.7}
                            >
                                <Ionicons 
                                    name="volume-medium" 
                                    size={audioPlaying ? 22 : 24} 
                                    color="#3498db" 
                                />
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
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    questionText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 20,
        textAlign: 'center',
        lineHeight: 28,
    },
    exampleContainer: {
        backgroundColor: '#f0f8ff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    exampleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    exampleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2980b9',
    },
    exampleText: {
        fontSize: 14,
        color: '#34495e',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    optionsContainer: {
        gap: 12,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
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
    optionSpeaker: {
        padding: 4,
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ebf5fb',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        gap: 8,
    },
    playText: {
        fontSize: 16,
        color: '#3498db',
        fontWeight: '500',
    },
    bigPlayButton: {
        alignSelf: 'center',
        backgroundColor: '#3498db',
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
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
});