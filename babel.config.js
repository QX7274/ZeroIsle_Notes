module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: [
            '.ios.js',
            '.android.js',
            '.js',
            '.jsx',
            '.json',
            '.tsx',
            '.ts',
            '.native.js',
          ],
          alias: {
            '@services': './src/services',
            '@components': './src/components',
            '@screens': './src/screens',
            '@utils': './src/utils',
            '@models': './src/models',
            '@assets': './src/assets',
            '@config': './src/config',
          },
        },
      ],
    ],
    env: {
      production: {
        plugins: ['react-native-paper/babel'],
      },
    },
  };
};
