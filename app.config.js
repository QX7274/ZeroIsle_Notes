/**
 * Expo配置文件
 */
module.exports = {
  name: 'ZeroIsle_Notes',
  slug: 'zeroislenotes',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.zeroisle_notes'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF'
    },
    package: 'com.zeroisle_notes'
  },
  web: {
    favicon: './assets/favicon.png'
  },
  plugins: [
    'expo-file-system',
    'expo-image',
    'expo-blur',
    'expo-haptics',
    'expo-crypto',
    'expo-linear-gradient'
  ]
};
