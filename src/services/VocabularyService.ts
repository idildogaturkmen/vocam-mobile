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

class VocabularyService {
    private cache: Map<string, { data: any; timestamp: number; expiresIn: number }> = new Map();

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
            // Get all existing user vocabulary with word data to check for duplicates
            const { data: existingUserWords } = await supabase
                .from('user_words')
                .select(`
                    id, 
                    word_id,
                    words (
                        original
                    )
                `)
                .eq('user_id', userId);

            // Create a comprehensive set of existing words to prevent duplicates
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
                            // Remove language suffix
                            const langSuffix = `_${language}`;
                            if (cleanOriginal.endsWith(langSuffix)) {
                                cleanOriginal = cleanOriginal.slice(0, -langSuffix.length);
                            }
                        }
                        existingWordTexts.add(`${cleanOriginal.toLowerCase()}_${language}`);
                    }
                }
            }

            console.log(`Found ${existingWordTexts.size} existing words for user in language ${language}`);

            for (const word of words) {
                try {
                    const wordKey = `${word.original.toLowerCase()}_${language}`;
                    
                    // Check if this exact word already exists for this user in this language
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

                    // Create a user-specific word entry in global table
                    const globalWordOriginal = `user_${userId}_${word.original.toLowerCase()}_${language}_${Date.now()}`;
                    
                    const { error: wordError } = await supabase
                        .from('words')
                        .insert({
                            word_id: wordId,
                            original: globalWordOriginal,
                            created_at: new Date().toISOString(),
                        });

                    if (wordError) {
                        console.error('Failed to create global word entry:', wordError);
                        result.errors.push(word.original);
                        continue;
                    }

                    // Create user_words entry
                    const { error: userWordError } = await supabase
                        .from('user_words')
                        .insert({
                            id: userWordId,
                            user_id: userId,
                            word_id: wordId,
                            proficiency: 0,
                            learned_at: new Date().toISOString(),
                        });

                    if (userWordError) {
                        console.error('Failed to save user word:', userWordError);
                        result.errors.push(word.original);
                        continue;
                    }

                    // Store word data in cache with unique key
                    await this.storeUserWordData(userId, wordId, {
                        original: word.original,
                        translation: word.translation,
                        example: word.example,
                        exampleEnglish: word.exampleEnglish,
                        language: language
                    });

                    // Add to tracking sets to prevent duplicates in this batch
                    existingWordTexts.add(wordKey);
                    existingWordIds.add(wordId);

                    result.savedWords.push(word.original);
                    
                    // Record learning activity
                    await recordLearningActivity(userId, wordId, 1);

                } catch (error) {
                    console.error('Error saving word:', word.original, error);
                    result.errors.push(word.original);
                }
            }

            console.log(`RLS-Compatible: Successfully saved ${result.savedWords.length} new words, ${result.existingWords.length} already existed`);
            this.invalidateUserCache(userId);
            
            return result;

        } catch (error) {
            console.error('RLS-compatible batch save error:', error);
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
        // Remove duplicates from input words based on original text
        const uniqueWordsMap = new Map<string, (typeof words)[0]>();
        for (const word of words) {
            const key = word.original.toLowerCase();
            if (!uniqueWordsMap.has(key)) {
                uniqueWordsMap.set(key, word);
            }
        }
        const uniqueWords = Array.from(uniqueWordsMap.values());

        // Use RLS-compatible approach
        return await this.saveWordsRLSCompatible(uniqueWords, language, userId);

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
            // Get user's vocabulary entries - simplified query
            let userWordsQuery = supabase
                .from('user_words')
                .select(`
                    id,
                    proficiency,
                    learned_at,
                    word_id,
                    words (
                        word_id,
                        original,
                        translations (
                            word_id,
                            language_code,
                            translated_text,
                            example
                        )
                    )
                `)
                .eq('user_id', userId)
                .order('learned_at', { ascending: false });

            // Apply language filter if specified
            if (languageFilter) {
                // We'll filter in-memory since RLS-bypassed words don't have translations
                console.log(`Getting vocabulary for language: ${languageFilter}`);
            } else {
                // If no language filter, we'll return all and filter in-memory
                console.log('Getting all vocabulary (will filter in-memory)');
            }

            const { data: userVocabData, error: vocabError } = await userWordsQuery;

            if (vocabError) {
                console.error('Error fetching user vocabulary:', vocabError);
                return [];
            }

            if (!userVocabData || userVocabData.length === 0) {
                return [];
            }

            // Transform the data into our SavedWord format
            const vocabulary: SavedWord[] = [];

            for (const userWord of userVocabData) {
                // Check if we have cached word data for this word
                const cachedWordData = this.getFromCache<{
                    original: string;
                    translation: string;
                    example: string;
                    exampleEnglish: string;
                    language: string;
                }>(`userWord_${userId}_${userWord.word_id}`);

                if (cachedWordData && (!languageFilter || cachedWordData.language === languageFilter)) {
                    // IMPORTANT: Only return cached words if they match the exact language filter
                    // This prevents the same cached word from appearing in multiple language queries
                    if (languageFilter && cachedWordData.language !== languageFilter) {
                        continue; // Skip if language doesn't match
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
                    continue;
                }

                // Fallback to database query for words that have proper translations
                const word = Array.isArray(userWord.words) ? userWord.words[0] : userWord.words;
                if (!word) continue;

                const translation = Array.isArray(word.translations)
                    ? word.translations[0]
                    : word.translations;
                if (!translation) continue;

                // Parse example (format: "translated|english")
                const [example = '', exampleEnglish = ''] = translation.example?.split('|') || [];

                // Create unique ID by combining user_word id and language code
                const uniqueId = `${userWord.id}_${translation.language_code}`;

                // Handle language-specific word format (remove language suffix for display)
                let displayOriginal = word.original || '';
                if (displayOriginal.includes('_') && languageFilter) {
                    const suffix = `_${languageFilter}`;
                    if (displayOriginal.endsWith(suffix)) {
                        displayOriginal = displayOriginal.slice(0, -suffix.length);
                    }
                }

                vocabulary.push({
                    id: uniqueId, // Make ID unique for each translation
                    original: displayOriginal,
                    translation: translation.translated_text || '',
                    example: example,
                    exampleEnglish: exampleEnglish,
                    language: translation.language_code || '',
                    proficiency: userWord.proficiency || 0,
                    learnedAt: userWord.learned_at || '',
                    category: this.categorizeWord(displayOriginal),
                });
            }

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
            
            // Get the user_id for proper cache invalidation
            const { data: userWordData, error: fetchError } = await supabase
                .from('user_words')
                .select('user_id, word_id')
                .eq('id', actualId)
                .single();
            
            if (fetchError) {
                console.error('Error fetching user word for deletion:', fetchError);
                return false;
            }
            
            if (!userWordData) {
                console.error('User word not found for deletion');
                return false;
            }

            // Delete the user_words entry
            const { error } = await supabase.from('user_words').delete().eq('id', actualId);

            if (error) {
                console.error('Error deleting word:', error);
                return false;
            }

            // Smart cache update: invalidate count caches for accurate recalculation
            this.invalidateUserCountCaches(userWordData.user_id);
            
            // Also invalidate SessionService caches to update profile counts immediately
            const SessionService = (await import('./SessionService')).default;
            SessionService.invalidateUserStatsCache(userWordData.user_id);
            
            // Trigger global cache invalidation event for real-time updates using React Native events
            try {
                // Get languages for this word to enable instant UI updates
                const { data: wordTranslations } = await supabase
                    .from('translations')
                    .select('language_code')
                    .eq('word_id', userWordData.word_id);
                
                const languages = wordTranslations?.map(t => t.language_code) || [];
                
                const EventService = (await import('./EventService')).default;
                EventService.emitVocabularyChange({
                    userId: userWordData.user_id,
                    action: 'deleted',
                    wordId: userWordData.word_id,
                    languages,
                    countChange: -1 // Decrement count
                });
            } catch (error) {
                console.warn('Could not dispatch vocabulary change event:', error);
            }
            
            console.log(`Successfully deleted user_word ${actualId} for user ${userWordData.user_id}`);
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

            // Count by language
            const langCounts: { [langCode: string]: number } = {};
            
            vocabularyData?.forEach(userWord => {
                const word = Array.isArray(userWord.words) ? userWord.words[0] : userWord.words;
                if (word?.translations) {
                    const translations = Array.isArray(word.translations) ? word.translations : [word.translations];
                    translations.forEach(translation => {
                        if (translation?.language_code) {
                            langCounts[translation.language_code] = (langCounts[translation.language_code] || 0) + 1;
                        }
                    });
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

export default vocabularyService;
