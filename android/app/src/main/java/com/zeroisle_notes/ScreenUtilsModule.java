package com.zeroisle_notes;

import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Android 侧屏幕取色模块（对齐 iOS 的 ios/ScreenUtils.m：同名模块 + 同名方法 pickColor）。
 *
 * 为什么必须和 iOS 完全同名：JS 侧 src/native/screenUtilsBridge.js 的能力探测只认
 * “NativeModules.ScreenUtils 存在且 pickColor 是函数”。模块名或方法名对不上，
 * 工具栏颜色选择器就会一直停在“暂不支持”的 disabled 降级分支上。
 *
 * 为什么用 PixelCopy 而不是 view.draw(canvas)：笔记 / PDF 正文由 SurfaceView、纹理或
 * 原生自绘视图渲染，view.draw(canvas) 拿不到这部分像素，取到的会是空白。PixelCopy 直接
 * 读窗口已提交的帧，既能覆盖自绘内容，也省掉一次整屏视图的软件绘制。仅在 API < 26 时回退。
 *
 * 为什么不需要权限：截图对象是“本应用自己的窗口”，不是 MediaProjection 的全屏录制，
 * 因此不申请任何权限，也不影响上架审核。
 */
public class ScreenUtilsModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "ScreenUtils";
    private static final String TAG = "ScreenUtilsModule";

    private static final String ERROR_NO_ACTIVITY = "NO_ACTIVITY";
    private static final String ERROR_CAPTURE_FAILED = "SCREENSHOT_FAILED";
    private static final String ERROR_USER_CANCELLED = "USER_CANCELLED";
    private static final String ERROR_PICKER_BUSY = "PICKER_BUSY";

    private final ReactApplicationContext reactContext;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    /** 同一时刻只允许一个取色会话：否则会叠出多个浮层、多份整屏 Bitmap。 */
    private boolean isPicking = false;
    /** 持有当前浮层引用，供 invalidate() 兜底关闭（Dialog 握着 Activity，不关必泄漏）。 */
    private ScreenColorPickerDialog activeDialog;

    public ScreenUtilsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        // 暴露截图后端能力，便于 JS / 排查时确认走的是 PixelCopy 还是软件绘制回退。
        constants.put("supportsPixelCopy", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);
        return constants;
    }

    /**
     * 屏幕取色：截取当前窗口 → 弹出取色浮层 → resolve 十六进制颜色（如 "#3F51B5"）。
     * 用户取消时以 USER_CANCELLED reject，保持与 iOS 一致，JS 侧现有 catch 分支无需改动。
     */
    @ReactMethod
    public void pickColor(final Promise promise) {
        if (promise == null) {
            return;
        }

        final Activity activity = getCurrentActivity();
        if (activity == null || activity.isFinishing()) {
            reject(promise, ERROR_NO_ACTIVITY, "当前没有可用的 Activity");
            return;
        }
        if (isPicking) {
            reject(promise, ERROR_PICKER_BUSY, "已有一个取色会话正在进行");
            return;
        }

        isPicking = true;
        // 截图与浮层都必须发生在 UI 线程：PixelCopy 读窗口帧、Dialog 挂载窗口都要求主线程。
        activity.runOnUiThread(() -> startPickOnUiThread(activity, promise));
    }

    @Override
    public void invalidate() {
        // RN 实例重建 / 退出（含开发态 reload）时必须把浮层收掉，否则 Dialog 会连着 Activity 一起泄漏。
        final ScreenColorPickerDialog dialog = activeDialog;
        activeDialog = null;
        isPicking = false;
        if (dialog != null) {
            mainHandler.post(() -> {
                try {
                    dialog.dismiss();
                } catch (Throwable ignored) {
                    // 窗口已销毁时 dismiss 会抛，这里无事可做
                }
            });
        }
        super.invalidate();
    }

    private void startPickOnUiThread(final Activity activity, final Promise promise) {
        if (isActivityGone(activity)) {
            finishSession();
            reject(promise, ERROR_NO_ACTIVITY, "Activity 已不可用");
            return;
        }

        final Window window = activity.getWindow();
        final View decorView = window == null ? null : window.getDecorView();
        if (decorView == null || decorView.getWidth() <= 0 || decorView.getHeight() <= 0) {
            finishSession();
            reject(promise, ERROR_CAPTURE_FAILED, "窗口尚未完成布局，无法截图");
            return;
        }

        captureWindow(activity, decorView, new CaptureCallback() {
            @Override
            public void onCaptured(Bitmap bitmap, int[] originOnScreen) {
                if (isActivityGone(activity)) {
                    if (!bitmap.isRecycled()) {
                        bitmap.recycle();
                    }
                    finishSession();
                    reject(promise, ERROR_NO_ACTIVITY, "Activity 已不可用");
                    return;
                }
                showPicker(activity, bitmap, originOnScreen, promise);
            }

            @Override
            public void onFailed(String message) {
                finishSession();
                reject(promise, ERROR_CAPTURE_FAILED, message);
            }
        });
    }

    /** Activity 已经不可用时返回 true：销毁中的窗口既不能截图，也不能再挂 Dialog。 */
    private boolean isActivityGone(Activity activity) {
        if (activity == null || activity.isFinishing()) {
            return true;
        }
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed();
    }

    private void finishSession() {
        isPicking = false;
        activeDialog = null;
    }

    // ------------------------------------------------------------------
    // 截图
    // ------------------------------------------------------------------

    private interface CaptureCallback {
        void onCaptured(Bitmap bitmap, int[] originOnScreen);

        void onFailed(String message);
    }

    private void captureWindow(final Activity activity, final View decorView, final CaptureCallback callback) {
        final int width = decorView.getWidth();
        final int height = decorView.getHeight();

        final Bitmap bitmap;
        try {
            // 整屏只保留这一份 Bitmap：放大镜用 shader 采样同一份内存，不再裁剪拷贝。
            bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        } catch (OutOfMemoryError e) {
            Log.e(TAG, "分配截图缓冲失败", e);
            callback.onFailed("内存不足，无法分配截图缓冲");
            return;
        }

        // 记录 decorView 在屏幕上的位置：浮层按屏幕坐标 1:1 复现截图，否则取色会整体偏移。
        final int[] origin = new int[2];
        decorView.getLocationOnScreen(origin);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            requestPixelCopy(activity, decorView, bitmap, origin, callback, 0);
        } else {
            drawDecorViewFallback(decorView, bitmap, origin, callback);
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    private void requestPixelCopy(
            final Activity activity,
            final View decorView,
            final Bitmap bitmap,
            final int[] origin,
            final CaptureCallback callback,
            final int attempt) {
        final Window window = activity.getWindow();
        if (window == null) {
            drawDecorViewFallback(decorView, bitmap, origin, callback);
            return;
        }

        try {
            PixelCopy.request(
                    window,
                    bitmap,
                    result -> {
                        if (result == PixelCopy.SUCCESS) {
                            callback.onCaptured(bitmap, origin);
                            return;
                        }
                        if (attempt < 1) {
                            // 首次失败常见于“窗口刚恢复、还没有可读帧”，隔一帧重试比直接降级保真度高。
                            Log.w(TAG, "PixelCopy 第一次失败 result=" + result + "，稍后重试");
                            mainHandler.postDelayed(
                                    () -> requestPixelCopy(activity, decorView, bitmap, origin, callback, attempt + 1),
                                    120L);
                            return;
                        }
                        Log.w(TAG, "PixelCopy 失败 result=" + result + "，回退到 view.draw(canvas)");
                        drawDecorViewFallback(decorView, bitmap, origin, callback);
                    },
                    mainHandler);
        } catch (Throwable t) {
            // 个别 ROM / 窗口形态会让 PixelCopy 直接抛异常，此时必须保证还能出图。
            Log.w(TAG, "PixelCopy 抛出异常，回退到 view.draw(canvas)", t);
            drawDecorViewFallback(decorView, bitmap, origin, callback);
        }
    }

    private void drawDecorViewFallback(
            final View decorView,
            final Bitmap bitmap,
            final int[] origin,
            final CaptureCallback callback) {
        try {
            // 先擦除：PixelCopy 可能已经写了一半，残留内容会让取色结果自相矛盾。
            bitmap.eraseColor(Color.BLACK);
            final Canvas canvas = new Canvas(bitmap);
            decorView.draw(canvas);
            callback.onCaptured(bitmap, origin);
        } catch (Throwable t) {
            Log.e(TAG, "view.draw(canvas) 回退同样失败", t);
            if (!bitmap.isRecycled()) {
                bitmap.recycle();
            }
            callback.onFailed("截图失败: " + t.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // 浮层
    // ------------------------------------------------------------------

    private void showPicker(
            final Activity activity,
            final Bitmap screenshot,
            final int[] originOnScreen,
            final Promise promise) {
        final ScreenColorPickerDialog dialog;
        try {
            dialog = new ScreenColorPickerDialog(
                    activity,
                    screenshot,
                    originOnScreen,
                    new ScreenColorPickerDialog.Listener() {
                        @Override
                        public void onColorPicked(String hexColor) {
                            finishSession();
                            resolve(promise, hexColor);
                        }

                        @Override
                        public void onCancelled() {
                            finishSession();
                            reject(promise, ERROR_USER_CANCELLED, "用户取消了颜色拾取");
                        }
                    });
        } catch (Throwable t) {
            Log.e(TAG, "创建取色浮层失败", t);
            if (!screenshot.isRecycled()) {
                screenshot.recycle();
            }
            finishSession();
            reject(promise, ERROR_CAPTURE_FAILED, "创建取色浮层失败: " + t.getMessage());
            return;
        }

        activeDialog = dialog;
        try {
            dialog.show();
        } catch (Throwable t) {
            // show 失败时 onDismiss 不会触发，必须在这里手动回收截图。
            Log.e(TAG, "展示取色浮层失败", t);
            activeDialog = null;
            if (!screenshot.isRecycled()) {
                screenshot.recycle();
            }
            finishSession();
            reject(promise, ERROR_CAPTURE_FAILED, "展示取色浮层失败: " + t.getMessage());
        }
    }

    private void resolve(Promise promise, String value) {
        try {
            promise.resolve(value);
        } catch (Throwable t) {
            Log.w(TAG, "resolve 时桥已销毁", t);
        }
    }

    private void reject(Promise promise, String code, String message) {
        try {
            promise.reject(code, message);
        } catch (Throwable t) {
            Log.w(TAG, "reject 时桥已销毁", t);
        }
    }

    /**
     * 取色浮层：冻结截图 + 放大镜 + 十字准星 + 实时色值 + 取消/确定。
     * 交互对齐 iOS 的 ColorPickerViewController，保证双端手感一致。
     */
    private static class ScreenColorPickerDialog extends Dialog {

        interface Listener {
            void onColorPicked(String hexColor);

            void onCancelled();
        }

        private static final int CONFIRM_COLOR = 0xFF007AFF;

        private final Bitmap screenshot;
        private final int[] originOnScreen;
        private final Listener listener;
        private final int bitmapWidth;
        private final int bitmapHeight;

        private PickerOverlayView overlayView;
        private FrameLayout contentRoot;

        /** Promise 只能结束一次：用 settled 同时挡住「按钮点击」和「dismiss 兜底」两条路径。 */
        private boolean settled = false;
        private boolean bitmapReleased = false;

        ScreenColorPickerDialog(
                Activity activity,
                Bitmap screenshot,
                int[] originOnScreen,
                Listener listener) {
            // 全屏黑底主题：浮层要盖住状态栏区域，使截图坐标与屏幕坐标一一对应。
            super(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
            this.screenshot = screenshot;
            this.originOnScreen = originOnScreen;
            this.listener = listener;
            this.bitmapWidth = screenshot.getWidth();
            this.bitmapHeight = screenshot.getHeight();
        }

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);

            contentRoot = buildContentView(getContext());
            setContentView(contentRoot);

            final Window window = getWindow();
            if (window != null) {
                window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.BLACK));
                window.setLayout(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.MATCH_PARENT);
            }

            setCanceledOnTouchOutside(false);
            setOnCancelListener(dialog -> cancelPick());
            setOnDismissListener(dialog -> {
                // 兜底：系统回收 / 主动 dismiss 等任何路径都要让 Promise 结束，且只结束一次。
                if (!settled) {
                    settled = true;
                    listener.onCancelled();
                }
                releaseBitmap();
            });

            // 窗口内容坐标 ≠ 屏幕坐标（状态栏、刘海、系统栏都会偏移），
            // 按实际偏差把截图对齐回原位置，否则取色会整体错位。
            // 监听器故意不注销：首帧布局可能发生在窗口动画未稳定的时刻，
            // 只在第一次回调取坐标会把一个瞬时偏差固化成永久错位；每次布局都重算才有可能自我纠正。
            contentRoot.getViewTreeObserver().addOnGlobalLayoutListener(
                    new ViewTreeObserver.OnGlobalLayoutListener() {
                        @Override
                        public void onGlobalLayout() {
                            alignScreenshotToWindow();
                        }
                    });
        }

        /** 用「窗口内容实际落在屏幕上的位置」反推截图该画在本 View 的哪个位置。 */
        private void alignScreenshotToWindow() {
            if (contentRoot == null || overlayView == null) {
                return;
            }
            final int[] here = new int[2];
            contentRoot.getLocationOnScreen(here);
            final float left = originOnScreen[0] - here[0];
            final float top = originOnScreen[1] - here[1];
            overlayView.setImageBounds(left, top, left + bitmapWidth, top + bitmapHeight);
        }

        private FrameLayout buildContentView(Context context) {
            final FrameLayout root = new FrameLayout(context);
            root.setBackgroundColor(Color.BLACK);

            overlayView = new PickerOverlayView(context, screenshot);
            overlayView.setContentDescription("屏幕取色区域，拖动选择颜色");
            root.addView(overlayView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));

            // 按钮做成真实 View（而不是画在 canvas 上）：这样系统 TalkBack 能识别，
            // 触摸目标也更稳，浮层里只有放大镜这类装饰性内容才需要自绘。
            final LinearLayout bar = new LinearLayout(context);
            bar.setOrientation(LinearLayout.HORIZONTAL);
            bar.setGravity(Gravity.CENTER_VERTICAL);

            final Button cancelButton = createBarButton(context, "取消", 0x66FFFFFF, this::cancelPick);
            final Button confirmButton = createBarButton(context, "确定", CONFIRM_COLOR, this::confirm);

            final LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(
                    dp(context, 100), dp(context, 44));
            cancelParams.rightMargin = dp(context, 20);
            bar.addView(cancelButton, cancelParams);
            bar.addView(confirmButton, new LinearLayout.LayoutParams(dp(context, 100), dp(context, 44)));

            final FrameLayout.LayoutParams barParams = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            barParams.gravity = Gravity.BOTTOM | Gravity.END;
            barParams.rightMargin = dp(context, 20);
            barParams.bottomMargin = dp(context, 50);
            root.addView(bar, barParams);

            return root;
        }

        private static Button createBarButton(Context context, String text, int backgroundColor, Runnable action) {
            final Button button = new Button(context);
            button.setText(text);
            button.setAllCaps(false);
            button.setTextColor(Color.WHITE);
            button.setTextSize(16f);
            button.setPadding(0, 0, 0, 0);
            button.setBackground(roundedBackground(backgroundColor, dp(context, 8)));
            button.setOnClickListener(v -> action.run());
            // 背景被替换后默认的按压态没了，用 alpha 补回按压反馈。
            button.setOnTouchListener((v, event) -> {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        v.setAlpha(0.65f);
                        break;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        v.setAlpha(1f);
                        break;
                    default:
                        break;
                }
                return false;
            });
            return button;
        }

        private static GradientDrawable roundedBackground(int color, float radiusPx) {
            final GradientDrawable drawable = new GradientDrawable();
            drawable.setShape(GradientDrawable.RECTANGLE);
            drawable.setColor(color);
            drawable.setCornerRadius(radiusPx);
            return drawable;
        }

        private static int dp(Context context, float value) {
            return Math.round(value * context.getResources().getDisplayMetrics().density);
        }

        private void confirm() {
            if (settled) {
                return;
            }
            final String hex = overlayView == null ? null : overlayView.getSampledHex();
            if (hex == null) {
                // 还没采到样（窗口尺寸异常）时不要结束会话，否则会 resolve 一个空值。
                return;
            }
            settled = true;
            listener.onColorPicked(hex);
            dismissQuietly();
        }

        /**
         * 取消取色。故意不叫 cancel()：Dialog.cancel() 是 public 且框架会在返回键路径上调用它，
         * 重名会变成「覆盖基类行为但不 dismiss」的陷阱，这里用独立命名把两条路径分清楚。
         */
        private void cancelPick() {
            if (settled) {
                return;
            }
            settled = true;
            listener.onCancelled();
            dismissQuietly();
        }

        private void dismissQuietly() {
            try {
                dismiss();
            } catch (Throwable ignored) {
                // 窗口已销毁，无需处理
            }
        }

        private void releaseBitmap() {
            if (bitmapReleased) {
                return;
            }
            bitmapReleased = true;
            if (overlayView != null) {
                // 先解除自绘视图对 Bitmap 的引用（含 BitmapShader），再回收，避免使用已回收位图。
                overlayView.detachBitmap();
            }
            if (screenshot != null && !screenshot.isRecycled()) {
                screenshot.recycle();
            }
        }
    }

    /**
     * 自绘层：复现冻结截图，并在其之上画放大镜、十字准星、实时色值与操作提示。
     * 一切按屏幕像素 1:1 绘制，取色结果就是所见即所得。
     */
    private static class PickerOverlayView extends View {

        private static final float MAGNIFICATION = 3f;
        private static final float MAGNIFIER_RADIUS_DP = 60f;
        private static final float MAGNIFIER_FINGER_GAP_DP = 26f;
        private static final float EDGE_MARGIN_DP = 8f;

        private final float density;
        private final Paint screenshotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint magnifierPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint ringOuterPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint ringInnerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint crosshairPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint pixelMarkerOuterPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint pixelMarkerInnerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint valueBarPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint valueTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint swatchPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint hintTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint hintBarPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint touchRingOuterPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint touchRingInnerPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

        private final Matrix shaderMatrix = new Matrix();
        private final RectF pixelRect = new RectF();
        private final RectF valueBarRect = new RectF();
        private final RectF hintRect = new RectF();
        // 每帧都 new RectF 会给拖动过程制造无谓的 GC 抖动，改成复用同一个目标矩形。
        private final RectF screenshotDstRect = new RectF();

        private Bitmap screenBitmap;
        private BitmapShader bitmapShader;
        private Bitmap shaderSourceBitmap;

        private float imageLeft;
        private float imageTop;
        private float imageRight;
        private float imageBottom;
        private boolean hasImageBounds = false;

        private float viewToBitmapX = 1f;
        private float viewToBitmapY = 1f;

        private float touchX = 0f;
        private float touchY = 0f;
        private float samplePixelX = 0f;
        private float samplePixelY = 0f;
        private int sampledColor = Color.TRANSPARENT;
        private String sampledHex = null;
        private boolean hasSample = false;

        PickerOverlayView(Context context, Bitmap screenBitmap) {
            super(context);
            this.screenBitmap = screenBitmap;
            this.density = context.getResources().getDisplayMetrics().density;

            screenshotPaint.setFilterBitmap(false);
            screenshotPaint.setDither(false);

            // 放大镜要显示“像素块”，插值会把方块糊成色晕，反而看不清取的是哪一格。
            magnifierPaint.setFilterBitmap(false);
            magnifierPaint.setDither(false);

            ringOuterPaint.setStyle(Paint.Style.STROKE);
            ringOuterPaint.setStrokeWidth(6f * density);
            ringOuterPaint.setColor(0x66000000);

            ringInnerPaint.setStyle(Paint.Style.STROKE);
            ringInnerPaint.setStrokeWidth(3f * density);
            ringInnerPaint.setColor(Color.WHITE);

            crosshairPaint.setStyle(Paint.Style.STROKE);
            crosshairPaint.setStrokeWidth(1.5f * density);
            crosshairPaint.setStrokeCap(Paint.Cap.ROUND);
            crosshairPaint.setColor(0xE6FF3B30);

            pixelMarkerOuterPaint.setStyle(Paint.Style.STROKE);
            pixelMarkerOuterPaint.setStrokeWidth(3f * density);
            pixelMarkerOuterPaint.setColor(0xCC000000);

            pixelMarkerInnerPaint.setStyle(Paint.Style.STROKE);
            pixelMarkerInnerPaint.setStrokeWidth(1f * density);
            pixelMarkerInnerPaint.setColor(Color.WHITE);

            valueBarPaint.setStyle(Paint.Style.FILL);
            valueBarPaint.setColor(0xCC000000);

            valueTextPaint.setColor(Color.WHITE);
            valueTextPaint.setFakeBoldText(true);
            valueTextPaint.setTextSize(15f * density);
            valueTextPaint.setTextAlign(Paint.Align.LEFT);

            swatchPaint.setStyle(Paint.Style.FILL);

            hintTextPaint.setColor(Color.WHITE);
            hintTextPaint.setTextSize(13f * density);
            hintTextPaint.setTextAlign(Paint.Align.CENTER);

            hintBarPaint.setStyle(Paint.Style.FILL);
            hintBarPaint.setColor(0x99000000);

            touchRingOuterPaint.setStyle(Paint.Style.STROKE);
            touchRingOuterPaint.setStrokeWidth(4f * density);
            touchRingOuterPaint.setColor(0x99000000);

            touchRingInnerPaint.setStyle(Paint.Style.STROKE);
            touchRingInnerPaint.setStrokeWidth(2f * density);
            touchRingInnerPaint.setColor(Color.WHITE);
        }

        /** 由浮层在布局完成后写入截图应出现的位置（已是本 View 的坐标系）。 */
        void setImageBounds(float left, float top, float right, float bottom) {
            if (screenBitmap == null || screenBitmap.isRecycled() || right <= left || bottom <= top) {
                return;
            }
            imageLeft = left;
            imageTop = top;
            imageRight = right;
            imageBottom = bottom;
            hasImageBounds = true;
            viewToBitmapX = screenBitmap.getWidth() / (right - left);
            viewToBitmapY = screenBitmap.getHeight() / (bottom - top);
            if (!hasSample) {
                // 初始落在窗口中心：用户一进浮层就能看到放大镜与色值，而不是一片空白。
                touchX = (left + right) / 2f;
                touchY = (top + bottom) / 2f;
            }
            updateSample(touchX, touchY);
        }

        /** 浮层销毁时必须调用：解除对 Bitmap / BitmapShader 的引用，之后 Bitmap 才能安全 recycle。 */
        void detachBitmap() {
            screenBitmap = null;
            bitmapShader = null;
            shaderSourceBitmap = null;
            magnifierPaint.setShader(null);
            hasImageBounds = false;
            hasSample = false;
            sampledHex = null;
            invalidate();
        }

        String getSampledHex() {
            return sampledHex;
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                case MotionEvent.ACTION_MOVE:
                    updateSample(event.getX(), event.getY());
                    return true;
                case MotionEvent.ACTION_UP:
                    updateSample(event.getX(), event.getY());
                    performClick();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    return true;
                default:
                    return super.onTouchEvent(event);
            }
        }

        @Override
        public boolean performClick() {
            // 自定义 View 接管触摸后要显式触发 click 事件，否则无障碍服务收不到点击语义。
            return super.performClick();
        }

        private void updateSample(float x, float y) {
            if (!hasImageBounds || screenBitmap == null || screenBitmap.isRecycled()) {
                return;
            }
            touchX = clamp(x, imageLeft, imageRight - 1f);
            touchY = clamp(y, imageTop, imageBottom - 1f);

            final int maxX = screenBitmap.getWidth() - 1;
            final int maxY = screenBitmap.getHeight() - 1;
            final int pixelX = (int) clamp((touchX - imageLeft) * viewToBitmapX, 0f, maxX);
            final int pixelY = (int) clamp((touchY - imageTop) * viewToBitmapY, 0f, maxY);

            sampledColor = screenBitmap.getPixel(pixelX, pixelY);
            sampledHex = String.format(
                    Locale.US,
                    "#%02X%02X%02X",
                    Color.red(sampledColor),
                    Color.green(sampledColor),
                    Color.blue(sampledColor));
            // 采样点取像素中心，放大镜才能把这一格正好摆在圆心，不会出现半格偏移。
            samplePixelX = pixelX + 0.5f;
            samplePixelY = pixelY + 0.5f;
            hasSample = true;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            if (!hasImageBounds || screenBitmap == null || screenBitmap.isRecycled()) {
                return;
            }

            screenshotDstRect.set(imageLeft, imageTop, imageRight, imageBottom);
            canvas.drawBitmap(screenBitmap, null, screenshotDstRect, screenshotPaint);

            drawTouchIndicator(canvas);
            drawMagnifier(canvas);
            drawHint(canvas);
        }

        private void drawTouchIndicator(Canvas canvas) {
            final float radius = 9f * density;
            canvas.drawCircle(touchX, touchY, radius, touchRingOuterPaint);
            canvas.drawCircle(touchX, touchY, radius, touchRingInnerPaint);
        }

        private void drawMagnifier(Canvas canvas) {
            final float radius = MAGNIFIER_RADIUS_DP * density;
            final float gap = MAGNIFIER_FINGER_GAP_DP * density;
            final float margin = EDGE_MARGIN_DP * density;

            // 放大镜优先放在手指上方（不挡视野），顶部放不下就翻到下方。
            float centerX = clamp(touchX, radius + margin, getWidth() - radius - margin);
            float centerY = touchY - radius - gap;
            if (centerY - radius < margin) {
                centerY = touchY + radius + gap;
            }
            centerY = clamp(centerY, radius + margin, getHeight() - radius - margin);

            // 用 BitmapShader 画圆而不是 clipPath：硬件加速下圆形 clipPath 在部分 ROM 上不可靠，
            // shader 方式同样只需要一份位图，且每帧只更新一个矩阵。
            if (bitmapShader == null || shaderSourceBitmap != screenBitmap) {
                bitmapShader = new BitmapShader(screenBitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
                shaderSourceBitmap = screenBitmap;
                magnifierPaint.setShader(bitmapShader);
            }

            final float pixelScale = viewToBitmapX > 0f ? 1f / viewToBitmapX : 1f;
            final float magnification = MAGNIFICATION * pixelScale;
            shaderMatrix.reset();
            shaderMatrix.setScale(magnification, magnification);
            shaderMatrix.postTranslate(
                    centerX - samplePixelX * magnification,
                    centerY - samplePixelY * magnification);
            bitmapShader.setLocalMatrix(shaderMatrix);
            canvas.drawCircle(centerX, centerY, radius, magnifierPaint);

            // 深浅背景下都要有边界感：先画半透明黑粗环再加白细环。
            canvas.drawCircle(centerX, centerY, radius, ringOuterPaint);
            canvas.drawCircle(centerX, centerY, radius, ringInnerPaint);

            drawCrosshair(canvas, centerX, centerY, radius, magnification);
            drawValueBar(canvas, centerX, centerY, radius);
        }

        private void drawCrosshair(Canvas canvas, float centerX, float centerY, float radius, float magnification) {
            // 十字准星只画到靠近圆心处：中间留给被取样的像素，避免准星本身盖住颜色。
            final float outer = radius - 4f * density;
            final float inner = radius * 0.42f;
            canvas.drawLine(centerX, centerY - outer, centerX, centerY - inner, crosshairPaint);
            canvas.drawLine(centerX, centerY + inner, centerX, centerY + outer, crosshairPaint);
            canvas.drawLine(centerX - outer, centerY, centerX - inner, centerY, crosshairPaint);
            canvas.drawLine(centerX + inner, centerY, centerX + outer, centerY, crosshairPaint);

            // 精确标出正在取的那一个像素块（双色描边保证任何底色上都可见）。
            final float half = Math.max(magnification / 2f, 1.5f * density);
            pixelRect.set(centerX - half, centerY - half, centerX + half, centerY + half);
            canvas.drawRect(pixelRect, pixelMarkerOuterPaint);
            canvas.drawRect(pixelRect, pixelMarkerInnerPaint);
        }

        private void drawValueBar(Canvas canvas, float magnifierCenterX, float magnifierCenterY, float radius) {
            final String text = sampledHex == null ? "#------" : sampledHex;
            final float padding = 10f * density;
            final float swatchSize = 26f * density;
            final float gap = 9f * density;
            final float textWidth = valueTextPaint.measureText(text);
            final float barWidth = padding * 2f + swatchSize + gap + textWidth;
            final float textHeight = valueTextPaint.getTextSize();
            final float barHeight = padding * 2f + Math.max(swatchSize, textHeight);

            // 优先放在放大镜上方：绝不会被手指压住，也尽量远离「确定/取消」按钮所在的下方。
            float barLeft = magnifierCenterX - barWidth / 2f;
            float barTop = magnifierCenterY - radius - barHeight - 6f * density;
            if (barTop < EDGE_MARGIN_DP * density) {
                barTop = magnifierCenterY + radius + 6f * density;
            }
            barLeft = clamp(barLeft, EDGE_MARGIN_DP * density, Math.max(0f, getWidth() - barWidth - EDGE_MARGIN_DP * density));
            barTop = clamp(barTop, EDGE_MARGIN_DP * density, Math.max(0f, getHeight() - barHeight - EDGE_MARGIN_DP * density));

            valueBarRect.set(barLeft, barTop, barLeft + barWidth, barTop + barHeight);
            canvas.drawRoundRect(valueBarRect, barHeight / 2f, barHeight / 2f, valueBarPaint);

            final float centerY = barTop + barHeight / 2f;
            final float swatchCenterX = barLeft + padding + swatchSize / 2f;
            swatchPaint.setColor(sampledColor);
            canvas.drawCircle(swatchCenterX, centerY, swatchSize / 2f, swatchPaint);
            canvas.drawCircle(swatchCenterX, centerY, swatchSize / 2f, pixelMarkerInnerPaint);

            final Paint.FontMetrics metrics = valueTextPaint.getFontMetrics();
            final float baseline = centerY - (metrics.ascent + metrics.descent) / 2f;
            canvas.drawText(text, swatchCenterX + swatchSize / 2f + gap, baseline, valueTextPaint);
        }

        private void drawHint(Canvas canvas) {
            final String hint = "拖动或点击屏幕选择颜色，点击「确定」完成";
            final float paddingX = 14f * density;
            final float paddingY = 9f * density;
            final float textWidth = hintTextPaint.measureText(hint);
            final float barWidth = textWidth + paddingX * 2f;
            final float barHeight = hintTextPaint.getTextSize() + paddingY * 2f;
            final float left = (getWidth() - barWidth) / 2f;
            final float top = 44f * density;

            hintRect.set(left, top, left + barWidth, top + barHeight);
            canvas.drawRoundRect(hintRect, barHeight / 2f, barHeight / 2f, hintBarPaint);

            final Paint.FontMetrics metrics = hintTextPaint.getFontMetrics();
            final float baseline = top + barHeight / 2f - (metrics.ascent + metrics.descent) / 2f;
            canvas.drawText(hint, getWidth() / 2f, baseline, hintTextPaint);
        }

        private static float clamp(float value, float min, float max) {
            if (max < min) {
                return min;
            }
            return value < min ? min : (value > max ? max : value);
        }
    }
}
