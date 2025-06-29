import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

class ObjectDetectionService {
  constructor() {
    this.isInitialized = false;
    this.apiKey = null; // Will be loaded securely from environment
    
    // Same COCO class names from your TensorFlow implementation
    this.COCO_CLASS_NAMES = {
      1: 'person', 2: 'bicycle', 3: 'car', 4: 'motorcycle', 5: 'airplane',
      6: 'bus', 7: 'train', 8: 'truck', 9: 'boat', 10: 'traffic light',
      11: 'fire hydrant', 13: 'stop sign', 14: 'parking meter', 15: 'bench',
      16: 'bird', 17: 'cat', 18: 'dog', 19: 'horse', 20: 'sheep',
      21: 'cow', 22: 'elephant', 23: 'bear', 24: 'zebra', 25: 'giraffe',
      27: 'backpack', 28: 'umbrella', 31: 'handbag', 32: 'tie', 33: 'suitcase',
      34: 'frisbee', 35: 'skis', 36: 'snowboard', 37: 'sports ball',
      38: 'kite', 39: 'baseball bat', 40: 'baseball glove', 41: 'skateboard',
      42: 'surfboard', 43: 'tennis racket', 44: 'bottle', 46: 'wine glass',
      47: 'cup', 48: 'fork', 49: 'knife', 50: 'spoon', 51: 'bowl',
      52: 'banana', 53: 'apple', 54: 'sandwich', 55: 'orange', 56: 'broccoli',
      57: 'carrot', 58: 'hot dog', 59: 'pizza', 60: 'donut', 61: 'cake',
      62: 'chair', 63: 'couch', 64: 'potted plant', 65: 'bed', 67: 'dining table',
      70: 'toilet', 72: 'tv', 73: 'laptop', 74: 'mouse', 75: 'remote',
      76: 'keyboard', 77: 'cell phone', 78: 'microwave', 79: 'oven',
      80: 'toaster', 81: 'sink', 82: 'refrigerator', 84: 'book', 85: 'clock',
      86: 'vase', 87: 'scissors', 88: 'teddy bear', 89: 'hair drier', 90: 'toothbrush'
    };

    // Object categories
    this.OBJECT_CATEGORIES = {
      "food": ["banana", "apple", "sandwich", "orange", "broccoli", "carrot", 
               "hot dog", "pizza", "donut", "cake", "bottle", "wine glass", 
               "cup", "fork", "knife", "spoon", "bowl"],
      "animals": ["bird", "cat", "dog", "horse", "sheep", "cow", "elephant", 
                  "bear", "zebra", "giraffe"],
      "vehicles": ["bicycle", "car", "motorcycle", "airplane", "bus", "train", 
                   "truck", "boat"],
      "electronics": ["tv", "laptop", "mouse", "remote", "keyboard", "cell phone", 
                     "microwave", "oven", "toaster", "refrigerator"],
      "furniture": ["chair", "couch", "potted plant", "bed", "dining table", 
                    "toilet", "bench"],
      "personal": ["backpack", "umbrella", "handbag", "tie", "suitcase"],
      "sports": ["frisbee", "skis", "snowboard", "sports ball", "kite", 
                "baseball bat", "baseball glove", "skateboard", "surfboard", 
                "tennis racket"],
      "household": ["bottle", "wine glass", "cup", "fork", "knife", "spoon", 
                   "bowl", "book", "clock", "vase", "scissors", "teddy bear", 
                   "hair drier", "toothbrush", "sink"]
    };

    // Google Vision label mapping
    this.VISION_LABEL_MAPPING = {
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
      
      // Load API key securely from environment
      this.apiKey = await this.getSecureApiKey();
      
      if (!this.apiKey) {
        console.warn('⚠️ Google Vision API key not found. Using mock detection.');
        console.warn('💡 To use real detection:');
        console.warn('   1. Set GOOGLE_CLOUD_VISION_API_KEY as a GitHub secret');
        console.warn('   2. Or use: export GOOGLE_CLOUD_VISION_API_KEY="your-key"');
      } else {
        console.log('✅ Google Vision API key loaded securely from environment');
      }
      
      this.isInitialized = true;
      console.log('✅ Google Vision Object Detection Service ready');
      return true;
      
    } catch (error) {
      console.error('❌ Google Vision initialization failed:', error);
      return false;
    }
  }

  async getSecureApiKey() {
    // SECURE: Load from environment variable (GitHub Codespaces secret)
    if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      console.log('🔐 Using API key from environment variable (secure)');
      return process.env.GOOGLE_CLOUD_VISION_API_KEY;
    }

    // Try Expo Constants (if using EAS secrets)
    try {
      const Constants = await import('expo-constants');
      if (Constants.default?.expoConfig?.extra?.googleVisionApiKey) {
        console.log('🔐 Using API key from Expo config (secure)');
        return Constants.default.expoConfig.extra.googleVisionApiKey;
      }
    } catch (error) {
      // Expo constants not available
    }

    console.log('🔍 No secure API key found in environment');
    return null; // No API key found - will use mock detection
  }

  async detectObjects(imageUri, confidenceThreshold = 0.5, iouThreshold = 0.45) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      console.log('🔍 Starting Google Vision object detection...');
      const startTime = Date.now();
      
      // If no API key, use mock detection
      if (!this.apiKey) {
        console.log('🎭 Using mock detection (no API key configured)');
        return this.generateMockDetections(imageUri, confidenceThreshold);
      }
      
      // Real Google Vision API call
      console.log('🖼️ Converting image to base64...');
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('⚡ Calling Google Vision API...');
      const inferenceStart = Date.now();
      const visionResponse = await this.callGoogleVisionAPI(base64Image);
      const inferenceTime = Date.now() - inferenceStart;
      
      console.log(`🎯 Google Vision API completed in ${inferenceTime}ms`);
      
      const detections = this.processGoogleVisionResults(visionResponse, confidenceThreshold);
      
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
      console.log('🎭 Falling back to mock detection');
      return this.generateMockDetections(imageUri, confidenceThreshold);
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
      throw new Error(`Google Vision API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.responses[0].error) {
      throw new Error(`Google Vision API error: ${result.responses[0].error.message}`);
    }

    return result.responses[0];
  }

  processGoogleVisionResults(visionResponse, confidenceThreshold) {
    const detections = [];
    
    if (!visionResponse.localizedObjectAnnotations) {
      console.log('No objects detected by Google Vision API');
      return detections;
    }

    for (const obj of visionResponse.localizedObjectAnnotations) {
      if (obj.score >= confidenceThreshold) {
        const mappedLabel = this.mapGoogleVisionLabel(obj.name.toLowerCase());
        const bbox = this.convertNormalizedBbox(obj.boundingPoly.normalizedVertices);
        
        detections.push({
          label: mappedLabel,
          confidence: obj.score,
          bbox: bbox,
          category: this.getObjectCategory(mappedLabel),
          source: 'google_vision',
          original_label: obj.name
        });
      }
    }

    detections.sort((a, b) => b.confidence - a.confidence);
    return detections;
  }

  mapGoogleVisionLabel(visionLabel) {
    if (this.VISION_LABEL_MAPPING[visionLabel]) {
      return this.VISION_LABEL_MAPPING[visionLabel];
    }
    
    for (const [visionKey, ourLabel] of Object.entries(this.VISION_LABEL_MAPPING)) {
      if (visionKey.includes(visionLabel) || visionLabel.includes(visionKey)) {
        return ourLabel;
      }
    }
    
    return visionLabel.replace(/_/g, ' ').trim();
  }

  convertNormalizedBbox(vertices) {
    const imageWidth = 640;
    const imageHeight = 480;
    
    const xCoords = vertices.map(v => v.x * imageWidth);
    const yCoords = vertices.map(v => v.y * imageHeight);
    
    return [
      Math.min(...xCoords),
      Math.min(...yCoords),
      Math.max(...xCoords),
      Math.max(...yCoords)
    ];
  }

  generateMockDetections(imageUri, confidenceThreshold) {
    const mockObjects = [
      { label: 'cup', confidence: 0.85, category: 'food' },
      { label: 'cell phone', confidence: 0.78, category: 'electronics' },
      { label: 'book', confidence: 0.65, category: 'household' },
      { label: 'chair', confidence: 0.72, category: 'furniture' },
      { label: 'bottle', confidence: 0.69, category: 'food' }
    ];

    return mockObjects
      .filter(obj => obj.confidence >= confidenceThreshold)
      .map((obj, index) => ({
        ...obj,
        bbox: [100 + index * 50, 100 + index * 30, 200 + index * 50, 200 + index * 30],
        source: 'mock_detection',
        id: `mock_${Date.now()}_${index}`,
        timestamp: new Date().toISOString(),
        processing_time_ms: 150,
        inference_time_ms: 50,
        rank: index + 1
      }));
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
      source: this.apiKey ? 'Google Cloud Vision API' : 'Mock Detection (No API Key)',
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
        this.apiKey ? '✅ API key configured securely' : '⚠️ API key not found (using mock)'
      ]
    };
  }

  dispose() {
    this.isInitialized = false;
    console.log('🧹 Google Vision Object Detection Service disposed');
  }
}

export default new ObjectDetectionService();