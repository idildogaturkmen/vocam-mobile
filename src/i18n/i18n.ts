import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

const resources = {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    it: { translation: it },
    pt: { translation: pt },
    ja: { translation: ja },
    ko: { translation: ko },
    zh: { translation: zh },
    ar: { translation: ar },
};

// Get device language or fallback to English
const getDeviceLanguage = () => {
    const deviceLanguage = Localization.locale.split('-')[0]; // e.g., "en-US" -> "en"
    return SUPPORTED_LANGUAGES.find(lang => lang.code === deviceLanguage)?.code || 'en';
};

// TEMP: Force Spanish for testing
const FORCE_LANGUAGE_FOR_TESTING = 'es'; // Change to 'en' to test English

// Initialize i18n synchronously first
i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: FORCE_LANGUAGE_FOR_TESTING, // TEMP: Force Spanish for testing
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        react: {
            useSuspense: false, // Prevent suspense issues
        },
    });

// Then update with saved language asynchronously
const initI18n = async () => {
    let savedLanguage;
    try {
        savedLanguage = await AsyncStorage.getItem('user_language');
    } catch (error) {
        console.error('Error loading saved language:', error);
    }

    const languageToUse = savedLanguage || getDeviceLanguage();
    
    console.log('🌐 i18n Debug - Saved language:', savedLanguage);
    console.log('🌐 i18n Debug - Language to use:', languageToUse);
    console.log('🌐 i18n Debug - Current language:', i18n.language);
    
    if (languageToUse !== 'en') {
        await i18n.changeLanguage(languageToUse);
        console.log('🌐 i18n Debug - Changed to:', i18n.language);
    }
};

// Function to change language and save preference
export const changeLanguage = async (languageCode: string) => {
    try {
        await AsyncStorage.setItem('user_language', languageCode);
        await i18n.changeLanguage(languageCode);
        console.log('🌐 Language changed to:', languageCode, '- Current:', i18n.language);
    } catch (error) {
        console.error('Error changing language:', error);
        throw error;
    }
};

// Quick debug function to test language change
export const quickChangeToSpanish = async () => {
    console.log('🚀 Quick change to Spanish triggered');
    await changeLanguage('es');
};

export const quickChangeToEnglish = async () => {
    console.log('🚀 Quick change to English triggered');
    await changeLanguage('en');
};

// Initialize i18n asynchronously
initI18n();

export default i18n;