import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withTiming,
    withDelay,
    Easing
} from 'react-native-reanimated';

interface XPBarProps {
    currentXP: number;
    xpToNextLevel: number;
}

export default function XPBar({ currentXP, xpToNextLevel }: XPBarProps) {
    const progress = Math.min((currentXP / xpToNextLevel) * 100, 100);
    const remainingXP = Math.max(xpToNextLevel - currentXP, 0);
    
    const animatedWidth = useSharedValue(0);
    const animatedOpacity = useSharedValue(0);

    useEffect(() => {
        animatedOpacity.value = withTiming(1, { duration: 500 });
        animatedWidth.value = withDelay(
            300,
            withTiming(progress, {
                duration: 1500,
                easing: Easing.out(Easing.cubic),
            })
        );
    }, [progress]);

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${animatedWidth.value}%`,
    }));

    const containerStyle = useAnimatedStyle(() => ({
        opacity: animatedOpacity.value,
    }));

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            <View style={styles.header}>
                <Text style={styles.label}>Experience Points</Text>
                <Text style={styles.xpText}>
                    {currentXP} / {xpToNextLevel} XP
                </Text>
            </View>
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground} />
                <Animated.View style={[styles.progressBar, progressBarStyle]} />
            </View>
            {remainingXP > 0 && (
                <Text style={styles.remainingText}>
                    {remainingXP} XP to next level
                </Text>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
    },
    xpText: {
        fontSize: 14,
        color: '#3498db',
        fontWeight: '500',
    },
    progressBarContainer: {
        height: 12,
        position: 'relative',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBarBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#e8f4ff',
        zIndex: 1,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3498db',
        borderRadius: 6,
        position: 'absolute',
        top: 0,
        left: 0,
        shadowColor: '#3498db',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 2,
    },
    remainingText: {
        fontSize: 12,
        color: '#7f8c8d',
        marginTop: 8,
        textAlign: 'center',
        fontWeight: '500',
    },
});