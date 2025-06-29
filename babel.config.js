module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // expo-router/babel is deprecated in SDK 50+, now included in babel-preset-expo
      'react-native-reanimated/plugin',
    ],
  };
};