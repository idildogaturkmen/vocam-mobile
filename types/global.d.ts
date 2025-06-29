/// <reference types="expo/types" />

// Global type declarations
declare namespace NodeJS {
  interface ProcessEnv {
    GOOGLE_CLOUD_VISION_API_KEY?: string;
    API_BASE_URL?: string;
  }
}

// Module declarations for assets
declare module "*.png" {
  const value: any;
  export default value;
}

declare module "*.jpg" {
  const value: any;
  export default value;
}

declare module "*.svg" {
  const value: any;
  export default value;
}