import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { scale, normalizeFont } from '../../utils/normalize';

interface BadgeCardProps {
    imageSource: () => Promise<any>;
    description: string;
    date: string;
}

export function BadgeCard({ imageSource, description, date }: BadgeCardProps) {
    const [image, setImage] = useState<any>(null);

    useEffect(() => {
        const loadImage = async () => {
            try {
                const result = await imageSource();
                setImage(result);
            } catch (error) {
                console.error('Failed to load badge image:', error);
            }
        };
        loadImage();
    }, [imageSource]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    return (
        <View style={styles.container}>
            <View style={styles.imageContainer}>
                {image && (
                    <Image source={image} style={styles.image} />
                )}
            </View>
            <Text style={styles.description}>{description}</Text>
            <Text style={styles.date}>{formatDate(date)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f8f9fa',
        borderRadius: scale(12),
        padding: scale(16),
        marginRight: scale(12),
        alignItems: 'center',
        minWidth: scale(120),
        maxWidth: scale(150),
    },
    imageContainer: {
        width: scale(50),
        height: scale(50),
        marginBottom: scale(8),
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: scale(50),
        height: scale(50),
        resizeMode: 'contain',
    },
    description: {
        fontSize: normalizeFont(12),
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: scale(4),
    },
    date: {
        fontSize: normalizeFont(10),
        color: '#666',
        textAlign: 'center',
    },
});