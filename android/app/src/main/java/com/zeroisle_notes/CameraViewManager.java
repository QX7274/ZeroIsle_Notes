package com.zeroisle_notes;

import android.view.View;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.bridge.ReactApplicationContext;

/**
 * 注意：这个类已经被注释掉，因为我们现在使用 react-native-camera 库
 * 这个文件只是一个占位符，以避免编译错误
 */
public class CameraViewManager extends SimpleViewManager<View> {
    private static final String REACT_CLASS = "RNCameraView";
    private final ReactApplicationContext reactContext;

    public CameraViewManager(ReactApplicationContext reactContext) {
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    protected View createViewInstance(ThemedReactContext reactContext) {
        return new View(reactContext);
    }

    public View getCameraKitView() {
        return null;
    }
}