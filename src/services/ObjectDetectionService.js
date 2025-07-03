import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

class ObjectDetectionService {
  constructor() {
    this.isInitialized = false;
    this.apiKey = null;
    
    this.OBJECT_CATEGORIES = {
      "food": ["apple", "banana", "orange", "pizza", "burger", "cake", "coffee", "wine", "cup", "bowl", "bottle", "sandwich", "bread"],
      "electronics": ["laptop", "cell phone", "tv", "keyboard", "mouse", "tablet", "camera", "headphones", "speaker"],
      "furniture": ["chair", "couch", "table", "bed", "desk", "bookshelf"],
      "clothing": ["shirt", "pants", "shoes", "hat", "jacket", "dress", "tie"],
      "transportation": ["car", "bus", "bicycle", "motorcycle", "train", "airplane", "boat"],
      "animals": ["dog", "cat", "bird", "horse", "cow", "sheep", "elephant", "lion"],
      "household": ["book", "pen", "scissors", "clock", "lamp", "mirror", "vase", "remote"],
      "sports": ["ball", "tennis racket", "bicycle", "skateboard", "football", "basketball", "baseball"]
    };

    this.GOOGLE_VISION_LABEL_MAPPING = {
      'mobile phone': 'cell phone',
      'smartphone': 'cell phone', 
      'telephone': 'cell phone',
      'computer': 'laptop',
      'laptop computer': 'laptop',
      'television': 'tv',
      'television set': 'tv',
      'computer monitor': 'tv',
      'computer mouse': 'mouse',
      'computer keyboard': 'keyboard',
      'remote control': 'remote',
      'drinking glass': 'cup',
      'coffee cup': 'cup',
      'tea cup': 'cup',
      'wine glass': 'wine glass',
      'water bottle': 'bottle',
      'plastic bottle': 'bottle',
      'glass bottle': 'bottle',
      'armchair': 'chair',
      'office chair': 'chair',
      'sofa': 'couch',
      'table': 'dining table',
      'desk': 'dining table',
      'automobile': 'car',
      'vehicle': 'car',
      'ball': 'sports ball',
      'football': 'sports ball',
      'basketball': 'sports ball',
      'tennis ball': 'sports ball',
      'baseball': 'sports ball',
      'soccer ball': 'sports ball',
      'plate': 'bowl',
      'plant': 'potted plant',
      'houseplant': 'potted plant'
    };
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      console.log('🚀 Initializing Google Vision Object Detection...');
      
      // Load API key from multiple sources
      this.apiKey = await this.getSecureApiKey();
      
      console.log('🔐 API Key loaded:', this.apiKey ? 'Yes (hidden)' : 'No');
      
      if (!this.apiKey) {
        console.error('❌ Google Vision API key not found!');
        throw new Error('Google Vision API key is required. Please set GOOGLE_CLOUD_VISION_API_KEY in your environment.');
      }
      
      console.log('✅ Google Vision API key loaded successfully');
      this.isInitialized = true;
      console.log('✅ Google Vision Object Detection Service ready');
      return true;
      
    } catch (error) {
      console.error('❌ Google Vision initialization failed:', error);
      throw error;
    }
  }

  async getSecureApiKey() {
    // Method 1: Try Expo Constants extra field
    if (Constants.expoConfig?.extra?.googleVisionApiKey) {
      console.log('🔐 Using API key from app.json extra field');
      return Constants.expoConfig.extra.googleVisionApiKey;
    }

    // Method 2: Try manifest extra field (older Expo versions)
    if (Constants.manifest?.extra?.googleVisionApiKey) {
      console.log('🔐 Using API key from manifest extra field');
      return Constants.manifest.extra.googleVisionApiKey;
    }

    // Method 3: Try environment variables (works in development)
    if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      console.log('🔐 Using API key from environment variable');
      return process.env.GOOGLE_CLOUD_VISION_API_KEY;
    }

    // Method 4: For development only - hardcoded key (REMOVE IN PRODUCTION)
    // Uncomment and add your key here for testing:
    // return 'YOUR_API_KEY_HERE';

    console.log('🔍 No API key found in any source');
    return null;
  }

  async detectObjects(imageUri, confidenceThreshold = 0.5, iouThreshold = 0.45) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      if (!this.apiKey) {
        throw new Error('Google Vision API key not configured. Detection cannot proceed.');
      }
      
      console.log('🔍 Starting Google Vision object detection...');
      const startTime = Date.now();
      
      // Convert image to base64
      console.log('🖼️ Converting image to base64...');
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Call Google Vision API
      console.log('⚡ Calling Google Vision API...');
      const inferenceStart = Date.now();
      const visionResponse = await this.callGoogleVisionAPI(base64Image);
      const inferenceTime = Date.now() - inferenceStart;
      
      console.log(`🎯 Google Vision API completed in ${inferenceTime}ms`);
      
      // Process results with bounding boxes
      const detections = this.processGoogleVisionResults(visionResponse, confidenceThreshold, imageUri);
      
      const totalTime = Date.now() - startTime;
      console.log(`✅ Detection complete! Found ${detections.length} objects in ${totalTime}ms`);
      
      return detections.map((detection, index) => ({
        ...detection,
        id: `det_${Date.now()}_${index}`,
        timestamp: new Date().toISOString(),
        processing_time_ms: totalTime,
        inference_time_ms: inferenceTime,
        rank: index + 1,
        source: 'google_vision_api'
      }));
      
    } catch (error) {
      console.error('❌ Google Vision detection failed:', error);
      throw error;
    }
  }

  async callGoogleVisionAPI(base64Image) {
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`;
    
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: 'OBJECT_LOCALIZATION',
              maxResults: 50
            }
          ]
        }
      ]
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Vision API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.responses[0].error) {
      throw new Error(`Google Vision API error: ${result.responses[0].error.message}`);
    }

    return result;
  }

  processGoogleVisionResults(visionResponse, confidenceThreshold, imageUri) {
    const annotations = visionResponse.responses[0].localizedObjectAnnotations || [];
    
    return annotations
      .filter(annotation => annotation.score >= confidenceThreshold)
      .map(annotation => {
        const label = this.normalizeGoogleVisionLabel(annotation.name);
        const category = this.getObjectCategory(label);
        
        // Convert normalized vertices to bbox array
        const vertices = annotation.boundingPoly.normalizedVertices;
        const bbox = [
          vertices[0].x,
          vertices[0].y,
          vertices[2].x,
          vertices[2].y
        ];
        
        return {
          label: label,
          confidence: annotation.score,
          bbox: bbox,
          category: category,
          raw_label: annotation.name,
          source: 'google_vision',
          vertices: vertices // Keep original vertices for drawing
        };
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  normalizeGoogleVisionLabel(googleLabel) {
    const lowerLabel = googleLabel.toLowerCase();
    return this.GOOGLE_VISION_LABEL_MAPPING[lowerLabel] || lowerLabel;
  }

  getObjectCategory(label) {
    const lowerLabel = label.toLowerCase();
    for (const [category, items] of Object.entries(this.OBJECT_CATEGORIES)) {
      if (items.includes(lowerLabel)) {
        return category;
      }
    }
    return "other";
  }

  getModelInfo() {
    return {
      type: 'Google Cloud Vision API',
      accuracy: 'High (Google\'s trained models)',
      cost: '$1.50 per 1000 requests (first 1000/month free)',
      source: this.apiKey ? 'Google Cloud Vision API' : 'API Key Missing',
      isLoaded: this.isInitialized,
      platform: Platform.OS,
      status: this.isInitialized ? 'Ready' : 'Initializing...',
      apiEndpoint: 'https://vision.googleapis.com/v1/images:annotate',
      features: [
        '✅ Google\'s state-of-the-art object detection',
        '✅ Real-time API calls',
        '✅ Supports 1000+ object types',
        '✅ Works in Expo managed workflow',
        '✅ No large model downloads',
        '💰 Pay-per-use pricing after free tier',
        this.apiKey ? '✅ API key configured' : '❌ API key missing'
      ]
    };
  }

  dispose() {
    this.isInitialized = false;
    console.log('🧹 Google Vision Object Detection Service disposed');
  }
}

export default new ObjectDetectionService();