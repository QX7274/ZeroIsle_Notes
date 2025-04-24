package com.zeroisle_notes;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.MotionEvent;
import android.view.View;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.uimanager.ThemedReactContext;
import androidx.annotation.NonNull;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.annotations.ReactProp;
import java.util.ArrayList;
import java.util.List;

public class CanvasModule extends SimpleViewManager<CanvasView> {
    private static final String REACT_CLASS = "CanvasView";
    private final ReactApplicationContext reactContext;

    public CanvasModule(ReactApplicationContext reactContext) {
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    @NonNull
    public CanvasView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new CanvasView(reactContext);
    }

    @ReactProp(name = "color")
    public void setColor(CanvasView view, String color) {
        view.setStrokeColor(Color.parseColor(color));
    }

    @ReactProp(name = "strokeWidth", defaultFloat = 5f)
    public void setStrokeWidth(CanvasView view, float width) {
        view.setStrokeWidth(width);
    }

    @ReactMethod
    public void clear(int viewId) {
        CanvasView view = (CanvasView) reactContext.getCurrentActivity()
                .findViewById(viewId);
        if (view != null) {
            view.clear();
        }
    }

    @ReactMethod
    public void save(int viewId, Promise promise) {
        try {
            CanvasView view = (CanvasView) reactContext.getCurrentActivity()
                    .findViewById(viewId);
            if (view != null) {
                String base64 = view.save();
                WritableMap result = Arguments.createMap();
                result.putString("base64", base64);
                promise.resolve(result);
            } else {
                promise.reject("ERROR", "View not found");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }


}