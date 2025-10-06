package com.zeroisle_notes;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
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
        // 注意：不要在这里添加已经通过 PackageList 自动添加的视图管理器
        viewManagers.add(new TouchDetectorViewManager());
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
        modules.add(new TouchTypeDetectionModule(reactContext));
        return modules;
    }
}