import React, { useState, useEffect, useMemo } from 'react';
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
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../database/config';
import VocabularyService, { SavedWord } from '../../src/services/VocabularyService';
import SpeechService from '../../src/services/SpeechService';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

const { width, height } = Dimensions.get('window');

// Define language mapping with proper typing
const languages: Record<string, string> = {
    'Spanish': 'es',
    'French': 'fr',
    'Chinese (Simplified)': 'zh-CN',
    'Chinese (Traditional)': 'zh-TW',
    'German': 'de',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Italian': 'it',
    'Portuguese': 'pt',
    'Russian': 'ru',
    'Arabic': 'ar',
    'Hindi': 'hi',
    'Turkish': 'tr',
    'Dutch': 'nl',
    'Swedish': 'sv',
    'Polish': 'pl',
    'Greek': 'el',
    'Hebrew': 'he',
    'Vietnamese': 'vi',
    'Indonesian': 'id',
    'Danish': 'da',
    'Norwegian': 'no',
    'Finnish': 'fi',
    'Thai': 'th',
    'Czech': 'cs',
    'Hungarian': 'hu',
    'Ukrainian': 'uk',
    'Romanian': 'ro',
    'Filipino': 'tl',
    'Malay': 'ms',
    'Swahili': 'sw',
    'Bengali': 'bn',
    'Urdu': 'ur',
    'Serbian': 'sr',
    'Croatian': 'hr',
    'Slovak': 'sk',
    'Bulgarian': 'bg',
    'Persian (Farsi)': 'fa',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Gujarati': 'gu',
    'Punjabi': 'pa',
    'Icelandic': 'is',
    'Latin': 'la'
};

// Type for language keys
type LanguageName = keyof typeof languages;
type ViewMode = 'cards' | 'list' | 'flashcard';

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

    useEffect(() => {
        loadVocabulary();
    }, []);

    useEffect(() => {
        applyFiltersAndSort();
    }, [vocabulary, filterLanguage, sortBy, searchQuery]);

    const loadVocabulary = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Error', 'Please log in to view your vocabulary');
                return;
            }

            const words = await VocabularyService.getUserVocabulary(user.id);
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

        // Apply language filter
        if (filterLanguage !== 'All') {
            const langCode = languages[filterLanguage as LanguageName];
            if (langCode) {
                filtered = filtered.filter(word => word.language === langCode);
            }
        }

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
        Alert.alert(
            'Delete Word',
            `Are you sure you want to remove "${word.original}" from your vocabulary?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await VocabularyService.deleteWord(word.id);
                        if (success) {
                            Alert.alert('Success', 'Word removed from vocabulary');
                            loadVocabulary();
                        } else {
                            Alert.alert('Error', 'Failed to delete word');
                        }
                    }
                }
            ]
        );
    };

    const getLanguageName = (code: string): string => {
        const entry = Object.entries(languages).find(([_, c]) => c === code);
        return entry ? entry[0] : code;
    };

    const getProficiencyInfo = (level: number) => {
        if (level >= 80) return { color: '#27ae60', label: 'Expert', emoji: '🏆' };
        if (level >= 60) return { color: '#f39c12', label: 'Advanced', emoji: '🌟' };
        if (level >= 40) return { color: '#e67e22', label: 'Intermediate', emoji: '📈' };
        if (level >= 20) return { color: '#3498db', label: 'Beginner', emoji: '🌱' };
        return { color: '#9b59b6', label: 'Learning', emoji: '🔥' };
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

    const renderVocabularyItem = (word: SavedWord) => {
        const isExpanded = expandedItems.has(word.id);
        const proficiencyInfo = getProficiencyInfo(word.proficiency);
        const categoryColor = getCategoryColor(word.category || 'general');

        return (
            <TouchableOpacity
                key={word.id}
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
                            <Ionicons name="volume-high" size={24} color="#3498db" />
                        </TouchableOpacity>
                        
                        <View style={[styles.proficiencyContainer, { borderColor: proficiencyInfo.color }]}>
                            <View style={[styles.proficiencyFill, { 
                                backgroundColor: proficiencyInfo.color,
                                width: `${word.proficiency}%`
                            }]} />
                            <Text style={[styles.proficiencyLabel, { color: proficiencyInfo.color }]}>
                                {proficiencyInfo.emoji} {word.proficiency}%
                            </Text>
                            <Text style={[styles.proficiencyLevel, { color: proficiencyInfo.color }]}>
                                {proficiencyInfo.label}
                            </Text>
                        </View>

                        <View style={styles.expandIndicator}>
                            <Ionicons 
                                name={isExpanded ? "chevron-up" : "chevron-down"} 
                                size={20} 
                                color="#7f8c8d" 
                            />
                        </View>
                    </View>
                </View>

                {/* Tap to expand hint */}
                {!isExpanded && (
                    <View style={styles.tapHint}>
                        <Text style={styles.tapHintText}><AntDesign name="upcircle" size={15} color="white" /> Tap to see example & more</Text>
                    </View>
                )}

                {/* Expanded Content */}
                {isExpanded && (
                    <View style={styles.expandedContent}>
                        {word.example && (
                            <View style={styles.exampleSection}>
                                <View style={styles.exampleHeader}>
                                    <Ionicons name="chatbubble-outline" size={18} color="#3498db" />
                                    <Text style={styles.exampleLabel}>Example Sentence</Text>
                                </View>
                                
                                <View style={styles.exampleContainer}>
                                    <Text style={styles.exampleText}>{word.example}</Text>
                                    <Text style={styles.exampleTranslation}>{word.exampleEnglish}</Text>
                                    
                                    <TouchableOpacity
                                        style={styles.playExampleButton}
                                        onPress={() => handleSpeech(word.example, word.language)}
                                    >
                                        <Ionicons name="play-circle" size={20} color="#27ae60" />
                                        <Text style={styles.playExampleText}>Play Example</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.practiceButton}
                                onPress={() => Alert.alert('Practice', 'Practice mode coming soon!')}
                            >
                                <Ionicons name="fitness" size={18} color="white" />
                                <Text style={styles.practiceButtonText}>Practice</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => handleDelete(word)}
                            >
                                <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                                <Text style={styles.deleteText}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderCompactListItem = (word: SavedWord) => {
        const proficiencyInfo = getProficiencyInfo(word.proficiency);
        
        return (
            <View key={word.id} style={styles.compactItem}>
                <View style={styles.compactItemLeft}>
                    <Text style={styles.compactOriginal}>{word.original}</Text>
                    <Text style={styles.compactTranslation}>{word.translation}</Text>
                    <Text style={styles.compactMeta}>
                        {getLanguageName(word.language)} • {new Date(word.learnedAt).toLocaleDateString()}
                    </Text>
                </View>
                <View style={styles.compactItemRight}>
                    <View style={[styles.compactProficiency, { backgroundColor: proficiencyInfo.color }]}>
                        <Text style={styles.compactProficiencyText}>{word.proficiency}%</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.compactSpeaker}
                        onPress={() => handleSpeech(word.translation, word.language)}
                    >
                        <Ionicons name="volume-medium" size={22} color="#3498db" />
                    </TouchableOpacity>
                </View>
            </View>
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
                            {proficiencyInfo.emoji} {word.proficiency}%
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
                                <Text style={styles.flashcardWord}>{word.original}</Text>
                                <Text style={styles.flashcardHint}>Tap to reveal translation</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.flashcardTranslation}>{word.translation}</Text>
                                <Text style={styles.flashcardLanguage}>{getLanguageName(word.language)}</Text>
                                {word.example && (
                                    <View style={styles.flashcardExample}>
                                        <Text style={styles.flashcardExampleText}>{word.example}</Text>
                                        <Text style={styles.flashcardExampleEn}>{word.exampleEnglish}</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={styles.flashcardSpeaker}
                                    onPress={() => handleSpeech(word.translation, word.language)}
                                >
                                    <Ionicons name="volume-high" size={30} color="white" />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
                
                <View style={styles.flashcardControls}>
                    <TouchableOpacity
                        style={styles.flashcardButton}
                        onPress={previousFlashcard}
                    >
                        <Ionicons name="arrow-back" size={24} color="white" />
                        <Text style={styles.flashcardButtonText}>Previous</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[styles.flashcardButton, styles.flashcardButtonPrimary]}
                        onPress={nextFlashcard}
                    >
                        <Text style={styles.flashcardButtonText}>Next</Text>
                        <Ionicons name="arrow-forward" size={24} color="white" />
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
                            size={20} 
                            color={viewMode === 'cards' ? 'white' : '#3498db'} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <Ionicons 
                            name="list" 
                            size={20} 
                            color={viewMode === 'list' ? 'white' : '#3498db'} 
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewModeButton, viewMode === 'flashcard' && styles.viewModeActive]}
                        onPress={() => setViewMode('flashcard')}
                    >
                        <FontAwesome5 
                            name="layer-group" 
                            size={16} 
                            color={viewMode === 'flashcard' ? 'white' : '#3498db'} 
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Smart Search Bar */}
            <View style={styles.searchSection}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#7f8c8d" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search words, languages, or categories..."
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
                            <Ionicons name="close-circle" size={20} color="#7f8c8d" />
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
                    <Ionicons name="language" size={18} color={filterLanguage !== 'All' ? "white" : "#3498db"} />
                    <Text style={[styles.filterChipText, filterLanguage !== 'All' && styles.filterChipTextActive]}>
                        {filterLanguage}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={filterLanguage !== 'All' ? "white" : "#3498db"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.filterChip}
                    onPress={() => setShowSortFilter(true)}
                >
                    <Ionicons name="funnel" size={18} color="#3498db" />
                    <Text style={styles.filterChipText}>Sort</Text>
                    <Ionicons name="chevron-down" size={16} color="#3498db" />
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
                        <Ionicons name="close" size={18} color="#e74c3c" />
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
                                loadVocabulary();
                            }}
                            colors={['#3498db']}
                        />
                    }
                >
                    {filteredVocabulary.length > 0 ? (
                        viewMode === 'cards' ? (
                            filteredVocabulary.map(renderVocabularyItem)
                        ) : (
                            filteredVocabulary.map(renderCompactListItem)
                        )
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
                onRequestClose={() => setShowLanguageFilter(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Language</Text>
                        
                        <ScrollView style={styles.optionsList}>
                            {['All', ...Object.keys(languages)].map(lang => (
                                <TouchableOpacity
                                    key={lang}
                                    style={[
                                        styles.optionItem,
                                        filterLanguage === lang && styles.optionItemActive
                                    ]}
                                    onPress={() => {
                                        setFilterLanguage(lang);
                                        setShowLanguageFilter(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        filterLanguage === lang && styles.optionTextActive
                                    ]}>{lang}</Text>
                                    {filterLanguage === lang && (
                                        <Ionicons name="checkmark" size={20} color="#3498db" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
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
                    <View style={styles.modalContent}>
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
                                        <Ionicons name={option.icon as any} size={20} color={sortBy === option.value ? "#3498db" : "#7f8c8d"} />
                                        <Text style={[
                                            styles.optionText,
                                            sortBy === option.value && styles.optionTextActive
                                        ]}>{option.label}</Text>
                                    </View>
                                    {sortBy === option.value && (
                                        <Ionicons name="checkmark" size={20} color="#3498db" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
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
        marginTop: 10,
        fontSize: 16,
        color: '#7f8c8d',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
        backgroundColor: 'white',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 5,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#7f8c8d',
    },
    viewModeToggle: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        padding: 4,
    },
    viewModeButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    viewModeActive: {
        backgroundColor: '#3498db',
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingTop: 15,
        zIndex: 10,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        color: '#2c3e50',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 15,
        marginHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5,
    },
    suggestionItem: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    suggestionText: {
        fontSize: 16,
        color: '#2c3e50',
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 15,
        gap: 10,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#ecf0f1',
        gap: 8,
    },
    filterChipActive: {
        backgroundColor: '#3498db',
        borderColor: '#3498db',
    },
    filterChipText: {
        fontSize: 14,
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
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 25,
        gap: 6,
    },
    clearFiltersText: {
        fontSize: 14,
        color: '#e74c3c',
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 10,
    },
    wordCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        overflow: 'hidden',
    },
    wordCardExpanded: {
        borderWidth: 2,
        borderColor: '#3498db',
    },
    cardHeader: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    wordSection: {
        flex: 1,
        marginRight: 15,
    },
    wordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    originalWord: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50',
        flex: 1,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    categoryText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    translatedWord: {
        fontSize: 18,
        color: '#3498db',
        fontWeight: '500',
        marginBottom: 10,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    languageBadge: {
        backgroundColor: '#ecf0f1',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    languageText: {
        color: '#7f8c8d',
        fontSize: 12,
        fontWeight: '500',
    },
    dateText: {
        fontSize: 12,
        color: '#95a5a6',
    },
    actionsSection: {
        alignItems: 'center',
        gap: 12,
    },
    speakerButton: {
        backgroundColor: '#ecf0f1',
        padding: 12,
        borderRadius: 50,
    },
    proficiencyContainer: {
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        backgroundColor: '#f8f9fa',
        minWidth: 80,
    },
    proficiencyFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        borderRadius: 10,
        opacity: 0.1,
    },
    proficiencyLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    proficiencyLevel: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    expandIndicator: {
        backgroundColor: '#ecf0f1',
        padding: 8,
        borderRadius: 50,
    },
    tapHint: {
        backgroundColor: '#f1c40f',
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    tapHintText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    expandedContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderTopWidth: 1,
        borderTopColor: '#ecf0f1',
    },
    exampleSection: {
        marginBottom: 20,
    },
    exampleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    exampleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3498db',
    },
    exampleContainer: {
        backgroundColor: '#f8f9fa',
        padding: 15,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3498db',
    },
    exampleText: {
        fontSize: 16,
        color: '#2c3e50',
        marginBottom: 5,
        lineHeight: 22,
    },
    exampleTranslation: {
        fontSize: 14,
        color: '#7f8c8d',
        fontStyle: 'italic',
        marginBottom: 10,
    },
    playExampleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    playExampleText: {
        color: '#27ae60',
        fontSize: 14,
        fontWeight: '500',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    practiceButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#27ae60',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    practiceButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    deleteButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ecf0f1',
        paddingVertical: 12,
        borderRadius: 10,
        gap: 8,
    },
    deleteText: {
        color: '#e74c3c',
        fontWeight: '600',
    },
    // Compact List View Styles
    compactItem: {
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        marginBottom: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    compactItemLeft: {
        flex: 1,
        marginRight: 10,
    },
    compactOriginal: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 2,
    },
    compactTranslation: {
        fontSize: 14,
        color: '#27ae60',
        marginBottom: 4,
    },
    compactMeta: {
        fontSize: 12,
        color: '#95a5a6',
    },
    compactItemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    compactProficiency: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    compactProficiencyText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    compactSpeaker: {
        padding: 8,
    },
    // Flashcard Styles
    flashcardContainer: {
        flex: 1,
        padding: 20,
    },
    flashcardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    flashcardCounter: {
        fontSize: 18,
        color: '#7f8c8d',
        fontWeight: '600',
    },
    flashcardProficiency: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    flashcardProficiencyText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    flashcard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    flashcardContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    flashcardWord: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: 20,
    },
    flashcardHint: {
        fontSize: 16,
        color: '#95a5a6',
        fontStyle: 'italic',
    },
    flashcardTranslation: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#27ae60',
        textAlign: 'center',
        marginBottom: 10,
    },
    flashcardLanguage: {
        fontSize: 18,
        color: '#7f8c8d',
        marginBottom: 20,
    },
    flashcardExample: {
        backgroundColor: '#f8f9fa',
        padding: 20,
        borderRadius: 15,
        marginTop: 20,
        width: '100%',
    },
    flashcardExampleText: {
        fontSize: 16,
        color: '#34495e',
        textAlign: 'center',
        marginBottom: 8,
    },
    flashcardExampleEn: {
        fontSize: 14,
        color: '#7f8c8d',
        fontStyle: 'italic',
        textAlign: 'center',
    },
    flashcardSpeaker: {
        marginTop: 20,
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        padding: 15,
        borderRadius: 50,
    },
    flashcardControls: {
        flexDirection: 'row',
        gap: 15,
    },
    flashcardButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#7f8c8d',
        paddingVertical: 15,
        borderRadius: 25,
        gap: 10,
    },
    flashcardButtonPrimary: {
        backgroundColor: '#3498db',
    },
    flashcardButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#7f8c8d',
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 16,
        color: '#95a5a6',
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 22,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '70%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 20,
        textAlign: 'center',
    },
    optionsList: {
        maxHeight: 400,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ecf0f1',
    },
    optionItemActive: {
        backgroundColor: '#ecf0f1',
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    optionText: {
        fontSize: 16,
        color: '#2c3e50',
    },
    optionTextActive: {
        color: '#3498db',
        fontWeight: '600',
    },
});