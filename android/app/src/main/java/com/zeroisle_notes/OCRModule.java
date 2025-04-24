package com.zeroisle_notes;

import android.graphics.Bitmap;
import android.util.SparseArray;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableArray;
import com.google.android.gms.vision.Frame;
import com.google.android.gms.vision.text.TextBlock;
import com.google.android.gms.vision.text.TextRecognizer;

public class OCRModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private final TextRecognizer textRecognizer;

    public OCRModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.textRecognizer = new TextRecognizer.Builder(reactContext).build();
    }

    @Override
    public String getName() {
        return "OCR";
    }

    @ReactMethod
    public void recognizeText(String base64Image, Promise promise) {
        try {
            // 将 base64 字符串转换为 Bitmap
            byte[] decodedString = android.util.Base64.decode(base64Image, android.util.Base64.DEFAULT);
            Bitmap bitmap = android.graphics.BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);

            Frame frame = new Frame.Builder().setBitmap(bitmap).build();
            SparseArray<TextBlock> items = textRecognizer.detect(frame);

            WritableArray blocks = Arguments.createArray();
            for (int i = 0; i < items.size(); i++) {
                TextBlock item = items.valueAt(i);
                WritableMap block = Arguments.createMap();
                block.putString("text", item.getValue());
                block.putString("language", item.getLanguage());
                blocks.pushMap(block);
            }

            WritableMap result = Arguments.createMap();
            result.putArray("blocks", blocks);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

} 