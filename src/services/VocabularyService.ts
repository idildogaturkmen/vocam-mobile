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

// Result for batch save operations
export interface BatchSaveResult {
    savedWords: string[];
    existingWords: string[];
    errors: string[];
    language: string;
}

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
     * Save a detected word to the vocabulary database
     * Returns detailed result for batch operations
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

            // Step 1: First check if user already has this word in this specific language
            const { data: existingUserWord, error: userCheckError } = await supabase
                .from('user_words')
                .select(`
                    id,
                    word_id,
                    words!inner (
                        original
                    )
                `)
                .eq('user_id', userId)
                .eq('words.original', original.toLowerCase())
                .single();

            if (existingUserWord) {
                // User has this word, now check if they have it in this specific language
                const { data: existingTranslation, error: translationCheckError } = await supabase
                    .from('translations')
                    .select('*')
                    .eq('word_id', existingUserWord.word_id)
                    .eq('language_code', language)
                    .single();

                if (existingTranslation) {
                    console.log(`❌ User already has "${original}" in ${languageName}`);
                    return 'exists'; // Return exists without showing alert (will be handled by caller)
                }
            }

            // Step 2: Check if word exists in the global words table
            let wordId: string;
            
            const { data: existingWord } = await supabase
                .from('words')
                .select('word_id')
                .eq('original', original.toLowerCase())
                .single();

            if (existingWord) {
                wordId = existingWord.word_id;
                console.log(`✅ Found existing word:`, wordId);
                
                // Check if translation exists for this language
                const { data: existingTranslation } = await supabase
                    .from('translations')
                    .select('*')
                    .eq('word_id', wordId)
                    .eq('language_code', language)
                    .single();

                if (!existingTranslation) {
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
                }
            } else {
                // Create new word
                console.log(`🆕 Creating new word: "${original}" -> "${translation}" (${language})`);
                
                const { data: newWord, error: wordError } = await supabase
                    .from('words')
                    .insert({
                        original: original.toLowerCase(),
                        created_at: new Date().toISOString()
                    })
                    .select('word_id')
                    .single();

                if (wordError || !newWord) {
                    console.error('Error creating word:', wordError);
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

            // Step 3: Add to user's vocabulary if not already there
            if (!existingUserWord) {
                const { error: userWordError } = await supabase
                    .from('user_words')
                    .insert({
                        user_id: userId,
                        word_id: wordId,
                        proficiency: Math.floor(Math.random() * 20) + 10,
                        learned_at: new Date().toISOString()
                    });

                if (userWordError) {
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
            // Build the query properly
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

                    // Create unique ID by combining user_word id and language code
                    const uniqueId = `${userWord.id}_${translation.language_code}`;

                    vocabulary.push({
                        id: uniqueId, // Make ID unique for each translation
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
            // Extract the actual user_word id from our composite id
            const actualId = userWordId.split('_')[0];
            
            const { error } = await supabase
                .from('user_words')
                .update({ proficiency: newProficiency })
                .eq('id', actualId);

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
            // Extract the actual user_word id from our composite id
            const actualId = userWordId.split('_')[0];
            
            const { error } = await supabase
                .from('user_words')
                .delete()
                .eq('id', actualId);

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