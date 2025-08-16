import * as FileSystem from 'expo-file-system';
import { Platform, Image } from 'react-native';
import { scale } from '../../utils/normalize';
import Constants from 'expo-constants';
import { manipulateAsync } from 'expo-image-manipulator';

class ObjectDetectionService {
  constructor() {
    this.isInitialized = false;
    this.apiKey = null;
    
    // EXPANDED categories to include detailed Google Vision labels
    this.OBJECT_CATEGORIES = {
      "food": ["apple", "banana", "orange", "pizza", "burger", "cake", "coffee", "wine", "cup", "bowl", "bottle", "sandwich", "bread", "fruit", "vegetable", "food"],
      "electronics": ["laptop", "cell phone", "tv", "keyboard", "mouse", "tablet", "camera", "headphones", "speaker", "mobile phone", "smartphone", "telephone", "computer", "laptop computer", "television", "television set", "computer monitor", "computer mouse", "computer keyboard", "remote control"],
      "furniture": ["chair", "couch", "table", "bed", "desk", "bookshelf", "armchair", "office chair", "dining chair", "sofa", "kitchen table", "dining table", "coffee table", "office desk", "writing desk", "kitchen & dining room table"],
      "clothing": ["shirt", "pants", "shoes", "hat", "jacket", "dress", "tie", "top", "t-shirt", "polo shirt", "dress shirt", "blouse", "jeans", "trousers"],
      "transportation": ["car", "bus", "bicycle", "motorcycle", "train", "airplane", "boat", "automobile", "vehicle", "motor vehicle"],
      "animals": ["dog", "cat", "bird", "horse", "cow", "sheep", "elephant", "lion", "domestic cat", "house cat", "domestic dog"],
      "household": ["book", "pen", "scissors", "clock", "lamp", "mirror", "vase", "remote", "glasses", "eyeglasses", "sunglasses", "spectacles", "reading glasses", "safety glasses"],
      "drinkware": ["cup", "mug", "glass", "wine glass", "drinking glass", "water glass", "coffee cup", "tea cup", "coffee mug", "tea mug"],
      "kitchen": ["plate", "dish", "bowl", "knife", "fork", "spoon"],
      "plants": ["plant", "houseplant", "potted plant", "flowering plant", "tree"],
      "bedding": ["pillow", "throw pillow", "bed pillow", "cushion", "mattress"],
      "bottles": ["bottle", "water bottle", "plastic bottle", "glass bottle", "beer bottle"],
      "sports": ["ball", "tennis racket", "bicycle", "skateboard", "football", "basketball", "baseball", "sports ball", "tennis ball", "soccer ball"]
    };

    // MINIMAL mapping - only fix critical misidentifications, preserve detailed labels
    this.GOOGLE_VISION_LABEL_MAPPING = {
      // Only map the most problematic cases
      
      // Phone consolidation - keep it simple
      'mobile phone': 'mobile phone', // Keep detailed
      'smartphone': 'smartphone', // Keep detailed  
      'telephone': 'telephone', // Keep detailed
      'cell phone': 'cell phone', // Keep detailed
      
      // Computer/TV - keep detailed but consistent
      'computer': 'computer', // Keep detailed
      'laptop computer': 'laptop computer', // Keep detailed
      'television': 'television', // Keep detailed
      'television set': 'television set', // Keep detailed
      'computer monitor': 'computer monitor', // Keep detailed
      
      // Furniture - KEEP DETAILED LABELS!
      'kitchen & dining room table': 'kitchen & dining room table', // Keep Google's detailed label!
      'dining table': 'dining table', // Keep detailed
      'coffee table': 'coffee table', // Keep detailed
      'office desk': 'office desk', // Keep detailed
      'writing desk': 'writing desk', // Keep detailed
      'armchair': 'armchair', // Keep detailed
      'office chair': 'office chair', // Keep detailed
      'dining chair': 'dining chair', // Keep detailed
      
      // Drinkware - be specific to prevent glasses confusion
      'drinking glass': 'drinking glass', // Keep detailed
      'water glass': 'water glass', // Keep detailed
      'wine glass': 'wine glass', // Keep detailed
      'coffee cup': 'coffee cup', // Keep detailed
      'tea cup': 'tea cup', // Keep detailed
      'coffee mug': 'coffee mug', // Keep detailed
      'tea mug': 'tea mug', // Keep detailed
      
      // Glasses - CRITICAL for preventing cup confusion
      'glasses': 'glasses',
      'eyeglasses': 'eyeglasses',
      'sunglasses': 'sunglasses',
      'spectacles': 'spectacles',
      'reading glasses': 'reading glasses',
      'safety glasses': 'safety glasses',
      
      // Clothing - prevent table confusion
      'shirt': 'shirt',
      't-shirt': 't-shirt',
      'polo shirt': 'polo shirt',
      'dress shirt': 'dress shirt',
      'blouse': 'blouse',
      'top': 'top', // Keep as clothing top
      
      // Bottles - keep detailed
      'water bottle': 'water bottle',
      'plastic bottle': 'plastic bottle',
      'glass bottle': 'glass bottle',
      'beer bottle': 'beer bottle',
      
      // Bedding - prevent confusion
      'pillow': 'pillow',
      'throw pillow': 'throw pillow',
      'bed pillow': 'bed pillow',
      'cushion': 'cushion',
      'mattress': 'mattress',
      
      // Plants - keep detailed
      'plant': 'plant',
      'houseplant': 'houseplant',
      'potted plant': 'potted plant',
      'flowering plant': 'flowering plant',
      
      // Animals - keep detailed when possible
      'domestic cat': 'domestic cat',
      'house cat': 'house cat',
      'domestic dog': 'domestic dog',
      
      // Sports - keep some detail
      'tennis ball': 'tennis ball',
      'basketball': 'basketball', 
      'football': 'football',
      'baseball': 'baseball',
      'soccer ball': 'soccer ball',
      
      // People
      'person': 'person',
      'human': 'person',
      'man': 'person',
      'woman': 'person',
      'child': 'person'
    };
  }

  // OPTIMIZED: Enhanced image resizing with better compression
  async resizeImage(imageUri, maxDimension = 800) { // Reduced from 1024 for faster processing
    try {
      const imageInfo = await new Promise((resolve, reject) => {
        Image.getSize(imageUri, (width, height) => {
          resolve({ width, height });
        }, reject);
      });

      const { width, height } = imageInfo;
      
      // OPTIMIZATION: More aggressive size limits for faster processing
  if (width <= maxDimension && height <= maxDimension) {
        // Still compress even if no resize needed
        const resizedImage = await manipulateAsync(
          imageUri,
          [], // No resize, just compress
          { compress: 0.6, format: 'jpeg', base64: true } // Better compression
        );
        return resizedImage.base64;
      }

      let newWidth, newHeight;
      if (width > height) {
        newWidth = maxDimension;
        newHeight = Math.floor((height / width) * maxDimension);
      } else {
        newHeight = maxDimension;
        newWidth = Math.floor((width / height) * maxDimension);
      }

      const { manipulateAsync } = require('expo-image-manipulator');
      
      const resizedImage = await manipulateAsync(
        imageUri,
        [{ resize: { width: newWidth, height: newHeight } }],
        { 
          compress: 0.6,  // OPTIMIZED: Better compression (was 0.8)
          format: 'jpeg', 
          base64: true 
        }
      );

      return resizedImage.base64;
    } catch (error) {
      console.error('Image resize error:', error);
      // Fallback with basic compression
      try {
        const fallbackImage = await manipulateAsync(
          imageUri,
          [],
          { compress: 0.5, format: 'jpeg', base64: true }
        );
        return fallbackImage.base64;
      } catch (fallbackError) {
        // Final fallback to original base64
        return await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      this.apiKey = await this.getSecureApiKey();
      if (!this.apiKey) {
        console.error('❌ Google Vision API key not found!');
        throw new Error('Google Vision API key is required. Please set GOOGLE_CLOUD_VISION_API_KEY in your environment.');
      }
      
      this.isInitialized = true;
      return true;
      
    } catch (error) {
      console.error('❌ Google Vision initialization failed:', error);
      throw error;
    }
  }

  async getSecureApiKey() {
    if (Constants.expoConfig?.extra?.googleVisionApiKey) {
      return Constants.expoConfig.extra.googleVisionApiKey;
    }

    if (Constants.manifest?.extra?.googleVisionApiKey) {
      return Constants.manifest.extra.googleVisionApiKey;
    }

    if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
      return process.env.GOOGLE_CLOUD_VISION_API_KEY;
    }
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

      const startTime = Date.now();
      
      // OPTIMIZED: Smaller image size for faster processing
      const resizedUri = await this.resizeImage(imageUri, 800); // Reduced from 1024
      const visionResponse = await this.callGoogleVisionAPI(resizedUri);
      
      const processingTime = Date.now() - startTime;
      
      if (!visionResponse || !visionResponse.responses || !visionResponse.responses[0]) {
        console.log('❌ No valid response from Google Vision API');
        return [];
      }
      
      const rawAnnotations = visionResponse.responses[0].localizedObjectAnnotations || [];
      
      const results = this.processGoogleVisionResults(visionResponse, confidenceThreshold, imageUri);

      return results;
      
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
              maxResults: 15  // OPTIMIZED: Reduced from 20 for faster response
            }
          ]
        }
      ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // Reduced timeout

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
        throw new Error('Google Vision API request timed out after 25 seconds');
      }
      throw error;
    }
  }

  processGoogleVisionResults(visionResponse, confidenceThreshold, imageUri) {
    const annotations = visionResponse.responses[0].localizedObjectAnnotations || [];
    return annotations
      .filter(annotation => {
        // STRICTER confidence filtering for commonly confused items
        const confusableItems = ['cup', 'glass', 'mug', 'table', 'desk', 'chair', 'bed', 'pillow', 'top'];
        const lowerName = annotation.name.toLowerCase();
        
        // Higher threshold for confusable items
        if (confusableItems.some(item => lowerName.includes(item))) {
          return annotation.score >= Math.max(confidenceThreshold, 0.75); // Even higher: 75%
        }
        
        // Normal threshold for other items
        return annotation.score >= confidenceThreshold;
      })
      .map((annotation, idx) => {
        let rawLabel = annotation.name.toLowerCase();
        
        // MINIMAL label normalization - preserve most original labels
        const label = this.normalizeGoogleVisionLabel(rawLabel);
        const category = this.getObjectCategory(label);

        const vertices = annotation.boundingPoly.normalizedVertices;
        const processedVertices = [];
        for (let i = 0; i < vertices.length; i++) {
          const vertex = vertices[i];
          const x = vertex.x !== undefined ? vertex.x : (i === 0 || i === 3) ? 0 : 1;
          const y = vertex.y !== undefined ? vertex.y : (i === 0 || i === 1) ? 0 : 1;
          processedVertices.push({ x, y });
        }
       
        const xValues = processedVertices.map(v => v.x);
        const yValues = processedVertices.map(v => v.y);
        
        const bbox = [
          Math.min(...xValues),
          Math.min(...yValues),
          Math.max(...xValues),
          Math.max(...yValues)
        ];
        
        if (bbox[2] <= bbox[0] || bbox[3] <= bbox[1]) {
          console.warn(`Invalid bbox for ${label}: [${bbox.join(', ')}]`);
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
    // MINIMAL mapping - mostly just return the original label
    return this.GOOGLE_VISION_LABEL_MAPPING[lowerLabel] || lowerLabel;
  }

  getObjectCategory(label) {
    const lowerLabel = label.toLowerCase();
    for (const [category, items] of Object.entries(this.OBJECT_CATEGORIES)) {
      if (items.some(item => lowerLabel.includes(item) || item.includes(lowerLabel))) {
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
        '✅ Preserves detailed labels',
        '🚀 Optimized image compression',
        '⚡ Faster processing with smaller images',
        '💰 Pay-per-use pricing after free tier',
        this.apiKey ? '✅ API key configured' : '❌ API key missing'
      ]
    };
  }

  dispose() {
    this.isInitialized = false;
  }
}

export default new ObjectDetectionService();