import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import DatabaseService from '../../src/services/DatabaseService';
import ObjectDetectionService from '../../src/services/ObjectDetectionService'; // Updated import
import TranslationService from '../../src/services/TranslationService';

//import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-platform-react-native';
import '@tensorflow/tfjs-react-native';


// Import the router

// Initialize TensorFlow.js
//tf.ready().then(() => {
//  console.log('TensorFlow.js ready for object detection!');
//});

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

export default function EnhancedCameraScreen() {
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
      
      // Initialize object detection
      const detectionReady = await ObjectDetectionService.initialize();
      if (detectionReady) {
        console.log('✅ Object Detection ready');
        setModelStatus('ready');
        
        // Get model info for status
        const modelInfo = ObjectDetectionService.getModelInfo();
        console.log('🎯 Detection Model Info:', modelInfo);
      } else {
        throw new Error('Object detection initialization failed');
      }
      
      console.log('🎉 All services ready!');
      
    } catch (error) {
      setModelStatus('error');
      console.error('❌ Service initialization failed:', error);
      Alert.alert(
        'Initialization Error',
        'There was an issue initializing the detection service. The app will still work but with limited functionality.',
        [{ text: 'Continue' }]
      );
    }
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

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>🔒 Camera permission required for object detection</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  const detectObjectsWithAI = async (imageUri: string) => {
    setIsProcessing(true);
    setDetections([]);
    setProcessingStats(null);
    
    try {
      console.log('🔍 Starting object detection...');
      const startTime = Date.now();
      
      // Use the updated object detection service
      const detectedObjects = await ObjectDetectionService.detectObjects(
        imageUri, 
        detectionSettings.confidenceThreshold,
        0.45 // IoU threshold
      );
      
      const processingTime = Date.now() - startTime;
      console.log(`⚡ Detection completed in ${processingTime}ms`);
      
      // Update processing stats
      setProcessingStats({
        processingTime,
        objectsDetected: detectedObjects.length,
        avgConfidence: detectedObjects.length > 0 
          ? (detectedObjects.reduce((sum: number, obj: Detection) => sum + obj.confidence, 0) / detectedObjects.length)
          : 0,
        modelUsed: 'Fallback Mock Detection'
      });
      
      if (detectedObjects.length === 0) {
        Alert.alert(
          'No Objects Detected',
          '🔍 No objects were found in the image. Would you like to try manual input?',
          [
            { text: 'Manual Input', onPress: () => setShowManualInput(true) },
            { text: 'Retake Photo', onPress: () => setPhoto(null) }
          ]
        );
        return;
      }
      
      // Limit detections based on settings
      const limitedDetections = detectedObjects.slice(0, detectionSettings.maxDetections);
      
      // Translate detected objects
      console.log('🌐 Translating detected objects...');
      const translatedDetections = await Promise.all(
        limitedDetections.map(async (detection: Detection, index: number) => {
          try {
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
              processingOrder: index + 1,
              detectionTimestamp: new Date().toISOString()
            };
          } catch (translationError) {
            console.error('Translation error for', detection.label, translationError);
            return {
              ...detection,
              translation: detection.label,
              example: `I can see a ${detection.label}.`,
              exampleEnglish: `I can see a ${detection.label}.`,
              processingOrder: index + 1,
              detectionTimestamp: new Date().toISOString()
            };
          }
        })
      );
      
      console.log('✅ Detection and translation complete');
      setDetections(translatedDetections);
      
      // Auto-select high-confidence detections
      const highConfidenceIndices = new Set(
        translatedDetections
          .map((det, index) => ({ det, index }))
          .filter(({ det }) => det.confidence >= 0.7)
          .map(({ index }) => index)
      );
      
      setSelectedWords(highConfidenceIndices.size > 0 ? highConfidenceIndices : new Set([0]));
      
    } catch (error) {
      console.error('❌ Object detection failed:', error);
      Alert.alert(
        'Detection Error',
        'Object detection encountered an issue. This is using mock detection for testing.',
        [
          { text: 'Manual Input', onPress: () => setShowManualInput(true) },
          { text: 'Retry', onPress: () => detectObjectsWithAI(imageUri) },
          { text: 'Cancel', onPress: () => setPhoto(null) }
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
        quality_score: 0.95,
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

  const speakWord = (text: string, language: string) => {
    try {
      Speech.speak(text, {
        language: language,
        pitch: 1.0,
        rate: 0.8,
      });
    } catch (error) {
      console.error('Speech error:', error);
      Alert.alert('Speech Error', 'Text-to-speech is not available');
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

  const saveSelectedWords = async () => {
    const wordsToSave = detections.filter((_, index) => selectedWords.has(index));
    
    if (wordsToSave.length === 0) {
      Alert.alert('No Selection', 'Please select at least one word to save');
      return;
    }

    // Auto-start session if needed
    if (!sessionId) {
      try {
        const id = await DatabaseService.createSession();
        if (id) {
          setSessionId(id);
          console.log('✅ Auto-started learning session');
        }
      } catch (error) {
        console.error('Auto-start session error:', error);
      }
    }

    try {
      console.log(`💾 Saving ${wordsToSave.length} detected words...`);
      let savedCount = 0;
      
      for (const detection of wordsToSave) {
        try {
          const wordData = {
            original: detection.label,
            translated: detection.translation,
            language: targetLanguage,
            category: detection.category || 'detection',
            imagePath: photo,
            source: detection.source || 'camera'
          };
          
          const result = await DatabaseService.addVocabulary(wordData);
          if (result) {
            savedCount++;
            setWordsStudied(prev => prev + 1);
            setWordsLearned(prev => prev + 1);
            console.log(`✅ Saved: ${detection.label} -> ${detection.translation}`);
          }
        } catch (wordError) {
          console.error(`❌ Failed to save ${detection.label}:`, wordError);
        }
      }
      
      if (savedCount > 0) {
        Alert.alert(
          '🎉 Success!', 
          `Saved ${savedCount} words to your vocabulary!`,
          [
            { 
              text: 'Continue Learning', 
              onPress: () => {
                setPhoto(null);
                setDetections([]);
                setSelectedWords(new Set());
                setProcessingStats(null);
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to save any words. Please try again.');
      }
      
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save words');
    }
  };

  const getStatusColor = () => {
    switch (modelStatus) {
      case 'ready': return '#27ae60';
      case 'loading': return '#f39c12';
      case 'error': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getStatusText = () => {
    switch (modelStatus) {
      case 'ready': return '🤖 Detection Ready';
      case 'loading': return '⏳ Loading...';
      case 'error': return '❌ Offline';
      default: return '⚪ Unknown';
    }
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.9) return '#27ae60';
    if (confidence >= 0.8) return '#2ecc71';
    if (confidence >= 0.7) return '#f39c12';
    if (confidence >= 0.6) return '#e67e22';
    return '#e74c3c';
  };

  // Advanced Settings Modal
  const AdvancedSettingsModal = () => (
    <Modal
      visible={showAdvancedSettings}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAdvancedSettings(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.advancedModalContent}>
          <Text style={styles.modalTitle}>🔬 Advanced AI Settings</Text>
          
          <ScrollView>
            <View style={styles.settingSection}>
              <Text style={styles.settingTitle}>Detection Confidence</Text>
              <Text style={styles.settingDescription}>Minimum confidence for object detection</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Low (50%)</Text>
                <View style={styles.sliderTrack}>
                  <TouchableOpacity
                    style={[styles.sliderThumb, { 
                      left: `${(detectionSettings.confidenceThreshold - 0.5) * 100}%` 
                    }]}
                    onPress={() => {
                      // Simple slider implementation
                      const newValue = detectionSettings.confidenceThreshold >= 0.8 ? 0.5 : 
                                     detectionSettings.confidenceThreshold + 0.1;
                      setDetectionSettings({
                        ...detectionSettings,
                        confidenceThreshold: newValue
                      });
                    }}
                  />
                </View>
                <Text style={styles.sliderLabel}>High (90%)</Text>
              </View>
              <Text style={styles.currentValue}>
                Current: {Math.round(detectionSettings.confidenceThreshold * 100)}%
              </Text>
            </View>

            <View style={styles.settingSection}>
              <Text style={styles.settingTitle}>Max Detections</Text>
              <Text style={styles.settingDescription}>Maximum objects to detect per image</Text>
              <View style={styles.buttonGroup}>
                {[5, 10, 15, 20].map(value => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.optionButton,
                      detectionSettings.maxDetections === value && styles.optionButtonActive
                    ]}
                    onPress={() => setDetectionSettings({
                      ...detectionSettings,
                      maxDetections: value
                    })}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      detectionSettings.maxDetections === value && styles.optionButtonTextActive
                    ]}>
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingSection}>
              <Text style={styles.settingTitle}>AI Features</Text>
              <TouchableOpacity
                style={styles.toggleOption}
                onPress={() => setDetectionSettings({
                  ...detectionSettings,
                  enableAdvancedAI: !detectionSettings.enableAdvancedAI
                })}
              >
                <Text style={styles.toggleText}>Advanced AI Detection</Text>
                <View style={[
                  styles.toggle,
                  detectionSettings.enableAdvancedAI && styles.toggleActive
                ]}>
                  <View style={[
                    styles.toggleThumb,
                    detectionSettings.enableAdvancedAI && styles.toggleThumbActive
                  ]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleOption}
                onPress={() => setDetectionSettings({
                  ...detectionSettings,
                  showQualityScores: !detectionSettings.showQualityScores
                })}
              >
                <Text style={styles.toggleText}>Show Quality Scores</Text>
                <View style={[
                  styles.toggle,
                  detectionSettings.showQualityScores && styles.toggleActive
                ]}>
                  <View style={[
                    styles.toggleThumb,
                    detectionSettings.showQualityScores && styles.toggleThumbActive
                  ]} />
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setShowAdvancedSettings(false)}
          >
            <Text style={styles.closeModalText}>Apply Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Language Selection Modal (unchanged from your original)
  const LanguageModal = () => (
    <Modal
      visible={showLanguageModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowLanguageModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.languageModalContent}>
          <Text style={styles.modalTitle}>Select Target Language</Text>
          
          <ScrollView>
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
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={() => setShowLanguageModal(false)}
          >
            <Text style={styles.closeModalText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Manual Input Modal (unchanged from your original)
  const ManualInputModal = () => (
    <Modal
      visible={showManualInput}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowManualInput(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Manual Object Input</Text>
          <Text style={styles.modalSubtitle}>What object do you see?</Text>
          
          <TextInput
            style={styles.textInput}
            placeholder="e.g., cup, book, phone..."
            value={manualWord}
            onChangeText={setManualWord}
            autoFocus={true}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowManualInput(false);
                setManualWord('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={handleManualInput}
            >
              <Text style={styles.confirmButtonText}>Add Word</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Detection Results Screen with Advanced Features
  if (photo && (detections.length > 0 || isProcessing)) {
    return (
      <ScrollView style={styles.container}>
        <Image source={{ uri: photo }} style={styles.previewImage} />
        
        {isProcessing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>🤖 Detecting objects in your image...</Text>
            <Text style={styles.loadingSubtext}>Using Faster R-CNN detection</Text>
          </View>
        ) : (
          <View style={styles.detectionsContainer}>
            {/* Processing Stats */}
            {processingStats && (
              <View style={styles.statsContainer}>
                <Text style={styles.statsTitle}>📊 Detection Stats</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{processingStats.processingTime || 0}ms</Text>
                    <Text style={styles.statLabel}>Processing Time</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{processingStats.objectsDetected || 0}</Text>
                    <Text style={styles.statLabel}>Objects Found</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{Math.round((processingStats.avgConfidence || 0) * 100)}%</Text>
                    <Text style={styles.statLabel}>Avg Confidence</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>✨ Detected Objects</Text>
            
            {detections.map((detection, index) => (
              <View key={index} style={styles.enhancedDetectionCard}>
                <View style={styles.detectionHeader}>
                  <Text style={styles.originalWord}>{detection.label}</Text>
                  <View style={styles.badgeContainer}>
                    <View style={[
                      styles.confidenceBadge,
                      { backgroundColor: getConfidenceBadgeColor(detection.confidence) }
                    ]}>
                      <Text style={styles.confidenceBadgeText}>
                        {Math.round(detection.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                </View>
                
                <Text style={styles.translatedWord}>→ {detection.translation || detection.label}</Text>
                
                <View style={styles.detectionActions}>
                  <TouchableOpacity
                    style={styles.audioButton}
                    onPress={() => speakWord(detection.translation || detection.label, targetLanguage)}
                  >
                    <Ionicons name="volume-high" size={20} color="#3498db" />
                    <Text style={styles.audioButtonText}>Listen</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      selectedWords.has(index) && styles.selectButtonActive
                    ]}
                    onPress={() => toggleWordSelection(index)}
                  >
                    <Ionicons 
                      name={selectedWords.has(index) ? "checkmark-circle" : "ellipse-outline"} 
                      size={20} 
                      color={selectedWords.has(index) ? "#fff" : "#3498db"} 
                    />
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
                    <Text style={styles.exampleEnglish}>{detection.exampleEnglish || 'Example not available'}</Text>
                    <Text style={styles.exampleTranslated}>{detection.example}</Text>
                    <TouchableOpacity
                      style={styles.exampleAudioButton}
                      onPress={() => speakWord(detection.example || detection.exampleEnglish || '', targetLanguage)}
                    >
                      <Ionicons name="play" size={16} color="#3498db" />
                      <Text style={styles.exampleAudioText}>Play Example</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
            
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.saveButton} onPress={saveSelectedWords}>
                <Ionicons name="save" size={20} color="#fff" />
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
                <Ionicons name="camera" size={20} color="#fff" />
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
      {/* Session Management */}
      <View style={styles.sessionContainer}>
        {sessionId ? (
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionText}>
              🎓 Session Active - Words: {wordsLearned}
            </Text>
            <TouchableOpacity style={styles.endSessionButton} onPress={endSession}>
              <Text style={styles.endSessionText}>End</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.startSessionButton} onPress={startSession}>
            <Text style={styles.startSessionText}>🚀 Start Learning Session</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef} />
        
        {/* Camera Overlay */}
        <View style={styles.overlay}>
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={() => setFacing(current => current === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.languageSelector}
              onPress={() => setShowLanguageModal(true)}
            >
              <Text style={styles.languageText}>🌐 {getCurrentLanguageName()}</Text>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusText}>{getStatusText()}</Text>
            </View>
          </View>

          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>🤖 Object Detection Learning</Text>
            <Text style={styles.instructionSubtext}>
              Point at objects for detection in {getCurrentLanguageName()}!
            </Text>
            {processingStats && (
              <Text style={styles.lastStatsText}>
                Last scan: {processingStats.objectsDetected || 0} objects in {processingStats.processingTime || 0}ms
              </Text>
            )}
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => setShowManualInput(true)}
            >
              <Ionicons name="create" size={24} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.captureButton,
                modelStatus !== 'ready' && styles.captureButtonDisabled
              ]} 
              onPress={takePicture}
              disabled={modelStatus === 'loading'}
            >
              <View style={styles.captureButtonInner}>
                {modelStatus === 'loading' ? (
                  <ActivityIndicator size="small" color="#3498db" />
                ) : (
                  <Ionicons name="scan" size={30} color="#3498db" />
                )}
              </View>
            </TouchableOpacity>
            
            <View style={styles.placeholder} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ... (keeping all your existing styles and adding new ones)
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  sessionContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  sessionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.9)',
    padding: 10,
    borderRadius: 20,
  },
  sessionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  endSessionButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  endSessionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  startSessionButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  startSessionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 18,
    padding: 20,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 100,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  advancedSettingsButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.8)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
    marginBottom: 10,
  },
  languageText: {
    color: 'white',
    fontSize: 14,
    marginRight: 5,
  },
  statusContainer: {
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  instructionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  instructionText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  instructionSubtext: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  lastStatsText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(52, 152, 219, 0.7)',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 50,
  },
  manualButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  previewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  loadingSubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#3498db',
    fontWeight: '500',
  },
  detectionsContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  enhancedDetectionCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  detectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalWord: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  confidenceBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  qualityBadge: {
    backgroundColor: '#9b59b6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 5,
  },
  qualityBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  translatedWord: {
    fontSize: 18,
    color: '#3498db',
    marginBottom: 8,
    fontWeight: '600',
  },
  confidenceLevel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  detectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  audioButtonText: {
    marginLeft: 5,
    color: '#3498db',
    fontWeight: '500',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  selectButtonActive: {
    backgroundColor: '#3498db',
  },
  selectButtonText: {
    marginLeft: 5,
    color: '#3498db',
    fontWeight: '500',
  },
  selectButtonTextActive: {
    color: '#fff',
  },
  exampleContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  exampleEnglish: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 4,
  },
  exampleTranslated: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '500',
    marginBottom: 8,
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
  metadataContainer: {
    backgroundColor: '#f1f2f6',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  metadataText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27ae60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 0.48,
    justifyContent: 'center',
  },
  saveButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#95a5a6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 0.48,
    justifyContent: 'center',
  },
  retakeButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  advancedModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#2c3e50',
  },
  modalSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  settingSection: {
    marginBottom: 25,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginHorizontal: 15,
    position: 'relative',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#3498db',
    borderRadius: 10,
    top: -7,
    marginLeft: -10,
  },
  currentValue: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  optionButtonText: {
    color: '#2c3e50',
    fontWeight: '500',
  },
  optionButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toggleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  toggleText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e9ecef',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#3498db',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 0.45,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  confirmButton: {
    backgroundColor: '#3498db',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  languageModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 5,
    backgroundColor: '#f8f9fa',
  },
  languageOptionActive: {
    backgroundColor: '#3498db',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  languageOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeModalButton: {
    backgroundColor: '#27ae60',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  },
  closeModalText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    margin: 20,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});