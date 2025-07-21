import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    ImageSourcePropType,
    ActivityIndicator,
} from 'react-native';

type StatBoxProps = {
    label: string;
    value: number | string;
    image: string | (() => Promise<string>);
};

export const StatBox = ({ label, value, image }: StatBoxProps) => {
    const [imageSource, setImageSource] = useState<ImageSourcePropType | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadImage = async () => {
            setLoading(true);
            try {
                if (typeof image === 'function') {
                    const url = await image();
                    setImageSource({ uri: url });
                } else {
                    setImageSource({ uri: image });
                }
            } catch (error) {
                console.error('Error loading image:', error);
                setImageSource(null);
            } finally {
                setLoading(false);
            }
        };

        loadImage();
    }, [image]);

    return (
        <View style={styles.box}>
            {loading ? (
                <ActivityIndicator size="small" color="#999" style={styles.image} />
            ) : (
                imageSource && (
                    <Image source={imageSource} style={styles.image} resizeMode="contain" />
                )
            )}
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
