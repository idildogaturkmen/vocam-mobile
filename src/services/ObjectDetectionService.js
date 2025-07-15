import * as FileSystem from 'expo-file-system';
import { Platform, Image } from 'react-native';
import Constants from 'expo-constants';
import { manipulateAsync } from 'expo-image-manipulator';

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

  // Add this method after the constructor
  async resizeImage(imageUri, maxDimension = 1024) {
    try {
      // Get image dimensions
      const imageInfo = await new Promise((resolve, reject) => {
        Image.getSize(imageUri, (width, height) => {
          resolve({ width, height });
        }, reject);
      });

      const { width, height } = imageInfo;
      
      // Check if resize is needed
      if (width <= maxDimension && height <= maxDimension) {
        // No resize needed, return original base64
        return await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Calculate new dimensions
      let newWidth, newHeight;
      if (width > height) {
        newWidth = maxDimension;
        newHeight = Math.floor((height / width) * maxDimension);
      } else {
        newHeight = maxDimension;
        newWidth = Math.floor((width / height) * maxDimension);
      }

      console.log(`📐 Resizing image from ${width}x${height} to ${newWidth}x${newHeight}`);

      // For Expo, we need to use ImageManipulator
      // First, import it at the top of the file
      const { manipulateAsync } = require('expo-image-manipulator');
      
      const resizedImage = await manipulateAsync(
        imageUri,
        [{ resize: { width: newWidth, height: newHeight } }],
        { compress: 0.8, format: 'jpeg', base64: true }
      );

      return resizedImage.base64;
    } catch (error) {
      console.error('Image resize error:', error);
      // Fallback to original
      return await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  }

  GOOGLE_VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';
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
      return Constants.expoConfig.extra.googleVisionApiKey;
    }

    // Method 2: Try manifest extra field (older Expo versions)
    if (Constants.manifest?.extra?.googleVisionApiKey) {
      return Constants.manifest.extra.googleVisionApiKey;
    }

    // Method 3: Try environment variables (works in development)
    if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      return process.env.GOOGLE_CLOUD_VISION_API_KEY;
    }

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
      
      // Resize image before converting to base64
      console.log('🖼️ Resizing and converting image to base64...');
      const base64Image = await this.resizeImage(imageUri, 800); // Reduced from 1024
      
      // Rest of the method remains the same...
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
              maxResults: 20  // Reduced from 50
            }
          ]
        }
      ]
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Vision API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.responses[0].error) {
        throw new Error(`Google Vision API error: ${result.responses[0].error.message}`);
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Google Vision API request timed out after 30 seconds');
      }
      throw error;
    }
  }

  processGoogleVisionResults(visionResponse, confidenceThreshold, imageUri) {
    const annotations = visionResponse.responses[0].localizedObjectAnnotations || [];
    
    console.log(`🔍 Processing ${annotations.length} detections from Google Vision`);
    
    return annotations
      .filter(annotation => annotation.score >= confidenceThreshold)
      .map((annotation, idx) => {
        const label = this.normalizeGoogleVisionLabel(annotation.name);
        const category = this.getObjectCategory(label);
        
        // Get vertices and handle undefined values
        const vertices = annotation.boundingPoly.normalizedVertices;
        
        // Process each vertex, replacing undefined with appropriate defaults
        const processedVertices = [];
        for (let i = 0; i < vertices.length; i++) {
          const vertex = vertices[i];
          const x = vertex.x !== undefined ? vertex.x : (i === 0 || i === 3) ? 0 : 1;
          const y = vertex.y !== undefined ? vertex.y : (i === 0 || i === 1) ? 0 : 1;
          processedVertices.push({ x, y });
        }
       
        // Calculate bounding box from processed vertices
        const xValues = processedVertices.map(v => v.x);
        const yValues = processedVertices.map(v => v.y);
        
        const bbox = [
          Math.min(...xValues),  // left
          Math.min(...yValues),  // top
          Math.max(...xValues),  // right
          Math.max(...yValues)   // bottom
        ];
        
        // Validate bbox
        if (bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
          console.warn(`Invalid bbox for ${label}: [${bbox.join(', ')}]`);
          // Try to fix it
          bbox[2] = Math.max(bbox[2], bbox[0] + 0.1);
          bbox[3] = Math.max(bbox[3], bbox[1] + 0.1);
        }
        
        return {
          label: label,
          confidence: annotation.score,
          bbox: bbox,
          category: category,
          raw_label: annotation.name,
          source: 'google_vision',
          vertices: processedVertices
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