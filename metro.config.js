const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// 自定义配置
const config = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts],
    sourceExts: [...defaultConfig.resolver.sourceExts],
    alias: {
      fs: false,
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      util: require.resolve('util'),
      events: require.resolve('events'),
      crypto: require.resolve('crypto-browserify'),
      url: require.resolve('url'),
    },
  },
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);
