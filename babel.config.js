module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        plugins: ['react-native-paper/babel'],
      },
    },
  };
};
