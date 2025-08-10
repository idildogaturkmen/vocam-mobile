import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    useColorScheme,
    SafeAreaView,
} from 'react-native';
import { Button } from '@rneui/base';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../database/config';
import { LanguageService } from '../../src/services/LanguageService';
import i18n from '../../src/i18n/i18n';

interface LanguageSelectionScreenProps {
    onLanguageSelected: () => void;
}

export default function LanguageSelectionScreen({ onLanguageSelected }: LanguageSelectionScreenProps) {
    const { t } = useTranslation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [selectedLanguage, setSelectedLanguage] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const handleLanguageSelect = (languageCode: string) => {
        setSelectedLanguage(languageCode);
    };

    const handleContinue = async () => {
        if (!selectedLanguage) return;
        
        setLoading(true);
        try {
            // Change app language using i18n directly
            await i18n.changeLanguage(selectedLanguage);
            
            // Store language preference in local storage
            await AsyncStorage.setItem('user_language', selectedLanguage);
            await AsyncStorage.setItem('language_selection_completed', 'true');
            
            // If user is authenticated, update their profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await LanguageService.saveUserLanguage(user.id, selectedLanguage);
            }
            
            // Small delay to ensure language change has taken effect
            setTimeout(() => {
                onLanguageSelected();
            }, 100);
        } catch (error) {
            console.error('Error setting language:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#ffffff' }]}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.title, { color: isDark ? '#64B5F6' : '#3498db' }]}>
                        {t('languageSelection.title')}
                    </Text>
                    <Text style={[styles.subtitle, { color: isDark ? '#BDBDBD' : '#7f8c8d' }]}>
                        {t('languageSelection.subtitle')}
                    </Text>
                </View>

                <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
                    {SUPPORTED_LANGUAGES.map((language) => (
                        <TouchableOpacity
                            key={language.code}
                            style={[
                                styles.languageOption,
                                {
                                    backgroundColor: isDark ? '#1a1a1a' : '#f8f9fa',
                                    borderColor: selectedLanguage === language.code 
                                        ? (isDark ? '#64B5F6' : '#3498db')
                                        : (isDark ? '#333333' : '#e0e0e0'),
                                    borderWidth: selectedLanguage === language.code ? 2 : 1,
                                }
                            ]}
                            onPress={() => handleLanguageSelect(language.code)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.languageInfo}>
                                <Text style={[
                                    styles.languageName,
                                    { color: isDark ? '#ffffff' : '#333333' }
                                ]}>
                                    {language.name}
                                </Text>
                                <Text style={[
                                    styles.nativeName,
                                    { color: isDark ? '#BDBDBD' : '#666666' }
                                ]}>
                                    {language.nativeName}
                                </Text>
                            </View>
                            {selectedLanguage === language.code && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={24}
                                    color={isDark ? '#64B5F6' : '#3498db'}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        title={t('languageSelection.continue')}
                        onPress={handleContinue}
                        disabled={!selectedLanguage || loading}
                        loading={loading}
                        buttonStyle={[
                            styles.continueButton,
                            {
                                backgroundColor: selectedLanguage && !loading 
                                    ? (isDark ? '#64B5F6' : '#3498db')
                                    : (isDark ? '#333333' : '#cccccc')
                            }
                        ]}
                        titleStyle={[
                            styles.continueButtonText,
                            { color: selectedLanguage && !loading ? '#ffffff' : (isDark ? '#666666' : '#999999') }
                        ]}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
    },
    languageList: {
        flex: 1,
        marginBottom: 20,
    },
    languageOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        marginBottom: 12,
        borderRadius: 12,
    },
    languageInfo: {
        flex: 1,
    },
    languageName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    nativeName: {
        fontSize: 14,
        fontWeight: '400',
    },
    footer: {
        paddingTop: 20,
    },
    continueButton: {
        borderRadius: 12,
        paddingVertical: 16,
    },
    continueButtonText: {
        fontSize: 18,
        fontWeight: '600',
    },
});