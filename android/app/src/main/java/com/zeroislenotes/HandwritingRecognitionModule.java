package com.zeroislenotes;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import com.google.mlkit.vision.digitalink.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.Ink;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.common.MlKitException;
import android.os.Bundle;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;

public class HandwritingRecognitionModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "HandwritingRecognitionModule";
    private DigitalInkRecognizer recognizer;
    private DigitalInkRecognitionModel model;
    private boolean isModelDownloaded = false;

    public HandwritingRecognitionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        initializeRecognizer();
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    private void initializeRecognizer() {
        // Initialize with Chinese preferred, fallback to English
        try {
            DigitalInkRecognitionModelIdentifier modelIdentifier =
                DigitalInkRecognitionModelIdentifier.fromLanguageTag("zh-CN");
            if (modelIdentifier == null) {
                modelIdentifier = DigitalInkRecognitionModelIdentifier.fromLanguageTag("en-US");
            }
            if (modelIdentifier == null) {
                Log.e(MODULE_NAME, "Failed to obtain DigitalInkRecognitionModelIdentifier for zh-CN or en-US");
                return;
            }

            model = DigitalInkRecognitionModel.builder(modelIdentifier).build();
            DigitalInkRecognizerOptions options =
                DigitalInkRecognizerOptions.builder(model).build();
            recognizer = DigitalInkRecognition.getClient(options);

            // Download model if not available
            downloadModelIfNeeded();
        } catch (MlKitException e) {
            Log.e(MODULE_NAME, "Failed to initialize Digital Ink recognizer", e);
        }
    }

    private void downloadModelIfNeeded() {
        if (model != null) {
            DownloadConditions conditions = new DownloadConditions.Builder().build();
            RemoteModelManager.getInstance()
                .download(model, conditions)
                .addOnSuccessListener(aVoid -> {
                    isModelDownloaded = true;
                })
                .addOnFailureListener(e -> {
                    isModelDownloaded = false;
                });
        }
    }

    @ReactMethod
    public void recognizeHandwriting(ReadableArray strokesData, Promise promise) {
        if (!isModelDownloaded) {
            promise.reject("MODEL_NOT_READY", "Handwriting recognition model not downloaded");
            return;
        }

        try {
            // Convert React Native stroke data to ML Kit Ink format
            Ink ink = convertStrokesToInk(strokesData);
            
            if (ink.getStrokes().isEmpty()) {
                WritableMap result = Arguments.createMap();
                result.putString("text", "");
                result.putDouble("confidence", 0.0);
                result.putArray("alternatives", Arguments.createArray());
                promise.resolve(result);
                return;
            }

            // Perform recognition
            recognizer.recognize(ink)
                .addOnSuccessListener(result -> {
                    WritableMap response = Arguments.createMap();
                    
                    if (result.getCandidates().isEmpty()) {
                        response.putString("text", "");
                        response.putDouble("confidence", 0.0);
                        response.putArray("alternatives", Arguments.createArray());
                    } else {
                        String topResult = result.getCandidates().get(0).getText();
                        response.putString("text", topResult);
                        response.putDouble("confidence", 0.85); // ML Kit doesn't provide confidence scores
                        
                        // Add alternatives
                        WritableArray alternatives = Arguments.createArray();
                        for (int i = 1; i < Math.min(result.getCandidates().size(), 3); i++) {
                            WritableMap alt = Arguments.createMap();
                            alt.putString("text", result.getCandidates().get(i).getText());
                            alt.putDouble("confidence", 0.85 - (i * 0.1));
                            alternatives.pushMap(alt);
                        }
                        response.putArray("alternatives", alternatives);
                    }
                    
                    response.putString("language", "auto");
                    promise.resolve(response);
                })
                .addOnFailureListener(e -> {
                    promise.reject("RECOGNITION_FAILED", e.getMessage());
                });
                
        } catch (Exception e) {
            promise.reject("CONVERSION_ERROR", "Failed to convert strokes: " + e.getMessage());
        }
    }

    private Ink convertStrokesToInk(ReadableArray strokesData) {
        Ink.Builder inkBuilder = Ink.builder();
        
        for (int i = 0; i < strokesData.size(); i++) {
            ReadableMap strokeMap = strokesData.getMap(i);
            ReadableArray points = strokeMap.getArray("points");
            
            if (points != null && points.size() > 0) {
                Ink.Stroke.Builder strokeBuilder = Ink.Stroke.builder();
                
                for (int j = 0; j < points.size(); j++) {
                    ReadableMap pointMap = points.getMap(j);
                    float x = (float) pointMap.getDouble("x");
                    float y = (float) pointMap.getDouble("y");
                    long timestamp = System.currentTimeMillis() + j; // Simulate timestamps
                    
                    strokeBuilder.addPoint(Ink.Point.create(x, y, timestamp));
                }
                
                inkBuilder.addStroke(strokeBuilder.build());
            }
        }
        
        return inkBuilder.build();
    }

    @ReactMethod
    public void recognizeStrokeRealTime(ReadableMap strokeData, Promise promise) {
        // For real-time recognition, we'll use a simplified approach
        WritableArray singleStroke = Arguments.createArray();
        Bundle bundle = Arguments.toBundle(strokeData);
        WritableMap strokeMap = Arguments.fromBundle(bundle);
        singleStroke.pushMap(strokeMap);
        recognizeHandwriting(singleStroke, promise);
    }

    @ReactMethod
    public void recognizeBatch(ReadableArray strokeGroups, Promise promise) {
        if (!isModelDownloaded) {
            promise.reject("MODEL_NOT_READY", "Handwriting recognition model not downloaded");
            return;
        }
        WritableArray results = Arguments.createArray();
        int total = strokeGroups != null ? strokeGroups.size() : 0;
        if (total == 0) {
            promise.resolve(results);
            return;
        }
        final int[] completed = new int[]{0};
        for (int i = 0; i < total; i++) {
            ReadableArray group = strokeGroups.getArray(i);
            try {
                Ink ink = convertStrokesToInk(group);
                if (ink.getStrokes().isEmpty()) {
                    WritableMap empty = Arguments.createMap();
                    empty.putString("text", "");
                    empty.putDouble("confidence", 0.0);
                    empty.putArray("alternatives", Arguments.createArray());
                    results.pushMap(empty);
                    completed[0]++;
                    if (completed[0] >= total) {
                        promise.resolve(results);
                    }
                    continue;
                }
                recognizer.recognize(ink)
                    .addOnSuccessListener(result -> {
                        WritableMap response = Arguments.createMap();
                        if (result.getCandidates().isEmpty()) {
                            response.putString("text", "");
                            response.putDouble("confidence", 0.0);
                            response.putArray("alternatives", Arguments.createArray());
                        } else {
                            String top = result.getCandidates().get(0).getText();
                            response.putString("text", top);
                            response.putDouble("confidence", 0.85);
                            WritableArray alts = Arguments.createArray();
                            for (int j = 1; j < Math.min(result.getCandidates().size(), 3); j++) {
                                WritableMap alt = Arguments.createMap();
                                alt.putString("text", result.getCandidates().get(j).getText());
                                alt.putDouble("confidence", 0.85 - (j * 0.1));
                                alts.pushMap(alt);
                            }
                            response.putArray("alternatives", alts);
                        }
                        results.pushMap(response);
                        completed[0]++;
                        if (completed[0] >= total) {
                            promise.resolve(results);
                        }
                    })
                    .addOnFailureListener(e -> {
                        WritableMap error = Arguments.createMap();
                        error.putString("error", e.getMessage());
                        results.pushMap(error);
                        completed[0]++;
                        if (completed[0] >= total) {
                            promise.resolve(results);
                        }
                    });
            } catch (Exception e) {
                WritableMap error = Arguments.createMap();
                error.putString("error", e.getMessage());
                results.pushMap(error);
                completed[0]++;
                if (completed[0] >= total) {
                    promise.resolve(results);
                }
            }
        }
    }

    @ReactMethod
    public void isModelReady(Promise promise) {
        promise.resolve(isModelDownloaded);
    }

    @ReactMethod
    public void downloadModel(Promise promise) {
        if (model != null) {
            DownloadConditions conditions = new DownloadConditions.Builder().build();
            RemoteModelManager.getInstance()
                .download(model, conditions)
                .addOnSuccessListener(aVoid -> {
                    isModelDownloaded = true;
                    promise.resolve(true);
                })
                .addOnFailureListener(e -> {
                    isModelDownloaded = false;
                    promise.reject("DOWNLOAD_FAILED", e.getMessage());
                });
        } else {
            promise.reject("MODEL_NULL", "Recognition model not initialized");
        }
    }
}
