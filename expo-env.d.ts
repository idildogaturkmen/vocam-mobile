/// <reference types="expo/types" />

// Expo environment variables types
declare namespace NodeJS {
  interface ProcessEnv {
    GOOGLE_CLOUD_VISION_API_KEY?: string;
    API_BASE_URL?: string;
  }
}