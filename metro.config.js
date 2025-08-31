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
      process: require.resolve('process'),
      'text-encoding': require.resolve('text-encoding'),
    },
    // 拦截所有对fs模块的请求
    resolveRequest: (context, moduleName, platform) => {
      // 拦截字符串拼接的fs模块请求
      if (moduleName === 'f' + 's' || moduleName === 'fs') {
        return {
          filePath: require.resolve('react-native-fs'),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
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
