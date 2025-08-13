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
      }
    }
  }
};