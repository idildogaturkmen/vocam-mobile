import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

interface FireStreakProps {
    streak: number;
}

export default function FireStreak({ streak }: FireStreakProps) {
    const animationRef = useRef<LottieView>(null);

    useEffect(() => {
        if (animationRef.current) {
            animationRef.current.play();
        }
    }, [streak]);

    return (
        <View style={styles.container}>
            <View style={styles.fireAnimation}>
                <LottieView
                    ref={animationRef}
                    source={require('../../assets/fire.json')}
                    autoPlay
                    loop
                    style={styles.lottie}
                />
            </View>
            <Text style={styles.streak}>{streak}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffffff',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        shadowColor: '#ff6b35',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 6,
    },
    fireAnimation: {
        width: 20,
        height: 20,
        marginRight: 6,
    },
    lottie: {
        width: 20,
        height: 20,
    },
    streak: {
        color: '#ff6b35',
        fontWeight: 'bold',
        fontSize: 14,
    },
});