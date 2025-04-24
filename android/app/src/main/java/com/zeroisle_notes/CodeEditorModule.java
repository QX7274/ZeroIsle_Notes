package com.zeroisle_notes;

import android.view.View;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import android.widget.EditText;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import androidx.annotation.NonNull;
import com.facebook.react.uimanager.annotations.ReactProp;

public class CodeEditorModule extends SimpleViewManager<EditText> {
    private final ReactApplicationContext reactContext;

    public CodeEditorModule(ReactApplicationContext reactContext) {
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "CodeView";
    }

    @ReactMethod
    public void getCode(int viewId, Promise promise) {
        try {
            EditText view = (EditText) reactContext.getCurrentActivity()
                    .findViewById(viewId);
            if (view != null) {
                WritableMap result = Arguments.createMap();
                result.putString("code", view.getText().toString());
                promise.resolve(result);
            } else {
                promise.reject("ERROR", "View not found");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @Override
    @NonNull
    protected EditText createViewInstance(@NonNull ThemedReactContext reactContext) {
        EditText editText = new EditText(reactContext);
        editText.setHorizontallyScrolling(true);
        editText.setTextSize(14);
        return editText;
    }

    @ReactProp(name = "code")
    public void setCode(EditText view, String code) {
        view.setText(code);
    }

    @ReactProp(name = "language")
    public void setLanguage(EditText view, String language) {
        // 可以在这里添加语法高亮的逻辑
    }

    @ReactProp(name = "theme")
    public void setTheme(EditText view, String theme) {
        // 可以在这里添加主题切换的逻辑
    }
}