import { NativeModules } from 'react-native';

const { TranslationModule } = NativeModules;

export default {
    translateText: (text, targetLanguage) => {
        return new Promise((resolve, reject) => {
            TranslationModule.translateText(text, targetLanguage)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    detectLanguage: (text) => {
        return new Promise((resolve, reject) => {
            TranslationModule.detectLanguage(text)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    getSupportedLanguages: () => {
        return new Promise((resolve, reject) => {
            TranslationModule.getSupportedLanguages()
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },
}; 