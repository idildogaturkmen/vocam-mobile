import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface XPBarProps {
    currentXP: number;
    xpToNextLevel: number;
}

const XPBar: React.FC<XPBarProps> = ({ currentXP, xpToNextLevel }) => {
    const progress = Math.min(currentXP / xpToNextLevel, 1);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>XP Progress</Text>
            <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.xpText}>
                {currentXP} / {xpToNextLevel} XP
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginTop: 16,
        padding: 12,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        elevation: 3, // Android
        shadowColor: '#000', // iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    label: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 8,
        color: '#333',
    },
    barBackground: {
        height: 16,
        backgroundColor: '#eee',
        borderRadius: 8,
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#ffa500',
        borderRadius: 8,
    },
    xpText: {
        marginTop: 8,
        textAlign: 'center',
        color: '#555',
        fontSize: 14,
    },
});

export default XPBar;
