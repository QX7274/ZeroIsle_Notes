import { NativeModules } from 'react-native';

const { OCRModule } = NativeModules;

export default {
    recognizeText: (imagePath) => {
        return new Promise((resolve, reject) => {
            OCRModule.recognizeText(imagePath)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },
}; 