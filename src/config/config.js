// Configuration file for the app
// Copy this file and update with your actual values

export const config = {
  // Google Cloud Vision API Key
  // Get this from: https://console.cloud.google.com/apis/credentials
  googleVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY || 'YOUR_API_KEY_HERE',
  
  // API Settings
  googleVision: {
    maxResults: 50,
    confidenceThreshold: 0.5,
    endpoint: 'https://vision.googleapis.com/v1/images:annotate'
  },
  
  // App Settings
  app: {
    defaultLanguage: 'es', // Spanish
    maxDetections: 10,
    autoSelectThreshold: 0.7
  },
  
  // Feature Flags
  features: {
    useGoogleVision: true,
    useMockWhenApiFails: true,
    enableAdvancedSettings: true
  }
};

export default config;