module.exports = function (api) {
  api.cache(true);

  const productionPlugins = ['react-native-paper/babel'];

  try {
    require.resolve('babel-plugin-transform-remove-console');
    productionPlugins.push('transform-remove-console');
  } catch (error) {
    // 避免在 test 环境刷屏，仅在非测试环境提示一次
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[babel.config] 未安装 babel-plugin-transform-remove-console，生产构建将保留 console 输出');
    }
  }

  return {
    presets: ['module:@react-native/babel-preset'],
    env: {
      test: {
        presets: [
          'module:@react-native/babel-preset',
        ],
        plugins: [
          '@babel/plugin-transform-modules-commonjs',
        ],
      },
      production: {
        plugins: productionPlugins,
      },
    },
    plugins: [
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
      // react-native-reanimated/plugin 必须是最后一个插件！
      'react-native-reanimated/plugin',
    ],
  };
};
