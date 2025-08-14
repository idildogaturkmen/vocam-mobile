// Load environment variables
require('dotenv').config();

module.exports = {
  expo: {
    name: "Vocam",
    slug: "vocam-learning-app",
    version: "1.0.0",
    orientation: "portrait",
    assetBundlePatterns: [
      "**/*"
    ],
    android: {
      package: "app.vocam.mobile",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ]
    },
    web: {
      bundler: "metro"
    },
    scheme: "vocam-learning",
    linking: {
      prefixes: ["vocam-learning://"],
      config: {
        screens: {
          "auth/confirm": "auth/confirm"
        }
      }
    },
    plugins: [
      "expo-router",
      "expo-sqlite",
      [
        "expo-camera",
        {
          cameraPermission: "Vocam needs your camera to detect objects for language learning."
        }
      ],
      [
        "expo-audio",
        {
          microphonePermission: "Vocam needs microphone access for pronunciation practice and speech recognition.",
          audioModeIOSOverride: "playback"
        }
      ]
    ],
    extra: {
      router: {},
      eas: {
        projectId: "1eb973cc-affd-4289-ab40-dc2ea91b13b9"
      },
      // API keys for development (only loaded if environment variables exist)
      ...(process.env.GOOGLE_CLOUD_VISION_API_KEY && { 
        googleVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY 
      }),
      ...(process.env.GOOGLE_CLOUD_API_KEY && { 
        googleApiKey: process.env.GOOGLE_CLOUD_API_KEY 
      })
    }
  }
};