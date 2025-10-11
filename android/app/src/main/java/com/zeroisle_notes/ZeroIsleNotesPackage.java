package com.zeroisle_notes;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.zeroisle_notes.nativepdf.NativePDFViewManager;
import com.zeroisle_notes.nativepaged.NativePagedNoteViewManager;
import com.zeroisle_notes.nativeinfinite.NativeInfiniteCanvasViewManager;
import com.zeroisle_notes.nativepdf.NativePDFModule;
import com.zeroisle_notes.nativepaged.NativePagedNoteModule;
import com.zeroisle_notes.nativeinfinite.NativeInfiniteCanvasModule;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 零屿笔记原生模块包
 * 用于注册所有原生模块和视图管理器
 */
public class ZeroIsleNotesPackage implements ReactPackage {
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        List<ViewManager> viewManagers = new ArrayList<>();
        // 添加自定义视图管理器
        viewManagers.add(new NativePDFViewManager()); // 原生 PDF 视图
        viewManagers.add(new NativePagedNoteViewManager()); // 原生分页笔记视图
        viewManagers.add(new NativeInfiniteCanvasViewManager()); // 原生无限画布视图
        return viewManagers;
    }

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        // 添加原生模块
        modules.add(new ZeroIsleUtilsModule(reactContext));
        modules.add(new FileSystemModule(reactContext));
        modules.add(new NotificationModule(reactContext));
        modules.add(new NotificationChannelModule(reactContext)); // 添加通知渠道模块
        modules.add(new AIAssistantModule(reactContext));
        modules.add(new BaiduAIAssistantModule(reactContext));
        modules.add(new XunfeiAIAssistantModule(reactContext));
        modules.add(new ZhipuAIAssistantModule(reactContext));
        // 添加原生视图模块
        modules.add(new NativePDFModule(reactContext));
        modules.add(new NativePagedNoteModule(reactContext));
        modules.add(new NativeInfiniteCanvasModule(reactContext));
        return modules;
    }
}