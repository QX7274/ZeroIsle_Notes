package com.zeroisle_notes;

import android.os.Bundle;
import android.util.Log;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class MainActivity extends ReactActivity {
    private static final String TAG = "ZeroIsleMainActivity";

    @Override
    protected String getMainComponentName() {
        Log.i(TAG, "getMainComponentName -> ZeroIsle_Notes");
        return "ZeroIsle_Notes";
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Log.i(TAG, "onCreate: savedInstanceState=" + (savedInstanceState != null));
        super.onCreate(null);
    }

    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        Log.i(
            TAG,
            "createReactActivityDelegate: fabricEnabled=" +
                DefaultNewArchitectureEntryPoint.getFabricEnabled()
        );
        return new DefaultReactActivityDelegate(
            this,
            getMainComponentName(),
            // If you opted-in for the New Architecture, we enable the Fabric Renderer.
            DefaultNewArchitectureEntryPoint.getFabricEnabled());
    }
}
