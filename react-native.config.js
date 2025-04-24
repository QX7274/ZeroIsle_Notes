module.exports = {
  dependencies: {
    'react-native-linear-gradient': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-linear-gradient/android',
        },
        ios: {
          project: '../node_modules/react-native-linear-gradient/ios/BVLinearGradient.xcodeproj',
        },
      },
    },
  },
};
