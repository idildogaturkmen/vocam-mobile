const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for TensorFlow.js model files and browser APIs
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'bin',
  'txt',
  'jpg',
  'png',
  'json',
];

// Enable browser globals for TensorFlow.js
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'jsx',
  'js',
  'ts',
  'tsx',
];

module.exports = config;