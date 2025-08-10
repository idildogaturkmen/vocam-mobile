import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n/i18n';
import SplashScreen from './SplashScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface I18nWrapperProps {
    children: React.ReactNode;
}

export default function I18nWrapper({ children }: I18nWrapperProps) {
    const [i18nReady, setI18nReady] = useState(false);

    useEffect(() => {
        const initializeI18n = async () => {
            try {
                console.log('🚀 I18nWrapper - Starting initialization');
                console.log('🚀 I18nWrapper - i18n.isInitialized:', i18n.isInitialized);
                console.log('🚀 I18nWrapper - Current language:', i18n.language);
                
                // Wait for initial i18n setup
                if (!i18n.isInitialized) {
                    console.log('🚀 I18nWrapper - Waiting for i18n initialization...');
                    await new Promise((resolve) => {
                        if (i18n.isInitialized) {
                            resolve(undefined);
                        } else {
                            i18n.on('initialized', () => {
                                console.log('🚀 I18nWrapper - i18n initialized!');
                                resolve(undefined);
                            });
                        }
                    });
                }

                // Load saved language if available
                const savedLanguage = await AsyncStorage.getItem('user_language');
                console.log('🚀 I18nWrapper - Saved language:', savedLanguage);
                console.log('🚀 I18nWrapper - Current i18n language before change:', i18n.language);
                
                if (savedLanguage && savedLanguage !== i18n.language) {
                    console.log('🚀 I18nWrapper - Changing language to:', savedLanguage);
                    await i18n.changeLanguage(savedLanguage);
                    console.log('🚀 I18nWrapper - Language changed to:', i18n.language);
                }

                console.log('🚀 I18nWrapper - Initialization complete, setting ready to true');
                setI18nReady(true);
            } catch (error) {
                console.error('Error initializing i18n:', error);
                setI18nReady(true); // Show app anyway
            }
        };

        initializeI18n();
    }, []);

    if (!i18nReady) {
        return <SplashScreen />;
    }

    return (
        <I18nextProvider i18n={i18n}>
            <View style={{ flex: 1 }}>
                {children}
            </View>
        </I18nextProvider>
    );
}