import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

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
        borderRadius: 12,
        padding: 16,
        marginRight: 12,
        alignItems: 'center',
        minWidth: 120,
        maxWidth: 150,
    },
    imageContainer: {
        width: 50,
        height: 50,
        marginBottom: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: 50,
        height: 50,
        resizeMode: 'contain',
    },
    description: {
        fontSize: 12,
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: 4,
    },
    date: {
        fontSize: 10,
        color: '#666',
        textAlign: 'center',
    },
});