import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring,
    withSequence,
    runOnJS
} from 'react-native-reanimated';

interface StatBoxProps {
    label: string;
    value: number | string;
    image: () => Promise<any> | any;
    showValueWhenImageLoading?: boolean; // Option to hide value until image loads
}

export function StatBox({ label, value, image, showValueWhenImageLoading = true }: StatBoxProps) {
    const [imageSource, setImageSource] = useState<any>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const scale = useSharedValue(1);
    const rotate = useSharedValue(0);

    useEffect(() => {
        const loadImage = async () => {
            try {
                const result = await image();
                setImageSource(result);
                setImageLoaded(true);
            } catch (error) {
                console.error('Failed to load image:', error);
                setImageLoaded(true); // Still mark as loaded even on error
            }
        };
        loadImage();
    }, [image]);

    const handlePress = () => {
        scale.value = withSequence(
            withSpring(0.95),
            withSpring(1.05),
            withSpring(1)
        );
        rotate.value = withSequence(
            withSpring(-5),
            withSpring(5),
            withSpring(0)
        );
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotate.value}deg` }
        ],
    }));

    return (
        <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
            <Animated.View style={[styles.container, animatedStyle]}>
                <View style={styles.imageContainer}>
                    {imageSource && (
                        <Image source={imageSource} style={styles.image} />
                    )}
                </View>
                <Text style={styles.value}>
                    {(showValueWhenImageLoading || imageLoaded) ? value : '...'}
                </Text>
                <Text style={styles.label}>{label}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        minWidth: 100,
        flex: 1,
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    imageContainer: {
        width: 50,
        height: 50,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9ff',
        borderRadius: 25,
    },
    image: {
        width: 35,
        height: 35,
        resizeMode: 'contain',
    },
    value: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        color: '#7f8c8d',
        textAlign: 'center',
        fontWeight: '500',
    },
});