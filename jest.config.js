module.exports = {
  preset: 'react-native',
  setupFiles: [
    '<rootDir>/src/tests/jestSetup.js',
  ],
transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  // transform: {
  //   '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  // },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-paper|@react-native-community|@shopify/react-native-skia|react-native-vector-icons|react-native-safe-area-context|react-native-screens|react-native-device-info|@react-native-async-storage|react-native-voice|react-native-permissions|@react-native-google-signin|axios|react-native-linear-gradient|react-redux|@reduxjs/toolkit|immer|react-native-keychain)/)',
  ],
  moduleNameMapper: {
    '^react-native-keychain$': '<rootDir>/src/tests/__mocks__/reactNativeKeychainMock.js',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/tests/__mocks__/fileMock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/output/',
    '<rootDir>/e2e/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/output/',
  ],
};
