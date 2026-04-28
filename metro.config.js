const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const {resolve: defaultResolve} = require('metro-resolver');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// 自定义配置
const config = {
  projectRoot: __dirname,
  watchFolders: [__dirname],
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
      // 强制将随机值模块映射到本地node_modules绝对路径，规避解析目录漂移
      if (moduleName === 'react-native-get-random-values') {
        return {
          filePath: path.join(__dirname, 'node_modules', 'react-native-get-random-values', 'index.js'),
          type: 'sourceFile',
        };
      }

      // 拦截字符串拼接的fs模块请求
      if (moduleName === 'f' + 's' || moduleName === 'fs') {
        return {
          filePath: require.resolve('react-native-fs'),
          type: 'sourceFile',
        };
      }
      return defaultResolve(context, moduleName, platform);
    },
  },
  watcher: {
    healthCheck: {
      enabled: false,
    },
    watchman: false,
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
