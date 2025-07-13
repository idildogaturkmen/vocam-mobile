import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Services
import ObjectDetectionService from '../../src/services/ObjectDetectionService';
import TranslationService from '../../src/services/TranslationService';
import SpeechService from '../../src/services/SpeechService';
import { getDisplayAndVisionImage } from '../../src/services/ImageUtils';
import VocabularyService from '../../src/services/VocabularyService';
import type { SaveWordResult } from '../../src/services/VocabularyService';
import SessionService from '../../src/services/SessionService';

// Database
import { supabase } from '../../database/config';

// Components
import PhotoResult from '../../src/components/detection/PhotoResult';
import DetectionItem from '../../src/components/detection/DetectionItem';
import CameraControls from '../../src/components/detection/CameraControls';

interface Detection {
  label: string;
  confidence: number;
  bbox: number[];
  category: string;
  translation?: string;
  example?: string;
  exampleEnglish?: string;
}

export default function DetectionScreen() {
  // Camera states
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  // Detection states
  const [photo, setPhoto] = useState<string | null>(null);
  const [rotatedPhoto, setRotatedPhoto] = useState<string | null>(null); //for normalized image
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWords, setSelectedWords] = useState(new Set<number>());
  
  // Settings states
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [modelStatus, setModelStatus] = useState('loading');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualWord, setManualWord] = useState('');
  const [languageSearchQuery, setLanguageSearchQuery] = useState('');
  const [userStats, setUserStats] = useState<{
    totalWords: number;
    masteredWords: number;
    averageProficiency: number;
    currentStreak: number;
  } | null>(null);

  // Sorted languages object
  const languages = {
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

  // Get sorted language list
  const sortedLanguages = useMemo(() => {
    return Object.keys(languages).sort((a, b) => a.localeCompare(b));
  }, []);

  // Filter languages based on search
  const filteredLanguages = useMemo(() => {
    if (!languageSearchQuery.trim()) return sortedLanguages;
    
    const query = languageSearchQuery.toLowerCase();
    return sortedLanguages.filter(lang => 
      lang.toLowerCase().includes(query)
    );
  }, [languageSearchQuery, sortedLanguages]);

  useEffect(() => {
      checkAuthAndInitialize();
  }, []);

  const checkAuthAndInitialize = async () => {
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
              setIsAuthenticated(false);
              return; // Don't initialize services if not authenticated
          }
          
          setIsAuthenticated(true);
          await initializeServices();
      } catch (error) {
          console.error('Auth check error:', error);
          setIsAuthenticated(false);
      }
  };

  const initializeServices = async () => {
    try {
      setModelStatus('loading');
      
      // Initialize all services
      await ObjectDetectionService.initialize();
      await TranslationService.initialize();
      await SpeechService.initialize();
      
      setModelStatus('ready');
      console.log('🎉 All services ready!');
      
    } catch (error) {
      setModelStatus('error');
      console.error('❌ Service initialization failed:', error);
      Alert.alert('Initialization Error', 'Failed to initialize services. Please check your API keys.');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current && modelStatus === 'ready') {
      try {
        const photoResult = await cameraRef.current.takePictureAsync({ 
          skipProcessing: false,
          quality: 0.9,
          exif: false,
        });
        
        // Auto-rotate and strip EXIF before using
        const rotatedUri = await getDisplayAndVisionImage(photoResult.uri);
        setPhoto(rotatedUri); // Use rotated image for display
        setRotatedPhoto(rotatedUri); // Use for detection
        await detectObjectsWithAI(rotatedUri); // Use rotated image for detection
      } catch (error) {
        console.error('Picture error:', error);
        Alert.alert('Error', 'Could not take picture. Please try again.');
      }
    }
  };

  const detectObjectsWithAI = async (imageUri: string) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Detect objects
      const results = await ObjectDetectionService.detectObjects(imageUri, 0.5);
      if (results && results.length > 0) {
        // Translate detected objects
        const translatedResults = await Promise.all(
          results.slice(0, 10).map(async (detection: Detection) => {
            const translation = await TranslationService.translateText(
              detection.label, 
              targetLanguage
            );
            const example = await TranslationService.getExampleSentence(
              detection.label, 
              targetLanguage
            );
            
            return {
              ...detection,
              translation,
              example: example.translated,
              exampleEnglish: example.english,
            };
          })
        );

        setDetections(translatedResults);
        
        // Auto-select high confidence detections
        const highConfidenceIndices = new Set(
          translatedResults
            .map((detection, index) => ({ detection, index }))
            .filter(({ detection }) => detection.confidence > 0.7)
            .map(({ index }) => index)
        );
        setSelectedWords(highConfidenceIndices.size > 0 ? highConfidenceIndices : new Set([0]));
        
      } else {
        Alert.alert('No Objects Found', 'No objects were detected in this image.');
      }
      
    } catch (error) {
      console.error('❌ Detection error:', error);
      Alert.alert('Detection Failed', 'Unable to analyze the image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const retranslateDetections = async (newLanguage: string) => {
    if (detections.length === 0) return;
    
    try {
      setIsProcessing(true);
      
      // Re-translate all current detections with the new language
      const retranslatedResults = await Promise.all(
        detections.map(async (detection) => {
          const translation = await TranslationService.translateText(
            detection.label, 
            newLanguage
          );
          const example = await TranslationService.getExampleSentence(
            detection.label, 
            newLanguage
          );
          
          return {
            ...detection,
            translation,
            example: example.translated,
            exampleEnglish: example.english,
          };
        })
      );
      
      setDetections(retranslatedResults);
      console.log(`✅ Re-translated ${retranslatedResults.length} detections to ${newLanguage}`);
      
    } catch (error) {
      console.error('❌ Re-translation error:', error);
      Alert.alert('Translation Error', 'Failed to re-translate detections. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced speech function that ensures text is valid
  const handleSpeech = async (text: string, language: string) => {
    try {
      // Validate text before speaking (Fix for TypeScript error)
      if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('⚠️ Invalid text for speech:', text);
        Alert.alert('Speech Error', 'No text available to pronounce.');
        return;
      }

      console.log(`🔊 Playing pronunciation: "${text}" in ${language}`);
      await SpeechService.speak(text, language);
      
    } catch (error) {
      console.error('❌ Speech failed:', error);
      Alert.alert('Speech Error', 'Unable to play pronunciation. Please check your device volume.');
    }
  };

  const saveSelectedWords = async () => {
    if (selectedWords.size === 0) {
      Alert.alert('No Selection', 'Please select at least one word to save.');
      return;
    }

    try {
      const selectedDetections = Array.from(selectedWords).map(index => detections[index]);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in to save vocabulary');
        return;
      }

      // Prepare words for batch save
      const wordsToSave = selectedDetections.map(detection => ({
        original: detection.label,
        translation: detection.translation || '',
        example: detection.example || '',
        exampleEnglish: detection.exampleEnglish || ''
      }));

      // Use batch save for better performance
      const result = await VocabularyService.saveMultipleWords(
        wordsToSave,
        targetLanguage,
        user.id
      );

      // Get language name for display
      const languageName = getCurrentLanguageName();

      // Show consolidated message
      if (result.savedWords.length > 0 || result.existingWords.length > 0) {
        let message = '';
        
        if (result.savedWords.length > 0) {
          message = `✅ ${result.savedWords.length} word${result.savedWords.length > 1 ? 's' : ''} saved in ${languageName}`;
        }
        
        if (result.existingWords.length > 0) {
          const existingWordsText = result.existingWords.map(w => `"${w}"`).join(', ');
          if (message) message += '\n\n';
          message += `ℹ️ Already in ${languageName}: ${existingWordsText}`;
        }
        
        if (result.errors.length > 0) {
          const errorWordsText = result.errors.map(w => `"${w}"`).join(', ');
          if (message) message += '\n\n';
          message += `❌ Failed to save: ${errorWordsText}`;
        }
        
        Alert.alert(
          result.savedWords.length > 0 ? 'Vocabulary Updated!' : 'Already Saved',
          message,
          [{ 
            text: 'Continue Learning', 
            onPress: async () => {
              setPhoto(null);
              // Refresh user stats after saving
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const stats = await SessionService.getUserStats(user.id);
                setUserStats(stats);
              }
            }
          }]
        );
      } else if (result.errors.length > 0) {
        Alert.alert('Save Failed', `Could not save: ${result.errors.join(', ')}`);
      }

      setSelectedWords(new Set());
      setDetections([]);
      
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save vocabulary. Please try again.');
    }
  };

  const toggleWordSelection = (index: number) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedWords(newSelected);
  };

  const getCurrentLanguageName = (): string => {
    return Object.entries(languages).find(([_, code]) => code === targetLanguage)?.[0] || 'Spanish';
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>📸 Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            VocAm needs camera access to detect objects and help you learn languages.
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
            <Text style={styles.grantButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Check authentication
  if (isAuthenticated === false) {
      return (
          <View style={styles.container}>
              <View style={styles.authCard}>
                  <Ionicons name="camera-outline" size={64} color="#95a5a6" />
                  <Text style={styles.authTitle}>Login Required</Text>
                  <Text style={styles.authText}>
                      You need to be logged in to use the camera and detect objects.
                  </Text>
                  <Text style={styles.authSubtext}>
                      Login to start learning languages through object detection.
                  </Text>
                  <TouchableOpacity
                      style={styles.loginButton}
                      onPress={() => router.replace('/App')}
                  >
                      <Text style={styles.loginButtonText}>Go to Login</Text>
                  </TouchableOpacity>
              </View>
          </View>
      );
  }

  // Show photo results
  if (photo) {
    return (
      <View style={styles.container}>
        <PhotoResult
          photoUri={photo} // Use rotated image for display
          detections={detections}
          isProcessing={isProcessing}
          onLanguagePress={() => setShowLanguageModal(true)}
          targetLanguage={targetLanguage}
          languageName={getCurrentLanguageName()}
        >
          <View style={{ flex: 1 }}>
            {/* Detection Results */}
          {detections.length > 0 && (
            <View style={styles.resultsContainer}>
              <View style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsTitle}>
                      Found {detections.length} Object{detections.length > 1 ? 's' : ''}
                    </Text>
                  </View>

                  {detections.map((detection, index) => (
                    <DetectionItem
                      key={index}
                      detection={detection}
                      index={index}
                      isSelected={selectedWords.has(index)}
                      onToggleSelect={toggleWordSelection}
                      onSpeakWord={(text: string) => handleSpeech(text, targetLanguage)}
                      onSpeakExample={(text: string) => handleSpeech(text, targetLanguage)}
                      targetLanguage={targetLanguage}
                    />
                  ))}
                </ScrollView>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.saveButton} onPress={saveSelectedWords}>
                  <Text style={styles.saveButtonIcon}>
                    <FontAwesome name="save" size={24} color="white" />
                  </Text>
                  <Text style={styles.saveButtonText}>
                    Save Selected ({selectedWords.size})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => {
                    setPhoto(null);
                    setDetections([]);
                    setSelectedWords(new Set());
                  }}
                >
                  <Text style={styles.retakeButtonIcon}>
                    <Entypo name="camera" size={20} color="white" />
                  </Text>
                  <Text style={styles.retakeButtonText}>Take Another</Text>
                </TouchableOpacity>
              </View>
            </View>
            )}
          </View>
        </PhotoResult>
        {/* MODAL */}
        <Modal
          visible={showLanguageModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowLanguageModal(false);
            setLanguageSearchQuery('');
          }}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => {
              setShowLanguageModal(false);
              setLanguageSearchQuery('');
            }}
          >
            <Pressable 
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.modalTitle}>Select Language</Text>
              
              {/* Language Search Bar */}
              <View style={styles.modalSearchContainer}>
                <Ionicons name="search" size={20} color="#7f8c8d" />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search languages..."
                  value={languageSearchQuery}
                  onChangeText={setLanguageSearchQuery}
                  autoFocus
                />
                {languageSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setLanguageSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#7f8c8d" />
                  </TouchableOpacity>
                )}
              </View>
              
              <ScrollView style={styles.languageList}>
                {filteredLanguages.map((name) => {
                  const code = languages[name as keyof typeof languages];
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[
                        styles.languageOption,
                        targetLanguage === code && styles.languageOptionActive
                      ]}
                      onPress={async () => {
                        const previousLanguage = targetLanguage;
                        setTargetLanguage(code);
                        setShowLanguageModal(false);
                        setLanguageSearchQuery('');
                        
                        // If we have detections (photo was taken), re-translate them
                        if (photo && detections.length > 0 && code !== previousLanguage) {
                          await retranslateDetections(code);
                        }
                      }}
                    >
                      <Text style={[
                        styles.languageOptionText,
                        targetLanguage === code && styles.languageOptionTextActive
                      ]}>
                        {name}
                      </Text>
                      {targetLanguage === code && (
                        <Text style={styles.languageOptionCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                
                {filteredLanguages.length === 0 && (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No languages found</Text>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  
  // Camera View with improved settings to prevent zoom
  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        facing={facing} 
        ref={cameraRef}
        zoom={0}
      />
      {/* Controls are outside CameraView to avoid warning */}
      <CameraControls
        facing={facing}
        onFlipCamera={() => setFacing(facing === 'back' ? 'front' : 'back')}
        onTakePicture={takePicture}
        onManualInput={() => setShowManualInput(true)}
        onLanguagePress={() => setShowLanguageModal(true)}
        modelStatus={modelStatus}
        languageName={getCurrentLanguageName()}
        // userStats={userStats || undefined}
      />

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowLanguageModal(false);
          setLanguageSearchQuery('');
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowLanguageModal(false);
            setLanguageSearchQuery('');
          }}
        >
          <Pressable 
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Select Language</Text>
            
            {/* Language Search Bar */}
            <View style={styles.modalSearchContainer}>
              <Ionicons name="search" size={20} color="#7f8c8d" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search languages..."
                value={languageSearchQuery}
                onChangeText={setLanguageSearchQuery}
                autoFocus
              />
              {languageSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setLanguageSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#7f8c8d" />
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView style={styles.languageList}>
              {filteredLanguages.map((name) => {
                const code = languages[name as keyof typeof languages];
                return (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.languageOption,
                      targetLanguage === code && styles.languageOptionActive
                    ]}
                    onPress={async () => {
                      const previousLanguage = targetLanguage;
                      setTargetLanguage(code);
                      setShowLanguageModal(false);
                      setLanguageSearchQuery('');
                      
                      // If we have detections (photo was taken), re-translate them
                      if (photo && detections.length > 0 && code !== previousLanguage) {
                        await retranslateDetections(code);
                      }
                    }}
                  >
                    <Text style={[
                      styles.languageOptionText,
                      targetLanguage === code && styles.languageOptionTextActive
                    ]}>
                      {name}
                    </Text>
                    {targetLanguage === code && (
                      <Text style={styles.languageOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
              
              {filteredLanguages.length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>No languages found</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowManualInput(false);
          setManualWord('');
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowManualInput(false);
            setManualWord('');
          }}
        >
          <Pressable 
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Add Word Manually</Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Enter a word to translate"
              value={manualWord}
              onChangeText={setManualWord}
              autoFocus
            />
            <View style={styles.manualButtons}>
              <TouchableOpacity 
                style={styles.manualCancelButton}
                onPress={() => {
                  setShowManualInput(false);
                  setManualWord('');
                }}
              >
                <Text style={styles.manualCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.manualAddButton}
                onPress={async () => {
                  if (manualWord.trim()) {
                    try {
                      // Get current user
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        Alert.alert('Error', 'Please log in to save vocabulary');
                        return;
                      }

                      // Translate manual word
                      const translation = await TranslationService.translateText(manualWord.trim(), targetLanguage);
                      const example = await TranslationService.getExampleSentence(manualWord.trim(), targetLanguage);
                      
                      // Test pronunciation
                      await handleSpeech(translation, targetLanguage);
                      
                      // Save to vocabulary
                      const result: SaveWordResult = await VocabularyService.saveWord(
                        manualWord.trim(),
                        translation,
                        example.translated || '',
                        example.english || '',
                        targetLanguage,
                        user.id
                      );
                      
                      setShowManualInput(false);
                      setManualWord('');
                      
                      // Get language name for display
                      const languageName = getCurrentLanguageName();
                      
                      if (result === 'success') {
                        Alert.alert(
                          'Word Added!', 
                          `✅ "${manualWord.trim()}" saved in ${languageName}\nTranslation: "${translation}"`,
                          [{
                            text: 'OK',
                            onPress: async () => {
                              // Refresh user stats
                              const stats = await SessionService.getUserStats(user.id);
                              setUserStats(stats);
                            }
                          }]
                        );
                      } else if (result === 'exists') {
                        Alert.alert(
                          'Already Saved', 
                          `ℹ️ "${manualWord.trim()}" is already in your ${languageName} vocabulary!`
                        );
                      } else {
                        Alert.alert('Error', 'Failed to save word. Please try again.');
                      }
                    } catch (error) {
                      console.error('Manual word error:', error);
                      Alert.alert('Error', 'Failed to add word. Please try again.');
                    }
                  }
                }}
              >
                <Text style={styles.manualAddText}>Add Word</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  permissionCard: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    margin: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#074173',
    marginBottom: 15,
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  grantButton: {
    backgroundColor: '#1679AB',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  grantButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  resultsHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  resultsTitle: {
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginHorizontal: 20,
    gap: 10,
  },
  saveButton: {
    flex: 1.3,
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
  },
  saveButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  retakeButton: {
    flex: 1.05,
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
  },
  retakeButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  retakeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 15,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#2c3e50',
  },
  languageList: {
    maxHeight: 300,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  languageOptionActive: {
    backgroundColor: '#e8f4f8',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  languageOptionTextActive: {
    color: '#3498db',
    fontWeight: '600',
  },
  languageOptionCheck: {
    fontSize: 18,
    color: '#3498db',
    fontWeight: 'bold',
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#95a5a6',
  },
  // Manual input styles
  manualInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  manualButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  manualCancelButton: {
    flex: 1,
    backgroundColor: '#95a5a6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  manualCancelText: {
    color: 'white',
    fontWeight: '600',
  },
  manualAddButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  manualAddText: {
    color: 'white',
    fontWeight: '600',
  },
  resultsScrollContent: {
    flexGrow: 1,
  },
  authCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  authTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#2c3e50',
      marginTop: 20,
      marginBottom: 10,
  },
  authText: {
      fontSize: 16,
      color: '#7f8c8d',
      textAlign: 'center',
      marginBottom: 10,
      lineHeight: 22,
  },
  authSubtext: {
      fontSize: 14,
      color: '#95a5a6',
      textAlign: 'center',
      marginBottom: 30,
      paddingHorizontal: 20,
      lineHeight: 20,
  },
  loginButton: {
      backgroundColor: '#3498db',
      paddingHorizontal: 30,
      paddingVertical: 15,
      borderRadius: 25,
  },
  loginButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
  },
});