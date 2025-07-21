import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

type Props = {
    count: number;
};

const MaxProficiencyStar: React.FC<Props> = ({ count }) => {
    const maxWords = 25;
    const progress = Math.min(count / maxWords, 1);

    return (
        <View style={styles.container}>
            <View style={styles.starWrapper}>
                {/* Empty star */}
                <View style={styles.overlay}>
                    <FontAwesome name="star" size={48} color="#ddd" />
                </View>

                {/* Colored star to have some kind of development */}
                <View style={[styles.fillMask, { width: `${progress * 100}%` }]}>
                    <FontAwesome name="star" size={48} color="#f5b301" />
                </View>
            </View>

            <Text style={styles.label}>{count} words at max proficiency</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        alignItems: 'center',
    },
    starWrapper: {
        width: 48,
        height: 48,
        position: 'relative',
    },
    fillMask: {
        position: 'absolute',
        height: 48,
        overflow: 'hidden',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    label: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
    },
});

export default MaxProficiencyStar;
