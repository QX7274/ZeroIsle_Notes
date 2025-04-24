package com.zeroisle_notes;

import android.content.res.Configuration;
import android.app.Application;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainReactPackage;
import com.facebook.soloader.SoLoader;
import com.facebook.react.PackageList;
import java.util.Arrays;
import java.util.List;

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
    private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
            return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
            List<ReactPackage> packages = new PackageList(this).getPackages();
            packages.add(new ZeroIsleNotesPackage());
            // 移除手动添加的 ReactNativePushNotificationPackage，因为它已经通过 PackageList 自动添加
            // packages.add(new ReactNativePushNotificationPackage());
            // 移除手动添加的 ImagePickerPackage，因为它已经通过 PackageList 自动添加
            // packages.add(new ImagePickerPackage());
            // 移除手动添加的 RNFSPackage，因为它已经通过 PackageList 自动添加
            // packages.add(new RNFSPackage());
            // 注释掉有问题的包引用，这些包将由 PackageList 自动添加
            // packages.add(new RNSharePackage());
            // packages.add(new RNCDocumentPickerPackage());
            // 移除手动添加的 RNSoundPackage，因为它已经通过 PackageList 自动添加
            // packages.add(new RNSoundPackage());
            // 移除手动添加的 RNAudioRecorderPlayerPackage，因为它已经通过 PackageList 自动添加
            // packages.add(new RNAudioRecorderPlayerPackage());
            // 移除手动添加的 TextToSpeechPackage，因为它可能已经通过 PackageList 自动添加
            // packages.add(new TextToSpeechPackage());
            // 移除手动添加的 VectorIconsPackage，因为它可能已经通过 PackageList 自动添加
            // packages.add(new VectorIconsPackage());
            // packages.add(new RNCameraPackage());
            // packages.add(new RNPermissionsPackage());
            return packages;
        }

        @Override
        protected String getJSMainModuleName() {
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
        SoLoader.init(this, /* native exopackage */ false);
    }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
  }
}