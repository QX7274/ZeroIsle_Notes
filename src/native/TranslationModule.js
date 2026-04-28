const { NativeModules } = require('react-native');

const TranslationModule = NativeModules.TranslationModule || null;

const translationWrapper = {
    translateText: (text, targetLanguage) => {
        if (!TranslationModule) {
            return Promise.reject(new Error('TranslationModule not available'));
        }
        return new Promise((resolve, reject) => {
            TranslationModule.translateText(text, targetLanguage)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    detectLanguage: (text) => {
        if (!TranslationModule) {
            return Promise.reject(new Error('TranslationModule not available'));
        }
        return new Promise((resolve, reject) => {
            TranslationModule.detectLanguage(text)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    getSupportedLanguages: () => {
        if (!TranslationModule) {
            return Promise.reject(new Error('TranslationModule not available'));
        }
        return new Promise((resolve, reject) => {
            TranslationModule.getSupportedLanguages()
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },
};

module.exports = translationWrapper;
module.exports.default = translationWrapper;
