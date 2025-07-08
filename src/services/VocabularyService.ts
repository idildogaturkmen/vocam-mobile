import { supabase } from '../../database/config';
import { Alert } from 'react-native';

interface VocabularyItem {
    word_id?: string;
    original: string;
    created_at?: string;
}

interface Translation {
    language_code: string;
    translated_text: string;
    example?: string;
}

interface UserWord {
    user_id: string;
    word_id: string;
    proficiency: number;
    learned_at?: string;
}

export interface SavedWord {
    id: string;
    original: string;
    translation: string;
    example: string;
    exampleEnglish: string;
    language: string;
    proficiency: number;
    learnedAt: string;
    category?: string;
}

// Result type for save operations
export type SaveWordResult = 'success' | 'exists' | 'error';

// Language code to name mapping
const LANGUAGE_NAMES: Record<string, string> = {
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'tr': 'Turkish',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'pl': 'Polish',
    'el': 'Greek',
    'he': 'Hebrew',
    'vi': 'Vietnamese',
    'id': 'Indonesian',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'th': 'Thai',
    'cs': 'Czech',
    'hu': 'Hungarian',
    'uk': 'Ukrainian',
    'ro': 'Romanian',
    'tl': 'Filipino',
    'ms': 'Malay',
    'sw': 'Swahili',
    'bn': 'Bengali',
    'ur': 'Urdu',
    'sr': 'Serbian',
    'hr': 'Croatian',
    'sk': 'Slovak',
    'bg': 'Bulgarian',
    'fa': 'Persian (Farsi)',
    'ta': 'Tamil',
    'te': 'Telugu',
    'gu': 'Gujarati',
    'pa': 'Punjabi',
    'is': 'Icelandic',
    'la': 'Latin'
};

class VocabularyService {
    /**
     * Get language name from code
     */
    private getLanguageName(code: string): string {
        return LANGUAGE_NAMES[code] || code;
    }

    /**
     * Show alert with delay to prevent jumpscare effect
     */
    private showDelayedAlert(title: string, message: string, delay: number = 1000): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                Alert.alert(title, message, [
                    { text: 'OK', onPress: () => resolve() }
                ]);
            }, delay);
        });
    }

    /**
     * Save a detected word to the vocabulary database
     */
    async saveWord(
        original: string,
        translation: string,
        example: string,
        exampleEnglish: string,
        language: string,
        userId: string
    ): Promise<SaveWordResult> {
        try {
            const languageName = this.getLanguageName(language);
            console.log(`🔄 Attempting to save "${original}" -> "${translation}" in ${languageName} for user ${userId}`);

            // Step 1: Check if word already exists for this language
            const { data: existingWordWithTranslation, error: checkError } = await supabase
                .from('words')
                .select(`
                    word_id,
                    translations!inner (
                        language_code,
                        translated_text
                    )
                `)
                .eq('original', original.toLowerCase())
                .eq('translations.language_code', language)
                .single();

            let wordId: string;

            if (existingWordWithTranslation) {
                // Word exists with this language translation
                wordId = existingWordWithTranslation.word_id;
                console.log(`✅ Found existing word with ${language} translation:`, wordId);
            } else {
                // Check if the word exists but without this language translation
                const { data: existingWord } = await supabase
                    .from('words')
                    .select('word_id')
                    .eq('original', original.toLowerCase())
                    .single();

                if (existingWord) {
                    // Word exists but needs new language translation
                    wordId = existingWord.word_id;
                    console.log(`🔄 Adding ${language} translation to existing word:`, wordId);
                    
                    // Add the new translation
                    const { error: translationError } = await supabase
                        .from('translations')
                        .insert({
                            word_id: wordId,
                            language_code: language,
                            translated_text: translation,
                            example: `${example}|${exampleEnglish}`
                        });

                    if (translationError) {
                        console.error('Error adding translation:', translationError);
                        return 'error';
                    }
                } else {
                    // Completely new word
                    console.log(`🆕 Creating new word: "${original}" -> "${translation}" (${language})`);
                    
                    const { data: newWord, error: wordError } = await supabase
                        .from('words')
                        .insert({
                            original: original.toLowerCase(),
                            created_at: new Date().toISOString()
                        })
                        .select('word_id')
                        .single();

                    if (wordError) {
                        console.error('Error creating word:', wordError);
                        return 'error';
                    }

                    if (!newWord) {
                        console.error('No word data returned');
                        return 'error';
                    }

                    wordId = newWord.word_id;

                    // Add translation
                    const { error: translationError } = await supabase
                        .from('translations')
                        .insert({
                            word_id: wordId,
                            language_code: language,
                            translated_text: translation,
                            example: `${example}|${exampleEnglish}`
                        });

                    if (translationError) {
                        console.error('Error adding translation:', translationError);
                        return 'error';
                    }
                }
            }

            // Step 2: Check if user already has this SPECIFIC word in this SPECIFIC language
            // Direct database query instead of loading all vocabulary
            console.log(`🔍 Checking if user ${userId} already has word ${wordId} in language ${language}`);
            
            const { data: existingUserWordQuery, error: userWordCheckError } = await supabase
                .from('user_words')
                .select(`
                    id,
                    words!inner (
                        original,
                        translations!inner (
                            language_code,
                            translated_text
                        )
                    )
                `)
                .eq('user_id', userId)
                .eq('word_id', wordId)
                .eq('words.translations.language_code', language)
                .maybeSingle(); // Use maybeSingle to avoid error when no match

            if (userWordCheckError) {
                console.error('Error checking existing user word:', userWordCheckError);
            }

            if (existingUserWordQuery) {
                console.log(`❌ User already has "${original}" in ${languageName}`);
                // Show alert with language name and return exists status
                Alert.alert('Already in Vocabulary', `"${original}" is already saved in ${languageName} in your vocabulary!`);
                return 'exists';
            }

            console.log(`✅ User does not have "${original}" in ${languageName}, proceeding to save`);

            // Step 3: Add to user's vocabulary
            const { error: userWordError } = await supabase
                .from('user_words')
                .insert({
                    user_id: userId,
                    word_id: wordId,
                    proficiency: Math.floor(Math.random() * 20) + 10,
                    learned_at: new Date().toISOString()
                });

            if (userWordError) {
                if (userWordError.code === '23505') {
                    // This shouldn't happen now with our better checking, but handle it gracefully
                    console.log(`✅ Word "${original}" was already in user vocabulary (duplicate key)`);
                    return 'success';
                } else {
                    console.error('Error adding to user vocabulary:', userWordError);
                    return 'error';
                }
            }

            console.log(`✅ Successfully saved "${original}" -> "${translation}" (${languageName}) to vocabulary`);
            return 'success';
        } catch (error) {
            console.error('Error saving word:', error);
            return 'error';
        }
    }

    /**
     * Get all vocabulary for a user
     */
    async getUserVocabulary(userId: string, languageFilter?: string): Promise<SavedWord[]> {
        try {
            // Build the query properly - single join with proper nesting
            let query = supabase
                .from('user_words')
                .select(`
                    id,
                    proficiency,
                    learned_at,
                    words!inner (
                        word_id,
                        original,
                        translations!inner (
                            language_code,
                            translated_text,
                            example
                        )
                    )
                `)
                .eq('user_id', userId);

            // Add language filter if specified
            if (languageFilter) {
                query = query.eq('words.translations.language_code', languageFilter);
            }

            const { data, error } = await query.order('learned_at', { ascending: false });

            if (error) {
                console.error('Error fetching vocabulary:', error);
                return [];
            }

            if (!data || data.length === 0) {
                console.log('No vocabulary found for user');
                return [];
            }

            // Transform the data into our SavedWord format
            const vocabulary: SavedWord[] = [];

            for (const item of data) {
                // Type assertion to help TypeScript understand the structure
                const userWord = item as any;
                const words = userWord.words;
                
                if (!words || !words.translations) {
                    console.warn('Invalid word structure:', item);
                    continue;
                }

                const translations = Array.isArray(words.translations) 
                    ? words.translations 
                    : [words.translations];

                for (const translation of translations) {
                    if (!translation || !translation.language_code || !translation.translated_text) {
                        continue;
                    }

                    // Parse example (format: "translated|english")
                    const [example = '', exampleEnglish = ''] = translation.example?.split('|') || [];

                    vocabulary.push({
                        id: userWord.id,
                        original: words.original || '',
                        translation: translation.translated_text || '',
                        example: example,
                        exampleEnglish: exampleEnglish,
                        language: translation.language_code || '',
                        proficiency: userWord.proficiency || 0,
                        learnedAt: userWord.learned_at || '',
                        category: this.categorizeWord(words.original || '')
                    });
                }
            }

            console.log(`Retrieved ${vocabulary.length} vocabulary items`);
            return vocabulary;
        } catch (error) {
            console.error('Error getting vocabulary:', error);
            return [];
        }
    }

    /**
     * Update word proficiency
     */
    async updateProficiency(userWordId: string, newProficiency: number): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_words')
                .update({ proficiency: newProficiency })
                .eq('id', userWordId);

            if (error) {
                console.error('Error updating proficiency:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error updating proficiency:', error);
            return false;
        }
    }

    /**
     * Delete a word from user's vocabulary
     */
    async deleteWord(userWordId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('user_words')
                .delete()
                .eq('id', userWordId);

            if (error) {
                console.error('Error deleting word:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error deleting word:', error);
            return false;
        }
    }

    /**
     * Simple word categorization
     */
    private categorizeWord(word: string): string {
        const categories = {
            food: ['apple', 'banana', 'bread', 'cheese', 'chicken', 'coffee', 'egg', 'fish', 'fruit', 'meat', 'milk', 'orange', 'pizza', 'rice', 'salad', 'sandwich', 'tea', 'water'],
            animals: ['bird', 'cat', 'dog', 'elephant', 'fish', 'horse', 'lion', 'monkey', 'mouse', 'rabbit', 'tiger'],
            objects: ['bag', 'book', 'bottle', 'box', 'camera', 'chair', 'clock', 'computer', 'cup', 'desk', 'door', 'glasses', 'key', 'lamp', 'laptop', 'mirror', 'pen', 'pencil', 'phone', 'table', 'watch', 'window'],
            clothing: ['belt', 'coat', 'dress', 'hat', 'jacket', 'jeans', 'pants', 'shirt', 'shoe', 'shorts', 'skirt', 'sock', 'suit', 'sweater', 't-shirt'],
            nature: ['cloud', 'flower', 'grass', 'leaf', 'moon', 'mountain', 'plant', 'rain', 'river', 'rock', 'sky', 'snow', 'star', 'sun', 'tree', 'water'],
            transportation: ['airplane', 'bicycle', 'boat', 'bus', 'car', 'helicopter', 'motorcycle', 'ship', 'train', 'truck']
        };

        const lowerWord = word.toLowerCase();
        for (const [category, words] of Object.entries(categories)) {
            if (words.includes(lowerWord)) {
                return category;
            }
        }
        return 'general';
    }
}

export default new VocabularyService();