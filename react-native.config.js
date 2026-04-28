module.exports = {
  dependencies: {
    // Temporary workaround for Windows build crash in native Nitro C++ (ninja 0xC0000005)
    'react-native-nitro-modules': {
      platforms: {
        android: null,
      },
    },
    // Depends on Nitro on Android; disable together to keep app buildable for debugging
    'react-native-audio-recorder-player': {
      platforms: {
        android: null,
      },
    },
  },
};
