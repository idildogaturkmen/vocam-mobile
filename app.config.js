export default {
  expo: {
    name: "Vocam",
    slug: "vocam",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yourcompany.vocamlearning",
      infoPlist: {
        NSCameraUsageDescription: "Vocam needs camera access to detect objects and help you learn languages.",
        NSSpeechRecognitionUsageDescription: "Vocam uses speech recognition to help with pronunciation."
      }
    },
    android: {
      package: "com.yourcompany.vocamlearning",
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
      ]
    ],
    extra: {
      router: {},
      eas: {
        projectId: "1eb973cc-affd-4289-ab40-dc2ea91b13b9"
      },
      
      googleVisionApiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY || ""
    }
  }
};