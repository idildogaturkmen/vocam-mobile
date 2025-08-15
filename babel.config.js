module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // expo-router/babel is deprecated in SDK 50+, now included in babel-preset-expo
      'react-native-reanimated/plugin',
      // Remove console.log statements in production for better performance
      ...(isProduction ? [['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
    ],
  };
};