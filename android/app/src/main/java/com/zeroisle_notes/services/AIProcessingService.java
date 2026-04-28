package com.zeroisle_notes.services;

import android.graphics.Bitmap;
import android.util.Log;
import android.graphics.Rect;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import android.graphics.Path;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Canvas;
import java.util.List;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

public class AIProcessingService {

    private static final String TAG = "AIProcessingService";

    public static void recognizeTextInBitmap(Bitmap bitmap, float offsetX, float offsetY, Promise promise) {
        try {
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            TextRecognizer recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());

            recognizer.process(image)
                .addOnSuccessListener(visionText -> {
                    WritableArray resultsArray = Arguments.createArray();
                    for (Text.TextBlock block : visionText.getTextBlocks()) {
                        WritableMap textBlockMap = Arguments.createMap();
                        textBlockMap.putString("text", block.getText());
                        // ML Kit Text API doesn't provide confidence for TextBlock; use 0.0 as placeholder
                        textBlockMap.putDouble("confidence", 0.0);

                        Rect blockFrame = block.getBoundingBox();
                        WritableMap frameMap = Arguments.createMap();
                        if (blockFrame != null) {
                            frameMap.putDouble("x", blockFrame.left + offsetX);
                            frameMap.putDouble("y", blockFrame.top + offsetY);
                            frameMap.putDouble("width", blockFrame.width());
                            frameMap.putDouble("height", blockFrame.height());
                        }
                        textBlockMap.putMap("frame", frameMap);
                        resultsArray.pushMap(textBlockMap);
                    }
                    promise.resolve(resultsArray);
                    bitmap.recycle();
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Text recognition failed", e);
                    promise.reject("E_AI_SERVICE_FAILED", "Text recognition failed: " + e.getMessage());
                    bitmap.recycle();
                });
        } catch (Exception e) {
            Log.e(TAG, "Error during text recognition", e);
            promise.reject("E_AI_SERVICE_ERROR", "Error during text recognition: " + e.getMessage());
        }
    }

    public static void recognizeHandwriting(List<Path> paths, List<Paint> paints, Promise promise) {
        recognizeHandwriting(paths, paints, new RecognitionCallback() {
            @Override
            public void onResult(String text, float confidence) {
                promise.resolve(text != null ? text : "");
            }

            @Override
            public void onError(Exception e) {
                Log.e(TAG, "Handwriting recognition failed", e);
                promise.reject("E_HANDWRITING_FAILED", "Handwriting recognition failed: " + e.getMessage());
            }
        });
    }

    public interface RecognitionCallback {
        void onResult(String text, float confidence);
        void onError(Exception e);
    }

    public static void recognizeHandwriting(List<Path> paths, List<Paint> paints, RecognitionCallback callback) {
        if (callback == null) {
            return;
        }

        if (paths == null || paths.isEmpty()) {
            callback.onResult("", 0);
            return;
        }

        try {
            // 1. Calculate the bounding box for all strokes
            RectF bounds = new RectF();
            boolean first = true;
            for (Path path : paths) {
                RectF strokeBounds = new RectF();
                path.computeBounds(strokeBounds, true);
                if (first) {
                    bounds.set(strokeBounds);
                    first = false;
                } else {
                    bounds.union(strokeBounds);
                }
            }

            // 2. Add padding
            float padding = 20f;
            bounds.inset(-padding, -padding);

            // 3. Create a bitmap and draw the strokes
            int bitmapWidth = (int) bounds.width();
            int bitmapHeight = (int) bounds.height();

            if (bitmapWidth <= 0 || bitmapHeight <= 0) {
                callback.onResult("", 0);
                return;
            }

            Bitmap bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(android.graphics.Color.WHITE);

            canvas.save();
            canvas.translate(-bounds.left, -bounds.top);

            for (int i = 0; i < paths.size(); i++) {
                canvas.drawPath(paths.get(i), paints.get(i));
            }
            canvas.restore();

            // 4. Use ML Kit for recognition
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            TextRecognizer recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());

            recognizer.process(image)
                .addOnSuccessListener(visionText -> {
                    String recognizedText = visionText.getText();
                    Log.d(TAG, "Handwriting recognition successful: " + recognizedText);
                    callback.onResult(recognizedText, 0.0f);
                    bitmap.recycle();
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Handwriting recognition failed", e);
                    callback.onError(e);
                    bitmap.recycle();
                });

        } catch (Exception e) {
            Log.e(TAG, "Error during handwriting recognition", e);
            callback.onError(e);
        }
    }

    public static void recognizeSingleStroke(List<com.zeroisle_notes.nativepaged.StrokePoint> points, RecognitionCallback callback) {
        if (points == null || points.isEmpty()) {
            callback.onResult("", 0);
            return;
        }

        try {
            // 1. Calculate bounding box and create a Path
            RectF bounds = new RectF();
            Path path = new Path();
            boolean first = true;
            for (com.zeroisle_notes.nativepaged.StrokePoint p : points) {
                if (first) {
                    path.moveTo(p.x, p.y);
                    bounds.set(p.x, p.y, p.x, p.y);
                    first = false;
                } else {
                    path.lineTo(p.x, p.y);
                    bounds.union(p.x, p.y);
                }
            }

            // 2. Add padding
            float padding = 20f;
            bounds.inset(-padding, -padding);

            // 3. Create bitmap and draw the stroke
            int bitmapWidth = (int) bounds.width();
            int bitmapHeight = (int) bounds.height();

            if (bitmapWidth <= 0 || bitmapHeight <= 0) {
                callback.onResult("", 0);
                return;
            }

            Bitmap bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(android.graphics.Color.WHITE);

            Paint paint = new Paint();
            paint.setColor(android.graphics.Color.BLACK);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(5f);
            paint.setAntiAlias(true);

            canvas.save();
            canvas.translate(-bounds.left, -bounds.top);
            canvas.drawPath(path, paint);
            canvas.restore();

            // 4. Use ML Kit for recognition
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            TextRecognizer recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());

            recognizer.process(image)
                .addOnSuccessListener(visionText -> {
                    String recognizedText = visionText.getText();
                    Log.d(TAG, "Single stroke recognition successful: " + recognizedText);
                    // ML Kit's Text object does not provide an overall confidence score.
                    // We can calculate an average if needed, but for now, we'll use 0.
                    callback.onResult(recognizedText, 0.0f);
                    bitmap.recycle();
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Single stroke recognition failed", e);
                    callback.onError(e);
                    bitmap.recycle();
                });

        } catch (Exception e) {
            Log.e(TAG, "Error during single stroke recognition", e);
            callback.onError(e);
        }
    }
}
