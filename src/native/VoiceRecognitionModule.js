const { NativeModules } = require('react-native');

const VoiceRecognitionModule = NativeModules.VoiceRecognitionModule || null;

const voiceRecognitionWrapper = {
    startListening: () => {
        if (!VoiceRecognitionModule) {
            return Promise.reject(new Error('VoiceRecognitionModule not available'));
        }
        return new Promise((resolve, reject) => {
            VoiceRecognitionModule.startListening()
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    stopListening: () => {
        if (VoiceRecognitionModule) {
            VoiceRecognitionModule.stopListening();
        }
    },

    destroy: () => {
        if (VoiceRecognitionModule) {
            VoiceRecognitionModule.destroy();
        }
    },
};

module.exports = voiceRecognitionWrapper;
module.exports.default = voiceRecognitionWrapper;
