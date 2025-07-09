import React from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';

type StatBoxProps = {
    label: string;
    value: string | number;
    image: ImageSourcePropType | (() => ImageSourcePropType);
};

export const StatBox = ({ label, value, image }: StatBoxProps) => {
    const imageSource = typeof image === 'function' ? image() : image;

    return (
        <View style={styles.box}>
            <Image source={imageSource} style={styles.image} resizeMode="contain" />
            <Text style={styles.label}>
                {label} {value}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    box: {
        backgroundColor: '#f0f0f0',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: '30%',
        elevation: 2,
    },
    image: {
        width: 200,
        height: 100,
        marginBottom: 4,
    },
    value: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
        textAlign: 'center',
    },
});
