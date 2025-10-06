package com.zeroisle_notes;

import androidx.annotation.NonNull;

import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

/**
 * TouchDetectorView 的 ViewManager
 */
public class TouchDetectorViewManager extends SimpleViewManager<TouchDetectorView> {
    public static final String REACT_CLASS = "TouchDetectorView";

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected TouchDetectorView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new TouchDetectorView(reactContext);
    }

    @ReactProp(name = "enabled")
    public void setEnabled(TouchDetectorView view, boolean enabled) {
        view.setEnabled(enabled);
    }
}

