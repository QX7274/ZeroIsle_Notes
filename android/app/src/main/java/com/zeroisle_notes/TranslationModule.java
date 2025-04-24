package com.zeroisle_notes;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.google.cloud.translate.Translate;
import com.google.cloud.translate.TranslateOptions;
import com.google.cloud.translate.Translation;
import com.google.cloud.translate.Language;
import java.util.List;

public class TranslationModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private final Translate translate;

    public TranslationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.translate = TranslateOptions.getDefaultInstance().getService();
    }

    @Override
    public String getName() {
        return "Translation";
    }

    @ReactMethod
    public void translate(String text, String targetLanguage, Promise promise) {
        try {
            Translation translation = translate.translate(
                text,
                Translate.TranslateOption.targetLanguage(targetLanguage)
            );

            WritableMap result = Arguments.createMap();
            result.putString("translatedText", translation.getTranslatedText());
            result.putString("sourceLanguage", translation.getSourceLanguage());
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void detectLanguage(String text, Promise promise) {
        try {
            String detectedLanguage = translate.detect(text).getLanguage();
            WritableMap result = Arguments.createMap();
            result.putString("language", detectedLanguage);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", "语言检测失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getSupportedLanguages(Promise promise) {
        try {
            List<Language> languages = translate.listSupportedLanguages();
            WritableArray languageArray = Arguments.createArray();

            for (Language language : languages) {
                WritableMap languageMap = Arguments.createMap();
                languageMap.putString("code", language.getCode());
                languageMap.putString("name", language.getName());
                languageArray.pushMap(languageMap);
            }

            promise.resolve(languageArray);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
} 