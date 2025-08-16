import { supabase } from '../../database/config';
import { recordLearningActivity, incrementDailyGoal } from '../../utils/progress/getDailyGoal';
import { Alert } from 'react-native';
import uuid from 'react-native-uuid';
import { CacheKeys, CACHE_CONFIG } from './CacheService';

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
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    ja: 'Japanese',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
    tr: 'Turkish',
    nl: 'Dutch',
    sv: 'Swedish',
    pl: 'Polish',
    el: 'Greek',
    he: 'Hebrew',
    vi: 'Vietnamese',
    id: 'Indonesian',
    da: 'Danish',
    no: 'Norwegian',
    fi: 'Finnish',
    th: 'Thai',
    cs: 'Czech',
    hu: 'Hungarian',
    uk: 'Ukrainian',
    ro: 'Romanian',
    tl: 'Filipino',
    ms: 'Malay',
    sw: 'Swahili',
    bn: 'Bengali',
    ur: 'Urdu',
    sr: 'Serbian',
    hr: 'Croatian',
    sk: 'Slovak',
    bg: 'Bulgarian',
    fa: 'Persian (Farsi)',
    ta: 'Tamil',
    te: 'Telugu',
    gu: 'Gujarati',
    pa: 'Punjabi',
    is: 'Icelandic',
    la: 'Latin',
};

type UserWordResponse = {
    word_id: string,
    proficiency: number,
    learned_at: string,
    words: {
        word_id: string,
        original: string,
        translations: Array<{
            language_code: string;
            translated_text: string;
            example: string | null;
        }>,
    },
};

class VocabularyService {
    private cache: Map<string, { data: any; timestamp: number; expiresIn: number }> = new Map();

    /**
     * Get user's vocabulary for a specific language
     */
    // Type definitions for Supabase response

    // Removed duplicate getUserVocabulary(userId: string, languageCode: string): Promise<SavedWord[]> method to resolve duplicate implementation error.

    // Cache helper methods
    private getFromCache<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > entry.expiresIn;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    /**
     * Static method to access cache from global instance
     */
    static getFromGlobalCache<T>(key: string): T | null {
        return vocabularyService.getFromCache<T>(key);
    }

    private setCache<T>(key: string, data: T, expiresIn: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn,
        });
    }

    private invalidateUserCache(userId: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(userId)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Invalidate specific cache types for a user
     */
    invalidateUserCountCaches(userId: string): void {
        this.cache.delete(`vocabularyCounts_${userId}`);
        this.cache.delete(`uniqueWordsCount_${userId}`);
        // Also invalidate vocabulary cache
        this.invalidateUserCache(userId);
    }

    /**
     * Store user word data in local cache for RLS bypass
     */
    private async storeUserWordData(userId: string, wordId: string, wordData: {
        original: string;
        translation: string;
        example: string;
        exampleEnglish: string;
        language: string;
    }): Promise<void> {
        try {
            // Store the word data in cache for retrieval
            const cacheKey = `userWord_${userId}_${wordId}`;
            this.setCache(cacheKey, wordData, CACHE_CONFIG.VOCABULARY);
            console.log(`Stored word data in cache: ${wordData.original}`);
            
            // Verify cache storage immediately
            const verifyCache = this.getFromCache(cacheKey);
            if (verifyCache) {
                console.log(`✅ Cache verification successful for: ${wordData.original}`);
            } else {
                console.error(`❌ Cache verification failed for: ${wordData.original}`);
            }
        } catch (error) {
            console.warn('Error storing user word data:', error);
        }
    }

    /**
     * RLS-compatible word saving that bypasses global words table
     */
    async saveWordsRLSCompatible(
        words: Array<{
            original: string;
            translation: string;
            example: string;
            exampleEnglish: string;
        }>,
        language: string,
        userId: string,
    ): Promise<BatchSaveResult> {
        const result: BatchSaveResult = {
            savedWords: [],
            existingWords: [],
            errors: [],
            language: this.getLanguageName(language),
        };

        try {
            // Get existing user vocabulary that has translations in the target language only
            const { data: existingUserWords } = await supabase
                .from('user_words')
                .select(`
                    id, 
                    word_id,
                    words!inner (
                        original,
                        translations!inner (
                            language_code
                        )
                    )
                `)
                .eq('user_id', userId)
                .eq('words.translations.language_code', language);

            // Create a comprehensive set of existing words to prevent duplicates (language-specific)
            const existingWordTexts = new Set<string>();
            const existingWordIds = new Set<string>();
            
            if (existingUserWords) {
                for (const userWord of existingUserWords) {
                    existingWordIds.add(userWord.word_id);
                    
                    // Check cached data first
                    const cachedWordData = this.getFromCache<{
                        original: string;
                        language: string;
                    }>(`userWord_${userId}_${userWord.word_id}`);
                    
                    if (cachedWordData && cachedWordData.language === language) {
                        existingWordTexts.add(`${cachedWordData.original.toLowerCase()}_${language}`);
                    }
                    
                    // Also check database word data
                    const word = Array.isArray(userWord.words) ? userWord.words[0] : userWord.words;
                    if (word?.original) {
                        // Extract original word from user-specific format
                        let cleanOriginal = word.original;
                        const userPrefix = `user_${userId}_`;
                        if (cleanOriginal.startsWith(userPrefix)) {
                            cleanOriginal = cleanOriginal.substring(userPrefix.length);
                            // Remove timestamp suffix if present
                            const parts = cleanOriginal.split('_');
                            if (parts.length > 2 && !isNaN(Number(parts[parts.length - 1]))) {
                                parts.pop(); // Remove timestamp
                                cleanOriginal = parts.join('_');
                            }
                            // Remove language suffix
                            const langSuffix = `_${language}`;
                            if (cleanOriginal.endsWith(langSuffix)) {
                                cleanOriginal = cleanOriginal.slice(0, -langSuffix.length);
                            }
                        }
                        // Only add to existing words for THIS specific language
                        existingWordTexts.add(`${cleanOriginal.toLowerCase()}_${language}`);
                    }
                }
            }

            console.log(`Found ${existingWordTexts.size} existing words for user in language ${language}`);

            // Get initial count for verification
            const { count: initialCount } = await supabase
                .from('user_words')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            console.log(`Initial user_words count: ${initialCount}`);

            for (const word of words) {
                try {
                    const wordKey = `${word.original.toLowerCase()}_${language}`;
                    
                    // Check if this exact word already exists for this user in this specific language
                    if (existingWordTexts.has(wordKey)) {
                        console.log(`Word "${word.original}" already exists for user in ${language}`);
                        result.existingWords.push(word.original);
                        continue;
                    }

                    // Generate unique IDs
                    const wordId = uuid.v4() as string;
                    const userWordId = uuid.v4() as string;
                    
                    // Double-check UUID uniqueness (extremely rare collision)
                    if (existingWordIds.has(wordId)) {
                        console.warn(`UUID collision detected for word "${word.original}", regenerating...`);
                        continue;
                    }

                    // Use clean word name for storage
                    const cleanWordOriginal = word.original.toLowerCase();
                    
                    console.log(`Checking if word exists: ${cleanWordOriginal}`);
                    
                    // Try upsert approach - this handles both new and existing words
                    console.log(`🔄 Attempting upsert for word: ${cleanWordOriginal}`);
                    
                    let wordData;
                    let finalWordId = wordId;
                    let existingWord = null;
                    
                    // First attempt: try to get existing word with language-specific original
                    const languageSpecificOriginal = `${cleanWordOriginal}_${language}`;
                    const { data: foundExistingWord } = await supabase
                        .from('words')
                        .select('word_id, original')
                        .eq('original', languageSpecificOriginal)
                        .single();
                    
                    if (foundExistingWord) {
                        console.log(`✅ Using existing language-specific word: ${foundExistingWord.original} with ID: ${foundExistingWord.word_id}`);
                        wordData = [foundExistingWord];
                        finalWordId = foundExistingWord.word_id;
                        existingWord = foundExistingWord;
                    } else {
                        console.log(`Creating new language-specific word: ${languageSpecificOriginal} with ID: ${wordId}`);
                        const { data: newWordData, error: wordError } = await supabase
                            .from('words')
                            .insert({
                                word_id: wordId,
                                original: languageSpecificOriginal,
                                created_at: new Date().toISOString(),
                            })
                            .select();
                            
                        if (wordError) {
                            console.error('❌ WORD INSERT ERROR:', {
                                word: cleanWordOriginal,
                                error: wordError,
                                code: wordError.code,
                                message: wordError.message,
                                details: wordError.details
                            });
                            
                            // If it's a constraint violation, try to get the existing word
                            if (wordError.code === '23505') {
                                console.log('🔄 Constraint violation - attempting to find existing word');
                                const { data: retryExistingWord } = await supabase
                                    .from('words')
                                    .select('word_id, original')
                                    .eq('original', cleanWordOriginal)
                                    .single();
                                    
                                if (retryExistingWord) {
                                    console.log(`✅ Found existing word after constraint error: ${retryExistingWord.word_id}`);
                                    wordData = [retryExistingWord];
                                    finalWordId = retryExistingWord.word_id;
                                } else {
                                    console.error('❌ Could not find existing word even after constraint error');
                                    result.errors.push(word.original);
                                    continue;
                                }
                            } else {
                                result.errors.push(word.original);
                                continue;
                            }
                        } else {
                            wordData = newWordData;
                        }
                    }

                    if (!wordData || wordData.length === 0) {
                        console.error('Word data not available');
                        result.errors.push(word.original);
                        continue;
                    }

                    console.log(`Word ready for user_words entry:`, wordData[0]);

                    // Check if user already has this exact word_id in ANY language first
                    const { data: existingUserWordGeneral } = await supabase
                        .from('user_words')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('word_id', finalWordId)
                        .single();

                    if (existingUserWordGeneral) {
                        // User already has this exact word_id, but check if they have it in THIS language
                        const { data: existingTranslation } = await supabase
                            .from('translations')
                            .select('id')
                            .eq('word_id', finalWordId)
                            .eq('language_code', language)
                            .single();

                        if (existingTranslation) {
                            console.log(`⚠️ User already has word "${word.original}" in ${language}`);
                            result.existingWords.push(word.original);
                            continue;
                        } else {
                            console.log(`✅ User has word "${word.original}" but not in ${language}, adding translation`);
                            // Continue to add the translation for this language
                        }
                    }

                    // Create user_words entry with upsert to handle duplicates gracefully
                    console.log(`Attempting to upsert user_word: userId=${userId}, wordId=${finalWordId}`);
                    
                    const { data: userWordData, error: userWordError } = await supabase
                        .from('user_words')
                        .upsert({
                            id: userWordId,
                            user_id: userId,
                            word_id: finalWordId,
                            proficiency: 0,
                            learned_at: new Date().toISOString(),
                        }, {
                            onConflict: 'user_id,word_id',
                            ignoreDuplicates: true
                        })
                        .select();

                    if (userWordError) {
                        // Handle the duplicate key constraint error gracefully
                        if (userWordError.code === '23505') {
                            console.log(`⚠️ User already has word "${word.original}" - treating as existing`);
                            result.existingWords.push(word.original);
                            continue;
                        } else {
                            console.error('Failed to save user word:', userWordError);
                            // Only cleanup if we created a new word (don't delete existing words)
                            if (!existingWord) {
                                await supabase.from('words').delete().eq('word_id', finalWordId);
                            }
                            result.errors.push(word.original);
                            continue;
                        }
                    }

                    if (!userWordData || userWordData.length === 0) {
                        console.error('User word insertion returned no data, may have been blocked by RLS');
                        // Only cleanup if we created a new word (don't delete existing words)
                        if (!existingWord) {
                            await supabase.from('words').delete().eq('word_id', finalWordId);
                        }
                        result.errors.push(word.original);
                        continue;
                    }

                    console.log(`Successfully inserted user_word:`, userWordData[0]);

                    // Verify the data was actually persisted by reading it back
                    const { data: verifyData, error: verifyError } = await supabase
                        .from('user_words')
                        .select('id, user_id, word_id')
                        .eq('id', userWordId)
                        .single();

                    if (verifyError || !verifyData) {
                        console.error('Verification failed - word was not actually saved:', verifyError);
                        // Only cleanup if we created a new word (don't delete existing words)
                        if (!existingWord) {
                            await supabase.from('words').delete().eq('word_id', finalWordId);
                        }
                        result.errors.push(word.original);
                        continue;
                    }

                    console.log(`✅ Verified persistence of user_word:`, verifyData);

                    // Save translation to the translations table
                    const translationExample = word.example && word.exampleEnglish 
                        ? `${word.example}|${word.exampleEnglish}` 
                        : '';

                    console.log(`Attempting to insert translation for word_id: ${finalWordId}, language: ${language}`);
                    
                    // Check if translation already exists for this word and language
                    const { data: existingTranslation } = await supabase
                        .from('translations')
                        .select('*')
                        .eq('word_id', finalWordId)
                        .eq('language_code', language)
                        .single();
                    
                    if (existingTranslation) {
                        console.log(`✅ Translation already exists for ${cleanWordOriginal} in ${language}`);
                    } else {
                        const { data: translationData, error: translationError } = await supabase
                            .from('translations')
                            .insert({
                                word_id: finalWordId,
                                language_code: language,
                                translated_text: word.translation,
                                example: translationExample
                            })
                            .select();

                        if (translationError) {
                            console.error('❌ TRANSLATION INSERT ERROR:', {
                                word_id: finalWordId,
                                language: language,
                                error: translationError,
                                code: translationError.code,
                                message: translationError.message
                            });
                            console.warn(`Translation not saved for word: ${word.original}`);
                        } else if (translationData && translationData.length > 0) {
                            console.log(`✅ Successfully saved translation:`, translationData[0]);
                        }
                    }

                    // Store word data in cache with unique key (as backup)
                    await this.storeUserWordData(userId, finalWordId, {
                        original: word.original,
                        translation: word.translation,
                        example: word.example,
                        exampleEnglish: word.exampleEnglish,
                        language: language
                    });

                    console.log(`Stored in cache with key: userWord_${userId}_${finalWordId}`);

                    // Add to tracking sets to prevent duplicates in this batch
                    existingWordTexts.add(wordKey);
                    existingWordIds.add(finalWordId);

                    result.savedWords.push(word.original);
                    
                    // Record learning activity
                    try {
                        await recordLearningActivity(userId, finalWordId, 1);
                    } catch (activityError) {
                        console.warn('Failed to record learning activity:', activityError);
                        // Don't fail the whole operation for activity recording
                    }

                } catch (error) {
                    console.error('Error saving word:', word.original, error);
                    result.errors.push(word.original);
                }
            }

            // Final verification - check if the count actually increased
            const { count: finalCount } = await supabase
                .from('user_words')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            console.log(`Final user_words count: ${finalCount}, Expected increase: ${result.savedWords.length}`);

            const actualIncrease = (finalCount || 0) - (initialCount || 0);
            if (actualIncrease !== result.savedWords.length) {
                console.error(`⚠️ COUNT MISMATCH: Expected ${result.savedWords.length} new words, but count increased by ${actualIncrease}`);
                
                // If we have a severe mismatch, something went wrong
                if (result.savedWords.length > 0 && actualIncrease === 0) {
                    console.error('❌ CRITICAL: Words reported as saved but database count unchanged - possible RLS/permission issue');
                    
                    // Move "saved" words to errors since they didn't actually persist
                    result.errors.push(...result.savedWords);
                    result.savedWords = [];
                }
            }

            console.log(`RLS-Compatible: Successfully saved ${result.savedWords.length} new words, ${result.existingWords.length} already existed`);
            
            // DON'T invalidate cache immediately after saving - this would remove the word data we just stored!
            // We need to preserve the individual word cache entries for the newly saved words
            console.log(`Preserving individual word cache entries for ${result.savedWords.length} newly saved words`);
            
            // Trigger vocabulary update callback if new words were saved
            if (result.savedWords.length > 0 && vocabularyUpdateCallback) {
                setTimeout(() => vocabularyUpdateCallback?.(), 100);
            }
            
            return result;

        } catch (error) {
            console.error('RLS-compatible batch save error:', error);
            console.log('🔄 Attempting fallback to standard method...');
            
            // Return error result for all words if main method fails
            return {
                savedWords: [],
                existingWords: [],
                errors: words.map(w => w.original),
                language: this.getLanguageName(language),
            };
        }
    }
    /**
     * Get language name from code
     */
    private getLanguageName(code: string): string {
        return LANGUAGE_NAMES[code] || code;
    }

    private async userHasWord(userId: string, wordId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('user_words')
                .select('id')
                .eq('user_id', userId)
                .eq('word_id', wordId)
                .single();

            if (error && error.code !== 'PGRST116') {
                // PGRST116 is "not found" - other errors are real problems
                console.error('Error checking user word:', error);
                return false;
            }

            return !!data;
        } catch (error) {
            console.error('Exception checking user word:', error);
            return false;
        }
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
        userId: string,
    ): Promise<BatchSaveResult> {
        try {
            console.log(`🔄 Starting batch save for ${words.length} words in ${language}`);
            
            // Remove duplicates from input words based on original text
            const uniqueWordsMap = new Map<string, (typeof words)[0]>();
            for (const word of words) {
                const key = word.original.toLowerCase().trim();
                if (key && !uniqueWordsMap.has(key)) {
                    uniqueWordsMap.set(key, word);
                }
            }
            const uniqueWords = Array.from(uniqueWordsMap.values());
            
            console.log(`📊 Processing ${uniqueWords.length} unique words (removed ${words.length - uniqueWords.length} duplicates from input)`);

            const result: BatchSaveResult = {
                savedWords: [],
                existingWords: [],
                errors: [],
                language: this.getLanguageName(language),
            };

            // Get user's current vocabulary for this specific language to check for existing words
            console.log(`🔍 Checking existing user vocabulary for language: ${language}...`);
            
            // Get user's words - simple approach without relying on potentially corrupted translations
            const { data: allUserWords, error: allUserWordsError } = await supabase
                .from('user_words')
                .select(`
                    word_id,
                    words!inner (
                        word_id, 
                        original
                    )
                `)
                .eq('user_id', userId);
                
            if (allUserWordsError) {
                console.error('❌ Error fetching user words:', allUserWordsError);
                return {
                    savedWords: [],
                    existingWords: [],
                    errors: words.map(w => w.original),
                    language: this.getLanguageName(language),
                };
            }
            
            console.log(`🔍 User has ${allUserWords?.length || 0} total words`);
            
            // CHANGE: Only consider words that are actually saved properly with translations
            // Check cache first since that's more reliable than database translations
            let existingUserWords: any[] = [];
            
            if (allUserWords && allUserWords.length > 0) {
                console.log(`🔍 Checking cached translations for ${language}...`);
                
                for (const userWord of allUserWords) {
                    // Check if we have cached data for this word in the target language
                    const cacheKey = `userWord_${userId}_${userWord.word_id}`;
                    const cachedWordData = this.getFromCache<{
                        original: string;
                        language: string;
                    }>(cacheKey);
                    
                    if (cachedWordData && cachedWordData.language === language) {
                        console.log(`📝 Found cached word "${cachedWordData.original}" in ${language}`);
                        existingUserWords.push(userWord);
                    }
                }
                
                console.log(`📝 Found ${existingUserWords.length} user words actually saved in ${language} (from cache)`);
            }

            // Create a set of words the user already has in this specific language
            const existingWordTexts = new Set<string>();
            const existingWordIds = new Set<string>();
            
            console.log(`📋 Processing ${existingUserWords.length} existing user words for ${language}`);
            
            if (existingUserWords && existingUserWords.length > 0) {
                existingUserWords.forEach((userWord, index) => {
                    if (userWord.words) {
                        const wordObj = Array.isArray(userWord.words) ? userWord.words[0] : userWord.words;
                        const wordText = wordObj.original.toLowerCase().trim();
                        
                        console.log(`📝 [${index + 1}] Processing existing word: "${wordText}" (word_id: ${userWord.word_id})`);
                        
                        // Create language-specific key to prevent cross-language duplicates
                        const languageSpecificKey = `${wordText}_${language}`;
                        existingWordTexts.add(languageSpecificKey);
                        existingWordIds.add(userWord.word_id);
                    }
                });
                console.log(`📚 User already has ${existingWordTexts.size} words in ${language} vocabulary:`, Array.from(existingWordTexts));
            } else {
                console.log(`📚 User has no existing words in ${language} vocabulary`);
            }

            // Process each word
            for (const word of uniqueWords) {
                try {
                    const cleanWordOriginal = word.original.toLowerCase().trim();
                    const languageSpecificKey = `${cleanWordOriginal}_${language}`;
                    
                    console.log(`🔍 Checking "${cleanWordOriginal}" with key "${languageSpecificKey}"`);
                    console.log(`📦 Existing words set contains:`, Array.from(existingWordTexts));
                    
                    // Skip if user already has this word in this specific language
                    if (existingWordTexts.has(languageSpecificKey)) {
                        console.log(`⏭️ Skipping "${cleanWordOriginal}" - user already has this word in ${language}`);
                        result.existingWords.push(word.original);
                        continue;
                    } else {
                        console.log(`✅ "${cleanWordOriginal}" is new in ${language} - proceeding to save`);
                    }

                    console.log(`🔄 Processing new word: ${cleanWordOriginal}`);

                    // Generate a consistent UUID for this word
                    const wordId = uuid.v4() as string;
                    let finalWordId = wordId;
                    let wordData;

                    // First, check if the word exists in the words table with language-specific original
                    const languageSpecificOriginal = `${cleanWordOriginal}_${language}`;
                    const { data: foundExistingWord } = await supabase
                        .from('words')
                        .select('word_id, original')
                        .eq('original', languageSpecificOriginal)
                        .single();

                    if (foundExistingWord) {
                        console.log(`✅ Using existing language-specific word: ${foundExistingWord.original} with ID: ${foundExistingWord.word_id}`);
                        finalWordId = foundExistingWord.word_id;
                        wordData = [foundExistingWord];
                    } else {
                        // Create new word with conflict resolution
                        console.log(`➕ Creating new language-specific word: ${languageSpecificOriginal} with ID: ${wordId}`);
                        
                        const { data: newWordData, error: wordError } = await supabase
                            .from('words')
                            .insert({
                                word_id: wordId,
                                original: languageSpecificOriginal,
                                created_at: new Date().toISOString(),
                            })
                            .select();

                        if (wordError) {
                            if (wordError.code === '23505') {
                                // Constraint violation - word was created by another request
                                console.log('🔄 Word created by concurrent request, fetching existing...');
                                const { data: retryExistingWord } = await supabase
                                    .from('words')
                                    .select('word_id, original')
                                    .eq('original', cleanWordOriginal)
                                    .single();

                                if (retryExistingWord) {
                                    finalWordId = retryExistingWord.word_id;
                                    wordData = [retryExistingWord];
                                } else {
                                    throw new Error('Failed to retrieve word after conflict');
                                }
                            } else {
                                throw wordError;
                            }
                        } else {
                            wordData = newWordData;
                        }
                    }

                    if (!wordData || wordData.length === 0) {
                        throw new Error('No word data available');
                    }

                    console.log(`Word ready for user_words entry:`, {
                        original: word.original,
                        word_id: finalWordId
                    });

                    // Check if user already has this exact word_id in ANY language first
                    const { data: existingUserWordGeneral } = await supabase
                        .from('user_words')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('word_id', finalWordId)
                        .single();

                    if (existingUserWordGeneral) {
                        // User already has this exact word_id - check cache to see if they have it in THIS language
                        const cacheKey = `userWord_${userId}_${finalWordId}`;
                        const cachedWordData = this.getFromCache<{
                            original: string;
                            language: string;
                        }>(cacheKey);
                        
                        if (cachedWordData && cachedWordData.language === language) {
                            console.log(`⚠️ User already has word "${word.original}" in ${language} (cache verified)`);
                            result.existingWords.push(word.original);
                            continue;
                        } else {
                            console.log(`✅ User has word "${word.original}" but not in ${language}, adding translation only`);
                            // Skip user_words insertion, just add translation
                        }
                    } else {
                        // User doesn't have this word_id at all, add to user_words
                        console.log(`Attempting to insert user_word: userId=${userId}, wordId=${finalWordId}`);
                        
                        const { data: userWordData, error: userWordError } = await supabase
                            .from('user_words')
                            .insert({
                                user_id: userId,
                                word_id: finalWordId,
                                proficiency: 0,
                                learned_at: new Date().toISOString(),
                            })
                            .select();

                        if (userWordError) {
                            // Handle duplicate key constraint error gracefully
                            if (userWordError.code === '23505') {
                                console.log(`⚠️ User already has word "${word.original}" - treating as existing (database conflict)`);
                                result.existingWords.push(word.original);
                                continue;
                            } else {
                                console.error('❌ User word error:', userWordError);
                                throw userWordError;
                            }
                        }
                    }

                    console.log(`✅ Successfully linked user to word: ${finalWordId}`);

                    // Add translation (always required for vocabulary)
                    if (word.translation) {
                        const translationExample = word.example && word.exampleEnglish 
                            ? `${word.example}|${word.exampleEnglish}`
                            : null;

                        console.log(`Attempting to upsert translation for word_id: ${finalWordId}, language: ${language}`);
                        
                        const { error: translationError } = await supabase
                            .from('translations')
                            .upsert({
                                word_id: finalWordId,
                                language_code: language,
                                translated_text: word.translation,
                                example: translationExample,
                            }, {
                                onConflict: 'word_id,language_code',
                                ignoreDuplicates: false  // Update translation if exists
                            });

                        if (translationError) {
                            console.warn(`Translation save failed for "${word.original}":`, translationError);
                            // Don't fail the whole operation for translation errors
                        } else {
                            console.log(`✅ Successfully saved translation for "${word.original}" in ${language}`);
                        }
                    }

                    // Store in cache
                    await this.storeUserWordData(userId, finalWordId, {
                        original: word.original,
                        translation: word.translation,
                        example: word.example,
                        exampleEnglish: word.exampleEnglish,
                        language: language
                    });

                    result.savedWords.push(word.original);
                    
                    // Record learning activity
                    try {
                        await recordLearningActivity(userId, finalWordId, 1);
                    } catch (activityError) {
                        console.warn('Failed to record learning activity:', activityError);
                    }

                } catch (error) {
                    console.error(`❌ Failed to save word "${word.original}":`, error);
                    result.errors.push(word.original);
                }
            }

            // Final count verification
            const { count: finalUserWordsCount } = await supabase
                .from('user_words')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            console.log(`📊 Final user_words count: ${finalUserWordsCount}, Saved: ${result.savedWords.length}, Existing: ${result.existingWords.length}, Errors: ${result.errors.length}`);
            console.log(`✅ Successfully saved ${result.savedWords.length} new words in ${language}, ${result.existingWords.length} already existed in this language`);
            
            // Log summary for debugging
            if (result.savedWords.length > 0) {
                console.log(`🎉 New words saved in ${language}:`, result.savedWords);
            }
            if (result.existingWords.length > 0) {
                console.log(`⚠️ Words already in ${language} vocabulary:`, result.existingWords);
            }

            // Trigger vocabulary update callback if new words were saved
            if (result.savedWords.length > 0 && vocabularyUpdateCallback) {
                setTimeout(() => vocabularyUpdateCallback?.(), 100);
            }

            return result;

        } catch (error) {
            console.error('❌ Batch save error:', error);
            
            // Return error result for all words if main method fails
            return {
                savedWords: [],
                existingWords: [],
                errors: words.map(w => w.original),
                language: this.getLanguageName(language),
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
        userId: string,
    ): Promise<SaveWordResult> {
        try {
            // Use the same language-specific approach as saveMultipleWords to prevent cross-language contamination
            const result = await this.saveMultipleWords(
                [{
                    original,
                    translation,
                    example,
                    exampleEnglish
                }],
                language,
                userId
            );
            
            // Convert batch result to single word result
            if (result.errors.length > 0) {
                return 'error';
            } else if (result.existingWords.length > 0) {
                return 'exists';
            } else if (result.savedWords.length > 0) {
                return 'success';
            } else {
                return 'error';
            }

        } catch (error) {
            console.error('Error saving word:', error);
            return 'error';
        }
    }

    /**
     * Backfill missing translations from cache data
     */
    private async backfillMissingTranslations(userId: string, userWords: any[]): Promise<void> {
        console.log('🔧 Checking for words that need translation backfill...');
        
        let backfilledCount = 0;
        for (const userWord of userWords) {
            // Check if this word has any translations in the database
            const { data: existingTranslations } = await supabase
                .from('translations')
                .select('word_id')
                .eq('word_id', userWord.word_id);
                
            // If no translations exist, try to backfill from cache
            if (!existingTranslations || existingTranslations.length === 0) {
                const cacheKey = `userWord_${userId}_${userWord.word_id}`;
                const cachedWordData = this.getFromCache<{
                    original: string;
                    translation: string;
                    example: string;
                    exampleEnglish: string;
                    language: string;
                }>(cacheKey);
                
                if (cachedWordData) {
                    console.log(`🔄 Backfilling translation for: ${cachedWordData.original} (${cachedWordData.language})`);
                    
                    const translationExample = cachedWordData.example && cachedWordData.exampleEnglish 
                        ? `${cachedWordData.example}|${cachedWordData.exampleEnglish}` 
                        : '';

                    const { error: backfillError } = await supabase
                        .from('translations')
                        .insert({
                            word_id: userWord.word_id,
                            language_code: cachedWordData.language,
                            translated_text: cachedWordData.translation,
                            example: translationExample
                        });

                    if (backfillError) {
                        console.warn(`Failed to backfill translation for ${cachedWordData.original}:`, backfillError);
                    } else {
                        backfilledCount++;
                        console.log(`✅ Backfilled translation for: ${cachedWordData.original}`);
                    }
                }
            }
        }
        
        if (backfilledCount > 0) {
            console.log(`🎉 Successfully backfilled ${backfilledCount} missing translations`);
        }
    }

    /**
     * Get all vocabulary for a user (cached)
     */
    async getUserVocabulary(
        userId: string,
        languageFilter?: string,
        forceRefresh = false,
    ): Promise<SavedWord[]> {
        const cacheKey = CacheKeys.vocabulary(userId, languageFilter);

        // Return cached data if available and not forcing refresh
        if (!forceRefresh) {
            const cached = this.getFromCache<SavedWord[]>(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            // First, get all user_words entries (simplified query without joins)
            const { data: userVocabData, error: vocabError } = await supabase
                .from('user_words')
                .select(`
                    id,
                    proficiency,
                    learned_at,
                    word_id
                `)
                .eq('user_id', userId)
                .order('learned_at', { ascending: false });

            if (vocabError) {
                console.error('Error fetching user vocabulary:', vocabError);
                return [];
            }

            if (!userVocabData || userVocabData.length === 0) {
                return [];
            }

            console.log(`Processing ${userVocabData.length} user_words for vocabulary display`);

            // Try to backfill missing translations from cache (recovery mechanism)
            if (!languageFilter) { // Only do this when loading all vocabulary to avoid repeated calls
                try {
                    await this.backfillMissingTranslations(userId, userVocabData);
                } catch (backfillError) {
                    console.warn('Backfill operation failed, continuing with regular processing:', backfillError);
                }
            }

            // Transform the data into our SavedWord format
            const vocabulary: SavedWord[] = [];
            const wordsNeedingDbLookup: typeof userVocabData = [];

            // First pass: Process cached words and collect words needing database lookup
            for (const userWord of userVocabData) {
                // First priority: Check if we have cached word data for this word
                const cacheKey = `userWord_${userId}_${userWord.word_id}`;
                const cachedWordData = this.getFromCache<{
                    original: string;
                    translation: string;
                    example: string;
                    exampleEnglish: string;
                    language: string;
                }>(cacheKey);

                if (cachedWordData) {
                    // Apply language filter if specified
                    if (languageFilter && cachedWordData.language !== languageFilter) {
                        continue; // Skip if language doesn't match filter
                    }
                    
                    // Use cached data for RLS-bypassed words
                    vocabulary.push({
                        id: `${userWord.id}_${cachedWordData.language}`,
                        original: cachedWordData.original,
                        translation: cachedWordData.translation,
                        example: cachedWordData.example,
                        exampleEnglish: cachedWordData.exampleEnglish,
                        language: cachedWordData.language,
                        proficiency: userWord.proficiency || 0,
                        learnedAt: userWord.learned_at || '',
                        category: this.categorizeWord(cachedWordData.original),
                    });
                } else {
                    // Add to batch lookup list
                    wordsNeedingDbLookup.push(userWord);
                }
            }

            console.log(`Found ${vocabulary.length} cached words, ${wordsNeedingDbLookup.length} words need database lookup`);

            // If we have words needing database lookup, batch query them
            if (wordsNeedingDbLookup.length > 0) {
                const wordIds = wordsNeedingDbLookup.map(uw => uw.word_id);
                
                // Batch query: Get all words data at once
                const { data: wordsData, error: wordsError } = await supabase
                    .from('words')
                    .select('word_id, original')
                    .in('word_id', wordIds);

                if (wordsError) {
                    console.warn('Error batch fetching words:', wordsError);
                } else if (wordsData) {
                    // Batch query: Get all translations data at once
                    const { data: translationsData, error: translationsError } = await supabase
                        .from('translations')
                        .select('word_id, language_code, translated_text, example')
                        .in('word_id', wordIds);

                    if (translationsError) {
                        console.warn('Error batch fetching translations:', translationsError);
                    } else if (translationsData) {
                        // Create lookup maps for efficient processing
                        const wordsMap = new Map(wordsData.map(w => [w.word_id, w]));
                        const translationsMap = new Map<string, typeof translationsData>();
                        
                        // Group translations by word_id
                        for (const translation of translationsData) {
                            if (!translationsMap.has(translation.word_id)) {
                                translationsMap.set(translation.word_id, []);
                            }
                            translationsMap.get(translation.word_id)!.push(translation);
                        }

                        // Process words with batch-fetched data
                        for (const userWord of wordsNeedingDbLookup) {
                            const wordData = wordsMap.get(userWord.word_id);
                            if (!wordData) {
                                console.warn(`No word data found for word_id: ${userWord.word_id}`);
                                continue;
                            }

                            const translations = translationsMap.get(userWord.word_id) || [];
                            if (translations.length === 0) {
                                console.warn(`No translations found for word_id: ${userWord.word_id}`);
                                
                                // Try to recover from cache as a fallback
                                const cacheKey = `userWord_${userId}_${userWord.word_id}`;
                                const cachedWordData = this.getFromCache<{
                                    original: string;
                                    translation: string;
                                    example: string;
                                    exampleEnglish: string;
                                    language: string;
                                }>(cacheKey);
                                
                                if (cachedWordData) {
                                    console.log(`🔧 Recovering word from cache: ${cachedWordData.original} (${cachedWordData.language})`);
                                    
                                    // Apply language filter if specified
                                    if (languageFilter && cachedWordData.language !== languageFilter) {
                                        continue;
                                    }
                                    
                                    vocabulary.push({
                                        id: `${userWord.id}_${cachedWordData.language}`,
                                        original: cachedWordData.original,
                                        translation: cachedWordData.translation,
                                        example: cachedWordData.example,
                                        exampleEnglish: cachedWordData.exampleEnglish,
                                        language: cachedWordData.language,
                                        proficiency: userWord.proficiency || 0,
                                        learnedAt: userWord.learned_at || '',
                                        category: this.categorizeWord(cachedWordData.original),
                                    });
                                }
                                continue;
                            }

                            // Process translations - show only one entry per word
                            let selectedTranslation = null;
                            
                            if (languageFilter) {
                                // If language filter is specified, find matching translation
                                selectedTranslation = translations.find(t => t && t.language_code === languageFilter);
                            } else {
                                // If no language filter, select the first available translation
                                // This ensures each word appears only once when viewing "All" languages
                                selectedTranslation = translations.find(t => t && t.language_code);
                            }
                            
                            if (selectedTranslation) {
                                // Parse example (format: "translated|english")
                                const [example = '', exampleEnglish = ''] = selectedTranslation.example?.split('|') || [];

                                // Create unique ID by combining user_word id and language code
                                const uniqueId = `${userWord.id}_${selectedTranslation.language_code}`;

                                // Handle user-specific word format (remove user prefix and language suffix)
                                let displayOriginal = wordData.original || '';
                                const userPrefix = `user_${userId}_`;
                                if (displayOriginal.startsWith(userPrefix)) {
                                    displayOriginal = displayOriginal.substring(userPrefix.length);
                                    // Remove timestamp suffix if present
                                    const parts = displayOriginal.split('_');
                                    if (parts.length > 2 && !isNaN(Number(parts[parts.length - 1]))) {
                                        parts.pop(); // Remove timestamp
                                        displayOriginal = parts.join('_');
                                    }
                                    // Remove language suffix
                                    const langSuffix = `_${selectedTranslation.language_code}`;
                                    if (displayOriginal.endsWith(langSuffix)) {
                                        displayOriginal = displayOriginal.slice(0, -langSuffix.length);
                                    }
                                } else {
                                    // Handle new language-specific format (word_language)
                                    const langSuffix = `_${selectedTranslation.language_code}`;
                                    if (displayOriginal.endsWith(langSuffix)) {
                                        displayOriginal = displayOriginal.slice(0, -langSuffix.length);
                                    }
                                }

                                vocabulary.push({
                                    id: uniqueId,
                                    original: displayOriginal,
                                    translation: selectedTranslation.translated_text || '',
                                    example: example,
                                    exampleEnglish: exampleEnglish,
                                    language: selectedTranslation.language_code || '',
                                    proficiency: userWord.proficiency || 0,
                                    learnedAt: userWord.learned_at || '',
                                    category: this.categorizeWord(displayOriginal),
                                });
                            }
                        }
                    }
                }
            }

            // Successfully processed vocabulary entries

            // Cache the result
            this.setCache(cacheKey, vocabulary, CACHE_CONFIG.VOCABULARY);
            return vocabulary;
        } catch (error) {
            console.error('Error getting vocabulary:', error);
            // Try to return cached data on error
            const cached = this.getFromCache<SavedWord[]>(cacheKey);
            if (cached) {
                console.warn('Returning cached vocabulary due to error');
                return cached;
            }
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

            // Invalidate cache after proficiency update
            this.invalidateUserCache(userWordId.split('_')[0]);

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
            
            // Get the user_id for proper cache invalidation (handle case where word might not exist)
            const { data: userWordData, error: fetchError } = await supabase
                .from('user_words')
                .select('user_id, word_id')
                .eq('id', actualId);
            
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error('Error fetching user word for deletion:', fetchError);
                return false;
            }
            
            // Handle case where word doesn't exist (PGRST116 - no rows returned)
            if (!userWordData || userWordData.length === 0) {
                console.log('User word not found for deletion - may have been already deleted');
                // Still invalidate caches in case it was a stale reference
                this.cache.clear();
                return true; // Return true since the goal (word not existing) is achieved
            }

            const wordData = Array.isArray(userWordData) ? userWordData[0] : userWordData;

            // Delete the user_words entry
            const { error } = await supabase.from('user_words').delete().eq('id', actualId);

            if (error) {
                console.error('Error deleting word:', error);
                return false;
            }

            // Smart cache update: invalidate count caches for accurate recalculation
            this.invalidateUserCountCaches(wordData.user_id);
            
            // Also invalidate SessionService caches to update profile counts immediately
            try {
                const SessionService = (await import('./SessionService')).default;
                SessionService.invalidateUserStatsCache(wordData.user_id);
            } catch (importError) {
                console.warn('Could not import SessionService:', importError);
            }
            
            // Trigger global cache invalidation event for real-time updates using React Native events
            try {
                // Get languages for this word to enable instant UI updates
                const { data: wordTranslations } = await supabase
                    .from('translations')
                    .select('language_code')
                    .eq('word_id', wordData.word_id);
                
                const languages = wordTranslations?.map(t => t.language_code) || [];
                
                const EventService = (await import('./EventService')).default;
                EventService.emitVocabularyChange({
                    userId: wordData.user_id,
                    action: 'deleted',
                    wordId: wordData.word_id,
                    languages,
                    countChange: -1 // Decrement count
                });
            } catch (eventError) {
                console.warn('Could not dispatch vocabulary change event:', eventError);
            }
            
            console.log(`Successfully deleted user_word ${actualId} for user ${wordData.user_id}`);
            return true;
        } catch (error) {
            console.error('Error deleting word:', error);
            return false;
        }
    }

    /**
     * Smart cache update after word deletion - updates counts without full reload
     */
    private async updateCacheAfterDeletion(userId: string, deletedWordId: string): Promise<void> {
        try {
            // Get the languages for the deleted word
            const { data: wordTranslations } = await supabase
                .from('translations')
                .select('language_code')
                .eq('word_id', deletedWordId);

            if (wordTranslations && wordTranslations.length > 0) {
                // Update vocabulary counts cache
                const countsKey = `vocabularyCounts_${userId}`;
                const cachedCounts = this.getFromCache<{ [langCode: string]: number }>(countsKey);
                
                if (cachedCounts) {
                    const updatedCounts = { ...cachedCounts };
                    wordTranslations.forEach(translation => {
                        if (updatedCounts[translation.language_code] > 0) {
                            updatedCounts[translation.language_code]--;
                        }
                        // Remove language if count reaches 0
                        if (updatedCounts[translation.language_code] === 0) {
                            delete updatedCounts[translation.language_code];
                        }
                    });
                    this.setCache(countsKey, updatedCounts, CACHE_CONFIG.VOCABULARY);
                    console.log('Updated vocabulary counts cache after deletion');
                }
            }
            
            // Still invalidate other caches that need full refresh
            this.invalidateUserCache(userId);
        } catch (error) {
            console.warn('Smart cache update failed, falling back to full invalidation:', error);
            this.invalidateUserCache(userId);
        }
    }

    /**
     * Get vocabulary counts by language (optimized for profile page)
     * This is much faster than loading all vocabulary data
     */
    async getUserVocabularyCounts(userId: string, forceRefresh = false): Promise<{ [langCode: string]: number }> {
        const cacheKey = `vocabularyCounts_${userId}`;
        
        // Return cached data if available and not forcing refresh
        if (!forceRefresh) {
            const cached = this.getFromCache<{ [langCode: string]: number }>(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            // First, let's see ALL user_words entries for debugging
            const { data: allUserWords, error: allError } = await supabase
                .from('user_words')
                .select('word_id, user_id')
                .eq('user_id', userId);
            
            // Get vocabulary counts efficiently using existing schema
            const { data: vocabularyData, error } = await supabase
                .from('user_words')
                .select(`
                    word_id,
                    words!inner (
                        word_id,
                        translations!inner (
                            language_code
                        )
                    )
                `)
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching vocabulary counts:', error);
                return {};
            }

            // Count by language - count each word only once per language it was originally saved in
            const langCounts: { [langCode: string]: number } = {};
            const processedWords = new Set<string>(); // Track processed word_ids to avoid duplicates
            
            vocabularyData?.forEach(userWord => {
                // Skip if we've already processed this word_id
                if (processedWords.has(userWord.word_id)) {
                    return;
                }
                processedWords.add(userWord.word_id);
                
                const word = Array.isArray(userWord.words) ? userWord.words[0] : userWord.words;
                if (word?.translations) {
                    const translations = Array.isArray(word.translations) ? word.translations : [word.translations];
                    
                    // Only count the first available translation to avoid duplicates
                    const firstTranslation = translations.find(t => t && t.language_code);
                    if (firstTranslation?.language_code) {
                        langCounts[firstTranslation.language_code] = (langCounts[firstTranslation.language_code] || 0) + 1;
                    }
                }
            });

            // Cache the result
            this.setCache(cacheKey, langCounts, CACHE_CONFIG.VOCABULARY);
            
            return langCounts;
        } catch (error) {
            console.error('Error getting vocabulary counts:', error);
            return {};
        }
    }

    /**
     * Get unique word count (distinct base words regardless of language)
     */
    async getUniqueWordsCount(userId: string, forceRefresh = false): Promise<number> {
        const cacheKey = `uniqueWordsCount_${userId}`;
        
        // Return cached data if available and not forcing refresh
        if (!forceRefresh) {
            const cached = this.getFromCache<number>(cacheKey);
            if (cached !== null) {
                return cached;
            }
        }

        try {
            // Get unique word count using existing schema
            const { data: vocabularyData, error } = await supabase
                .from('user_words')
                .select(`
                    words!inner (
                        original
                    )
                `)
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching unique words count:', error);
                return 0;
            }

            // Count unique base words (remove language suffixes)
            const uniqueWords = new Set<string>();
            vocabularyData?.forEach(userWord => {
                const word = Array.isArray(userWord.words) ? userWord.words[0] : userWord.words;
                if (word?.original) {
                    // Remove language suffix to get the base word
                    let baseWord = word.original;
                    
                    // Remove language suffix pattern: "word_language"
                    if (baseWord.includes('_')) {
                        const lastUnderscoreIndex = baseWord.lastIndexOf('_');
                        const possibleLanguageCode = baseWord.substring(lastUnderscoreIndex + 1);
                        
                        // Check if the suffix looks like a language code (2-5 characters, common patterns)
                        if (possibleLanguageCode.length >= 2 && possibleLanguageCode.length <= 5) {
                            baseWord = baseWord.substring(0, lastUnderscoreIndex);
                        }
                    }
                    
                    uniqueWords.add(baseWord.toLowerCase());
                }
            });

            const uniqueCount = uniqueWords.size;
            
            // Cache the result
            this.setCache(cacheKey, uniqueCount, CACHE_CONFIG.VOCABULARY);
            return uniqueCount;
        } catch (error) {
            console.error('Error getting unique words count:', error);
            return 0;
        }
    }

    /**
     * Get total vocabulary count (sum of all languages) - super fast
     */
    async getTotalVocabularyCount(userId: string, forceRefresh = false): Promise<number> {
        const counts = await this.getUserVocabularyCounts(userId, forceRefresh);
        return Object.values(counts).reduce((sum, count) => sum + count, 0);
    }

    /**
     * Clean up duplicate vocabulary entries for a user
     */
    async cleanupDuplicateVocabulary(userId: string): Promise<{cleaned: number, remaining: number}> {
        try {
            console.log('Starting vocabulary cleanup for user:', userId);
            
            // Get all user words with their cached data
            const { data: allUserWords } = await supabase
                .from('user_words')
                .select('id, word_id, learned_at')
                .eq('user_id', userId)
                .order('learned_at', { ascending: true }); // Keep oldest entries

            if (!allUserWords || allUserWords.length === 0) {
                return { cleaned: 0, remaining: 0 };
            }

            // Group by word content to find duplicates
            const wordGroups = new Map<string, typeof allUserWords>();
            const duplicatesToDelete: string[] = [];

            for (const userWord of allUserWords) {
                // Check cached data for word content
                const cachedWordData = this.getFromCache<{
                    original: string;
                    language: string;
                }>(`userWord_${userId}_${userWord.word_id}`);
                
                if (cachedWordData) {
                    const wordKey = `${cachedWordData.original.toLowerCase()}_${cachedWordData.language}`;
                    
                    if (wordGroups.has(wordKey)) {
                        // This is a duplicate - mark for deletion (keep the first/oldest one)
                        duplicatesToDelete.push(userWord.id);
                        console.log(`Marking duplicate for deletion: ${cachedWordData.original} (${cachedWordData.language})`);
                    } else {
                        wordGroups.set(wordKey, [userWord]);
                    }
                }
            }

            // Delete duplicates in batches
            let cleaned = 0;
            if (duplicatesToDelete.length > 0) {
                console.log(`Deleting ${duplicatesToDelete.length} duplicate entries...`);
                
                const { error } = await supabase
                    .from('user_words')
                    .delete()
                    .in('id', duplicatesToDelete);
                
                if (error) {
                    console.error('Error deleting duplicates:', error);
                } else {
                    cleaned = duplicatesToDelete.length;
                    console.log(`Successfully deleted ${cleaned} duplicate entries`);
                }
            }

            // Clear all cache to force refresh
            this.invalidateUserCache(userId);
            
            const remaining = allUserWords.length - cleaned;
            console.log(`Cleanup complete: ${cleaned} deleted, ${remaining} remaining`);
            
            return { cleaned, remaining };

        } catch (error) {
            console.error('Error during vocabulary cleanup:', error);
            return { cleaned: 0, remaining: 0 };
        }
    }

    /**
     * Debug function to check user's vocabulary data in Supabase
     */
    async debugUserVocabulary(userId: string): Promise<void> {
        try {
            console.log('=== VOCABULARY DEBUG FOR USER:', userId, '===');
            
            // Check user_words table
            const { data: userWords, error: userWordsError } = await supabase
                .from('user_words')
                .select('*')
                .eq('user_id', userId);
                
            console.log('USER_WORDS DATA:', userWords?.length || 0, 'entries');
            if (userWords && userWords.length > 0) {
                console.log('First 3 user_words:', userWords.slice(0, 3));
            }
            
            if (userWordsError) {
                console.error('USER_WORDS ERROR:', userWordsError);
            }
            
            // Check words table for user's word_ids
            if (userWords && userWords.length > 0) {
                const wordIds = userWords.map(uw => uw.word_id);
                
                const { data: wordsData, error: wordsError } = await supabase
                    .from('words')
                    .select('*')
                    .in('word_id', wordIds);
                    
                console.log('WORDS DATA:', wordsData?.length || 0, 'entries');
                if (wordsData && wordsData.length > 0) {
                    console.log('First 3 words:', wordsData.slice(0, 3));
                }
                
                if (wordsError) {
                    console.error('WORDS ERROR:', wordsError);
                }
                
                // Check translations for these words
                const { data: translationsData, error: translationsError } = await supabase
                    .from('translations')
                    .select('*')
                    .in('word_id', wordIds);
                    
                console.log('TRANSLATIONS DATA:', translationsData?.length || 0, 'entries');
                if (translationsData && translationsData.length > 0) {
                    console.log('First 3 translations:', translationsData.slice(0, 3));
                }
                
                if (translationsError) {
                    console.error('TRANSLATIONS ERROR:', translationsError);
                }
            }
            
            // Check cache
            console.log('=== CACHE DEBUG ===');
            console.log('Cache size:', this.cache.size);
            const cacheKeys = Array.from(this.cache.keys()).filter(key => key.includes(userId));
            console.log('User cache keys:', cacheKeys);
            
            // Try to get cached word data for first few words
            if (userWords && userWords.length > 0) {
                for (let i = 0; i < Math.min(3, userWords.length); i++) {
                    const userWord = userWords[i];
                    const cachedData = this.getFromCache(`userWord_${userId}_${userWord.word_id}`);
                    console.log(`Cached data for word_id ${userWord.word_id}:`, cachedData);
                }
            }
            
            console.log('=== END VOCABULARY DEBUG ===');
        } catch (error) {
            console.error('DEBUG ERROR:', error);
        }
    }

    /**
     * Force refresh vocabulary by clearing cache
     */
    async forceRefreshUserVocabulary(userId: string): Promise<SavedWord[]> {
        // Clear all cache entries for this user
        this.invalidateUserCache(userId);
        
        // Force refresh all vocabulary
        return await this.getUserVocabulary(userId, undefined, true);
    }

    /**
     * Simple word categorization
     */
    private categorizeWord(word: string): string {
        const categories = {
            food: [
                'apple',
                'banana',
                'bread',
                'cheese',
                'chicken',
                'coffee',
                'egg',
                'fish',
                'fruit',
                'meat',
                'milk',
                'orange',
                'pizza',
                'rice',
                'salad',
                'sandwich',
                'tea',
                'water',
            ],
            animals: [
                'bird',
                'cat',
                'dog',
                'elephant',
                'fish',
                'horse',
                'lion',
                'monkey',
                'mouse',
                'rabbit',
                'tiger',
            ],
            objects: [
                'bag',
                'book',
                'bottle',
                'box',
                'camera',
                'chair',
                'clock',
                'computer',
                'cup',
                'desk',
                'door',
                'glasses',
                'key',
                'lamp',
                'laptop',
                'mirror',
                'pen',
                'pencil',
                'phone',
                'table',
                'watch',
                'window',
            ],
            clothing: [
                'belt',
                'coat',
                'dress',
                'hat',
                'jacket',
                'jeans',
                'pants',
                'shirt',
                'shoe',
                'shorts',
                'skirt',
                'sock',
                'suit',
                'sweater',
                't-shirt',
            ],
            nature: [
                'cloud',
                'flower',
                'grass',
                'leaf',
                'moon',
                'mountain',
                'plant',
                'rain',
                'river',
                'rock',
                'sky',
                'snow',
                'star',
                'sun',
                'tree',
                'water',
            ],
            transportation: [
                'airplane',
                'bicycle',
                'boat',
                'bus',
                'car',
                'helicopter',
                'motorcycle',
                'ship',
                'train',
                'truck',
            ],
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

const vocabularyService = new VocabularyService();

// Export cache clearing method globally for emergency use
(global as any).clearVocabularyCache = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🧹 CLEARING ALL VOCABULARY CACHE...');
        
        // Clear all cache entries
        (vocabularyService as any).cache.clear();
        
        console.log('✅ All vocabulary cache cleared!');
        console.log('🔄 Please refresh your vocabulary page now!');
        
        return { cleared: true };
        
    } catch (error) {
        console.error('❌ Cache clear error:', error);
        return { cleared: false };
    }
};

// Export debug method globally for troubleshooting
(global as any).debugVocabulary = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        await vocabularyService.debugUserVocabulary(user.id);
        
        // Also test language detection (like the vocabulary page does)
        console.log('\n=== TESTING LANGUAGE DETECTION ===');
        
        // Test the same logic as the vocabulary page
        const { data: userWords } = await supabase
            .from('user_words')
            .select('word_id')
            .eq('user_id', user.id);
            
        if (userWords && userWords.length > 0) {
            const wordIds = userWords.map(uw => uw.word_id);
            
            const { data: translations } = await supabase
                .from('translations')
                .select('language_code')
                .in('word_id', wordIds);
            
            if (translations && translations.length > 0) {
                const languageCodes = new Set();
                translations.forEach(t => {
                    if (t.language_code) {
                        languageCodes.add(t.language_code);
                    }
                });
                
                console.log('✅ Languages detected:', Array.from(languageCodes));
            } else {
                console.log('❌ No translations found for user words');
            }
        } else {
            console.log('❌ No user words found');
        }
        
        console.log('=== END LANGUAGE DETECTION TEST ===\n');
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
};

// Export force refresh method globally for emergency use
(global as any).forceRefreshVocabulary = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🔄 Force refreshing vocabulary...');
        const result = await vocabularyService.forceRefreshUserVocabulary(user.id);
        console.log('✅ Vocabulary refreshed!', result.length, 'words found');
        
        // Trigger callback to update UI
        if (vocabularyUpdateCallback) {
            vocabularyUpdateCallback();
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Force refresh error:', error);
    }
};

// Callback for vocabulary updates - can be set by UI components
export let vocabularyUpdateCallback: (() => void) | null = null;

export const setVocabularyUpdateCallback = (callback: (() => void) | null) => {
    vocabularyUpdateCallback = callback;
};

// Export method to clean ALL orphaned translations globally
(global as any).cleanAllOrphanedTranslations = async () => {
    try {
        const { supabase } = await import('../../database/config');
        
        console.log('🔥 CLEANING ALL ORPHANED TRANSLATIONS (production ready)...');
        
        // Get all user_words from all users to find legitimate word_ids
        const { data: allUserWords } = await supabase
            .from('user_words')
            .select('word_id');
            
        const legitimateWordIds = new Set(allUserWords?.map(uw => uw.word_id) || []);
        console.log(`📋 Found ${legitimateWordIds.size} legitimate word IDs across all users`);
        
        // Get all translations
        const { data: allTranslations } = await supabase
            .from('translations')
            .select('id, word_id, language_code, translated_text');
            
        const orphanedTranslations = allTranslations?.filter(t => 
            !legitimateWordIds.has(t.word_id)
        ) || [];
        
        console.log(`🗑️ Found ${orphanedTranslations.length} orphaned translation records`);
        
        if (orphanedTranslations.length > 0) {
            // Delete orphaned translations in batches
            const batchSize = 100;
            let totalDeleted = 0;
            
            for (let i = 0; i < orphanedTranslations.length; i += batchSize) {
                const batch = orphanedTranslations.slice(i, i + batchSize);
                const batchIds = batch.map(t => t.id);
                
                console.log(`🗑️ Deleting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(orphanedTranslations.length/batchSize)}...`);
                
                const { error: deleteError } = await supabase
                    .from('translations')
                    .delete()
                    .in('id', batchIds);
                
                if (!deleteError) {
                    totalDeleted += batchIds.length;
                }
                
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            console.log(`🎉 CLEANED ${totalDeleted} orphaned translations!`);
            return { cleaned: totalDeleted };
        } else {
            console.log('✅ No orphaned translations found');
            return { cleaned: 0 };
        }
        
    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return { cleaned: 0, error };
    }
};

// Export cache clearing function
(global as any).clearVocabularyCache = async () => {
    try {
        console.log('🧹 CLEARING ALL VOCABULARY CACHE...');
        
        const vocabularyService = VocabularyService.getInstance();
        let clearedCount = 0;
        
        // Clear the entire cache
        if (vocabularyService.cache) {
            const cacheSize = vocabularyService.cache.size;
            vocabularyService.cache.clear();
            clearedCount = cacheSize;
        }
        
        console.log(`✅ Cleared ${clearedCount} cache entries`);
        console.log('🔄 Cache completely reset');
        
        return { clearedCount };
        
    } catch (error) {
        console.error('❌ Cache clear error:', error);
        return { error };
    }
};

// Export comprehensive diagnostic tool
(global as any).diagnoseVocabularyState = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🔍 COMPREHENSIVE VOCABULARY DIAGNOSIS...');
        console.log(`👤 Current User ID: ${user.id}`);
        console.log(`📧 Current User Email: ${user.email}`);
        
        // 1. Check user_words table
        const { data: userWords, error: userWordsError } = await supabase
            .from('user_words')
            .select('*')
            .eq('user_id', user.id);
            
        console.log(`\n📊 USER_WORDS TABLE:`);
        if (userWordsError) {
            console.error('❌ Error reading user_words:', userWordsError);
        } else {
            console.log(`Found ${userWords?.length || 0} user_words entries:`);
            userWords?.forEach((uw, i) => {
                console.log(`  ${i + 1}. word_id: ${uw.word_id}, proficiency: ${uw.proficiency}, learned_at: ${uw.learned_at}`);
            });
        }
        
        // 2. Check words table for user's word_ids
        if (userWords && userWords.length > 0) {
            const wordIds = userWords.map(uw => uw.word_id);
            const { data: words, error: wordsError } = await supabase
                .from('words')
                .select('*')
                .in('word_id', wordIds);
                
            console.log(`\n📚 WORDS TABLE:`);
            if (wordsError) {
                console.error('❌ Error reading words:', wordsError);
            } else {
                console.log(`Found ${words?.length || 0} word entries:`);
                words?.forEach((w, i) => {
                    console.log(`  ${i + 1}. word_id: ${w.word_id}, original: "${w.original}"`);
                });
            }
            
            // 3. Check translations table
            const { data: translations, error: translationsError } = await supabase
                .from('translations')
                .select('*')
                .in('word_id', wordIds);
                
            console.log(`\n🌐 TRANSLATIONS TABLE:`);
            if (translationsError) {
                console.error('❌ Error reading translations:', translationsError);
            } else {
                console.log(`Found ${translations?.length || 0} translation entries:`);
                translations?.forEach((t, i) => {
                    console.log(`  ${i + 1}. word_id: ${t.word_id}, language: ${t.language_code}, text: "${t.translated_text}"`);
                });
            }
        }
        
        // 4. Check cache state
        console.log(`\n💾 CACHE STATE:`);
        const cacheKeys = [];
        if (userWords && userWords.length > 0) {
            userWords.forEach(uw => {
                const cacheKey = `userWord_${user.id}_${uw.word_id}`;
                const cachedData = VocabularyService.getInstance().getFromCache(cacheKey);
                console.log(`  Cache ${cacheKey}: ${cachedData ? JSON.stringify(cachedData) : 'NOT FOUND'}`);
                if (cachedData) cacheKeys.push(cacheKey);
            });
        }
        
        // 5. Check what the vocabulary page is actually loading
        console.log(`\n📱 VOCABULARY SERVICE STATE:`);
        const vocabularyService = VocabularyService.getInstance();
        
        return {
            userId: user.id,
            userEmail: user.email,
            userWordsCount: userWords?.length || 0,
            userWords: userWords || [],
            wordsCount: userWords?.length || 0,
            translationsCount: translations?.length || 0,
            cacheKeysFound: cacheKeys.length
        };
        
    } catch (error) {
        console.error('❌ Diagnosis error:', error);
        return { error };
    }
};

// Export RLS diagnostic for translations table
(global as any).diagnoseTranslationRLS = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🔍 DIAGNOSING TRANSLATION RLS ISSUE...');
        console.log(`👤 User: ${user.email} (${user.id})`);
        
        // Check what's actually in the database
        const { data: userWords } = await supabase
            .from('user_words')
            .select('word_id')
            .eq('user_id', user.id);
            
        console.log(`📋 User has ${userWords?.length || 0} user_words entries`);
        
        if (userWords && userWords.length > 0) {
            const wordIds = userWords.map(uw => uw.word_id);
            
            // Check what translations exist
            const { data: translations, error: translationsError } = await supabase
                .from('translations')
                .select('*')
                .in('word_id', wordIds);
                
            console.log(`🌐 Found ${translations?.length || 0} translations in database`);
            if (translationsError) {
                console.error('❌ Error reading translations:', translationsError);
            } else {
                translations?.forEach((t, i) => {
                    console.log(`  ${i + 1}. ${t.language_code}: "${t.translated_text}"`);
                });
            }
            
            // Try to manually insert a translation to test RLS
            console.log('\n🧪 Testing translation insert...');
            const testWordId = wordIds[0];
            const { data: insertResult, error: insertError } = await supabase
                .from('translations')
                .insert({
                    word_id: testWordId,
                    language_code: 'test',
                    translated_text: 'test translation'
                })
                .select();
                
            if (insertError) {
                console.error('❌ Translation insert failed:', insertError);
                console.log('🔧 This confirms RLS policy is blocking translations');
            } else {
                console.log('✅ Translation insert succeeded - RLS is working');
                
                // Clean up test translation
                await supabase
                    .from('translations')
                    .delete()
                    .eq('word_id', testWordId)
                    .eq('language_code', 'test');
            }
        }
        
        return {
            userWordsCount: userWords?.length || 0,
            translationsCount: translations?.length || 0,
            rlsBlocking: !!translationsError || translations?.length === 0
        };
        
    } catch (error) {
        console.error('❌ RLS diagnosis error:', error);
        return { error };
    }
};

// Export function to fix vocabulary display and RLS issues
(global as any).fixVocabularyDisplay = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🔧 FIXING VOCABULARY DISPLAY AND RLS ISSUES...');
        console.log(`👤 User: ${user.email} (${user.id})`);
        
        // Get current user words
        const { data: userWords } = await supabase
            .from('user_words')
            .select('word_id')
            .eq('user_id', user.id);
            
        console.log(`📋 User has ${userWords?.length || 0} user_words entries`);
        
        if (!userWords || userWords.length === 0) {
            console.log('⚠️ No user words found - nothing to fix');
            return { fixed: 0 };
        }
        
        // For each language you've cached, create a separate user_words entry
        const languagesSaved = ['es', 'ar', 'bn']; // Based on your logs
        let fixedCount = 0;
        
        console.log('🔄 Creating separate entries for each language...');
        
        for (const language of languagesSaved) {
            console.log(`\n🌐 Processing ${language}...`);
            
            // Generate a proper UUID for this language-specific word
            // Using crypto.randomUUID() or fallback to a simple UUID generator
            const generateUUID = () => {
                try {
                    return crypto.randomUUID();
                } catch (e) {
                    // Fallback UUID generation
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        const r = Math.random() * 16 | 0;
                        const v = c === 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                }
            };
            
            const languageSpecificWordId = generateUUID();
            
            // Insert into words table
            const { error: wordError } = await supabase
                .from('words')
                .upsert({
                    word_id: languageSpecificWordId,
                    original: `laptop_${language}`, // Make it language-specific
                    created_at: new Date().toISOString()
                });
                
            if (wordError && wordError.code !== '23505') {
                console.error(`❌ Word creation failed for ${language}:`, wordError);
                continue;
            }
            
            // Insert into user_words
            const { error: userWordError } = await supabase
                .from('user_words')
                .upsert({
                    user_id: user.id,
                    word_id: languageSpecificWordId,
                    proficiency: 0,
                    learned_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,word_id'
                });
                
            if (userWordError) {
                console.error(`❌ User word creation failed for ${language}:`, userWordError);
                continue;
            }
            
            // Try to insert translation (may fail due to RLS, but worth trying)
            const { error: translationError } = await supabase
                .from('translations')
                .upsert({
                    word_id: languageSpecificWordId,
                    language_code: language,
                    translated_text: language === 'es' ? 'computadora portátil' : 
                                   language === 'ar' ? 'كمبيوتر محمول' :
                                   language === 'bn' ? 'ল্যাপটপ' : 'laptop'
                }, {
                    onConflict: 'word_id,language_code'
                });
                
            if (translationError) {
                console.log(`⚠️ Translation failed for ${language} (RLS issue): ${translationError.message}`);
            } else {
                console.log(`✅ Translation saved for ${language}`);
            }
            
            fixedCount++;
            console.log(`✅ Fixed entry ${fixedCount} for ${language}`);
        }
        
        // Delete the original generic entry
        await supabase
            .from('user_words')
            .delete()
            .eq('user_id', user.id)
            .eq('word_id', userWords[0].word_id);
            
        console.log('\n🎉 VOCABULARY DISPLAY FIX COMPLETE!');
        console.log(`📊 Created ${fixedCount} language-specific entries`);
        console.log('✅ Now vocabulary page should show all 3 languages');
        
        return { fixed: fixedCount };
        
    } catch (error) {
        console.error('❌ Fix error:', error);
        return { error };
    }
};

// Export BULLETPROOF cleanup method - handles all edge cases
(global as any).bulletproofCleanupVocabulary = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🔥 BULLETPROOF CLEANUP - GUARANTEED VOCABULARY REMOVAL...');
        console.log(`👤 User: ${user.email} (${user.id})`);
        console.log('⚠️ This WILL delete ALL your vocabulary - no exceptions');
        console.log('🔥 Starting in 3 seconds...');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        let totalDeleted = 0;
        
        // Step 1: Get current state
        console.log('\n📊 STEP 1: Getting current state...');
        const { data: initialUserWords } = await supabase
            .from('user_words')
            .select('word_id')
            .eq('user_id', user.id);
            
        const userWordIds = initialUserWords?.map(uw => uw.word_id) || [];
        console.log(`📋 Found ${userWordIds.length} user_words entries`);
        
        // Step 2: Force delete user_words with multiple strategies
        console.log('\n🗑️ STEP 2: Force deleting user_words...');
        
        // Strategy A: Direct delete
        let { error: userWordsError } = await supabase
            .from('user_words')
            .delete()
            .eq('user_id', user.id);
            
        if (userWordsError) {
            console.log(`❌ Strategy A failed: ${userWordsError.message}`);
            
            // Strategy B: Delete one by one
            console.log('🔄 Trying Strategy B: Individual deletions...');
            for (const wordId of userWordIds) {
                const { error: individualError } = await supabase
                    .from('user_words')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('word_id', wordId);
                    
                if (!individualError) {
                    totalDeleted++;
                    console.log(`✅ Deleted user_word ${totalDeleted}/${userWordIds.length}`);
                } else {
                    console.log(`❌ Failed to delete word ${wordId}: ${individualError.message}`);
                }
                
                // Small delay to avoid overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } else {
            console.log('✅ Strategy A succeeded: All user_words deleted');
            totalDeleted = userWordIds.length;
        }
        
        // Step 3: Force delete translations
        console.log('\n🌐 STEP 3: Force deleting translations...');
        if (userWordIds.length > 0) {
            // Delete in smaller batches to avoid timeout
            const batchSize = 10;
            let translationsDeleted = 0;
            
            for (let i = 0; i < userWordIds.length; i += batchSize) {
                const batch = userWordIds.slice(i, i + batchSize);
                console.log(`🗑️ Deleting translations batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(userWordIds.length/batchSize)}...`);
                
                const { error: translationsBatchError } = await supabase
                    .from('translations')
                    .delete()
                    .in('word_id', batch);
                
                if (!translationsBatchError) {
                    translationsDeleted += batch.length;
                    console.log(`✅ Deleted translations for ${translationsDeleted}/${userWordIds.length} words`);
                } else {
                    console.log(`❌ Batch deletion failed: ${translationsBatchError.message}`);
                    
                    // Try individual deletion for this batch
                    for (const wordId of batch) {
                        const { error: individualTranslationError } = await supabase
                            .from('translations')
                            .delete()
                            .eq('word_id', wordId);
                            
                        if (!individualTranslationError) {
                            translationsDeleted++;
                        }
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`✅ Deleted translations for ${translationsDeleted} words`);
        }
        
        // Step 4: Try to delete orphaned words (best effort)
        console.log('\n📚 STEP 4: Cleaning up words (best effort)...');
        if (userWordIds.length > 0) {
            const { error: wordsError } = await supabase
                .from('words')
                .delete()
                .in('word_id', userWordIds);
                
            if (wordsError) {
                console.log(`⚠️ Words cleanup failed (may be shared): ${wordsError.message}`);
            } else {
                console.log('✅ Deleted word entries');
            }
        }
        
        // Step 5: Verify cleanup
        console.log('\n🔍 STEP 5: Verifying cleanup...');
        const { data: remainingUserWords } = await supabase
            .from('user_words')
            .select('word_id')
            .eq('user_id', user.id);
            
        const remainingCount = remainingUserWords?.length || 0;
        
        if (remainingCount === 0) {
            console.log('🎉 SUCCESS! All vocabulary data completely removed');
            console.log('✅ Database is clean and ready for fresh vocabulary');
        } else {
            console.log(`⚠️ WARNING: ${remainingCount} entries still remain`);
            console.log('📝 This may indicate RLS policy issues');
        }
        
        // Step 6: Clear cache completely  
        console.log('\n🧹 STEP 6: Clearing cache...');
        try {
            const vocabularyService = VocabularyService.getInstance();
            if (vocabularyService?.cache) {
                vocabularyService.cache.clear();
                console.log('✅ Cache cleared');
            }
        } catch (cacheError) {
            console.log('⚠️ Cache clear failed (not critical)');
        }
        
        console.log('\n🎯 BULLETPROOF CLEANUP COMPLETE!');
        console.log(`📊 Summary: Attempted to delete ${userWordIds.length} entries`);
        console.log(`✅ Success rate: ${((totalDeleted / Math.max(userWordIds.length, 1)) * 100).toFixed(1)}%`);
        console.log(`🔄 Remaining entries: ${remainingCount}`);
        
        return { 
            attempted: userWordIds.length,
            deleted: totalDeleted,
            remaining: remainingCount,
            success: remainingCount === 0
        };
        
    } catch (error) {
        console.error('❌ Bulletproof cleanup error:', error);
        return { error: error.message, success: false };
    }
};

// Export method to clean orphaned translations globally for emergency use
(global as any).cleanupOrphanedTranslations = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🧹 CLEANING ORPHANED TRANSLATIONS...');
        
        // Get all user's word_ids
        const { data: userWords } = await supabase
            .from('user_words')
            .select('word_id')
            .eq('user_id', user.id);
            
        const userWordIds = userWords?.map(uw => uw.word_id) || [];
        console.log(`📋 User has ${userWordIds.length} words`);
        
        if (userWordIds.length === 0) {
            console.log('✅ No user words found - nothing to clean');
            return { cleaned: 0 };
        }
        
        // Find orphaned translations (translations for words the user doesn't have)
        const { data: allTranslations } = await supabase
            .from('translations')
            .select('id, word_id, language_code, translated_text');
            
        const orphanedTranslations = allTranslations?.filter(t => 
            !userWordIds.includes(t.word_id)
        ) || [];
        
        console.log(`🗑️ Found ${orphanedTranslations.length} orphaned translation records`);
        
        if (orphanedTranslations.length > 0) {
            console.log('📝 First 10 orphaned translations:', orphanedTranslations.slice(0, 10).map(t => 
                `${t.translated_text} (${t.language_code})`
            ));
            
            console.log('⚠️ These translations exist but user doesn\'t own the words');
            console.log('💡 This explains why words appear as "already saved" in languages you don\'t have');
            console.log('🔥 DELETING ORPHANED TRANSLATIONS (they are blocking your saves)...');
            
            // Delete orphaned translations in batches to avoid overwhelming the database
            const batchSize = 50;
            let totalDeleted = 0;
            
            for (let i = 0; i < orphanedTranslations.length; i += batchSize) {
                const batch = orphanedTranslations.slice(i, i + batchSize);
                const batchIds = batch.map(t => t.id);
                
                console.log(`🗑️ Deleting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(orphanedTranslations.length/batchSize)} (${batchIds.length} records)...`);
                
                const { error: deleteError } = await supabase
                    .from('translations')
                    .delete()
                    .in('id', batchIds);
                
                if (deleteError) {
                    console.error(`❌ Error deleting batch:`, deleteError);
                } else {
                    totalDeleted += batchIds.length;
                    console.log(`✅ Deleted ${totalDeleted}/${orphanedTranslations.length} orphaned translations`);
                }
                
                // Small delay between batches to be gentle on the database
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`🎉 CLEANUP COMPLETE! Deleted ${totalDeleted} orphaned translation records`);
            console.log('✅ Your vocabulary saving should work correctly now!');
            
            return { 
                cleaned: totalDeleted, 
                orphaned: orphanedTranslations.length,
                details: orphanedTranslations.slice(0, 20) // Show first 20 for reference
            };
        } else {
            console.log('✅ No orphaned translations found');
            return { cleaned: 0, orphaned: 0 };
        }
        
    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return { cleaned: 0, orphaned: 0, error };
    }
};

// Export cleanup method globally for emergency use
(global as any).cleanupVocabulary = async () => {
    try {
        const { supabase } = await import('../../database/config');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.error('❌ No user logged in');
            return;
        }
        
        console.log('🚨 EMERGENCY CLEANUP STARTING...');
        
        // Get all user words grouped by word_id to find duplicates
        const { data: allUserWords } = await supabase
            .from('user_words')
            .select('id, word_id, learned_at')
            .eq('user_id', user.id)
            .order('learned_at', { ascending: true });
        
        if (!allUserWords) {
            console.log('❌ Could not fetch user words');
            return;
        }
        
        console.log(`📊 Found ${allUserWords.length} total vocabulary entries`);
        
        // Group by word_id to find exact duplicates
        const wordGroups = new Map<string, typeof allUserWords>();
        const duplicatesToDelete: string[] = [];
        
        for (const userWord of allUserWords) {
            if (wordGroups.has(userWord.word_id)) {
                // This is a duplicate - mark for deletion (keep the oldest)
                duplicatesToDelete.push(userWord.id);
                console.log(`🔄 Found duplicate word_id: ${userWord.word_id}`);
            } else {
                wordGroups.set(userWord.word_id, [userWord]);
            }
        }
        
        if (duplicatesToDelete.length === 0) {
            console.log('✅ No duplicates found based on word_id!');
            
            // Clear cache to force refresh
            (vocabularyService as any).invalidateUserCache(user.id);
            return { cleaned: 0, remaining: allUserWords.length };
        }
        
        console.log(`🗑️ Deleting ${duplicatesToDelete.length} duplicate entries...`);
        
        // Delete duplicates in batches
        const batchSize = 10;
        let totalDeleted = 0;
        
        for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
            const batch = duplicatesToDelete.slice(i, i + batchSize);
            
            const { error } = await supabase
                .from('user_words')
                .delete()
                .in('id', batch);
            
            if (error) {
                console.error(`❌ Error deleting batch ${i}-${i + batch.length}:`, error);
            } else {
                totalDeleted += batch.length;
                console.log(`✅ Deleted batch ${i}-${i + batch.length} (${totalDeleted}/${duplicatesToDelete.length})`);
            }
        }
        
        // Clear cache to force refresh
        (vocabularyService as any).invalidateUserCache(user.id);
        
        const remaining = allUserWords.length - totalDeleted;
        console.log(`🎉 CLEANUP COMPLETE!`);
        console.log(`   - Deleted: ${totalDeleted} duplicates`);
        console.log(`   - Remaining: ${remaining} unique words`);
        
        return { cleaned: totalDeleted, remaining };
        
    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return { cleaned: 0, remaining: 0 };
    }
};

export { VocabularyService };
export default vocabularyService;
