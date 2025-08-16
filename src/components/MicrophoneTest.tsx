import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, normalizeFont } from '../../utils/normalize';
import RecordingService from '../services/RecordingService';

interface MicrophoneTestProps {
    onTestComplete?: (success: boolean, message: string) => void;
    style?: any;
}

const MicrophoneTest: React.FC<MicrophoneTestProps> = ({ onTestComplete, style }) => {
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleTestMicrophone = async () => {
        setIsTestingMic(true);
        setTestResult(null);

        try {
            const result = await RecordingService.testMicrophone();
            setTestResult(result);
            
            // Show alert with result
            Alert.alert(
                result.success ? 'Microphone Test Successful' : 'Microphone Test Failed',
                result.message,
                [{ text: 'OK' }]
            );

            // Call optional callback
            if (onTestComplete) {
                onTestComplete(result.success, result.message);
            }
        } catch (error) {
            const errorMessage = 'An unexpected error occurred during microphone test.';
            setTestResult({ success: false, message: errorMessage });
            
            Alert.alert(
                'Microphone Test Error',
                errorMessage,
                [{ text: 'OK' }]
            );

            if (onTestComplete) {
                onTestComplete(false, errorMessage);
            }
        } finally {
            setIsTestingMic(false);
        }
    };

    const getStatusColor = () => {
        if (testResult === null) return '#666';
        return testResult.success ? '#4CAF50' : '#F44336';
    };

    const getStatusIcon = () => {
        if (isTestingMic) return 'hourglass-outline';
        if (testResult === null) return 'mic-outline';
        return testResult.success ? 'checkmark-circle' : 'close-circle';
    };

    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity
                style={[
                    styles.testButton,
                    isTestingMic && styles.testButtonActive,
                    testResult && (testResult.success ? styles.testButtonSuccess : styles.testButtonError)
                ]}
                onPress={handleTestMicrophone}
                disabled={isTestingMic}
                activeOpacity={0.7}
            >
                {isTestingMic ? (
                    <ActivityIndicator size="small" color="white" />
                ) : (
                    <Ionicons 
                        name={getStatusIcon()} 
                        size={scale(24)} 
                        color="white" 
                    />
                )}
                <Text style={styles.testButtonText}>
                    {isTestingMic ? 'Testing...' : 'Test Microphone'}
                </Text>
            </TouchableOpacity>

            {testResult && (
                <View style={styles.resultContainer}>
                    <Ionicons 
                        name={testResult.success ? 'checkmark-circle' : 'alert-circle'} 
                        size={scale(16)} 
                        color={getStatusColor()} 
                    />
                    <Text style={[styles.resultText, { color: getStatusColor() }]}>
                        {testResult.success ? 'Microphone working!' : 'Test failed'}
                    </Text>
                </View>
            )}

            <Text style={styles.helpText}>
                This test will record 1 second of audio to verify your microphone is working properly.
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        padding: scale(16),
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2196F3',
        paddingHorizontal: scale(20),
        paddingVertical: scale(12),
        borderRadius: scale(8),
        minWidth: scale(160),
        gap: scale(8),
    },
    testButtonActive: {
        backgroundColor: '#FF9800',
    },
    testButtonSuccess: {
        backgroundColor: '#4CAF50',
    },
    testButtonError: {
        backgroundColor: '#F44336',
    },
    testButtonText: {
        color: 'white',
        fontSize: normalizeFont(16),
        fontWeight: '600',
    },
    resultContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: scale(12),
        gap: scale(6),
    },
    resultText: {
        fontSize: normalizeFont(14),
        fontWeight: '500',
    },
    helpText: {
        fontSize: normalizeFont(12),
        color: '#666',
        textAlign: 'center',
        marginTop: scale(8),
        maxWidth: scale(280),
        lineHeight: normalizeFont(16),
    },
});

export default MicrophoneTest;
