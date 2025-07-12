import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';

interface BadgeCardProps {
    imageSource: string | (() => Promise<string>);
    description: string;
    date: string;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({ imageSource, description, date }) => {
    const [resolvedImage, setResolvedImage] = useState<string | null>(null);

    useEffect(() => {
        const resolveImage = async () => {
            if (typeof imageSource === 'function') {
                const url = await imageSource();
                setResolvedImage(url);
            } else {
                setResolvedImage(imageSource);
            }
        };

        resolveImage();
    }, [imageSource]);

    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });

    return (
        <View style={styles.card}>
            {!resolvedImage ? (
                <ActivityIndicator size="small" color="#888" style={styles.image} />
            ) : (
                <Image source={{ uri: resolvedImage }} style={styles.image} resizeMode="contain" />
            )}
            <View style={styles.textContainer}>
                <Text style={styles.description}>{description}</Text>
                <Text style={styles.date}>Achieved in {formattedDate}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 12,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    image: {
        width: 64,
        height: 64,
        marginRight: 16,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    textContainer: {
        flex: 1,
    },
    description: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    date: {
        fontSize: 14,
        color: '#666',
    },
});
