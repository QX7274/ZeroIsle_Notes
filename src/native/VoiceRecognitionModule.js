import { NativeModules } from 'react-native';

const { VoiceRecognitionModule } = NativeModules;

export default {
    startListening: () => {
        return new Promise((resolve, reject) => {
            VoiceRecognitionModule.startListening()
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    stopListening: () => {
        VoiceRecognitionModule.stopListening();
    },

    destroy: () => {
        VoiceRecognitionModule.destroy();
    },
}; 