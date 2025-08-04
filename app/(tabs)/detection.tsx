import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
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
import VocabularyService from '../../src/services/VocabularyService';
import type { SaveWordResult } from '../../src/services/VocabularyService';
import SessionService from '../../src/services/SessionService';

// 🚀 OPTIMIZED: Import the new optimized image functions
import { getDisplayAndVisionImage, getOptimalImage } from '../../src/services/ImageUtils';

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

// Simple deduplication that only removes exact duplicates
const deduplicateDetections = (detections: Detection[]): Detection[] => {
  const seen = new Map<string, Detection>();
  
  detections.forEach(detection => {
    const key = detection.label.toLowerCase();
    const existing = seen.get(key);
    
    // Only keep the highest confidence detection for exact same labels
    if (!existing || detection.confidence > existing.confidence) {
      seen.set(key, detection);
    }
  });
  
  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
};

export default function DetectionScreen() {
  // Camera states
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  // Detection states
  const [photo, setPhoto] = useState<string | null>(null);
  const [rotatedPhoto, setRotatedPhoto] = useState<string | null>(null);
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
              return;
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
      
      await ObjectDetectionService.initialize();
      await TranslationService.initialize();
      await SpeechService.initialize();
      
      setModelStatus('ready');
      
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
          quality: 0.8,
          exif: false,
        });
        
        // OPTIMIZED: Use optimized image processing
        const rotatedUri = await getDisplayAndVisionImage(photoResult.uri);
        setPhoto(rotatedUri);
        setRotatedPhoto(rotatedUri);
        await detectObjectsWithAI(rotatedUri);
      } catch (error) {
        console.error('Picture error:', error);
        Alert.alert('Error', 'Could not take picture. Please try again.');
      }
    }
  };

  const uploadImage = async () => {
    if (modelStatus !== 'ready') return;
    
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];
        
        //  OPTIMIZED: Use optimal image processing for uploads
        const processedUri = await getOptimalImage(selectedImage.uri, 'display');

        setPhoto(processedUri);
        setRotatedPhoto(processedUri);
        await detectObjectsWithAI(processedUri);
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Error', 'Could not upload image. Please try again.');
    }
  };

  const detectObjectsWithAI = async (imageUri: string) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Higher confidence threshold for better accuracy  
      const results = await ObjectDetectionService.detectObjects(imageUri, 0.7);
      
      if (results && results.length > 0) {
        // Simple deduplication - only removes exact duplicates
        const deduplicatedResults = deduplicateDetections(results);

        // Translate detected objects
        const translatedResults = await Promise.all(
          deduplicatedResults.slice(0, 10).map(async (detection: Detection, index) => {
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
        const highConfidenceIndices = new Set<number>(
          translatedResults
            .map((detection: Detection, index: number) => ({ detection, index }))
            .filter(({ detection }: { detection: Detection }) => detection.confidence > 0.8)
            .map(({ index }: { index: number }) => index)
        );
        
        const selectedCount = highConfidenceIndices.size > 0 ? highConfidenceIndices.size : 1;
        setSelectedWords(highConfidenceIndices.size > 0 ? highConfidenceIndices : new Set([0]));
        
      } else {
        setDetections([]);
      }
      
    } catch (error) {
      console.error('❌ Detection error:', error);
      Alert.alert('Detection Failed', 'Unable to analyze the image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const retranslateDetections = async (newLanguage: string) => {
    if (detections.length === 0) return;
    
    try {
      setIsProcessing(true);
      
      const retranslatedResults = await Promise.all(
        detections.map(async (detection, index) => {
          
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
      
    } catch (error) {
      console.error('❌ Re-translation error:', error);
      Alert.alert('Translation Error', 'Failed to re-translate detections. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeech = async (text: string, language: string) => {
    try {
      if (!text || typeof text !== 'string' || text.trim() === '') {
        console.warn('⚠️ Invalid text for speech:', text);
        Alert.alert('Speech Error', 'No text available to pronounce.');
        return;
      }

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
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in to save vocabulary');
        return;
      }

      const wordsToSave = selectedDetections.map(detection => ({
        original: detection.label,
        translation: detection.translation || '',
        example: detection.example || '',
        exampleEnglish: detection.exampleEnglish || ''
      }));

      const result = await VocabularyService.saveMultipleWords(
        wordsToSave,
        targetLanguage,
        user.id
      );

      const languageName = getCurrentLanguageName();

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
          <Text style={styles.permissionTitle}><Ionicons name="camera-outline" size={64} color="#074173" /> Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Vocam needs camera access to detect objects and help you learn languages.
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
          photoUri={photo}
          detections={detections}
          isProcessing={isProcessing}
          onLanguagePress={() => setShowLanguageModal(true)}
          targetLanguage={targetLanguage}
          languageName={getCurrentLanguageName()}
          onRetakePhoto={() => {
            setPhoto(null);
            setDetections([]);
            setSelectedWords(new Set());
          }}
        >
          <View style={{ flex: 1 }}>
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
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) {
                          Alert.alert('Error', 'Please log in to save vocabulary');
                          return;
                        }

                        const translation = await TranslationService.translateText(manualWord.trim(), targetLanguage);
                        const example = await TranslationService.getExampleSentence(manualWord.trim(), targetLanguage);
                        
                        await handleSpeech(translation, targetLanguage);
                        
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
                        
                        const languageName = getCurrentLanguageName();
                        
                        if (result === 'success') {
                          Alert.alert(
                            'Word Added!', 
                            `✅ "${manualWord.trim()}" saved in ${languageName}\nTranslation: "${translation}"`,
                            [{
                              text: 'OK',
                              onPress: async () => {
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

  
  // Camera View
  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        facing={facing} 
        ref={cameraRef}
        zoom={0}
      />
      <CameraControls
        facing={facing}
        onFlipCamera={() => setFacing(facing === 'back' ? 'front' : 'back')}
        onTakePicture={takePicture}
        onUploadImage={uploadImage}
        onManualInput={() => setShowManualInput(true)}
        onLanguagePress={() => setShowLanguageModal(true)}
        modelStatus={modelStatus}
        languageName={getCurrentLanguageName()}
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
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        Alert.alert('Error', 'Please log in to save vocabulary');
                        return;
                      }

                      const translation = await TranslationService.translateText(manualWord.trim(), targetLanguage);
                      const example = await TranslationService.getExampleSentence(manualWord.trim(), targetLanguage);
                      
                      await handleSpeech(translation, targetLanguage);
                      
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
                      
                      const languageName = getCurrentLanguageName();
                      
                      if (result === 'success') {
                        Alert.alert(
                          'Word Added!', 
                          `✅ "${manualWord.trim()}" saved in ${languageName}\nTranslation: "${translation}"`,
                          [{
                            text: 'OK',
                            onPress: async () => {
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
  resultsSubtitle: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: -5,
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
  noResultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  noResultsSubtitle: {
    fontSize: 16,
    color: '#95a5a6',
    marginBottom: 20,
  },
  noResultsText: {
    fontSize: 16,
    color: '#95a5a6',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
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
  tipsContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 20,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  tipText: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 10,
  },
});