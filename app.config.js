// Load environment variables
require('dotenv').config();

module.exports = {
  expo: {
    name: "Vocam",
    slug: "vocam",
    version: "1.0.0",
    orientation: "portrait",
    assetBundlePatterns: [
      "**/*"
    ],
    splash: {
      image: "./assets/Splash-android.png",
      resizeMode: "cover",
      backgroundColor: "#ffffff"
    },
    android: {
      package: "app.vocam.mobile",
      splash: {
        image: "./assets/Splash-android.png",
        resizeMode: "cover",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ],

      // Enable edge-to-edge display
      edgeToEdge: {
        enabled: true
      }
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

      // ✅ Keep plugin splash config the same for EAS builds
      [
        "expo-splash-screen",
        {
          image: "./assets/Splash-android.png",
          resizeMode: "cover",
          backgroundColor: "#ffffff"
        }
      ],

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
      googleCloudApiKey: process.env.GOOGLE_CLOUD_API_KEY,
      ...(process.env.GOOGLE_CLOUD_VISION_API_KEY && { 
        googleVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY 
      })
    }
  }
};