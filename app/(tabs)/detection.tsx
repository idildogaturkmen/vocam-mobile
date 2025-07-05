import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';

// Services
import DatabaseService from '../../src/services/DatabaseService';
import ObjectDetectionService from '../../src/services/ObjectDetectionService';
import TranslationService from '../../src/services/TranslationService';
import SpeechService from '../../src/services/SpeechService';
import { getDisplayAndVisionImage } from '../../src/services/ImageUtils';

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
  
  // Session states
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [wordsStudied, setWordsStudied] = useState(0);
  const [wordsLearned, setWordsLearned] = useState(0);

  const languages = {
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
    'Esperanto': 'eo',
    'Latin': 'la'
  };



  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      setModelStatus('loading');
      
      // Initialize all services
      await DatabaseService.initialize();
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
        const photoResult = await cameraRef.current.takePictureAsync({ skipProcessing: false });
        
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
        setWordsStudied(prev => prev + translatedResults.length);
        
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

  // Enhanced speech function that ensures text is valid
  const handleSpeech = async (text: string, language: string) => {
    try {
      // Validate text before speaking
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
      
      for (const detection of selectedDetections) {
        await DatabaseService.saveVocabularyWord(
          detection.translation || detection.label,
          detection.label,
          targetLanguage,
          detection.example || '',
          detection.exampleEnglish || '',
          detection.category,
          sessionId
        );
      }

      setWordsLearned(prev => prev + selectedDetections.length);
      
      Alert.alert(
        'Words Saved!', 
        `📚 ${selectedDetections.length} word${selectedDetections.length > 1 ? 's' : ''} saved to your vocabulary.`,
        [{ text: 'Continue Learning', onPress: () => setPhoto(null) }]
      );
      
      setSelectedWords(new Set());
      setDetections([]);
      setPhoto(null);
      
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Save Error', 'Failed to save words. Please try again.');
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
      </View>
    );
  }

  
  // Camera View
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
      {/* Controls are outside CameraView to avoid warning */}
      <CameraControls
        facing={facing}
        onFlipCamera={() => setFacing(facing === 'back' ? 'front' : 'back')}
        onTakePicture={takePicture}
        onManualInput={() => setShowManualInput(true)}
        onLanguagePress={() => setShowLanguageModal(true)}
        modelStatus={modelStatus}
        sessionId={sessionId}
        wordsStudied={wordsStudied}
        wordsLearned={wordsLearned}
        languageName={getCurrentLanguageName()}
        onStartSession={async () => {
          const id = await DatabaseService.createSession();
          if (id) setSessionId(id);
        }}
        onEndSession={async () => {
          if (sessionId) {
            await DatabaseService.endSession(sessionId, wordsStudied, wordsLearned);
            setSessionId(null);
            setWordsStudied(0);
            setWordsLearned(0);
          }
        }}
      />

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <ScrollView style={styles.languageList}>
              {Object.entries(languages).map(([name, code]) => (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.languageOption,
                    targetLanguage === code && styles.languageOptionActive
                  ]}
                  onPress={() => {
                    setTargetLanguage(code);
                    setShowLanguageModal(false);
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
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                      // Translate manual word
                      const translation = await TranslationService.translateText(manualWord.trim(), targetLanguage);
                      const example = await TranslationService.getExampleSentence(manualWord.trim(), targetLanguage);
                      
                      // Test pronunciation
                      await handleSpeech(translation, targetLanguage);
                      
                      // Save to database
                      await DatabaseService.saveVocabularyWord(
                        translation,
                        manualWord.trim(),
                        targetLanguage,
                        example.translated,
                        example.english,
                        'manual',
                        sessionId
                      );
                      
                      setWordsLearned(prev => prev + 1);
                      setShowManualInput(false);
                      setManualWord('');
                      
                      Alert.alert('Word Added!', `"${translation}" has been added to your vocabulary.`);
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
          </View>
        </View>
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
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
  }
});