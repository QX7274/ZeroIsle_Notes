package com.zeroisle_notes;

import android.content.res.Configuration;
import android.app.Application;
import android.content.Context;
import android.util.Log;
import androidx.multidex.MultiDex;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainReactPackage;
import com.facebook.soloader.SoLoader;
import com.facebook.react.PackageList;
import java.util.Arrays;
import java.util.List;

// 额外包：手写识别（位于不同包名）
import com.zeroislenotes.HandwritingRecognitionPackage;

// 使用原生模块
// 注释掉 ReactNativePushNotificationPackage 的导入，因为它已经通过 PackageList 自动添加
// import com.dieam.reactnativepushnotification.ReactNativePushNotificationPackage;
// 注释掉 ImagePickerPackage 的导入，因为它已经通过 PackageList 自动添加
// import com.imagepicker.ImagePickerPackage;
// 注释掉 RNFSPackage 的导入，因为它已经通过 PackageList 自动添加
// import com.rnfs.RNFSPackage;
// 注释掉 RNSoundPackage 的导入，因为它已经通过 PackageList 自动添加
// import com.zmxv.RNSound.RNSoundPackage;
// 注释掉 RNAudioRecorderPlayerPackage 的导入，因为它已经通过 PackageList 自动添加
// import com.dooboolab.audiorecorderplayer.RNAudioRecorderPlayerPackage;
// 注释掉 TextToSpeechPackage 的导入，因为它可能已经通过 PackageList 自动添加
// import net.no_mad.tts.TextToSpeechPackage;
// 注释掉 VectorIconsPackage 的导入，因为它可能已经通过 PackageList 自动添加
// import com.oblador.vectoricons.VectorIconsPackage;

// 注释掉有问题的导入，我们将使用 PackageList 自动添加这些包
// import com.rnshare.RNSharePackage;
// import com.reactnativecommunity.picker.RNCDocumentPickerPackage;
// import com.reactnativecamera.RNCameraPackage;
// import com.reactnativepermissions.RNPermissionsPackage;
// import com.reactnativecommunity.picker.RNCPickerPackage;
// import com.reactnativecommunity.permissions.RNPermissionsPackage;

public class MainApplication extends Application implements ReactApplication {
    private static final String TAG = "ZeroIsleMainApplication";

    private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
            Log.i(TAG, "getUseDeveloperSupport -> " + BuildConfig.DEBUG);
            return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
            List<ReactPackage> packages = new PackageList(this).getPackages();
            // 注册项目自有打包器（包含 PDF/分页/画布 等视图与模块）
            packages.add(new ZeroIsleNotesPackage());
            // 注册手写识别模块包（com.zeroislenotes）
            packages.add(new HandwritingRecognitionPackage());
            // 其他包均由 PackageList 自动管理
            Log.i(TAG, "getPackages: total=" + packages.size());
            return packages;
        }

        @Override
        protected String getJSMainModuleName() {
            Log.i(TAG, "getJSMainModuleName -> index");
            return "index";
        }
    };

    @Override
    public ReactNativeHost getReactNativeHost() {
        return mReactNativeHost;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "onCreate: start");
        SoLoader.init(this, /* native exopackage */ false);
        Log.i(TAG, "onCreate: SoLoader initialized");
    }

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        Log.i(TAG, "attachBaseContext");
        MultiDex.install(this);
    }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    Log.i(TAG, "onConfigurationChanged");
  }
}
