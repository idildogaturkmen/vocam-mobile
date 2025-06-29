module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for expo-router
      require.resolve('expo-router/babel'),
      // Required for react-native-reanimated
      'react-native-reanimated/plugin',
    ],
  };
};