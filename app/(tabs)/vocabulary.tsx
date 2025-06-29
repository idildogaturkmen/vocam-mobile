import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import DatabaseService from '../../src/services/DatabaseService';

const { width } = Dimensions.get('window');

// TypeScript Interfaces
interface VocabularyWord {
  id: number;
  word_original: string;
  word_translated: string;
  language_translated: string;
  category?: string;
  image_path?: string;
  date_added?: string;
  source?: string;
  proficiency_level?: number;
  review_count?: number;
  correct_count?: number;
  last_reviewed?: string;
  pronunciationTips?: string;
  example?: string;
  exampleEnglish?: string;
}

interface LanguageMap {
  [key: string]: string;
}

type SortOption = 'Date (Newest)' | 'Date (Oldest)' | 'Proficiency (Low to High)' | 'Proficiency (High to Low)' | 'Alphabetical (A-Z)' | 'Alphabetical (Z-A)';

export default function VocabularyScreen(): React.ReactElement {
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>([]);
  const [filteredVocabulary, setFilteredVocabulary] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [showWordModal, setShowWordModal] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('Date (Newest)');
  const [proficiencyFilter, setProficiencyFilter] = useState<string>('All');

  const languages: LanguageMap = {
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'zh-CN': 'Chinese'
  };

  const sortOptions: SortOption[] = [
    'Date (Newest)',
    'Date (Oldest)', 
    'Proficiency (Low to High)',
    'Proficiency (High to Low)',
    'Alphabetical (A-Z)',
    'Alphabetical (Z-A)'
  ];

  useFocusEffect(
    useCallback(() => {
      loadVocabulary();
    }, [])
  );

  const loadVocabulary = async (): Promise<void> => {
    try {
      setLoading(true);
      const words: VocabularyWord[] = await DatabaseService.getAllVocabulary();
      setVocabulary(words);
      applyFiltersAndSort(words);
    } catch (error) {
      console.error('Error loading vocabulary:', error);
      Alert.alert('Error', 'Failed to load vocabulary');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await loadVocabulary();
    setRefreshing(false);
  };

  const applyFiltersAndSort = (words: VocabularyWord[] = vocabulary): void => {
    let filtered: VocabularyWord[] = [...words];

    // Search filter
    if (searchText.trim()) {
      const search: string = searchText.toLowerCase().trim();
      filtered = filtered.filter((word: VocabularyWord) => 
        word.word_original?.toLowerCase().includes(search) ||
        word.word_translated?.toLowerCase().includes(search)
      );
    }

    // Language filter
    if (languageFilter !== 'All') {
      const langCode: string | undefined = Object.keys(languages).find(key => languages[key] === languageFilter);
      filtered = filtered.filter((word: VocabularyWord) => word.language_translated === langCode);
    }

    // Category filter
    if (categoryFilter !== 'All') {
      filtered = filtered.filter((word: VocabularyWord) => word.category === categoryFilter);
    }

    // Proficiency filter
    if (proficiencyFilter !== 'All') {
      const level: number = parseInt(proficiencyFilter.split(' ')[1]);
      filtered = filtered.filter((word: VocabularyWord) => (word.proficiency_level || 0) === level);
    }

    // Sort
    filtered.sort((a: VocabularyWord, b: VocabularyWord) => {
      switch (sortBy) {
        case 'Date (Newest)':
          return new Date(b.date_added || 0).getTime() - new Date(a.date_added || 0).getTime();
        case 'Date (Oldest)':
          return new Date(a.date_added || 0).getTime() - new Date(b.date_added || 0).getTime();
        case 'Proficiency (Low to High)':
          return (a.proficiency_level || 0) - (b.proficiency_level || 0);
        case 'Proficiency (High to Low)':
          return (b.proficiency_level || 0) - (a.proficiency_level || 0);
        case 'Alphabetical (A-Z)':
          return (a.word_original || '').localeCompare(b.word_original || '');
        case 'Alphabetical (Z-A)':
          return (b.word_original || '').localeCompare(a.word_original || '');
        default:
          return 0;
      }
    });

    setFilteredVocabulary(filtered);
  };

  useEffect(() => {
    applyFiltersAndSort();
  }, [searchText, languageFilter, categoryFilter, sortBy, proficiencyFilter]);

  const speakWord = (text: string, language: string): void => {
    Speech.speak(text, {
      language: language,
      pitch: 1.0,
      rate: 0.8,
    });
  };

  const getProficiencyDisplay = (level: number | undefined): string => {
    const actualLevel: number = level || 0;
    const stars: string = '⭐'.repeat(actualLevel);
    const empty: string = '☆'.repeat(5 - actualLevel);
    return stars + empty;
  };

  const getProficiencyColor = (level: number | undefined): string => {
    const colors: string[] = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#27ae60', '#16a085'];
    return colors[level || 0];
  };

  const getUniqueCategories = (): string[] => {
    const categories = new Set<string>();
    vocabulary.forEach((word: VocabularyWord) => {
      if (word.category && word.category !== 'manual') {
        categories.add(word.category);
      }
    });
    return Array.from(categories).sort();
  };

  const getAvailableLanguages = (): string[] => {
    const langs = new Set<string>();
    vocabulary.forEach((word: VocabularyWord) => {
      if (word.language_translated && languages[word.language_translated]) {
        langs.add(languages[word.language_translated]);
      }
    });
    return Array.from(langs).sort();
  };

  const deleteWord = async (wordId: number): Promise<void> => {
    Alert.alert(
      'Delete Word',
      'Are you sure you want to delete this word from your vocabulary?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement deleteVocabulary method in DatabaseService
              // For now, we'll show a message that this feature is coming soon
              Alert.alert(
                'Feature Coming Soon',
                'Word deletion will be available in a future update. For now, you can use filters to hide words you don\'t want to see.'
              );
              setShowWordModal(false);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete word');
            }
          }
        }
      ]
    );
  };

  const practiceWord = async (word: VocabularyWord): Promise<void> => {
    // Simple practice - speak both original and translation
    Alert.alert(
      'Practice Mode',
      `Let's practice: "${word.word_original}" → "${word.word_translated}"`,
      [
        {
          text: 'Hear Original',
          onPress: () => speakWord(word.word_original, 'en')
        },
        {
          text: 'Hear Translation', 
          onPress: () => speakWord(word.word_translated, word.language_translated)
        },
        {
          text: 'Mark as Practiced',
          onPress: async () => {
            await DatabaseService.updateWordProgress(word.id, true);
            await loadVocabulary();
            Alert.alert('Great!', 'Keep up the good practice!');
          }
        }
      ]
    );
  };

  // Word Detail Modal
  const WordDetailModal = (): React.ReactElement | null => {
    if (!selectedWord) return null;

    let pronunciationTips: string[] = [];
    try {
      pronunciationTips = selectedWord.pronunciationTips ? 
        JSON.parse(selectedWord.pronunciationTips) : [];
    } catch (e) {
      pronunciationTips = [];
    }

    return (
      <Modal
        visible={showWordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.wordModalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedWord.word_original}</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setShowWordModal(false)}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Translation */}
              <View style={styles.translationSection}>
                <Text style={styles.translationText}>{selectedWord.word_translated}</Text>
                <Text style={styles.languageText}>
                  {languages[selectedWord.language_translated] || selectedWord.language_translated}
                </Text>
              </View>

              {/* Audio Controls */}
              <View style={styles.audioSection}>
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => speakWord(selectedWord.word_original, 'en')}
                >
                  <Ionicons name="volume-high" size={20} color="#3498db" />
                  <Text style={styles.audioButtonText}>Original</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => speakWord(selectedWord.word_translated, selectedWord.language_translated)}
                >
                  <Ionicons name="volume-high" size={20} color="#27ae60" />
                  <Text style={styles.audioButtonText}>Translation</Text>
                </TouchableOpacity>
              </View>

              {/* Proficiency */}
              <View style={styles.proficiencySection}>
                <Text style={styles.sectionTitle}>Learning Progress</Text>
                <View style={styles.proficiencyDisplay}>
                  <Text style={styles.proficiencyStars}>
                    {getProficiencyDisplay(selectedWord.proficiency_level)}
                  </Text>
                  <Text style={styles.proficiencyText}>
                    Level {selectedWord.proficiency_level || 0}/5
                  </Text>
                </View>
                {(selectedWord.review_count || 0) > 0 && (
                  <Text style={styles.reviewStats}>
                    Reviewed {selectedWord.review_count} times, 
                    {Math.round(((selectedWord.correct_count || 0) / (selectedWord.review_count || 1)) * 100)}% accuracy
                  </Text>
                )}
              </View>

              {/* Image */}
              {selectedWord.image_path && (
                <View style={styles.imageSection}>
                  <Text style={styles.sectionTitle}>Image</Text>
                  <Image source={{ uri: selectedWord.image_path }} style={styles.wordImage} />
                </View>
              )}

              {/* Example */}
              {selectedWord.example && (
                <View style={styles.exampleSection}>
                  <Text style={styles.sectionTitle}>Example</Text>
                  <Text style={styles.exampleEnglish}>{selectedWord.exampleEnglish}</Text>
                  <Text style={styles.exampleTranslated}>{selectedWord.example}</Text>
                  <TouchableOpacity
                    style={styles.exampleAudioButton}
                    onPress={() => speakWord(selectedWord.example || '', selectedWord.language_translated)}
                  >
                    <Ionicons name="play" size={16} color="#3498db" />
                    <Text style={styles.exampleAudioText}>Play Example</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Pronunciation Tips */}
              {pronunciationTips.length > 0 && (
                <View style={styles.tipsSection}>
                  <Text style={styles.sectionTitle}>💡 Pronunciation Tips</Text>
                  {pronunciationTips.map((tip: string, index: number) => (
                    <Text key={index} style={styles.tipText}>• {tip}</Text>
                  ))}
                </View>
              )}

              {/* Metadata */}
              <View style={styles.metaSection}>
                <Text style={styles.sectionTitle}>Details</Text>
                <Text style={styles.metaText}>Category: {selectedWord.category || 'General'}</Text>
                <Text style={styles.metaText}>Source: {selectedWord.source || 'Camera'}</Text>
                <Text style={styles.metaText}>
                  Added: {selectedWord.date_added ? new Date(selectedWord.date_added).toLocaleDateString() : 'Unknown'}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.practiceButton}
                  onPress={() => practiceWord(selectedWord)}
                >
                  <Ionicons name="school" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Practice</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteWord(selectedWord.id)}
                >
                  <Ionicons name="trash" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Filter Modal
  const FilterModal = (): React.ReactElement => (
    <Modal
      visible={showFilterModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModalContent}>
          <Text style={styles.modalTitle}>Filter & Sort</Text>
          
          <ScrollView>
            {/* Language Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Language</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.filterOption, languageFilter === 'All' && styles.filterOptionActive]}
                  onPress={() => setLanguageFilter('All')}
                >
                  <Text style={[styles.filterOptionText, languageFilter === 'All' && styles.filterOptionTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {getAvailableLanguages().map((lang: string) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.filterOption, languageFilter === lang && styles.filterOptionActive]}
                    onPress={() => setLanguageFilter(lang)}
                  >
                    <Text style={[styles.filterOptionText, languageFilter === lang && styles.filterOptionTextActive]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Category Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.filterOption, categoryFilter === 'All' && styles.filterOptionActive]}
                  onPress={() => setCategoryFilter('All')}
                >
                  <Text style={[styles.filterOptionText, categoryFilter === 'All' && styles.filterOptionTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {getUniqueCategories().map((category: string) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.filterOption, categoryFilter === category && styles.filterOptionActive]}
                    onPress={() => setCategoryFilter(category)}
                  >
                    <Text style={[styles.filterOptionText, categoryFilter === category && styles.filterOptionTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Proficiency Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Proficiency Level</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.filterOption, proficiencyFilter === 'All' && styles.filterOptionActive]}
                  onPress={() => setProficiencyFilter('All')}
                >
                  <Text style={[styles.filterOptionText, proficiencyFilter === 'All' && styles.filterOptionTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {[0, 1, 2, 3, 4, 5].map((level: number) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.filterOption, proficiencyFilter === `Level ${level}` && styles.filterOptionActive]}
                    onPress={() => setProficiencyFilter(`Level ${level}`)}
                  >
                    <Text style={[styles.filterOptionText, proficiencyFilter === `Level ${level}` && styles.filterOptionTextActive]}>
                      Level {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Sort Options */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Sort By</Text>
              {sortOptions.map((option: SortOption) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.sortOption, sortBy === option && styles.sortOptionActive]}
                  onPress={() => setSortBy(option)}
                >
                  <Text style={[styles.sortOptionText, sortBy === option && styles.sortOptionTextActive]}>
                    {option}
                  </Text>
                  {sortBy === option && <Ionicons name="checkmark" size={20} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.closeFilterButton}
            onPress={() => setShowFilterModal(false)}
          >
            <Text style={styles.closeFilterText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading vocabulary...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📚 My Vocabulary</Text>
        <Text style={styles.subtitle}>{filteredVocabulary.length} words</Text>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search words..."
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Ionicons name="options" size={20} color="#3498db" />
        </TouchableOpacity>
      </View>

      {/* Active Filters Display */}
      {(languageFilter !== 'All' || categoryFilter !== 'All' || proficiencyFilter !== 'All') && (
        <ScrollView horizontal style={styles.activeFilters} showsHorizontalScrollIndicator={false}>
          {languageFilter !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{languageFilter}</Text>
              <TouchableOpacity onPress={() => setLanguageFilter('All')}>
                <Ionicons name="close" size={14} color="#3498db" />
              </TouchableOpacity>
            </View>
          )}
          {categoryFilter !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{categoryFilter}</Text>
              <TouchableOpacity onPress={() => setCategoryFilter('All')}>
                <Ionicons name="close" size={14} color="#3498db" />
              </TouchableOpacity>
            </View>
          )}
          {proficiencyFilter !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{proficiencyFilter}</Text>
              <TouchableOpacity onPress={() => setProficiencyFilter('All')}>
                <Ionicons name="close" size={14} color="#3498db" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Vocabulary List */}
      {filteredVocabulary.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {vocabulary.length === 0 
              ? "No vocabulary words yet.\nStart learning with Camera Mode!"
              : "No words match your current filters."
            }
          </Text>
          {vocabulary.length === 0 && (
            <TouchableOpacity style={styles.startLearningButton}>
              <Text style={styles.startLearningText}>📸 Go to Camera Mode</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.vocabularyList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredVocabulary.map((word: VocabularyWord, index: number) => (
            <TouchableOpacity
              key={word.id || index}
              style={styles.wordCard}
              onPress={() => {
                setSelectedWord(word);
                setShowWordModal(true);
              }}
            >
              <View style={styles.wordCardContent}>
                <View style={styles.wordInfo}>
                  <Text style={styles.originalWord}>{word.word_original}</Text>
                  <Text style={styles.translatedWord}>{word.word_translated}</Text>
                  <Text style={styles.languageTag}>
                    {languages[word.language_translated] || word.language_translated}
                  </Text>
                </View>
                
                <View style={styles.wordMeta}>
                  <View style={styles.proficiencyContainer}>
                    <Text style={[
                      styles.proficiencyLevel,
                      { color: getProficiencyColor(word.proficiency_level) }
                    ]}>
                      {getProficiencyDisplay(word.proficiency_level)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      speakWord(word.word_translated, word.language_translated);
                    }}
                  >
                    <Ionicons name="play" size={20} color="#3498db" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {word.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{word.category}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
          
          {/* Padding at bottom */}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      <WordDetailModal />
      <FilterModal />
    </View>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 10,
    fontSize: 16,
  },
  filterButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilters: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  activeFilterText: {
    color: '#3498db',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 5,
  },
  vocabularyList: {
    flex: 1,
    padding: 15,
  },
  wordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wordCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordInfo: {
    flex: 1,
  },
  originalWord: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  translatedWord: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '500',
    marginBottom: 4,
  },
  languageTag: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  wordMeta: {
    alignItems: 'flex-end',
  },
  proficiencyContainer: {
    marginBottom: 5,
  },
  proficiencyLevel: {
    fontSize: 16,
  },
  playButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 8,
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  startLearningButton: {
    backgroundColor: '#3498db',
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  startLearningText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  translationSection: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  translationText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 5,
  },
  languageText: {
    fontSize: 14,
    color: '#666',
  },
  audioSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  audioButtonText: {
    marginLeft: 5,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  proficiencySection: {
    marginBottom: 20,
  },
  proficiencyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proficiencyStars: {
    fontSize: 20,
  },
  proficiencyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3498db',
  },
  reviewStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  imageSection: {
    marginBottom: 20,
  },
  wordImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  exampleSection: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  exampleEnglish: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 5,
  },
  exampleTranslated: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '500',
    marginBottom: 10,
  },
  exampleAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  exampleAudioText: {
    marginLeft: 5,
    color: '#3498db',
    fontSize: 12,
  },
  tipsSection: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  tipText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 3,
  },
  metaSection: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  // Filter Modal Styles
  filterModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: '80%',
    padding: 20,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  filterOption: {
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterOptionActive: {
    backgroundColor: '#3498db',
  },
  filterOptionText: {
    color: '#2c3e50',
    fontSize: 14,
  },
  filterOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 5,
  },
  sortOptionActive: {
    backgroundColor: '#3498db',
  },
  sortOptionText: {
    color: '#2c3e50',
    fontSize: 14,
  },
  sortOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeFilterButton: {
    backgroundColor: '#27ae60',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  closeFilterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});