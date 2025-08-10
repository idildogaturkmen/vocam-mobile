import i18n from '../i18n/i18n';

export class TranslationService {
    /**
     * Get translated text with fallback to key if translation missing
     */
    static t(key: string, fallback?: string): string {
        const translated = i18n.t(key);
        
        // If translation is the same as key, it means translation is missing
        if (translated === key && fallback) {
            return fallback;
        }
        
        return translated;
    }

    /**
     * Format motivational message based on user progress
     */
    static getMotivationalMessage(level: number, streak: number, wordsLearned: number): string {
        if (streak >= 7) return this.t('profile.motivational.streakFire');
        if (level >= 5) return this.t('profile.motivational.vocabularyMaster');
        if (wordsLearned >= 50) return this.t('profile.motivational.incredibleProgress');
        if (streak >= 3) return this.t('profile.motivational.greatConsistency');
        if (wordsLearned >= 10) return this.t('profile.motivational.vocabularyGrowing');
        return this.t('profile.motivational.everyWord');
    }

    /**
     * Get language name in current app language
     */
    static getLanguageName(languageCode: string): string {
        // This could be expanded to have translations for all language names
        const languageNames: Record<string, Record<string, string>> = {
            en: {
                'ar': 'Arabic', 'bn': 'Bengali', 'bg': 'Bulgarian', 'zh-CN': 'Chinese (Simplified)', 
                'zh-TW': 'Chinese (Traditional)', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish',
                'nl': 'Dutch', 'tl': 'Filipino', 'fi': 'Finnish', 'fr': 'French', 'de': 'German',
                'el': 'Greek', 'gu': 'Gujarati', 'he': 'Hebrew', 'hi': 'Hindi', 'hu': 'Hungarian',
                'is': 'Icelandic', 'id': 'Indonesian', 'it': 'Italian', 'ja': 'Japanese', 'ko': 'Korean',
                'la': 'Latin', 'ms': 'Malay', 'no': 'Norwegian', 'fa': 'Persian', 'pl': 'Polish',
                'pt': 'Portuguese', 'pa': 'Punjabi', 'ro': 'Romanian', 'ru': 'Russian', 'sr': 'Serbian',
                'sk': 'Slovak', 'es': 'Spanish', 'sw': 'Swahili', 'sv': 'Swedish', 'ta': 'Tamil',
                'te': 'Telugu', 'th': 'Thai', 'tr': 'Turkish', 'uk': 'Ukrainian', 'ur': 'Urdu',
                'vi': 'Vietnamese'
            },
            es: {
                'ar': 'Árabe', 'bn': 'Bengalí', 'bg': 'Búlgaro', 'zh-CN': 'Chino (Simplificado)', 
                'zh-TW': 'Chino (Tradicional)', 'hr': 'Croata', 'cs': 'Checo', 'da': 'Danés',
                'nl': 'Holandés', 'tl': 'Filipino', 'fi': 'Finlandés', 'fr': 'Francés', 'de': 'Alemán',
                'el': 'Griego', 'gu': 'Guyaratí', 'he': 'Hebreo', 'hi': 'Hindi', 'hu': 'Húngaro',
                'is': 'Islandés', 'id': 'Indonesio', 'it': 'Italiano', 'ja': 'Japonés', 'ko': 'Coreano',
                'la': 'Latín', 'ms': 'Malayo', 'no': 'Noruego', 'fa': 'Persa', 'pl': 'Polaco',
                'pt': 'Portugués', 'pa': 'Panyabí', 'ro': 'Rumano', 'ru': 'Ruso', 'sr': 'Serbio',
                'sk': 'Eslovaco', 'es': 'Español', 'sw': 'Suajili', 'sv': 'Sueco', 'ta': 'Tamil',
                'te': 'Telugu', 'th': 'Tailandés', 'tr': 'Turco', 'uk': 'Ucraniano', 'ur': 'Urdu',
                'vi': 'Vietnamita'
            }
        };

        const currentLang = i18n.language;
        return languageNames[currentLang]?.[languageCode] || languageNames['en'][languageCode] || languageCode;
    }

    /**
     * Get plural form for word count
     */
    static getWordCount(count: number): string {
        const key = count === 1 ? 'vocabulary.word' : 'vocabulary.wordCount';
        return `${count} ${this.t(key, count === 1 ? 'word' : 'words')}`;
    }

    /**
     * Format date in user's language
     */
    static formatDate(date: Date): string {
        const currentLang = i18n.language;
        return date.toLocaleDateString(currentLang);
    }
}