import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface PracticeFeedbackProps {
    isCorrect: boolean;
    show: boolean;
    message?: string;
}

export default function PracticeFeedback({ isCorrect, show, message }: PracticeFeedbackProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const slideAnim = useRef(new Animated.Value(-50)).current;

    useEffect(() => {
        if (show) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.8,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [show]);

    if (!show) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                    transform: [
                        { scale: scaleAnim },
                        { translateY: slideAnim }
                    ],
                },
            ]}
        >
            <View style={[styles.content, isCorrect ? styles.correctContent : styles.incorrectContent]}>
                <Ionicons
                    name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                    size={48}
                    color={isCorrect ? '#27ae60' : '#e74c3c'}
                />
                <Text style={[styles.text, isCorrect ? styles.correctText : styles.incorrectText]}>
                    {isCorrect ? 'Correct!' : 'Not quite!'}
                </Text>
                {message && (
                    <Text style={styles.message}>{message}</Text>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        zIndex: 1000,
    },
    content: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    correctContent: {
        borderWidth: 2,
        borderColor: '#27ae60',
    },
    incorrectContent: {
        borderWidth: 2,
        borderColor: '#e74c3c',
    },
    text: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 8,
    },
    correctText: {
        color: '#27ae60',
    },
    incorrectText: {
        color: '#e74c3c',
    },
    message: {
        fontSize: 16,
        color: '#7f8c8d',
        marginTop: 8,
        textAlign: 'center',
    },
});