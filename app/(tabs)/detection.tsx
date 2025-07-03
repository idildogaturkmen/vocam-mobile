import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DatabaseService from '../../src/services/DatabaseService';
import ObjectDetectionService from '../../src/services/ObjectDetectionService';
import TranslationService from '../../src/services/TranslationService';
import ImageAnnotationService from '../../src/services/ImageAnnotationService';
import BoundingBoxOverlay from '../../src/components/BoundingBoxOverlay';

const { width } = Dimensions.get('window');

interface ProcessingStats {
  processingTime: number;
  objectsDetected: number;
  avgConfidence: number;
  modelUsed: string;
}

interface Detection {
  label: string;
  confidence: number;
  bbox: number[];
  category: string;
  source: string;
  translation?: string;
  example?: string;
  exampleEnglish?: string;
  quality_score?: number;
  confidence_level?: string;
}

interface LanguageMap {
  [key: string]: string;
}

export default function DetectionScreen() {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWords, setSelectedWords] = useState(new Set<number>());
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [modelStatus, setModelStatus] = useState('loading');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [wordsStudied, setWordsStudied] = useState(0);
  const [wordsLearned, setWordsLearned] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualWord, setManualWord] = useState('');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [detectionSettings, setDetectionSettings] = useState({
    confidenceThreshold: 0.5,
    maxDetections: 10,
    enableAdvancedAI: true,
    showQualityScores: true
  });
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 1, height: 1 });
  const cameraRef = useRef<CameraView>(null);

  const languages: LanguageMap = {
    'Spanish': 'es',
    'French': 'fr', 
    'German': 'de',
    'Italian': 'it',
    'Portuguese': 'pt',
    'Russian': 'ru',
    'Japanese': 'ja',
    'Chinese (Simplified)': 'zh-CN'
  };

  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      setModelStatus('loading');
      console.log('🚀 Initializing Services...');
      
      // Initialize database
      await DatabaseService.initialize();
      console.log('✅ Database ready');
      
      // Initialize Google Vision object detection
      await ObjectDetectionService.initialize();
      console.log('✅ Google Vision Object Detection ready');
      setModelStatus('ready');
      
      // Get model info for status
      const modelInfo = ObjectDetectionService.getModelInfo();
      console.log('🎯 Detection Model Info:', modelInfo);
      
      console.log('🎉 All services ready!');
      
    } catch (error) {
      setModelStatus('error');
      console.error('❌ Service initialization failed:', error);
      
      // Show specific error message based on the error type
      let errorMessage = 'There was an issue initializing the detection service.';
      
      if (error.message.includes('API key')) {
        errorMessage = 'Google Vision API key is missing or invalid. Please:\n\n1. Set GOOGLE_CLOUD_VISION_API_KEY in your GitHub Codespace secrets\n2. Restart your Codespace\n3. Try again';
      }
      
      Alert.alert(
        'Initialization Error',
        errorMessage,
        [
          { text: 'Continue Anyway', style: 'cancel' },
          { text: 'Retry', onPress: initializeServices }
        ]
      );
    }
  };

  const detectObjectsWithAI = async (imageUri: string) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      console.log('🔍 Starting object detection...');
      
      const startTime = Date.now();
      const results = await ObjectDetectionService.detectObjects(imageUri, detectionSettings.confidenceThreshold);
      
      if (results && results.length > 0) {
        console.log('🌐 Translating detected objects...');
        
        const translatedResults = await Promise.all(
          results.slice(0, detectionSettings.maxDetections).map(async (detection: Detection) => {
            try {
              const translation = await TranslationService.translateText(detection.label, targetLanguage);
              const example = await TranslationService.getExampleSentence(detection.label, targetLanguage);
              
              return {
                ...detection,
                translation,
                example: example.translated,
                exampleEnglish: example.english,
                quality_score: detection.confidence * 100,
                confidence_level: detection.confidence > 0.8 ? 'High' : 
                                detection.confidence > 0.5 ? 'Medium' : 'Low'
              };
            } catch (error) {
              console.error('Translation error for', detection.label, error);
              // Return detection without translation if it fails
              return {
                ...detection,
                translation: detection.label,
                example: `I can see a ${detection.label}.`,
                exampleEnglish: `I can see a ${detection.label}.`,
                quality_score: detection.confidence * 100,
                confidence_level: detection.confidence > 0.8 ? 'High' : 
                                detection.confidence > 0.5 ? 'Medium' : 'Low'
              };
            }
          })
        );

        setDetections(translatedResults);
        setWordsStudied(prev => prev + translatedResults.length);

        // Set processing stats
        const processingTime = Date.now() - startTime;
        const stats: ProcessingStats = {
          processingTime,
          objectsDetected: translatedResults.length,
          avgConfidence: translatedResults.reduce((sum, det) => sum + det.confidence, 0) / translatedResults.length,
          modelUsed: 'Google Vision API'
        };
        setProcessingStats(stats);

        // Auto-select high confidence detections
        const highConfidenceIndices = new Set(
          translatedResults
            .map((detection, index) => ({ detection, index }))
            .filter(({ detection }) => detection.confidence > 0.7)
            .map(({ index }) => index)
        );
        setSelectedWords(highConfidenceIndices.size > 0 ? highConfidenceIndices : new Set([0]));
        
      } else {
        console.log('⚠️ No objects detected in the image');
        Alert.alert(
          'No Objects Found',
          'No objects were detected in this image. Try:\n• Better lighting\n• Clearer view of objects\n• Moving closer to objects',
          [
            { text: 'Manual Input', onPress: () => setShowManualInput(true) },
            { text: 'Try Again', onPress: () => setPhoto(null) }
          ]
        );
      }
      
    } catch (error) {
      console.error('❌ Detection error:', error);
      setIsProcessing(false);
      
      // Handle specific error types
      let errorTitle = 'Detection Failed';
      let errorMessage = 'Unable to analyze the image. ';
      
      if (error.message.includes('API key')) {
        errorTitle = 'API Key Missing';
        errorMessage = 'Google Vision API key not found. Please check your environment variables and restart the app.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorTitle = 'Network Error';
        errorMessage = 'Could not connect to Google Vision API. Please check your internet connection and try again.';
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorTitle = 'API Limit Reached';
        errorMessage = 'Google Vision API quota exceeded. Please try again later or check your API usage.';
      }
      
      Alert.alert(
        errorTitle,
        errorMessage,
        [
          { text: 'Manual Input', onPress: () => setShowManualInput(true) },
          { text: 'Retake Photo', onPress: () => setPhoto(null) },
          { text: 'OK', style: 'cancel' }
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualInput = async () => {
    if (!manualWord.trim()) {
      Alert.alert('Error', 'Please enter a word');
      return;
    }

    try {
      console.log('🖊️ Processing manual input:', manualWord);
      
      const translation = await TranslationService.translateText(manualWord.trim(), targetLanguage);
      const example = await TranslationService.getExampleSentence(manualWord.trim(), targetLanguage);

      const manualDetection: Detection = {
        label: manualWord.trim().toLowerCase(),
        confidence: 1.0,
        bbox: [0, 0, 1, 1],
        category: 'manual',
        source: 'manual_input',
        translation,
        example: example.translated,
        exampleEnglish: example.english,
        quality_score: 95,
        confidence_level: 'Manual Input'
      };

      setDetections([manualDetection]);
      setSelectedWords(new Set([0]));
      setShowManualInput(false);
      setManualWord('');
      
      console.log('✅ Manual input processed');
    } catch (error) {
      console.error('Manual input error:', error);
      Alert.alert('Error', 'Failed to process manual input');
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
    const languageEntry = Object.entries(languages).find(([_, code]) => code === targetLanguage);
    return languageEntry ? languageEntry[0] : 'Spanish';
  };

  const startSession = async () => {
    try {
      const id = await DatabaseService.createSession();
      if (id) {
        setSessionId(id);
        Alert.alert('Success', '🎓 Learning session started!');
      } else {
        throw new Error('Failed to create session');
      }
    } catch (error) {
      console.error('Session start error:', error);
      Alert.alert('Error', 'Failed to start session. You can still use the app.');
    }
  };

  const endSession = async () => {
    if (sessionId) {
      try {
        await DatabaseService.endSession(sessionId, wordsStudied, wordsLearned);
        Alert.alert('Session Complete', `📊 Words studied: ${wordsStudied}, Words learned: ${wordsLearned}`);
        setSessionId(null);
        setWordsStudied(0);
        setWordsLearned(0);
      } catch (error) {
        console.error('Session end error:', error);
        Alert.alert('Error', 'Failed to end session properly.');
      }
    }
  };

  const takePicture = async () => {
    if (cameraRef.current && modelStatus === 'ready') {
      try {
        console.log('📸 Taking picture with AI analysis...');
        const photoData = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        
        setPhoto(photoData.uri);
        await detectObjectsWithAI(photoData.uri);
      } catch (error) {
        console.error('Picture error:', error);
        Alert.alert('Error', 'Could not take picture. Please try again.');
      }
    } else if (modelStatus !== 'ready') {
      Alert.alert('Detection Loading', '🤖 Object detection is still loading. Please wait a moment.');
    }
  };

  const speakWord = async (text: string, language: string) => {
    try {
      // Stop any ongoing speech
      await Speech.stop();
      
      // Map language codes to speech-compatible codes
      const speechLanguageMap: { [key: string]: string } = {
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT',
        'ru': 'ru-RU',
        'ja': 'ja-JP',
        'zh-CN': 'zh-CN'
      };
      
      const speechLang = speechLanguageMap[language] || language;
      
      // Check if speech is available
      const isAvailable = await Speech.getAvailableVoicesAsync();
      const hasLanguage = isAvailable.some(voice => voice.language.startsWith(language));
      
      if (!hasLanguage) {
        console.log(`⚠️ Language ${speechLang} not available for speech`);
        Alert.alert('Speech Not Available', `Speech synthesis for ${getCurrentLanguageName()} is not available on your device.`);
        return;
      }
      
      // Speak with appropriate settings
      await Speech.speak(text, {
        language: speechLang,
        pitch: 1.0,
        rate: Platform.OS === 'ios' ? 0.5 : 0.7,
        onDone: () => console.log('✅ Speech completed'),
        onError: (error) => console.error('❌ Speech error:', error)
      });
    } catch (error) {
      console.error('Speech error:', error);
      Alert.alert('Speech Error', 'Unable to speak the word. Please check your device settings.');
    }
  };

  const saveSelectedWords = async () => {
    if (selectedWords.size === 0) {
      Alert.alert('No Selection', 'Please select at least one word to save.');
      return;
    }

    try {
      const selectedDetections = Array.from(selectedWords).map(index => detections[index]);
      
      // Auto-start session if needed
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        console.log('🎓 Auto-starting session for vocabulary save...');
        currentSessionId = await DatabaseService.createSession();
        if (currentSessionId) {
          setSessionId(currentSessionId);
        }
      }

      const savedCount = selectedDetections.length;
      
      for (const detection of selectedDetections) {
        await DatabaseService.saveVocabularyWord(
          detection.translation || detection.label,
          detection.label,
          targetLanguage,
          detection.example || `I can see a ${detection.label}.`,
          detection.exampleEnglish || `I can see a ${detection.label}.`,
          detection.category,
          currentSessionId
        );
      }

      setWordsStudied(prev => prev + savedCount);
      setWordsLearned(prev => prev + savedCount);
      
      Alert.alert(
        'Words Saved!', 
        `📚 ${savedCount} word${savedCount > 1 ? 's' : ''} saved to your vocabulary.`,
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

  const addManualWord = async () => {
    if (!manualWord.trim()) {
      Alert.alert('Empty Input', 'Please enter a word to translate.');
      return;
    }

    try {
      const translation = await TranslationService.translateText(manualWord.trim(), targetLanguage);
      
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await DatabaseService.createSession();
        if (currentSessionId) {
          setSessionId(currentSessionId);
        }
      }

      await DatabaseService.saveVocabularyWord(
        translation,
        manualWord.trim(),
        targetLanguage,
        `I can use the word "${manualWord.trim()}".`,
        `I can use the word "${manualWord.trim()}".`,
        'manual',
        currentSessionId
      );

      setWordsLearned(prev => prev + 1);
      
      Alert.alert(
        'Word Added!',
        `📚 "${manualWord.trim()}" → "${translation}" added to your vocabulary.`,
        [{ text: 'Add Another', onPress: () => setManualWord('') }]
      );
      
      setShowManualInput(false);
      setManualWord('');
      
    } catch (error) {
      console.error('Manual word error:', error);
      Alert.alert('Error', 'Failed to add manual word. Please try again.');
    }
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 20 }} />
        <Text style={styles.permissionMessage}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionMessage}>🔒 Camera permission required for object detection</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show photo results
  if (photo) {
    return (
      <ScrollView style={styles.container} bounces={false}>
        {/* Header with language selection */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Detection Results</Text>
          <TouchableOpacity 
            style={styles.languageChip} 
            onPress={() => setShowLanguageModal(true)}
          >
            <Text style={styles.languageChipText}>🌍 {getCurrentLanguageName()}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photoContainer}>
          <Image 
            source={{ uri: photo }} 
            style={styles.capturedPhoto}
            resizeMode="contain"
            onLoad={(event) => {
              const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
              setImageDimensions({ width: imgWidth, height: imgHeight });
            }}
          />
          {detections.length > 0 && imageDimensions.width > 1 && (
            <BoundingBoxOverlay
              detections={detections}
              imageWidth={imageDimensions.width}
              imageHeight={imageDimensions.height}
              containerWidth={width}
              containerHeight={width * (imageDimensions.height / imageDimensions.width)}
            />
          )}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.processingText}>🤖 Analyzing image...</Text>
            </View>
          )}
        </View>

        {processingStats && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>📊 Analysis Results</Text>
            <Text style={styles.statsText}>
              Found {processingStats.objectsDetected} objects in {processingStats.processingTime}ms
            </Text>
            <Text style={styles.statsText}>
              Average confidence: {(processingStats.avgConfidence * 100).toFixed(1)}%
            </Text>
          </View>
        )}

        {detections.length > 0 && (
          <View style={styles.detectionsContainer}>
            <Text style={styles.detectionsTitle}>
              🎯 Found {detections.length} Object{detections.length > 1 ? 's' : ''}
            </Text>
            
            {detections.map((detection, index) => (
              <View key={index} style={styles.detectionCard}>
                <View style={styles.detectionHeader}>
                  <View style={styles.detectionTitleRow}>
                    <Text style={styles.detectionLabel}>{detection.label}</Text>
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {(detection.confidence * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.translationRow}>
                    <View style={styles.translationTextContainer}>
                      <Text style={styles.translationLabel}>→ {detection.translation}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.audioButton}
                      onPress={() => speakWord(detection.translation || detection.label, targetLanguage)}
                    >
                      <Text style={{ color: '#3498db', fontSize: 20 }}>🔊</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.selectButton, selectedWords.has(index) && styles.selectButtonActive]}
                    onPress={() => toggleWordSelection(index)}
                  >
                    <Text style={{ 
                      color: selectedWords.has(index) ? "#fff" : "#3498db",
                      fontSize: 20 
                    }}>
                      {selectedWords.has(index) ? "✅" : "⭕"}
                    </Text>
                    <Text style={[
                      styles.selectButtonText,
                      selectedWords.has(index) && styles.selectButtonTextActive
                    ]}>
                      {selectedWords.has(index) ? 'Selected' : 'Select'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {detection.example && (
                  <View style={styles.exampleContainer}>
                    <Text style={styles.exampleLabel}>Example:</Text>
                    <Text style={styles.exampleTranslated}>{detection.example}</Text>
                    <Text style={styles.exampleEnglish}>{detection.exampleEnglish || 'Example not available'}</Text>
                    <TouchableOpacity
                      style={styles.exampleAudioButton}
                      onPress={() => speakWord(detection.example || '', targetLanguage)}
                    >
                      <Text style={{ color: '#3498db', fontSize: 16 }}>▶️</Text>
                      <Text style={styles.exampleAudioText}>Play Example</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.saveButton} onPress={saveSelectedWords}>
                <Text style={{ color: 'white', fontSize: 20 }}>💾</Text>
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
                  setProcessingStats(null);
                }}
              >
                <Text style={{ color: 'white', fontSize: 20 }}>📷</Text>
                <Text style={styles.retakeButtonText}>Take Another</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // Main Camera View
  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        {/* Top Controls Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity 
            style={styles.topBarButton}
            onPress={() => setShowLanguageModal(true)}
          >
            <Text style={styles.topBarIcon}>🌍</Text>
            <Text style={styles.topBarText}>{getCurrentLanguageName()}</Text>
          </TouchableOpacity>
          
          <View style={styles.sessionInfo}>
            {sessionId ? (
              <TouchableOpacity 
                style={styles.sessionBadge}
                onPress={endSession}
              >
                <Text style={styles.sessionBadgeText}>
                  📚 {wordsStudied} | 🎯 {wordsLearned}
                </Text>
                <Text style={styles.endSessionText}>End</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.startSessionBadge}
                onPress={startSession}
              >
                <Text style={styles.startSessionText}>Start Session</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Bottom Camera Controls */}
        <View style={styles.bottomControls}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}>
              <Text style={{ color: 'white', fontSize: 24 }}>🔄</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.captureButton,
                modelStatus !== 'ready' && styles.captureButtonDisabled
              ]} 
              onPress={takePicture}
              disabled={modelStatus !== 'ready'}
            >
              <Text style={{ color: 'white', fontSize: 32 }}>📷</Text>
              {modelStatus === 'loading' && (
                <ActivityIndicator size="small" color="white" style={styles.captureLoader} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.button} onPress={() => setShowManualInput(true)}>
              <Text style={{ color: 'white', fontSize: 24 }}>✏️</Text>
            </TouchableOpacity>
          </View>
          
          {/* Status Text */}
          <Text style={styles.statusText}>
            {modelStatus === 'loading' && '🔄 Loading AI Model...'}
            {modelStatus === 'ready' && '✅ Ready to detect objects'}
            {modelStatus === 'error' && '❌ AI Error - Check API key'}
          </Text>
        </View>
      </CameraView>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ Add Word Manually</Text>
            <TextInput
              style={styles.manualInput}
              placeholder="Enter a word (e.g., book, apple)"
              value={manualWord}
              onChangeText={setManualWord}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]} 
                onPress={() => {
                  setShowManualInput(false);
                  setManualWord('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm]} 
                onPress={handleManualInput}
              >
                <Text style={styles.modalButtonText}>Translate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🌍 Select Language</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  permissionMessage: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
  },
  permissionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  topBarIcon: {
    fontSize: 20,
    marginRight: 5,
  },
  topBarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionInfo: {
    alignItems: 'flex-end',
  },
  sessionBadge: {
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 10,
  },
  sessionBadgeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  endSessionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.3)',
    paddingLeft: 10,
  },
  startSessionBadge: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  startSessionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  captureButtonDisabled: {
    backgroundColor: '#7f8c8d',
  },
  captureLoader: {
    position: 'absolute',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 15,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60, // Add space for status bar
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  languageChip: {
    backgroundColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  languageChipText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  photoContainer: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    width: width,
    alignItems: 'center',
  },
  capturedPhoto: {
    width: width,
    height: undefined,
    aspectRatio: 1,
    maxHeight: width * 1.5,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  statsContainer: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    padding: 15,
  },
  statsTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  statsText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  detectionsContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  detectionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  detectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  detectionHeader: {
    marginBottom: 10,
  },
  detectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textTransform: 'capitalize',
  },
  confidenceBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  translationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  translationTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  translationLabel: {
    fontSize: 20,
    color: '#27ae60',
    fontWeight: '600',
  },
  audioButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 10,
  },
  selectButtonActive: {
    backgroundColor: '#3498db',
  },
  selectButtonText: {
    color: '#3498db',
    marginLeft: 5,
    fontWeight: '600',
  },
  selectButtonTextActive: {
    color: 'white',
  },
  exampleContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  exampleLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  exampleTranslated: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 22,
  },
  exampleEnglish: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  exampleAudioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  exampleAudioText: {
    color: '#3498db',
    marginLeft: 5,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
  },
  retakeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
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
  manualInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#ecf0f1',
  },
  modalButtonConfirm: {
    backgroundColor: '#3498db',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
});