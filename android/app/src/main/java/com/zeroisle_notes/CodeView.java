package com.zeroisle_notes;

import android.content.Context;
import android.widget.LinearLayout;
import android.widget.TextView;

public class CodeView extends LinearLayout {
    private TextView textView;
    private String code;
    private String language;
    private String theme;

    public CodeView(Context context) {
        super(context);
        init();
    }

    private void init() {
        textView = new TextView(getContext());
        addView(textView);
    }

    public void setCode(String code) {
        this.code = code;
        textView.setText(code);
    }

    public String getCode() {
        return code;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }
} 