import { supabase } from '../../database/config';
import { recordLearningActivity, incrementDailyGoal } from '../../utils/progress/getDailyGoal';
import { Alert } from 'react-native';
import uuid from 'react-native-uuid';

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
     * Batch save multiple words for better performance
     */
    async saveMultipleWords(
        words: Array<{
            original: string;
            translation: string;
            example: string;
            exampleEnglish: string;
        }>,
        language: string,
        userId: string
    ): Promise<BatchSaveResult> {
        const result: BatchSaveResult = {
            savedWords: [],
            existingWords: [],
            errors: [],
            language: this.getLanguageName(language)
        };

        // Remove duplicates from input words based on original text
        const uniqueWordsMap = new Map<string, typeof words[0]>();
        for (const word of words) {
            const key = word.original.toLowerCase();
            if (!uniqueWordsMap.has(key)) {
                uniqueWordsMap.set(key, word);
            }
        }
        const uniqueWords = Array.from(uniqueWordsMap.values());

        try {
            // Step 1: Get ALL user's words with their translations to check language-specific ownership
            const originals = uniqueWords.map(w => w.original.toLowerCase());
            
            // First, get all user's words that match the originals
            const { data: userWordsData } = await supabase
                .from('user_words')
                .select(`
                    word_id,
                    words!inner (
                        word_id,
                        original
                    )
                `)
                .eq('user_id', userId)
                .in('words.original', originals);

            // Create a map of user's words
            const userWordMap = new Map<string, string>(); // original -> word_id
            if (userWordsData) {
                for (const uw of userWordsData) {
                    const word = Array.isArray(uw.words) ? uw.words[0] : uw.words;
                    if (word?.original && word?.word_id) {
                        userWordMap.set(word.original, word.word_id);
                    }
                }
            }

            // Step 2: For user's existing words, check which languages they have
            const existingWordIds = Array.from(userWordMap.values());
            let userLanguageMap = new Map<string, Set<string>>(); // word_id -> Set of language_codes
            
            if (existingWordIds.length > 0) {
                const { data: existingTranslations } = await supabase
                    .from('translations')
                    .select('word_id, language_code')
                    .in('word_id', existingWordIds);

                if (existingTranslations) {
                    for (const trans of existingTranslations) {
                        if (!userLanguageMap.has(trans.word_id)) {
                            userLanguageMap.set(trans.word_id, new Set());
                        }
                        userLanguageMap.get(trans.word_id)!.add(trans.language_code);
                    }
                }
            }

            // Step 3: Get all global words
            const { data: existingGlobalWords } = await supabase
                .from('words')
                .select('word_id, original')
                .in('original', originals);

            const existingGlobalMap = new Map(
                existingGlobalWords?.map(w => [w.original, w.word_id]) || []
            );

            // Step 4: Prepare batch operations
            const newWords: any[] = [];
            const newTranslations: any[] = [];
            const newUserWords: any[] = [];
            
            // Track what we're adding in this batch to avoid duplicates
            const batchWordIds = new Set<string>();
            const batchTranslationKeys = new Set<string>();

            for (const word of uniqueWords) {
                const original = word.original.toLowerCase();
                let wordId = existingGlobalMap.get(original);
                const userHasWord = userWordMap.has(original);
                
                // Check if user has this word in THIS SPECIFIC language
                let userHasInThisLanguage = false;
                if (userHasWord && wordId) {
                    const userWordId = userWordMap.get(original);
                    const languagesForWord = userLanguageMap.get(userWordId!);
                    userHasInThisLanguage = languagesForWord?.has(language) || false;
                }

                // If user already has this word in this language, skip it
                if (userHasInThisLanguage) {
                    result.existingWords.push(word.original);
                    continue;
                }

                // If word doesn't exist globally, create it
                if (!wordId) {
                    wordId = uuid.v4() as string;
                    if (!batchWordIds.has(wordId)) {
                        newWords.push({
                            word_id: wordId,
                            original: original,
                            created_at: new Date().toISOString()
                        });
                        batchWordIds.add(wordId);
                    }
                    existingGlobalMap.set(original, wordId);
                }

                // Check if translation exists for this language
                const translationKey = `${wordId}_${language}`;
                let translationExists = false;
                
                // Skip if we're already adding this translation in the current batch
                if (batchTranslationKeys.has(translationKey)) {
                    result.savedWords.push(word.original);
                    continue;
                }

                if (wordId && !newWords.find(w => w.word_id === wordId)) {
                    const { data: existingTrans } = await supabase
                        .from('translations')
                        .select('id')
                        .eq('word_id', wordId)
                        .eq('language_code', language)
                        .single();
                    
                    translationExists = !!existingTrans;
                }

                // Add translation if it doesn't exist
                if (!translationExists) {
                    newTranslations.push({
                        word_id: wordId,
                        language_code: language,
                        translated_text: word.translation,
                        example: `${word.example}|${word.exampleEnglish}`
                    });
                    batchTranslationKeys.add(translationKey);
                }

                // Add to user's vocabulary if they don't have this word at all
                if (!userHasWord && !newUserWords.find(uw => uw.word_id === wordId)) {
                    newUserWords.push({
                        user_id: userId,
                        word_id: wordId,
                        proficiency: Math.floor(Math.random() * 20) + 10,
                        learned_at: new Date().toISOString()
                    });
                }

                // This is a new word for the user in this language
                result.savedWords.push(word.original);
            }

            // Step 5: Execute batch inserts
            if (newWords.length > 0) {
                const { error: wordsError } = await supabase
                    .from('words')
                    .upsert(newWords, {
                        onConflict: 'original'
                    });
                if (wordsError) {
                    console.error('Words insert error:', wordsError);
                    throw wordsError;
                }
            }

            if (newTranslations.length > 0) {
                const { error: translationsError } = await supabase
                    .from('translations')
                    .upsert(newTranslations, {
                        onConflict: 'word_id,language_code'
                    });
                if (translationsError) {
                    console.error('Translations insert error:', translationsError);
                    throw translationsError;
                }
            }

            if (newUserWords.length > 0) {
                const { error: userWordsError } = await supabase
                    .from('user_words')
                    .insert(newUserWords);
                if (userWordsError) {
                    console.error('User words insert error:', userWordsError);
                    throw userWordsError;
                }

                // Record learning activity for each new word learned
                for (const userWord of newUserWords) {
                    // Count translations for this specific word
                    const { data: wordTranslations } = await supabase
                        .from('translations')
                        .select('id')
                        .eq('word_id', userWord.word_id);
                    
                    const translationCount = wordTranslations?.length || 1;
                    await recordLearningActivity(userId, userWord.word_id, translationCount);
                }
            }

            // Handle duplicate counts in the result
            const duplicateCount = words.length - uniqueWords.length;
            if (duplicateCount > 0) {
                console.log(`Removed ${duplicateCount} duplicate detections`);
            }

            return result;
        } catch (error) {
            console.error('Batch save error:', error);
            return {
                savedWords: [],
                existingWords: [],
                errors: uniqueWords.map((w: typeof words[0]) => w.original),
                language: this.getLanguageName(language)
            };
        }
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

            // Step 1: Check if this specific user already has this word in this specific language
            const { data: existingUserWord, error: userCheckError } = await supabase
                .from('user_words')
                .select(`
                    id,
                    word_id,
                    words!inner (
                        word_id,
                        original,
                        translations!inner (
                            language_code,
                            translated_text
                        )
                    )
                `)
                .eq('user_id', userId)
                .eq('words.original', original.toLowerCase())
                .eq('words.translations.language_code', language);

            if (existingUserWord && existingUserWord.length > 0) {
                // User already has this word in this language
                return 'exists';
            }

            // Step 2: Check if word exists globally
            let wordId: string;
            
            const { data: existingWord } = await supabase
                .from('words')
                .select('word_id')
                .eq('original', original.toLowerCase())
                .single();

            if (existingWord) {
                wordId = existingWord.word_id;
                
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
                // Create new word (use upsert to handle duplicates)
                const { data: newWord, error: wordError } = await supabase
                    .from('words')
                    .upsert({
                        original: original.toLowerCase(),
                        created_at: new Date().toISOString()
                    }, {
                        onConflict: 'original'
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

            // Step 3: Check if user already has this word (in any language)
            const { data: userHasWord } = await supabase
                .from('user_words')
                .select('id')
                .eq('user_id', userId)
                .eq('word_id', wordId)
                .single();

            if (!userHasWord) {
                // Add to user's vocabulary
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

                // Record learning activity for new word learned
                const { data: wordTranslations } = await supabase
                    .from('translations')
                    .select('id')
                    .eq('word_id', wordId);
                
                const translationCount = wordTranslations?.length || 1;
                await recordLearningActivity(userId, wordId, translationCount);
            }

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
            // First, get all user words
            const { data: userWordsData, error: userWordsError } = await supabase
                .from('user_words')
                .select(`
                    id,
                    proficiency,
                    learned_at,
                    word_id
                `)
                .eq('user_id', userId)
                .order('learned_at', { ascending: false });

            if (userWordsError) {
                console.error('Error fetching user words:', userWordsError);
                return [];
            }

            if (!userWordsData || userWordsData.length === 0) {
                return [];
            }

            // Get word IDs
            const wordIds = userWordsData.map(uw => uw.word_id);

            // Get words with their translations
            let translationsQuery = supabase
                .from('translations')
                .select(`
                    word_id,
                    language_code,
                    translated_text,
                    example,
                    words!inner (
                        word_id,
                        original
                    )
                `)
                .in('word_id', wordIds);

            // Apply language filter if specified
            if (languageFilter) {
                translationsQuery = translationsQuery.eq('language_code', languageFilter);
            }

            const { data: translationsData, error: translationsError } = await translationsQuery;

            if (translationsError) {
                console.error('Error fetching translations:', translationsError);
                return [];
            }

            if (!translationsData || translationsData.length === 0) {
                return [];
            }

            // Create a map of user words for quick lookup
            const userWordsMap = new Map(
                userWordsData.map(uw => [uw.word_id, uw])
            );

            // Transform the data into our SavedWord format
            const vocabulary: SavedWord[] = [];

            for (const translation of translationsData) {
                const userWord = userWordsMap.get(translation.word_id);
                if (!userWord) continue;

                const word = Array.isArray(translation.words) ? translation.words[0] : translation.words;
                if (!word) continue;

                // Parse example (format: "translated|english")
                const [example = '', exampleEnglish = ''] = translation.example?.split('|') || [];

                // Create unique ID by combining user_word id and language code
                const uniqueId = `${userWord.id}_${translation.language_code}`;

                vocabulary.push({
                    id: uniqueId, // Make ID unique for each translation
                    original: word.original || '',
                    translation: translation.translated_text || '',
                    example: example,
                    exampleEnglish: exampleEnglish,
                    language: translation.language_code || '',
                    proficiency: userWord.proficiency || 0,
                    learnedAt: userWord.learned_at || '',
                    category: this.categorizeWord(word.original || '')
                });
            }

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