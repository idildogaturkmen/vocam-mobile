import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n/i18n';

interface LanguageLoaderProps {
    children: React.ReactNode;
}

export default function LanguageLoader({ children }: LanguageLoaderProps) {
    const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);

    useEffect(() => {
        const loadUserLanguage = async () => {
            try {
                const savedLanguage = await AsyncStorage.getItem('user_language');
                
                console.log('🌐 LanguageLoader - Saved language:', savedLanguage);
                
                if (savedLanguage && savedLanguage !== 'en') {
                    await i18n.changeLanguage(savedLanguage);
                    console.log('🌐 LanguageLoader - Changed to:', savedLanguage);
                }
            } catch (error) {
                console.error('LanguageLoader error:', error);
            } finally {
                setIsLanguageLoaded(true);
            }
        };

        loadUserLanguage();
    }, []);

    if (!isLanguageLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={{ marginTop: 16, fontSize: 16, color: '#7f8c8d' }}>
                    Loading...
                </Text>
            </View>
        );
    }

    return <>{children}</>;
}