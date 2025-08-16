import { CameraView, useCameraPermissions } from 'expo-camera';

// Conditionally import VisionCamera for development builds (not Expo Go)
let VisionCamera: any = null;
try {
  // Only try to load VisionCamera if we're in a development build with react-native-vision-camera
  if (__DEV__ && typeof require !== 'undefined') {
    VisionCamera = require('../../src/components/detection/VisionCamera').default;
    console.log('✅ VisionCamera loaded successfully');
  }
} catch (error) {
  console.log('ℹ️ VisionCamera not available in this build (Expo Go)');
  VisionCamera = null;
}
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
  Pressable,
  Platform
} from 'react-native';
import { normalizeFont, scale } from '../../utils/normalize';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Entypo from '@expo/vector-icons/Entypo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

// Services
import ObjectDetectionService from '../../src/services/ObjectDetectionService';
import TranslationService from '../../src/services/TranslationService';
import SpeechService from '../../src/services/SpeechService';
import VocabularyService from '../../src/services/VocabularyService';
import type { SaveWordResult } from '../../src/services/VocabularyService';
import SessionService from '../../src/services/SessionService';
import ExampleSentenceGenerator from '@/src/services/example-sentences/ExampleSentenceGenerator';
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
  const cameraRef = useRef<any>(null); // Changed to support both CameraView and VisionCamera
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const router = useRouter();

  // Detection states
  const [photo, setPhoto] = useState<string | null>(null);
  const [rotatedPhoto, setRotatedPhoto] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedWords, setSelectedWords] = useState(new Set<number>());
  const [useCallbackMethod, setUseCallbackMethod] = useState(false);
  const [useVisionCamera, setUseVisionCamera] = useState(!!VisionCamera && Platform.OS === 'android'); // Use VisionCamera if available
  
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

  // Handle camera permission and authentication changes
  useEffect(() => {
    if (permission?.granted && isAuthenticated && isTabFocused) {
      setIsCameraActive(true);
    } else {
      setIsCameraActive(false);
      setIsCameraReady(false);
    }
  }, [permission?.granted, isAuthenticated, isTabFocused]);

  // Note: onCameraReady callback is unreliable on Android, using timer-based approach instead

  // Camera ready detection: VisionCamera handles this internally, fallback timer for expo-camera
  useEffect(() => {
    if (isCameraActive && isTabFocused) {
      if (useVisionCamera) {
        console.log('🎯 VisionCamera activated - ready immediately');
        setIsCameraReady(true);
      } else {
        console.log('📷 Expo Camera activated - starting ready timer');
        const readyTimer = setTimeout(() => {
          console.log('⏰ Expo Camera ready timer fired');
          setIsCameraReady(true);
        }, 2000);
        
        return () => clearTimeout(readyTimer);
      }
    } else {
      setIsCameraReady(false);
    }
  }, [isCameraActive, isTabFocused, useVisionCamera]);

  // Handle focus/blur to reset camera state when returning from other screens
  useFocusEffect(
    React.useCallback(() => {
      // Reset any processing state when screen comes into focus
      console.log('Detection screen focused - resetting camera state');
      setIsTabFocused(true);
      setIsProcessing(false);
      
      // Also clear any previous photo states that might be interfering
      setPhoto(null);
      setRotatedPhoto(null);
      setDetections([]);
      setSelectedWords(new Set<number>());
      
      // Activate camera after a short delay to ensure proper mounting
      const activateTimer = setTimeout(() => {
        if (permission?.granted && isAuthenticated) {
          console.log('✅ Activating camera after tab focus');
          setIsCameraActive(true);
          initializeServices();
        }
      }, 100);
      
      return () => {
        // Deactivate camera when screen loses focus
        console.log('Detection screen unfocused - deactivating camera');
        setIsTabFocused(false);
        setIsCameraActive(false);
        setIsCameraReady(false);
        clearTimeout(activateTimer);
      };
    }, [permission?.granted, isAuthenticated])
  );

  const checkAuthAndInitialize = async () => {
      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
              setIsAuthenticated(false);
              return;
          }
          
          setIsAuthenticated(true);
          await initializeServices();
          
          // Only activate camera if permission is granted and we're on this tab
          if (permission?.granted) {
            setIsCameraActive(true);
          }
      } catch (error) {
          console.error('Auth check error:', error);
          setIsAuthenticated(false);
      }
  };

  // Emergency camera reset function
  const emergencyResetCamera = () => {
    console.log('🚨 Emergency camera reset triggered');
    setIsProcessing(false);
    setPhoto(null);
    setRotatedPhoto(null);
    setDetections([]);
    setSelectedWords(new Set<number>());
    
    // Reset camera active and ready state
    setIsCameraActive(false);
    setIsCameraReady(false);
    setTimeout(() => {
      if (isTabFocused && permission?.granted && isAuthenticated) {
        setIsCameraActive(true);
        console.log('✅ Camera reactivated after emergency reset - waiting for onCameraReady');
      }
    }, 1000);
    
    console.log('✅ Camera state forcibly reset');
  };

  // Expose emergency reset globally for debugging
  React.useEffect(() => {
    (global as any).resetCamera = emergencyResetCamera;
    return () => {
      delete (global as any).resetCamera;
    };
  }, []);

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

  // Reset camera and detection states
  const resetCameraState = () => {
    setPhoto(null);
    setRotatedPhoto(null);
    setDetections([]);
    setSelectedWords(new Set<number>());
    setIsProcessing(false);
    
    // Ensure camera stays active for immediate reuse
    if (!isCameraActive && isTabFocused && permission?.granted && isAuthenticated) {
      setIsCameraActive(true);
    }
  };

  const takePicture = async () => {
    // Enhanced camera readiness checks with fallback approach
    if (!cameraRef.current || modelStatus !== 'ready' || !isCameraActive || !isTabFocused) {
      console.log('Camera basic checks failed:', { 
        hasCamera: !!cameraRef.current, 
        modelStatus, 
        permission: permission?.granted,
        isCameraActive,
        isTabFocused,
        isCameraReady
      });
      
      // If camera is inactive due to tab switching, reactivate it
      if (!isCameraActive && isTabFocused && permission?.granted && isAuthenticated) {
        console.log('🔄 Reactivating camera after tab switch');
        setIsCameraActive(true);
        setIsCameraReady(false); // Reset ready state for reactivation
        // Wait a bit for camera to initialize before allowing photo capture
        setTimeout(() => {
          console.log('✅ Camera reactivated, waiting for ready state');
        }, 1000);
      }
      return;
    }

    // Special handling for camera ready state - be more lenient for Android
    if (!isCameraReady && !useVisionCamera && Platform.OS !== 'android') {
      console.log('⚠️ Camera not ready yet (iOS)');
      Alert.alert(
        'Camera Initializing', 
        'Camera is starting up, please wait a moment and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // For Android, try anyway even if not "ready" since onCameraReady is unreliable
    if (!isCameraReady && Platform.OS === 'android' && !useVisionCamera) {
      console.log('⚠️ Android camera not marked ready, but attempting anyway...');
    }

    // Always allow photo capture, but prevent multiple simultaneous captures
    if (isProcessing) {
      console.log('Camera is busy processing, please wait');
      return;
    }

    console.log('Taking picture...');

    let safetyTimeout: any = null;

    try {
      // Reset previous states first (synchronously)
      setPhoto(null);
      setRotatedPhoto(null);
      setDetections([]);
      setSelectedWords(new Set<number>());
      
      // Set processing state after reset
      setIsProcessing(true);

      // Set a safety timeout to reset processing state if something goes wrong
      safetyTimeout = setTimeout(() => {
        console.warn('⚠️ Camera processing timeout - forcing reset');
        setIsProcessing(false);
        // Try to reactivate camera on timeout
        if (isTabFocused && permission?.granted && isAuthenticated) {
          console.log('🔄 Reactivating camera after timeout');
          setIsCameraActive(false);
          setTimeout(() => setIsCameraActive(true), 500);
        }
      }, 12000); // Reasonable timeout since we're using simpler approach now

      // Enhanced stability delay for Android after tab switching
      const stabilityDelay = Platform.OS === 'android' ? 800 : 400;
      await new Promise(resolve => setTimeout(resolve, stabilityDelay));
      
      // Triple-check camera ref is still valid and camera is active
      if (!cameraRef.current || !isCameraActive) {
        throw new Error('Camera reference lost or inactive - please try again');
      }

      console.log('📸 Taking picture with camera library...');
      
      let photoResult: any = null;
      
      if (useVisionCamera && VisionCamera) {
        console.log('🎯 Using VisionCamera for reliable Android capture...');
        // VisionCamera handles timeouts and reliability internally
        photoResult = await cameraRef.current.takePictureAsync();
      } else {
        console.log('📷 Using Expo Camera with optimizations...');
        // AGGRESSIVE ANDROID FIX: Multiple fallback strategies
        if (Platform.OS === 'android') {
          console.log('🤖 Android: Trying multiple capture strategies...');
          
          try {
            // Strategy 1: Minimal options with short timeout
            console.log('📱 Strategy 1: Minimal options');
            photoResult = await Promise.race([
              cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: false,
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Strategy 1 timeout')), 5000)
              )
            ]);
            console.log('✅ Strategy 1 succeeded');
          } catch (error) {
            console.log('⚠️ Strategy 1 failed, trying Strategy 2...');
            
            try {
              // Strategy 2: Empty options object (sometimes required on Android)
              console.log('📱 Strategy 2: Empty options');
              photoResult = await Promise.race([
                cameraRef.current.takePictureAsync({}),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Strategy 2 timeout')), 3000)
                )
              ]);
              console.log('✅ Strategy 2 succeeded');
            } catch (error2) {
              console.log('⚠️ Strategy 2 failed, trying Strategy 3...');
              
              // Strategy 3: Force with skipProcessing
              console.log('📱 Strategy 3: Skip processing');
              photoResult = await Promise.race([
                cameraRef.current.takePictureAsync({ skipProcessing: true }),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('All Android strategies failed')), 2000)
                )
              ]);
              console.log('✅ Strategy 3 succeeded');
            }
          }
        } else {
          // iOS approach (unchanged)
          photoResult = await cameraRef.current.takePictureAsync({
            quality: 0.7,
            exif: false,
            base64: false,
          });
        }
      }
      
      console.log('Photo result:', { 
        hasResult: !!photoResult, 
        hasUri: !!photoResult?.uri 
      });
      
      if (!photoResult || !photoResult.uri) {
        throw new Error('Failed to capture photo - no result returned');
      }
      
      // Process the captured image
      console.log('Processing captured image...');
      const rotatedUri = await getDisplayAndVisionImage(photoResult.uri);
      setPhoto(rotatedUri);
      setRotatedPhoto(rotatedUri);
      
      // Start AI detection
      console.log('Starting AI detection...');
      await detectObjectsWithAI(rotatedUri);
      
      console.log('Photo capture and processing complete');
      
    } catch (error) {
      console.error('Picture error:', error);
      
      // Enhanced error handling for tab switching and camera issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes('Camera reference lost') || errorMessage?.includes('inactive')) {
        Alert.alert('Camera Reset', 'Camera needs to reinitialize after tab switch. Please try taking a photo again.');
        // Force camera reactivation
        setIsCameraActive(false);
        setTimeout(() => setIsCameraActive(true), 500);
      } else if (errorMessage?.includes('timeout')) {
        if (Platform.OS === 'android') {
          Alert.alert(
            'Android Camera Issue', 
            'Android camera timed out. This is a known issue. Please try again - the app will automatically try different methods to capture the photo.',
            [{ text: 'Try Again', onPress: () => {
              // Reset for retry
              setIsCameraActive(false);
              setTimeout(() => setIsCameraActive(true), 1000);
            }}]
          );
        } else {
          Alert.alert('Timeout Error', 'Camera operation timed out. Please try again.');
        }
      } else if (errorMessage?.includes('All Android takePictureAsync methods failed')) {
        Alert.alert(
          'Camera Initialization Issue', 
          'The camera failed to capture properly. This has been fixed with onCameraReady implementation. Please:\n\n1. Wait for the "Camera is ready!" message\n2. Try taking the photo again\n3. If issue persists, restart the app',
          [
            { text: 'Reset Camera', onPress: () => {
              setIsCameraActive(false);
              setIsCameraReady(false);
              setUseCallbackMethod(false);
              setTimeout(() => setIsCameraActive(true), 1500);
            }},
            { text: 'Try Again' }
          ]
        );
      } else {
        Alert.alert('Camera Error', 'Could not take picture. Please try again.');
      }
      
      // Reset states on error
      setPhoto(null);
      setRotatedPhoto(null);
      setDetections([]);
      setSelectedWords(new Set<number>());
    } finally {
      // Clear safety timeout
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
      }
      
      console.log('Photo capture and processing complete');
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
        
        // Clear previous state and set processing
        setDetections([]);
        setSelectedWords(new Set<number>());
        setIsProcessing(true);
        
        //  OPTIMIZED: Use optimal image processing for uploads
        const processedUri = await getOptimalImage(selectedImage.uri, 'display');

        setPhoto(processedUri);
        setRotatedPhoto(processedUri);
        await detectObjectsWithAI(processedUri);
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Error', 'Could not upload image. Please try again.');
      setIsProcessing(false); // Reset processing state on error
    }
  };

  const detectObjectsWithAI = async (imageUri: string) => {
    try {
      // Note: isProcessing should already be true when this is called from takePicture
      
      // IMMEDIATE CLEAR: Clear previous detections to prevent lag/overlap
      setDetections([]);
      setSelectedWords(new Set<number>());
      
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
      throw error; // Re-throw so takePicture can handle it
    } finally {
      // Always reset processing state when detection is complete
      setIsProcessing(false);
      console.log('AI detection processing complete');
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
                if (stats && typeof stats === 'object' && 'totalWords' in stats) {
                  setUserStats(stats as {
                    totalWords: number;
                    masteredWords: number;
                    averageProficiency: number;
                    currentStreak: number;
                  });
                }
              }
            }
          }]
        );
      } else if (result.errors.length > 0) {
        Alert.alert('Save Failed', `Could not save: ${result.errors.join(', ')}`);
      }

      setSelectedWords(new Set());
      // Do NOT clear photo or detections here, so user stays on results screen
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
          <Ionicons name="camera-outline" size={34} color="#074173"/>
          <Text style={styles.permissionTitle}> Camera Permission Required</Text>
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

    // Show login warning if not authenticated
     if (isAuthenticated === false) {
         // Full white background, top header, and centered card
         return (
             <View style={[styles.container, { backgroundColor: 'white' }]}> 
                 <View style={styles.header}> 
                     <View>
                         <Text style={styles.title}>Camera</Text>
                     </View>
                 </View>
                 <View style={styles.authRequiredContainer}>
                     <Ionicons name="information-circle-outline" size={64} color="#f39c12" />
                     <Text style={styles.authRequiredTitle}>Login Required</Text>
                     <Text style={styles.authRequiredText}>
                         You must be logged in to use the camera and detect objects.
                     </Text>
                     <Text style={styles.authRequiredSubtext}>
                         Login to start learning languages through object detection.
                     </Text>
                     <TouchableOpacity
                         style={styles.loginButton}
                         onPress={() => router.replace('/')}
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
                                if (stats && typeof stats === 'object' && 'totalWords' in stats) {
                                  setUserStats(stats as {
                                    totalWords: number;
                                    masteredWords: number;
                                    averageProficiency: number;
                                    currentStreak: number;
                                  });
                                }
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

  
  // Camera View - Use VisionCamera for Android, Expo Camera for iOS
  return (
    <View style={styles.container}>
      {useVisionCamera && VisionCamera ? (
        <VisionCamera
          facing={facing}
          isActive={isCameraActive && isTabFocused && permission?.granted && isAuthenticated === true}
          ref={cameraRef}
          onPhotoTaken={(photoPath: string) => {
            console.log('VisionCamera photo taken:', photoPath);
          }}
        />
      ) : (
        <CameraView 
          style={StyleSheet.absoluteFillObject} 
          facing={facing} 
          ref={cameraRef}
          zoom={0}
          active={isCameraActive && isTabFocused && permission?.granted && isAuthenticated === true}
        />
      )}
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
      
      {/* Retake Photo Button - Show when photo exists */}
      {photo && (
        <View style={styles.retakeButtonContainer}>
          <TouchableOpacity 
            style={styles.retakeButton}
            onPress={resetCameraState}
          >
            <Ionicons name="camera" size={24} color="white" />
            <Text style={styles.retakeButtonText}>Retake Photo</Text>
          </TouchableOpacity>
        </View>
      )}

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
                              if (stats && typeof stats === 'object' && 'totalWords' in stats) {
                                setUserStats(stats as {
                                  totalWords: number;
                                  masteredWords: number;
                                  averageProficiency: number;
                                  currentStreak: number;
                                });
                              }
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
    padding: scale(30),
    borderRadius: scale(20),
    alignItems: 'center',
    margin: scale(20),
  },
  permissionTitle: {
    fontSize: normalizeFont(20),
    fontWeight: 'bold',
    color: '#074173',
    marginBottom: scale(15),
  },
  permissionText: {
    fontSize: normalizeFont(16),
    color: '#666',
    textAlign: 'center',
    marginBottom: scale(25),
  },
  grantButton: {
    backgroundColor: '#1679AB',
    paddingHorizontal: scale(30),
    paddingVertical: scale(15),
    borderRadius: scale(25),
  },
  grantButtonText: {
    color: 'white',
    fontSize: normalizeFont(16),
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  resultsHeader: {
    paddingHorizontal: scale(20),
    marginBottom: scale(20),
  },
  resultsTitle: {
    paddingVertical: scale(10),
    fontSize: normalizeFont(20),
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
  },
  resultsSubtitle: {
    fontSize: normalizeFont(12),
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: scale(-5),
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scale(10),
    marginHorizontal: scale(20),
    gap: scale(10),
  },
  saveButton: {
    flex: 1.3,
    backgroundColor: '#27ae60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(15),
    borderRadius: scale(25),
    elevation: 3,
  },
  saveButtonIcon: {
    fontSize: normalizeFont(20),
    marginRight: scale(8),
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: normalizeFont(16),
  },
  retakeButton: {
    flex: 1.05,
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(15),
    borderRadius: scale(25),
    elevation: 3,
  },
  retakeButtonIcon: {
    fontSize: normalizeFont(20),
    marginRight: scale(8),
  },
  retakeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: normalizeFont(16),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: scale(20),
    padding: scale(20),
    width: '100%',
    maxWidth: scale(400),
    maxHeight: '70%',
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
    paddingVertical: scale(10),
    borderRadius: scale(10),
    marginBottom: scale(15),
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: scale(10),
    fontSize: normalizeFont(16),
    color: '#2c3e50',
  },
  languageList: {
    maxHeight: 300,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scale(15),
    paddingHorizontal: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  languageOptionActive: {
    backgroundColor: '#e8f4f8',
  },
  languageOptionText: {
    fontSize: normalizeFont(16),
    color: '#2c3e50',
  },
  languageOptionTextActive: {
    color: '#3498db',
    fontWeight: '600',
  },
  languageOptionCheck: {
    fontSize: normalizeFont(18),
    color: '#3498db',
    fontWeight: 'bold',
  },
  noResultsContainer: {
    padding: scale(40),
    alignItems: 'center',
  },
  noResultsTitle: {
    fontSize: normalizeFont(20),
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: scale(10),
  },
  noResultsSubtitle: {
    fontSize: normalizeFont(16),
    color: '#95a5a6',
    marginBottom: scale(20),
  },
  noResultsText: {
    fontSize: normalizeFont(16),
    color: '#95a5a6',
    marginBottom: scale(20),
  },
  retryButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: scale(30),
    paddingVertical: scale(15),
    borderRadius: scale(25),
  },
  retryButtonText: {
    color: 'white',
    fontSize: normalizeFont(16),
    fontWeight: '600',
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: scale(10),
    padding: scale(15),
    fontSize: normalizeFont(16),
    marginBottom: scale(20),
  },
  manualButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(10),
  },
  manualCancelButton: {
    flex: 1,
    backgroundColor: '#95a5a6',
    padding: scale(15),
    borderRadius: scale(10),
    alignItems: 'center',
  },
  manualCancelText: {
    color: 'white',
    fontWeight: '600',
  },
  manualAddButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: scale(15),
    borderRadius: scale(10),
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
    padding: scale(20),
    backgroundColor: '#f8f9fa',
    borderRadius: scale(10),
    marginBottom: scale(20),
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  tipText: {
    fontSize: normalizeFont(16),
    color: '#2c3e50',
    marginLeft: scale(10),
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
    lineHeight: normalizeFont(22),
  },
  authRequiredSubtext: {
    fontSize: normalizeFont(14),
    color: '#95a5a6',
    textAlign: 'center',
    marginBottom: scale(20),
    paddingHorizontal: scale(20),
    lineHeight: normalizeFont(20),
  },
  continueButton: {
    marginTop: scale(15),
    paddingHorizontal: scale(30),
    paddingVertical: scale(12),
  },
  retakeButtonContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 15,
  }
});