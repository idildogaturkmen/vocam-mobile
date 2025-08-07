import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withTiming,
    withDelay,
    interpolateColor
} from 'react-native-reanimated';

interface MaxProficiencyWordsProps {
    count: number;
}

export default function MaxProficiencyWords({ count }: MaxProficiencyWordsProps) {
    const scale = useSharedValue(0.8);
    const opacity = useSharedValue(0);
    const colorProgress = useSharedValue(0);

    useEffect(() => {
        opacity.value = withTiming(1, { duration: 600 });
        scale.value = withDelay(200, withTiming(1, { duration: 800 }));
        colorProgress.value = withDelay(400, withTiming(1, { duration: 1000 }));
    }, [count]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const animatedBgStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            colorProgress.value,
            [0, 1],
            ['#f0f8f0', '#e8f5e8']
        ),
    }));

    const animatedCountStyle = useAnimatedStyle(() => ({
        color: interpolateColor(
            colorProgress.value,
            [0, 1],
            ['#666', '#27ae60']
        ),
    }));

    return (
        <Animated.View style={[styles.container, animatedStyle, animatedBgStyle]}>
            <View style={styles.header}>
                <Text style={styles.title}>Mastered Words</Text>
            </View>
            <View style={styles.countContainer}>
                <Animated.Text style={[styles.count, animatedCountStyle]}>{count}</Animated.Text>
                <Text style={styles.label}>words at max proficiency</Text>
            </View>
            {count > 0 && (
                <Text style={styles.encouragement}>
                    {count >= 10 ? "Amazing mastery!" : "Keep going!"}
                </Text>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#e8f5e8',
        borderRadius: 16,
        padding: 20,
        marginVertical: 12,
        shadowColor: '#27ae60',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 2,
        borderColor: '#d5eddb',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    icon: {
        fontSize: 20,
        marginRight: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2d5a2d',
    },
    countContainer: {
        alignItems: 'center',
        marginBottom: 8,
    },
    count: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#27ae60',
    },
    label: {
        fontSize: 12,
        color: '#5a7a5a',
        marginTop: 4,
        textAlign: 'center',
        fontWeight: '500',
    },
    encouragement: {
        fontSize: 13,
        color: '#27ae60',
        textAlign: 'center',
        fontWeight: '600',
        fontStyle: 'italic',
    },
});