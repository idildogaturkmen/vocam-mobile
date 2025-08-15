// Replace app.config.js completely

// Load environment variables
require('dotenv').config();

module.exports = {
  expo: {
    name: "Vocam",
    slug: "vocam-learning-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/app-icon.png",
    assetBundlePatterns: [
      "**/*"
    ],
    splash: {
      image: "./assets/bundling-screen.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    android: {
      package: "app.vocam.mobile",
      versionCode: 1,
      compileSdkVersion: 34,
      targetSdkVersion: 34,
      buildToolsVersion: "34.0.0",
      backgroundColor:  "#ffffff",
      
      // Enhanced splash configuration for Android
      splash: {
        image: "./assets/bundling-screen.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
      },
      
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_EXTERNAL_STORAGE"
      ],

      // Enable edge-to-edge display
      edgeToEdge: {
        enabled: true
      },
      
      // Add adaptive icon support
      adaptiveIcon: {
        foregroundImage: "./assets/app-icon.png",
        backgroundColor: "#ffffff"
      }
    },
    
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.vocam.mobile",
      buildNumber: "1.0.0",
      splash: {
        image: "./assets/bundling-screen.png",
        resizeMode: "cover",
        backgroundColor: "#ffffff"
      }
    },
    
    web: {
      bundler: "metro",
  favicon: "./assets/app-icon.png"
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

      // Enhanced splash screen plugin configuration
      [
        "expo-splash-screen",
        {
          image: "./assets/bundling-screen.png",
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        }
      ],

      [
        "expo-camera",
        {
          cameraPermission: "Vocam needs your camera to detect objects for language learning."
        }
      ],
      
      // Add react-native-vision-camera for reliable Android camera support
      [
        "react-native-vision-camera",
        {
          cameraPermissionText: "Vocam needs access to your Camera for object detection and language learning.",
          enableMicrophonePermission: true,
          microphonePermissionText: "Vocam needs access to your Microphone for pronunciation practice."
        }
      ],
      
      [
        "expo-av",
        {
          microphonePermission: "Vocam needs microphone access for pronunciation practice and speech recognition."
        }
      ],
      
      // Add file system plugin for better file handling
      [
        "expo-file-system"
      ]
    ],
    
    extra: {
      router: {},
      eas: {
        projectId: "1eb973cc-affd-4289-ab40-dc2ea91b13b9"
      },
      googleCloudApiKey: process.env.GOOGLE_CLOUD_API_KEY,
      ...(process.env.GOOGLE_CLOUD_VISION_API_KEY && { 
        googleVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY 
      })
    },
    
    // Add updates configuration for OTA updates
    updates: {
      fallbackToCacheTimeout: 0
    },
    
    // Enhanced asset handling
    assetBundlePatterns: [
      "**/*"
    ]
  }
};