import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    View, 
    Text, 
    ScrollView, 
    TouchableOpacity, 
    StyleSheet, 
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    Animated,
    Dimensions,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, normalizeFont } from '../../utils/normalize';
import { supabase } from '../../database/config';
import VocabularyService, { VocabularyService as VocabularyServiceClass, SavedWord, setVocabularyUpdateCallback } from '../../src/services/VocabularyService';
import { useCache, CacheKeys } from '../../src/services/CacheService';

// Type definitions removed - no longer needed with simplified queries
import SpeechService from '../../src/services/SpeechService';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

// Define language mapping with proper typing - NOW SORTED ALPHABETICALLY
const languages: Record<string, string> = {
    'Arabic': 'ar',
    'Bengali': 'bn',
    'Bulgarian': 'bg',
    'Chinese (Simplified)': 'zh-CN',
    'Chinese (Traditional)': 'zh-TW',
    'Croatian': 'hr',
    'Czech': 'cs',
    'Danish': 'da',
    'Dutch': 'nl',
    'Filipino': 'tl',
    'Finnish': 'fi',
    'French': 'fr',
    'German': 'de',
    'Greek': 'el',
    'Gujarati': 'gu',
    'Hebrew': 'he',
    'Hindi': 'hi',
    'Hungarian': 'hu',
    'Icelandic': 'is',
    'Indonesian': 'id',
    'Italian': 'it',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Latin': 'la',
    'Malay': 'ms',
    'Norwegian': 'no',
    'Persian (Farsi)': 'fa',
    'Polish': 'pl',
    'Portuguese': 'pt',
    'Punjabi': 'pa',
    'Romanian': 'ro',
    'Russian': 'ru',
    'Serbian': 'sr',
    'Slovak': 'sk',
    'Spanish': 'es',
    'Swahili': 'sw',
    'Swedish': 'sv',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Thai': 'th',
    'Turkish': 'tr',
    'Ukrainian': 'uk',
    'Urdu': 'ur',
    'Vietnamese': 'vi'
};

// Type for language keys
type LanguageName = keyof typeof languages;
type ViewMode = 'cards' | 'flashcard';

export default function VocabularyScreen() {
    const [vocabulary, setVocabulary] = useState<SavedWord[]>([]);
    const [filteredVocabulary, setFilteredVocabulary] = useState<SavedWord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLanguage, setFilterLanguage] = useState<string>('All');
    const [sortBy, setSortBy] = useState<string>('newest');
    const [showLanguageFilter, setShowLanguageFilter] = useState(false);
    const [showSortFilter, setShowSortFilter] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<ViewMode>('cards');
    const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
    const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
    const [languageSearchQuery, setLanguageSearchQuery] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const router = useRouter();

    // Use the cache service for request deduplication and performance
    const { fetchCached, invalidateCache } = useCache();

    // Helper function - moved before useMemo that uses it
    const getLanguageName = (code: string): string => {
        const entry = Object.entries(languages).find(([_, c]) => c === code);
        return entry ? entry[0] : code;
    };

    // Get sorted language list for the user
    const [userLanguages, setUserLanguages] = useState<string[]>([]);
    const [allLanguages, setAllLanguages] = useState<string[]>([]);

    // Initialize languages
    useEffect(() => {
        const sorted = Object.keys(languages).sort((a, b) => a.localeCompare(b));
        setAllLanguages(sorted);
    }, []);

    // Get languages to show in the filter
    const sortedLanguages = useMemo(() => {
        return filterLanguage === 'All' ? userLanguages : allLanguages;
    }, [userLanguages, allLanguages, filterLanguage]);

    // Filter languages based on search
    const filteredLanguages = useMemo(() => {
        if (!languageSearchQuery.trim()) return sortedLanguages;
        
        const query = languageSearchQuery.toLowerCase();
        return sortedLanguages.filter(lang => 
            lang.toLowerCase().includes(query)
        );
    }, [languageSearchQuery, sortedLanguages]);

    useEffect(() => {
        // Set up callback for vocabulary updates
        const handleVocabularyUpdate = async () => {
            await invalidateLanguagesCache();
            await invalidateVocabularyCache();
            // Clear vocabulary state first to show loading, then reload
            setVocabulary([]);
            loadVocabulary(true); // Force refresh when new words are saved
        };
        
        setVocabularyUpdateCallback(handleVocabularyUpdate);
        checkAuthAndLoadVocabulary();
        
        // Cleanup callback on unmount
        return () => {
            setVocabularyUpdateCallback(null);
        };
    }, []);

    const checkAuthAndLoadVocabulary = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsAuthenticated(false);
                setLoading(false);
                return;
            }
            
            setIsAuthenticated(true);
            await loadVocabulary(false);
            // Update user languages after loading vocabulary once
            await updateUserLanguages(user.id);
        } catch (error) {
            console.error('Auth check error:', error);
            setIsAuthenticated(false);
            setLoading(false);
        }
    };

    const updateUserLanguages = async (userId: string) => {
        try {
            const userLangs = await getUserLanguages(userId);
            const langNames = userLangs
                .map(code => {
                    const entry = Object.entries(languages).find(([_, c]) => c === code);
                    return entry ? entry[0] : null;
                })
                .filter(Boolean) as string[];
            setUserLanguages(langNames.sort((a, b) => a.localeCompare(b)));
        } catch (error) {
            console.error('Error updating user languages:', error);
        }
    };

    useEffect(() => {
        applyFiltersAndSort();
    }, [vocabulary, sortBy, searchQuery]);

    // Only reload vocabulary when language filter changes (not on initial auth)
    useEffect(() => {
        if (isAuthenticated && filterLanguage !== 'All') {
            loadVocabulary(false);
        }
    }, [filterLanguage]);

    // Cache invalidation helpers
    const invalidateLanguagesCache = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            invalidateCache(CacheKeys.userLanguages(user.id));
        }
    };

    const invalidateVocabularyCache = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            invalidateCache(CacheKeys.vocabulary(user.id, filterLanguage));
        }
    };

    // Get all languages that the user has words in
    const getUserLanguages = async (userId: string): Promise<string[]> => {
        return fetchCached(
            CacheKeys.userLanguages(userId),
            async () => {
                try {
                    // Get word_ids for user
                    const { data: userWords, error: userWordsError } = await supabase
                        .from('user_words')
                        .select('word_id')
                        .eq('user_id', userId);
                    
                    if (userWordsError) {
                        console.error('Error fetching user words for languages:', userWordsError);
                        return [];
                    }
                    
                    if (!userWords || userWords.length === 0) {
                        return [];
                    }
                    
                    const languageCodes = new Set<string>();
                    
                    // 1. Get languages from translations table (database words)
                    const wordIds = userWords.map(uw => uw.word_id);
                    const { data: translations } = await supabase
                        .from('translations')
                        .select('language_code')
                        .in('word_id', wordIds);
                    
                    if (translations) {
                        translations.forEach(t => {
                            if (t.language_code) {
                                languageCodes.add(t.language_code);
                            }
                        });
                    }
                    
                    // 2. Get languages from cached words (RLS-compatible words)
                    for (const userWord of userWords) {
                        const cacheKey = `userWord_${userId}_${userWord.word_id}`;
                        try {
                            const cachedWordData = VocabularyServiceClass.getFromGlobalCache<{
                                original: string;
                                translation: string;
                                example: string;
                                exampleEnglish: string;
                                language: string;
                            }>(cacheKey);
                            if (cachedWordData && cachedWordData.language) {
                                languageCodes.add(cachedWordData.language);
                            }
                        } catch (cacheError) {
                            // Skip individual cache errors and continue
                            continue;
                        }
                    }
                    
                    return Array.from(languageCodes);
                } catch (error) {
                    console.error('Error getting user languages:', error);
                    return [];
                }
            },
            'USER_STATS' // Use existing cache config
        );
    };

    const loadVocabulary = async (forceRefresh = false) => {
        try {
            // Only show loading indicator if we're not already loading and this isn't a background refresh
            if (!refreshing && !forceRefresh) {
                setLoading(true);
            }
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'Please log in to view your vocabulary');
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const words = await fetchCached(
                CacheKeys.vocabulary(user.id, filterLanguage),
                async () => {
                    let vocabularyWords: SavedWord[] = [];
                    if (filterLanguage === 'All') {
                        // Load all vocabulary at once (much more efficient)
                        vocabularyWords = await VocabularyService.getUserVocabulary(user.id);
                    } else {
                        // Load only the selected language
                        const langCode = languages[filterLanguage as keyof typeof languages];
                        if (langCode) {
                            vocabularyWords = await VocabularyService.getUserVocabulary(user.id, langCode);
                        } else {
                            console.warn(`No language code found for: ${filterLanguage}`);
                            vocabularyWords = [];
                        }
                    }
                    return vocabularyWords;
                },
                'VOCABULARY',
                forceRefresh
            );

            setVocabulary(words);
        } catch (error) {
            console.error('Error loading vocabulary:', error);
            Alert.alert('Error', 'Failed to load vocabulary');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const applyFiltersAndSort = () => {
        let filtered = [...vocabulary];

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(word => 
                word.original.toLowerCase().includes(query) ||
                word.translation.toLowerCase().includes(query)
            );
        }

        // Language filtering is now handled at the database level in loadVocabulary()
        // No need to filter by language here

        // Apply sorting
        switch (sortBy) {
            case 'newest':
                filtered.sort((a, b) => new Date(b.learnedAt).getTime() - new Date(a.learnedAt).getTime());
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.learnedAt).getTime() - new Date(b.learnedAt).getTime());
                break;
            case 'proficiency-low':
                filtered.sort((a, b) => a.proficiency - b.proficiency);
                break;
            case 'proficiency-high':
                filtered.sort((a, b) => b.proficiency - a.proficiency);
                break;
            case 'alphabetical':
                filtered.sort((a, b) => a.original.localeCompare(b.original));
                break;
        }

        setFilteredVocabulary(filtered);
        
        // Reset flashcard index when filters change
        setCurrentFlashcardIndex(0);
        setShowFlashcardAnswer(false);
    };

    // Get search suggestions
    const searchSuggestions = useMemo(() => {
        if (!searchQuery.trim()) return [];
        
        const query = searchQuery.toLowerCase();
        const suggestions: string[] = [];
        
        // Get unique languages that match
        const matchingLanguages = new Set<string>();
        vocabulary.forEach(word => {
            const langName = getLanguageName(word.language);
            if (langName.toLowerCase().includes(query)) {
                matchingLanguages.add(langName);
            }
        });
        
        matchingLanguages.forEach(lang => {
            suggestions.push(`🌐 ${lang} words`);
        });
        
        // Get unique categories that match
        const matchingCategories = new Set<string>();
        vocabulary.forEach(word => {
            if (word.category && word.category.includes(query)) {
                matchingCategories.add(word.category);
            }
        });
        
        matchingCategories.forEach(cat => {
            suggestions.push(`📁 ${cat.charAt(0).toUpperCase() + cat.slice(1)} category`);
        });
        
        return suggestions.slice(0, 5);
    }, [searchQuery, vocabulary]);

    const handleSearchSuggestion = (suggestion: string) => {
        if (suggestion.includes('🌐')) {
            const lang = suggestion.replace('🌐 ', '').replace(' words', '');
            setFilterLanguage(lang);
            setSearchQuery('');
        } else if (suggestion.includes('📁')) {
            const category = suggestion.replace('📁 ', '').replace(' category', '').toLowerCase();
            setSearchQuery(category);
        }
        setShowSearchSuggestions(false);
    };

    const toggleExpanded = (id: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };

    const handleSpeech = async (text: string, language: string) => {
        try {
            await SpeechService.speak(text, language);
        } catch (error) {
            Alert.alert('Speech Error', 'Unable to play pronunciation');
        }
    };

    const handleDelete = (word: SavedWord) => {
        if (!isAuthenticated) {
            Alert.alert('Login Required', 'Please log in to manage your vocabulary');
            return;
        }

        Alert.alert(
            'Delete Word',
            `Are you sure you want to remove "${word.original}" from your vocabulary?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Immediately remove the word from the UI
                        setVocabulary(prev => prev.filter(v => v.id !== word.id));
                        setFilteredVocabulary(prev => prev.filter(v => v.id !== word.id));
                        
                        try {
                            const success = await VocabularyService.deleteWord(word.id);
                            if (success) {
                                Alert.alert('Success', 'Word removed from vocabulary');
                            } else {
                                // If deletion failed, restore the word to the UI
                                Alert.alert('Error', 'Failed to delete word');
                                loadVocabulary(true); // Reload to restore the word
                            }
                        } catch (error) {
                            // If deletion failed, restore the word to the UI
                            Alert.alert('Error', 'Failed to delete word');
                            loadVocabulary(true); // Reload to restore the word
                        }
                    }
                }
            ]
        );
    };

    const getProficiencyInfo = (level: number) => {
        const clamped = Math.min(Math.max(level, 0), 100); // Ensure between 0-100
        if (clamped >= 80) return { color: '#27ae60', label: 'Expert', icon: 'trophy' };
        if (clamped >= 60) return { color: '#f39c12', label: 'Advanced', icon: 'star' };
        if (clamped >= 40) return { color: '#e67e22', label: 'Intermediate', icon: 'trending-up' };
        if (clamped >= 20) return { color: '#3498db', label: 'Beginner', icon: 'leaf' };
        return { color: '#9b59b6', label: 'Learning', icon: 'flash' };
    };

    const getCategoryColor = (category: string) => {
        const colors = {
            food: '#e74c3c',
            animals: '#2ecc71',
            objects: '#3498db',
            clothing: '#9b59b6',
            nature: '#27ae60',
            transportation: '#e67e22',
            general: '#95a5a6'
        };
        return colors[category as keyof typeof colors] || colors.general;
    };

    // Flashcard navigation
    const nextFlashcard = () => {
        if (currentFlashcardIndex < filteredVocabulary.length - 1) {
            setCurrentFlashcardIndex(currentFlashcardIndex + 1);
            setShowFlashcardAnswer(false);
        } else {
            // Loop back to start
            setCurrentFlashcardIndex(0);
            setShowFlashcardAnswer(false);
        }
    };

    const previousFlashcard = () => {
        if (currentFlashcardIndex > 0) {
            setCurrentFlashcardIndex(currentFlashcardIndex - 1);
            setShowFlashcardAnswer(false);
        } else {
            // Loop to end
            setCurrentFlashcardIndex(filteredVocabulary.length - 1);
            setShowFlashcardAnswer(false);
        }
    };

    const renderVocabularyItem = (word: SavedWord, index: number) => {
        const isExpanded = expandedItems.has(word.id);
        const proficiencyInfo = getProficiencyInfo(word.proficiency);
        const categoryColor = getCategoryColor(word.category || 'general');
        // Create a more unique key by combining word ID and language code
        const uniqueKey = `${word.id}_${word.language}_${index}`;

        return (
            <TouchableOpacity
                key={uniqueKey}
                style={[
                    styles.wordCard,
                    isExpanded && styles.wordCardExpanded
                ]}
                onPress={() => toggleExpanded(word.id)}
                activeOpacity={0.8}
            >
                {/* Main Card Content */}
                <View style={styles.cardHeader}>
                    <View style={styles.wordSection}>
                        <View style={styles.wordRow}>
                            <Text style={styles.originalWord}>{word.original}</Text>
                            <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
                                <Text style={styles.categoryText}>
                                    {(word.category || 'general').charAt(0).toUpperCase() + (word.category || 'general').slice(1)}
                                </Text>
                            </View>
                        </View>
                        
                        <Text style={styles.translatedWord}>{word.translation}</Text>
                        
                        <View style={styles.metaRow}>
                            <View style={styles.languageBadge}>
                                <Text style={styles.languageText}>{getLanguageName(word.language)}</Text>
                            </View>
                            <Text style={styles.dateText}>
                                {new Date(word.learnedAt).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={styles.speakerButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleSpeech(word.translation, word.language);
                            }}
                        >
                            <Ionicons name="volume-high" size={scale(24)} color="#3498db" />
                        </TouchableOpacity>
                        
                        <View style={[styles.proficiencyContainer, { borderColor: proficiencyInfo.color }]}>
                            <View 
                                style={[
                                    styles.proficiencyFill, 
                                    { 
                                        backgroundColor: proficiencyInfo.color,
                                        width: Math.min(word.proficiency, 100) * 1.04, // Use actual pixel calculation
                                        borderTopRightRadius: word.proficiency >= 100 ? 10 : 0,
                                        borderBottomRightRadius: word.proficiency >= 100 ? 10 : 0,
                                    }
                                ]} 
                            />
                            <View style={styles.proficiencyContent}>
                                <View style={styles.proficiencyIconRow}>
                                    <Ionicons 
                                        name={proficiencyInfo.icon as any} 
                                        size={scale(16)} 
                                        color={proficiencyInfo.color} 
                                        style={{ zIndex: 2 }}
                                    />
                                    <Text style={[styles.proficiencyLabel, { color: proficiencyInfo.color }]}>
                                        {Math.min(word.proficiency, 100)}%
                                    </Text>
                                </View>
                                <Text style={[styles.proficiencyLevel, { color: proficiencyInfo.color }]}>
                                    {proficiencyInfo.label}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.expandIndicator}>
                            <Ionicons 
                                name={isExpanded ? "chevron-up" : "chevron-down"} 
                                size={scale(20)} 
                                color="#7f8c8d" 
                            />
                        </View>
                    </View>
                </View>

                {/* Tap to expand hint */}
                {!isExpanded && (
                    <View style={styles.tapHint}>
                        <Text style={styles.tapHintText}><AntDesign name="upcircle" size={scale(15)} color="white" /> Tap to see example & more</Text>
                    </View>
                )}

                {/* Expanded Content */}
                {isExpanded && (
                    <View style={styles.expandedContent}>
                        {word.example && (
                            <View style={styles.exampleSection}>
                                <View style={styles.exampleHeader}>
                                    <Ionicons name="chatbubble-outline" size={scale(18)} color="#3498db" />
                                    <Text style={styles.exampleLabel}>Example Sentence</Text>
                                </View>
                                
                                <View style={styles.exampleContainer}>
                                    <Text style={styles.exampleText}>{word.example}</Text>
                                    <Text style={styles.exampleTranslation}>{word.exampleEnglish}</Text>
                                    
                                    <TouchableOpacity
                                        style={styles.playExampleButton}
                                        onPress={() => handleSpeech(word.example, word.language)}
                                    >
                                        <Ionicons name="play-circle" size={scale(20)} color="#27ae60" />
                                        <Text style={styles.playExampleText}>Play Example</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.practiceButton}
                                onPress={() => {
                                    // Find the index of this word in the filtered vocabulary
                                    const wordIndex = filteredVocabulary.findIndex(w => w.id === word.id);
                                    if (wordIndex !== -1) {
                                        setCurrentFlashcardIndex(wordIndex);
                                    }
                                    setViewMode('flashcard');
                                }}
                            >
                                <Ionicons name="school" size={scale(18)} color="white" />
                                <Text style={styles.practiceButtonText}>Learn</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDelete(word)}
                            >
                                <Ionicons name="trash-outline" size={scale(18)} color="#e74c3c" />
                                <Text style={styles.deleteText}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderFlashcard = () => {
        if (filteredVocabulary.length === 0) return null;
        
        const word = filteredVocabulary[currentFlashcardIndex];
        const proficiencyInfo = getProficiencyInfo(word.proficiency);
        
        return (                    
            <View style={styles.flashcardContainer}>
                <View style={styles.flashcardHeader}>
                    <Text style={styles.flashcardCounter}>
                        {currentFlashcardIndex + 1} / {filteredVocabulary.length}
                    </Text>
                    <View style={[styles.flashcardProficiency, { backgroundColor: proficiencyInfo.color }]}>
                        <Text style={styles.flashcardProficiencyText}>
                            {word.proficiency}% {proficiencyInfo.label}
                        </Text>
                    </View>
                </View>
                
                <TouchableOpacity
                    style={styles.flashcard}
                    onPress={() => setShowFlashcardAnswer(!showFlashcardAnswer)}
                    activeOpacity={0.9}
                >
                    <View style={styles.flashcardContent}>
                        {!showFlashcardAnswer ? (
                            <>
                                <View style={styles.flashcardWordContainer}>
                                    <Text 
                                        style={styles.flashcardTranslation}
                                        numberOfLines={3}
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.6}
                                    >
                                        {word.translation}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.flashcardSpeakerTop}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleSpeech(word.translation, word.language);
                                        }}
                                    >
                                        <Ionicons name="volume-high" size={scale(24)} color="#3498db" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.flashcardLanguage}>{getLanguageName(word.language)}</Text>
                                <Text style={styles.flashcardHint}>Tap to reveal meaning</Text>
                            </>
                        ) : (
                            <>
                                <Text 
                                    style={styles.flashcardWord}
                                    numberOfLines={3}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.6}
                                >
                                    {word.original}
                                </Text>
                                <Text style={styles.flashcardMeaning}>English</Text>
                                {word.example && (
                                    <View style={styles.flashcardExample}>
                                        <View style={styles.exampleContent}>
                                            <View style={styles.exampleTextContainer}>
                                                <Text style={styles.flashcardExampleText}>{word.example}</Text>
                                                <Text style={styles.flashcardExampleEn}>{word.exampleEnglish}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.exampleSpeaker}
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleSpeech(word.example || word.translation, word.language);
                                                }}
                                            >
                                                <Ionicons name="volume-high" size={scale(20)} color="#3498db" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </TouchableOpacity>
                
                <View style={styles.flashcardControls}>
                    <TouchableOpacity
                        style={styles.flashcardButton}
                        onPress={previousFlashcard}
                    >
                        <Ionicons name="arrow-back" size={scale(24)} color="white" />
                        <Text style={styles.flashcardButtonText}>Previous</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[styles.flashcardButton, styles.flashcardButtonPrimary]}
                        onPress={nextFlashcard}
                    >
                        <Text style={styles.flashcardButtonText}>Next</Text>
                        <Ionicons name="arrow-forward" size={scale(24)} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Loading your vocabulary...</Text>
            </View>
        );
    }

    // Show empty state for non-authenticated users
    if (isAuthenticated === false) {
        return (
            <View style={[styles.container, { backgroundColor: 'white' }]}> 
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>My Vocabulary</Text>
                    </View>
                </View>
                
                <View style={styles.authRequiredContainer}>
                    <Ionicons name="information-circle-outline" size={scale(64)} color="#f39c12" />
                    <Text style={styles.authRequiredTitle}>Login Required</Text>
                    <Text style={styles.authRequiredText}>
                        You're browsing without logging in. Your vocabulary won't be saved.
                    </Text>
                    <Text style={styles.authRequiredSubtext}>
                        Login to save words, track progress, and access your vocabulary across devices.
                    </Text>
                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={() => router.replace('/App')}
                    >
                        <Text style={styles.loginButtonText}>Go to Login</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={() => router.replace('/(tabs)/detection')}
                    >
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>My Vocabulary</Text>
                    <Text style={styles.subtitle}>
                        {filteredVocabulary.length} word{filteredVocabulary.length !== 1 ? 's' : ''} 
                        {searchQuery || filterLanguage !== 'All' ? ` (filtered)` : ' learned'}
                    </Text>
                </View>
                
                {/* View Mode Toggle */}
                <View style={styles.viewModeToggle}>
                    <TouchableOpacity
                        style={[styles.viewModeButton, viewMode === 'cards' && styles.viewModeActive]}
                        onPress={() => setViewMode('cards')}
                    >
                        <MaterialCommunityIcons 
                            name="card-text" 
                            size={scale(20)*1.3} 
                            color={viewMode === 'cards' ? 'white' : '#3498db'} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewModeButton, viewMode === 'flashcard' && styles.viewModeActive]}
                        onPress={() => setViewMode('flashcard')}
                    >
                        <FontAwesome5 
                            name="layer-group" 
                            size={scale(16)*1.3} 
                            color={viewMode === 'flashcard' ? 'white' : '#3498db'} 
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Smart Search Bar */}
            <View style={styles.searchSection}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={scale(20)} color="#7f8c8d" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search words, languages, or categories..."
                        placeholderTextColor="#7f8c8d"
                        value={searchQuery}
                        onChangeText={(text) => {
                            setSearchQuery(text);
                            setShowSearchSuggestions(text.length > 0);
                        }}
                        onFocus={() => setShowSearchSuggestions(searchQuery.length > 0)}
                        onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => {
                            setSearchQuery('');
                            setShowSearchSuggestions(false);
                        }}>
                            <Ionicons name="close-circle" size={scale(20)} color="#7f8c8d" />
                        </TouchableOpacity>
                    )}
                </View>
                
                {/* Search Suggestions */}
                {showSearchSuggestions && searchSuggestions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                        {searchSuggestions.map((suggestion, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.suggestionItem}
                                onPress={() => handleSearchSuggestion(suggestion)}
                            >
                                <Text style={styles.suggestionText}>{suggestion}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Filter Row */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterChip, filterLanguage !== 'All' && styles.filterChipActive]}
                    onPress={() => setShowLanguageFilter(true)}
                >
                    <Ionicons name="language" size={scale(18)} color={filterLanguage !== 'All' ? "white" : "#3498db"} />
                    <Text style={[styles.filterChipText, filterLanguage !== 'All' && styles.filterChipTextActive]}>
                        {filterLanguage}
                    </Text>
                    <Ionicons name="chevron-down" size={scale(16)} color={filterLanguage !== 'All' ? "white" : "#3498db"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.filterChip}
                    onPress={() => setShowSortFilter(true)}
                >
                    <Ionicons name="funnel" size={scale(18)} color="#3498db" />
                    <Text style={styles.filterChipText}>Sort</Text>
                    <Ionicons name="chevron-down" size={scale(16)} color="#3498db" />
                </TouchableOpacity>
                
                {(searchQuery || filterLanguage !== 'All') && (
                    <TouchableOpacity
                        style={styles.clearFiltersChip}
                        onPress={() => {
                            setSearchQuery('');
                            setFilterLanguage('All');
                            setShowSearchSuggestions(false);
                        }}
                    >
                        <Ionicons name="close" size={scale(18)} color="#e74c3c" />
                        <Text style={styles.clearFiltersText}>Clear</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Content based on view mode */}
            {viewMode === 'flashcard' ? (
                filteredVocabulary.length > 0 ? renderFlashcard() : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📚</Text>
                        <Text style={styles.emptyTitle}>No words to practice</Text>
                        <Text style={styles.emptyText}>
                            {filterLanguage !== 'All' || searchQuery
                                ? 'Try adjusting your filters'
                                : 'Start learning by using the Camera tab!'}
                        </Text>
                    </View>
                )
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                loadVocabulary(true);
                            }}
                            colors={['#3498db']}
                        />
                    }
                >
                    {filteredVocabulary.length > 0 ? (
                        filteredVocabulary.map((word, index) => renderVocabularyItem(word, index))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📚</Text>
                            <Text style={styles.emptyTitle}>No words yet</Text>
                            <Text style={styles.emptyText}>
                                {filterLanguage !== 'All' || searchQuery
                                    ? 'No words match your search'
                                    : 'Start learning by using the Camera tab!'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Language Filter Modal */}
            <Modal
                visible={showLanguageFilter}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setShowLanguageFilter(false);
                    setLanguageSearchQuery('');
                }}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardAvoidingView}
                    >
                        <Pressable 
                            style={styles.modalContentWrapper}
                            onPress={() => {
                                setShowLanguageFilter(false);
                                setLanguageSearchQuery('');
                            }}
                        >
                            <Pressable 
                                style={styles.modalContent}
                                onPress={(e) => e.stopPropagation()}
                            >
                                <Text style={styles.modalTitle}>Filter by Language</Text>
                                
                                {/* Language Search Bar */}
                                <View style={styles.modalSearchContainer}>
                                    <Ionicons name="search" size={scale(20)} color="#7f8c8d" />
                                    <TextInput
                                        style={styles.modalSearchInput}
                                        placeholder="Search languages..."
                                        value={languageSearchQuery}
                                        onChangeText={setLanguageSearchQuery}
                                        autoFocus
                                    />
                                    {languageSearchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => setLanguageSearchQuery('')}>
                                            <Ionicons name="close-circle" size={scale(20)} color="#7f8c8d" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                
                                <ScrollView 
                                    style={styles.optionsList} 
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={true}
                                >
                                    {/* All option */}
                                    <TouchableOpacity
                                        style={[
                                            styles.optionItem,
                                            filterLanguage === 'All' && styles.optionItemActive
                                        ]}
                                        onPress={() => {
                                            setFilterLanguage('All');
                                            setShowLanguageFilter(false);
                                            setLanguageSearchQuery('');
                                        }}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            filterLanguage === 'All' && styles.optionTextActive
                                        ]}>All Languages</Text>
                                        {filterLanguage === 'All' && (
                                            <Ionicons name="checkmark" size={scale(20)} color="#3498db" />
                                        )}
                                    </TouchableOpacity>
                                    
                                    {/* Filtered languages */}
                                    {filteredLanguages.map(lang => (
                                        <TouchableOpacity
                                            key={lang}
                                            style={[
                                                styles.optionItem,
                                                filterLanguage === lang && styles.optionItemActive
                                            ]}
                                            onPress={() => {
                                                setFilterLanguage(lang);
                                                setShowLanguageFilter(false);
                                                setLanguageSearchQuery('');
                                            }}
                                        >
                                            <Text style={[
                                                styles.optionText,
                                                filterLanguage === lang && styles.optionTextActive
                                            ]}>{lang}</Text>
                                            {filterLanguage === lang && (
                                                <Ionicons name="checkmark" size={scale(20)} color="#3498db" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                    
                                    {filteredLanguages.length === 0 && (
                                        <View style={styles.noResultsContainer}>
                                            <Text style={styles.noResultsText}>No languages found</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            </Pressable>
                        </Pressable>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Sort Filter Modal */}
            <Modal
                visible={showSortFilter}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSortFilter(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardAvoidingView}
                    >
                        <Pressable 
                            style={styles.modalContentWrapper}
                            onPress={() => setShowSortFilter(false)}
                        >
                            <Pressable 
                                style={styles.modalContent}
                                onPress={(e) => e.stopPropagation()}
                            >
                                <Text style={styles.modalTitle}>Sort by</Text>

                                <View style={styles.optionsList}>
                                    {[
                                        { value: 'newest', label: 'Newest First', icon: 'time' },
                                        { value: 'oldest', label: 'Oldest First', icon: 'time-outline' },
                                        { value: 'alphabetical', label: 'Alphabetical', icon: 'text' },
                                        { value: 'proficiency-high', label: 'High Proficiency', icon: 'trending-up' },
                                        { value: 'proficiency-low', label: 'Low Proficiency', icon: 'trending-down' }
                                    ].map(option => (
                                        <TouchableOpacity
                                            key={option.value}
                                            style={[
                                                styles.optionItem,
                                                sortBy === option.value && styles.optionItemActive
                                            ]}
                                            onPress={() => {
                                                setSortBy(option.value);
                                                setShowSortFilter(false);
                                            }}
                                        >
                                            <View style={styles.optionLeft}>
                                                <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={scale(20)} color={sortBy === option.value ? "#3498db" : "#7f8c8d"} />
                                                <Text style={[
                                                    styles.optionText,
                                                    sortBy === option.value && styles.optionTextActive
                                                ]}>{option.label}</Text>
                                            </View>
                                            {sortBy === option.value && (
                                                <Ionicons name="checkmark" size={scale(20)} color="#3498db" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </Pressable>
                        </Pressable>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    loadingText: {
        marginTop: scale(10),
        fontSize: normalizeFont(16),
        color: '#7f8c8d',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingTop: scale(50),
        paddingBottom: scale(20),
        backgroundColor: 'white',
        borderBottomLeftRadius: scale(20),
        borderBottomRightRadius: scale(20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.1,
        shadowRadius: scale(3),
        elevation: 5,
    },
    title: {
        fontSize: normalizeFont(32),
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: scale(5),
    },
    subtitle: {
        fontSize: normalizeFont(16),
        color: '#7f8c8d',
    },
    viewModeToggle: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: scale(20)*1.3,
        padding: scale(4)*1.3,
    },
    viewModeButton: {
        paddingHorizontal: scale(12)*1.3,
        paddingVertical: scale(8)*1.3,
        borderRadius: scale(16)*1.3,
    },
    viewModeActive: {
        backgroundColor: '#3498db',
    },
    searchSection: {
        paddingHorizontal: scale(20),
        paddingTop: scale(15),
        zIndex: 10,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: scale(15),
        paddingVertical: scale(6),
        borderRadius: scale(25),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(2) },
        shadowOpacity: 0.05,
        shadowRadius: scale(3),
        elevation: scale(2),
    },
    searchInput: {
        flex: 1,
        marginLeft: scale(10),
        fontSize: normalizeFont(16),
        color: '#2c3e50',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: scale(60),
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderRadius: scale(15),
        marginHorizontal: scale(20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.1,
        shadowRadius: scale(5),
        elevation: 5,
    },
    suggestionItem: {
        paddingHorizontal: scale(20),
        paddingVertical: scale(15),
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    suggestionText: {
        fontSize: normalizeFont(16),
        color: '#2c3e50',
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: scale(20),
        paddingVertical: scale(15),
        gap: scale(10),
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: scale(15),
        paddingVertical: scale(10),
        borderRadius: scale(25),
        borderWidth: 1,
        borderColor: '#ecf0f1',
        gap: scale(8),
    },
    filterChipActive: {
        backgroundColor: '#3498db',
        borderColor: '#3498db',
    },
    filterChipText: {
        fontSize: normalizeFont(14),
        color: '#3498db',
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: 'white',
    },
    clearFiltersChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee',
        paddingHorizontal: scale(15),
        paddingVertical: scale(10),
        borderRadius: scale(25),
        gap: scale(6),
    },
    clearFiltersText: {
        fontSize: normalizeFont(14),
        color: '#e74c3c',
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: scale(20),
        paddingTop: scale(10),
    },
    wordCard: {
        backgroundColor: 'white',
        borderRadius: scale(16),
        marginBottom: scale(16),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: scale(8),
        elevation: scale(4),
        overflow: 'hidden',
    },
    wordCardExpanded: {
        borderWidth: scale(2),
        borderColor: '#3498db',
    },
    cardHeader: {
        padding: scale(20),
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    wordSection: {
        flex: 1,
        marginRight: scale(15),
    },
    wordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(8),
    },
    originalWord: {
        fontSize: normalizeFont(22),
        fontWeight: 'bold',
        color: '#2c3e50',
        flex: 1,
    },
    categoryBadge: {
        paddingHorizontal: scale(8),
        paddingVertical: scale(4),
        borderRadius: scale(12),
    },
    categoryText: {
        color: 'white',
        fontSize: normalizeFont(10),
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    translatedWord: {
        fontSize: normalizeFont(18),
        color: '#3498db',
        fontWeight: '500',
        marginBottom: scale(10),
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    languageBadge: {
        backgroundColor: '#ecf0f1',
        paddingHorizontal: scale(10),
        paddingVertical: scale(4),
        borderRadius: scale(12),
    },
    languageText: {
        color: '#7f8c8d',
        fontSize: normalizeFont(12),
        fontWeight: '500',
    },
    dateText: {
        fontSize: normalizeFont(12),
        color: '#95a5a6',
    },
    actionsSection: {
        alignItems: 'center',
        gap: scale(12),
    },
    speakerButton: {
        backgroundColor: '#ecf0f1',
        padding: scale(12),
        borderRadius: scale(50),
    },
    proficiencyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: scale(12),
        borderRadius: scale(12),
        borderWidth: scale(2),
        backgroundColor: '#f8f9fa',
        width: scale(104),
        height: scale(60),
        position: 'relative',
        overflow: 'hidden',
    },
    proficiencyFill: {
        position: 'absolute',
        left: scale(0),
        top: scale(0),
        bottom: scale(0),
        borderTopLeftRadius: scale(10),
        borderBottomLeftRadius: scale(10),
        opacity: 0.16,
        zIndex: 1,
    },
    proficiencyLabel: {
        fontSize: normalizeFont(14),
        fontWeight: 'bold',
        marginBottom: scale(2),
        zIndex: 2,
        textShadowColor: 'rgba(255, 255, 255, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: scale(2),
    },
    proficiencyLevel: {
        fontSize: normalizeFont(10),
        fontWeight: '600',
        textTransform: 'uppercase',
        zIndex: 2,
        textShadowColor: 'rgba(255, 255, 255, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: scale(2),
    },
    proficiencyContent: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        position: 'relative',
    },
    proficiencyIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(4),
        marginBottom: scale(2),
    },
    expandIndicator: {
        backgroundColor: '#ecf0f1',
        padding: scale(8),
        borderRadius: scale(50),
    },
    tapHint: {
        backgroundColor: '#27ae60',
        paddingVertical: scale(8),
        paddingHorizontal: scale(20),
        alignItems: 'center',
    },
    tapHintText: {
        color: 'white',
        fontSize: normalizeFont(14),
        fontWeight: '600',
    },
    expandedContent: {
        paddingHorizontal: scale(20),
        paddingBottom: scale(20),
        borderTopWidth: 1,
        borderTopColor: '#ecf0f1',
    },
    exampleSection: {
        marginBottom: scale(20),
    },
    exampleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(10),
        gap: scale(8),
    },
    exampleLabel: {
        fontSize: normalizeFont(16),
        fontWeight: '600',
        color: '#3498db',
    },
    exampleContainer: {
        backgroundColor: '#f8f9fa',
        padding: scale(15),
        borderRadius: scale(12),
        borderLeftWidth: scale(4),
        borderLeftColor: '#3498db',
    },
    exampleText: {
        fontSize: normalizeFont(16),
        color: '#2c3e50',
        marginBottom: scale(5),
        lineHeight: scale(22),
    },
    exampleTranslation: {
        fontSize: normalizeFont(14),
        color: '#7f8c8d',
        fontStyle: 'italic',
        marginBottom: scale(10),
    },
    playExampleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    playExampleText: {
        color: '#27ae60',
        fontSize: normalizeFont(14),
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: scale(10),
    },
    practiceButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        paddingVertical: scale(12),
        borderRadius: scale(10),
        gap: scale(8),
    },
    practiceButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: normalizeFont(18),
    },
    deleteButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ecf0f1',
        paddingVertical: scale(12),
        borderRadius: scale(10),
        gap: scale(8),
    },
    deleteText: {
        color: '#e74c3c',
        fontWeight: '600',
        fontSize: normalizeFont(18)
    },
    // Flashcard Styles
    flashcardContainer: {
        flex: 1,
        padding: scale(20),
    },
    flashcardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(20),
    },
    flashcardCounter: {
        fontSize: normalizeFont(18),
        color: '#7f8c8d',
        fontWeight: '600',
    },
    flashcardProficiency: {
        paddingHorizontal: scale(12),
        paddingVertical: scale(6),
        borderRadius: scale(16),
    },
    flashcardProficiencyText: {
        color: 'white',
        fontSize: normalizeFont(14),
        fontWeight: '600',
    },
    flashcard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: scale(20),
        marginBottom: scale(20),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: scale(4) },
        shadowOpacity: 0.15,
        shadowRadius: scale(10),
        elevation: 5,
        overflow: 'hidden',
    },
    flashcardScrollView: {
        flex: 1,
    },
    flashcardContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(30),
    },
    flashcardMainContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: scale(15),
    },
    flashcardWord: {
        fontSize: normalizeFont(28),
        fontWeight: 'bold',
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: scale(20),
        paddingHorizontal: scale(10),
        width: '100%',
    },
    flashcardHint: {
        fontSize: normalizeFont(16),
        color: '#95a5a6',
        fontStyle: 'italic',
    },
    flashcardTranslation: {
        fontSize: normalizeFont(32),
        fontWeight: 'bold',
        color: '#27ae60',
        textAlign: 'center',
    },
    flashcardLanguage: {
        fontSize: normalizeFont(18),
        color: '#7f8c8d',
        marginBottom: scale(20),
    },
    flashcardExample: {
        backgroundColor: '#f8f9fa',
        padding: scale(15),
        borderRadius: scale(15),
        marginTop: scale(20),
        width: '100%',
    },
    exampleContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    exampleTextContainer: {
        flex: 1,
        marginRight: scale(10),
    },
    flashcardExampleScroll: {
        maxHeight: scale(170),
    },
    flashcardExampleText: {
        fontSize: normalizeFont(15),
        color: '#34495e',
        marginBottom: scale(8),
        lineHeight: scale(22),
    },
    flashcardExampleEn: {
        fontSize: normalizeFont(13),
        color: '#7f8c8d',
        fontStyle: 'italic',
        lineHeight: scale(20),
    },
    exampleSpeaker: {
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        padding: scale(8),
        borderRadius: scale(50),
        marginTop: scale(5),
    },
    flashcardSpeaker: {
        marginTop: scale(20),
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        padding: scale(10),
        borderRadius: scale(50),
        flex: 1
    },
    flashcardControls: {
        flexDirection: 'row',
        gap: scale(15)
    },
    flashcardButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7f8c8d',
        paddingVertical: scale(15),
        borderRadius: scale(25),
        gap: scale(10),
    },
    flashcardButtonPrimary: {
        backgroundColor: '#3498db',
    },
    flashcardButtonText: {
        color: 'white',
        fontSize: normalizeFont(16),
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scale(100),
    },
    emptyIcon: {
        fontSize: scale(64),
        marginBottom: scale(20),
    },
    emptyTitle: {
        fontSize: normalizeFont(24),
        fontWeight: 'bold',
        color: '#7f8c8d',
        marginBottom: scale(10),
    },
    emptyText: {
        fontSize: normalizeFont(16),
        color: '#95a5a6',
        textAlign: 'center',
        paddingHorizontal: scale(40),
        lineHeight: scale(22),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        padding: scale(20),
        maxHeight: '80%',
        paddingBottom: Platform.OS === 'ios' ? scale(30) : scale(20),
    },
    modalTitle: {
        fontSize: normalizeFont(20),
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: scale(20),
        textAlign: 'center',
    },
    modalSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        paddingHorizontal: scale(15),
        paddingVertical: scale(2),
        borderRadius: scale(25),
        marginBottom: scale(10),
    },
    modalSearchInput: {
        flex: 1,
        marginLeft: scale(10),
        fontSize: normalizeFont(16),
        color: '#2c3e50',
    },
    optionsList: {
        maxHeight: scale(350),
        marginTop: scale(10),
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: scale(15),
        paddingHorizontal: scale(10),
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    optionItemActive: {
        backgroundColor: '#ecf0f1',
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    optionText: {
        fontSize: normalizeFont(16),
        color: '#2c3e50',
    },
    optionTextActive: {
        color: '#3498db',
        fontWeight: '600',
    },
    flashcardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        gap: scale(20),
    },
    flashcardSpeakerTop: {
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: [{ translateY: scale(-20) }], // Half of button height
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        padding: scale(10),
        borderRadius: scale(50),
    },
    flashcardMeaning: {
        fontSize: normalizeFont(16),
        color: '#7f8c8d',
        marginBottom: scale(20),
        fontStyle: 'italic',
    },
    speakerLabel: {
        color: 'white',
        fontSize: normalizeFont(14),
        marginTop: scale(5),
    },
    flashcardWordContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: scale(15),
        position: 'relative',
    },
    noResultsContainer: {
        padding: scale(40),
        alignItems: 'center',
    },
    noResultsText: {
        fontSize: normalizeFont(16),
        color: '#95a5a6',
    },
    authRequiredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(40),
    },
    authRequiredTitle: {
        fontSize: normalizeFont(24),
        fontWeight: 'bold',
        color: '#2c3e50',
        marginTop: scale(20),
        marginBottom: scale(10),
    },
    authRequiredText: {
        fontSize: normalizeFont(16),
        color: '#7f8c8d',
        textAlign: 'center',
        marginBottom: scale(30),
        lineHeight: scale(22),
    },
    loginButton: {
        backgroundColor: '#3498db',
        paddingHorizontal: scale(30),
        paddingVertical: scale(15),
        borderRadius: scale(25),
    },
    loginButtonText: {
        color: 'white',
        fontSize: normalizeFont(16),
        fontWeight: '600',
    },
    authRequiredSubtext: {
        fontSize: normalizeFont(14),
        color: '#95a5a6',
        textAlign: 'center',
        marginBottom: scale(20),
        paddingHorizontal: scale(20),
        lineHeight: scale(20),
    },
    continueButton: {
        marginTop: scale(15),
        paddingHorizontal: scale(30),
        paddingVertical: scale(12),
    },
    continueButtonText: {
        color: '#3498db',
        fontSize: normalizeFont(16),
        fontWeight: '500',
    },
    keyboardAvoidingView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContentWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
});