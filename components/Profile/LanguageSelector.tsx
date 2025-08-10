import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    useColorScheme,
} from 'react-native';
import { Button } from '@rneui/base';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../src/i18n/i18n';
import { LanguageService } from '../../src/services/LanguageService';
import { supabase } from '../../database/config';
import i18n from '../../src/i18n/i18n';

export default function LanguageSelector() {
    const { t } = useTranslation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [showModal, setShowModal] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language);
    const [loading, setLoading] = useState(false);

    const handleLanguageSelect = (languageCode: string) => {
        setSelectedLanguage(languageCode);
    };

    const handleSaveLanguage = async () => {
        if (selectedLanguage === i18n.language) {
            setShowModal(false);
            return;
        }
        
        setLoading(true);
        try {
            // Change app language
            await i18n.changeLanguage(selectedLanguage);
            
            // Save to database if user is authenticated
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await LanguageService.saveUserLanguage(user.id, selectedLanguage);
            }
            
            setShowModal(false);
        } catch (error) {
            console.error('Error changing language:', error);
        } finally {
            setLoading(false);
        }
    };

    const currentLanguageName = SUPPORTED_LANGUAGES.find(lang => lang.code === i18n.language)?.nativeName || 'English';

    return (
        <View>
            <TouchableOpacity
                style={[
                    styles.languageButton,
                    { 
                        backgroundColor: isDark ? '#2c3e50' : '#ecf0f1',
                        borderColor: isDark ? '#34495e' : '#bdc3c7'
                    }
                ]}
                onPress={() => setShowModal(true)}
                activeOpacity={0.7}
            >
                <View style={styles.languageInfo}>
                    <Ionicons name="language" size={20} color={isDark ? '#3498db' : '#2980b9'} />
                    <View style={styles.languageText}>
                        <Text style={[styles.languageLabel, { color: isDark ? '#ecf0f1' : '#2c3e50' }]}>
                            {t('profile.language')}
                        </Text>
                        <Text style={[styles.currentLanguage, { color: isDark ? '#bdc3c7' : '#7f8c8d' }]}>
                            {currentLanguageName}
                        </Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#bdc3c7' : '#95a5a6'} />
            </TouchableOpacity>

            <Modal
                visible={showModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowModal(false)}
            >
                <View style={[styles.modalContainer, { backgroundColor: isDark ? '#2c3e50' : '#ffffff' }]}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowModal(false)}>
                            <Text style={[styles.cancelButton, { color: isDark ? '#3498db' : '#2980b9' }]}>
                                {t('common.cancel')}
                            </Text>
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: isDark ? '#ecf0f1' : '#2c3e50' }]}>
                            {t('profile.language')}
                        </Text>
                        <TouchableOpacity onPress={handleSaveLanguage} disabled={loading}>
                            <Text style={[
                                styles.saveButton,
                                { 
                                    color: loading ? (isDark ? '#7f8c8d' : '#95a5a6') : (isDark ? '#3498db' : '#2980b9'),
                                    opacity: loading ? 0.5 : 1
                                }
                            ]}>
                                {t('common.save')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
                        {SUPPORTED_LANGUAGES.map((language) => (
                            <TouchableOpacity
                                key={language.code}
                                style={[
                                    styles.languageOption,
                                    {
                                        backgroundColor: isDark ? '#34495e' : '#f8f9fa',
                                        borderColor: selectedLanguage === language.code 
                                            ? (isDark ? '#3498db' : '#2980b9')
                                            : 'transparent',
                                        borderWidth: selectedLanguage === language.code ? 2 : 0,
                                    }
                                ]}
                                onPress={() => handleLanguageSelect(language.code)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.optionInfo}>
                                    <Text style={[
                                        styles.optionName,
                                        { color: isDark ? '#ecf0f1' : '#2c3e50' }
                                    ]}>
                                        {language.name}
                                    </Text>
                                    <Text style={[
                                        styles.optionNativeName,
                                        { color: isDark ? '#bdc3c7' : '#7f8c8d' }
                                    ]}>
                                        {language.nativeName}
                                    </Text>
                                </View>
                                {selectedLanguage === language.code && (
                                    <Ionicons
                                        name="checkmark-circle"
                                        size={24}
                                        color={isDark ? '#3498db' : '#2980b9'}
                                    />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    languageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
    },
    languageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    languageText: {
        marginLeft: 12,
        flex: 1,
    },
    languageLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    currentLanguage: {
        fontSize: 14,
        marginTop: 2,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: '#bdc3c7',
    },
    cancelButton: {
        fontSize: 16,
        fontWeight: '400',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    saveButton: {
        fontSize: 16,
        fontWeight: '600',
    },
    languageList: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    languageOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 8,
        borderRadius: 8,
    },
    optionInfo: {
        flex: 1,
    },
    optionName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    optionNativeName: {
        fontSize: 14,
    },
});