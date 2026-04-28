package com.zeroisle_notes.nativepaged;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.Log;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.content.ContentResolver;
import java.io.InputStream;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import android.view.ViewGroup;
import android.animation.ValueAnimator;

import com.zeroisle_notes.TouchTypeDetectionModule;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;


import com.facebook.react.bridge.Promise;
import android.graphics.RectF;

// ML Kit
import com.zeroisle_notes.services.AIProcessingService;
import com.google.mlkit.vision.common.InputImage;

/**
 * 分页笔记视图 - 支持可滚动浏览和自动新增页
 */
public class NativePagedNoteView extends ScrollView {

    private static final String TAG = "NativePagedNoteView";
    private static final int PAGE_SPACING = 60;
    private static final int AUTO_ADD_PAGE_THRESHOLD = 300;

    // 页面尺寸相关（动态计算）
    private int pageWidth;
    private int pageHeight;
    private int horizontalMargin;
    private static final float A4_RATIO = 1.414f; // A4纸比例（高/宽）

    private ScalableLinearLayout pagesContainer;
    private List<PageView> pageViews;
    private List<PageData> pages;

    private String noteId;
    private Map<String, Object> styleConfig;
    private String currentTool;
    private int currentColor;
    private float currentStrokeWidth;

    private int currentPage = 0;
    private boolean isAutoAddingPage = false;

    // 缩放相关
    private ScaleGestureDetector scaleDetector;
    private float scaleFactor = 1.0f;
    private static final float MIN_SCALE = 0.5f;
    private static final float MAX_SCALE = 3.0f;

    public NativePagedNoteView(Context context) {
        super(context);
        initialize();
    }

    private void initialize() {
        pages = new ArrayList<>();
        pageViews = new ArrayList<>();

        currentTool = "pen";
        currentColor = Color.BLACK;
        currentStrokeWidth = 2.0f;
        styleConfig = new HashMap<>();
        styleConfig.put("background", "blank");

        // 计算页面尺寸
        calculatePageDimensions();

        // 允许过度滚动
        setOverScrollMode(View.OVER_SCROLL_ALWAYS);
        setFillViewport(false);

        // 创建可缩放的线性容器，垂直堆叠页面
        pagesContainer = new ScalableLinearLayout(getContext());
        pagesContainer.setOrientation(LinearLayout.VERTICAL);
        pagesContainer.setBackgroundColor(Color.WHITE); // 白色背景

        // 第一页顶部间距20dp
        int topPadding = dpToPx(20);
        int bottomPadding = 400; // 增加底部padding以便触发自动添加
        pagesContainer.setPadding(0, topPadding, 0, bottomPadding);

        // ✅ 添加到 ScrollView，高度 WRAP_CONTENT，由容器自行测量
        addView(pagesContainer, new LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.WRAP_CONTENT
        ));

        // 添加第一页
        addNewPage();

        // 设置滚动监听
        setOnScrollChangeListener(new OnScrollChangeListener() {
            @Override
            public void onScrollChange(View v, int scrollX, int scrollY, int oldScrollX, int oldScrollY) {
                handleScroll(scrollY);
            }
        });

        // 初始化缩放手势检测器
        scaleDetector = new ScaleGestureDetector(getContext(), new ScaleListener());

        Log.d(TAG, "初始化完成");

        post(new Runnable() {
            @Override
            public void run() {
                sendReadyEvent();
                logLayoutState("初始化后");
            }
        });
    }

    private void calculatePageDimensions() {
        // 获取屏幕尺寸
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;

        // 计算水平边距（屏幕宽度的5%，确保居中且有合适边距）
        horizontalMargin = (int)(screenWidth * 0.05f);

        // 可用宽度
        int availableWidth = screenWidth - (horizontalMargin * 2);

        // 根据A4比例计算页面尺寸
        pageWidth = availableWidth;
        pageHeight = (int)(pageWidth * A4_RATIO);

        // 确保页面高度不超过屏幕高度的80%
        int maxPageHeight = (int)(screenHeight * 0.8f);
        if (pageHeight > maxPageHeight) {
            pageHeight = maxPageHeight;
            pageWidth = (int)(pageHeight / A4_RATIO);
            // 重新计算边距以保持居中
            horizontalMargin = (screenWidth - pageWidth) / 2;
        }

        Log.d(TAG, String.format("页面尺寸计算完成 - 宽: %d, 高: %d, 边距: %d, 比例: %.2f",
            pageWidth, pageHeight, horizontalMargin, (float)pageHeight / pageWidth));
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private void handleScroll(int scrollY) {
        // 由于容器已经缩放，子View的位置也是缩放后的，需要转换到未缩放坐标系
        int viewportCenterY = scrollY + getHeight() / 2;

        // 需要在未缩放坐标系中查找页面
        int scaledViewportCenter = (int)(viewportCenterY / scaleFactor);

        int newPage = currentPage;
        int pageIndex = 0;
        for (int i = 0; i < pagesContainer.getChildCount(); i++) {
            View child = pagesContainer.getChildAt(i);
            // 只处理 PageView，跳过分隔器
            if (!(child instanceof PageView)) {
                continue;
            }
            // child.getTop/Bottom 返回的是未缩放的原始位置
            int top = child.getTop();
            int bottom = child.getBottom();
            if (scaledViewportCenter >= top && scaledViewportCenter < bottom) {
                newPage = pageIndex;
                break;
            }
            pageIndex++;
        }

        if (newPage != currentPage) {
            currentPage = newPage;
            Log.d(TAG, "页面切换到: " + (currentPage + 1) + "/" + pages.size());
            sendPageChangeEvent(currentPage);
        }

        // 检查是否需要添加新页面（现在contentHeight是缩放后的）
        int contentHeight = pagesContainer.getMeasuredHeight();
        int visibleBottom = scrollY + getHeight();
        int distanceToBottom = contentHeight - visibleBottom;

        boolean isOnLastPage = (currentPage == pages.size() - 1);

        // 调试日志：每隔一段时间输出滚动信息
        if (scrollY % 500 < 50) {
            Log.d(TAG, String.format("滚动状态 - Y: %d, 容器高度: %d, 可见底部: %d, 距底部: %d, 当前页: %d/%d",
                scrollY, contentHeight, visibleBottom, distanceToBottom, currentPage + 1, pages.size()));
        }

        if (isOnLastPage
            && distanceToBottom < AUTO_ADD_PAGE_THRESHOLD
            && !isAutoAddingPage) {
            isAutoAddingPage = true;
            Log.d(TAG, String.format("触发添加新页面 - 距离底部: %d (缩放: %.2f)", distanceToBottom, scaleFactor));
            post(new Runnable() {
                @Override
                public void run() {
                    addNewPage();
                    isAutoAddingPage = false;
                }
            });
        }
    }

    public void addNewPage() {
        int newPageIndex = pages.size();

        Log.d(TAG, "========== 开始添加页面 #" + (newPageIndex + 1) + " ==========");

        // 创建页面数据
        PageData newPageData = new PageData();
        pages.add(newPageData);

        // 创建页面视图
        PageView newPageView = new PageView(getContext(), newPageIndex, newPageData);
        // 设置当前缩放因子
        newPageView.setParentScaleFactor(scaleFactor);
        pageViews.add(newPageView);

        // 设置页面边距（使用动态计算的边距）
        int horizontalMargin = this.horizontalMargin;

        // 如果不是第一页，先添加分隔器
        if (newPageIndex > 0) {
            View separator = createSeparator();
            LinearLayout.LayoutParams sepParams = new LinearLayout.LayoutParams(
                pageWidth,  // 使用页面宽度，而非整个容器宽度
                PAGE_SPACING
            );
            sepParams.setMargins(horizontalMargin, 0, horizontalMargin, 0);
            pagesContainer.addView(separator, sepParams);
        }

        // 使用动态计算的页面尺寸
        LinearLayout.LayoutParams pageParams = new LinearLayout.LayoutParams(
            pageWidth,  // 使用动态宽度
            pageHeight  // 使用动态高度
        );

        // 设置居中边距
        pageParams.setMargins(horizontalMargin, 0, horizontalMargin, 0);
        pageParams.gravity = android.view.Gravity.CENTER_HORIZONTAL;

        // 添加到容器
        pagesContainer.addView(newPageView, pageParams);

        // 设置页面样式
        newPageView.setElevation(8);
        android.graphics.drawable.GradientDrawable background = new android.graphics.drawable.GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(8);
        newPageView.setBackground(background);

        Log.d(TAG, String.format("页面 #%d 已添加 - 总页数: %d, 容器子View数: %d",
            newPageIndex + 1, pages.size(), pagesContainer.getChildCount()));

        // 强制触发完整的测量和布局流程
        post(new Runnable() {
            @Override
            public void run() {
                // 强制容器重新测量所有子View
                int widthSpec = MeasureSpec.makeMeasureSpec(
                    pagesContainer.getWidth(),
                    MeasureSpec.EXACTLY
                );
                int heightSpec = MeasureSpec.makeMeasureSpec(
                    0,
                    MeasureSpec.UNSPECIFIED
                );
                pagesContainer.measure(widthSpec, heightSpec);

                // 强制重新布局
                pagesContainer.layout(
                    pagesContainer.getLeft(),
                    pagesContainer.getTop(),
                    pagesContainer.getRight(),
                    pagesContainer.getTop() + pagesContainer.getMeasuredHeight()
                );

                // 请求ScrollView重新布局
                requestLayout();

                Log.d(TAG, "强制布局完成 - 容器新高度: " + pagesContainer.getMeasuredHeight());

                // 延迟输出布局信息
                postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        logLayoutState("添加页面 #" + (newPageIndex + 1) + " 后");
                    }
                }, 100);
            }
        });

        // 发送页面数量变化事件
        WritableMap event = Arguments.createMap();
        event.putInt("totalPages", pages.size());
        event.putInt("newPageIndex", newPageIndex);
        sendEvent("onPageAdded", event);
    }

    private View createSeparator() {
        LinearLayout separator = new LinearLayout(getContext());
        separator.setOrientation(LinearLayout.HORIZONTAL);
        separator.setGravity(android.view.Gravity.CENTER);

        // 左侧横线
        View leftLine = new View(getContext());
        leftLine.setBackgroundColor(Color.parseColor("#E0E0E0"));
        leftLine.setAlpha(0.3f);
        LinearLayout.LayoutParams lineParams = new LinearLayout.LayoutParams(0, 1);
        lineParams.weight = 1;
        separator.addView(leftLine, lineParams);

        // 中间三个圆点
        LinearLayout dotsContainer = new LinearLayout(getContext());
        dotsContainer.setOrientation(LinearLayout.HORIZONTAL);
        dotsContainer.setPadding(12, 0, 12, 0);
        for (int i = 0; i < 3; i++) {
            View dot = new View(getContext());
            android.graphics.drawable.GradientDrawable circle = new android.graphics.drawable.GradientDrawable();
            circle.setShape(android.graphics.drawable.GradientDrawable.OVAL);
            circle.setColor(Color.parseColor("#666666"));
            dot.setBackground(circle);
            dot.setAlpha(0.6f);
            LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(8, 8);
            dotParams.setMargins(6, 0, 6, 0);
            dotsContainer.addView(dot, dotParams);
        }
        separator.addView(dotsContainer);

        // 右侧横线
        View rightLine = new View(getContext());
        rightLine.setBackgroundColor(Color.parseColor("#E0E0E0"));
        rightLine.setAlpha(0.3f);
        LinearLayout.LayoutParams rightLineParams = new LinearLayout.LayoutParams(0, 1);
        rightLineParams.weight = 1;
        separator.addView(rightLine, rightLineParams);

        return separator;
    }

    private void logLayoutState(String context) {
        Log.d(TAG, "========== 布局状态: " + context + " ==========");
        Log.d(TAG, String.format("ScrollView - 高度: %d, 滚动Y: %d",
            getHeight(), getScrollY()));
        Log.d(TAG, String.format("容器 - 高度: %d, 宽度: %d, 子View数: %d (页面: %d), 缩放: %.2f",
            pagesContainer.getHeight(), pagesContainer.getWidth(),
            pagesContainer.getChildCount(), pages.size(), scaleFactor));

        int pageIndex = 0;
        for (int i = 0; i < pagesContainer.getChildCount(); i++) {
            View child = pagesContainer.getChildAt(i);
            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) child.getLayoutParams();

            if (child instanceof PageView) {
                pageIndex++;
                Log.d(TAG, String.format("  页面 #%d - 高度: %d (期望: %d), Top: %d, Bottom: %d, Margins: [%d,%d,%d,%d]",
                    pageIndex,
                    child.getHeight(), params.height,
                    child.getTop(), child.getBottom(),
                    params.leftMargin, params.topMargin, params.rightMargin, params.bottomMargin));
            } else {
                Log.d(TAG, String.format("  分隔器 - 高度: %d (期望: %d), Top: %d, Bottom: %d",
                    child.getHeight(), params.height,
                    child.getTop(), child.getBottom()));
            }
        }

        // 计算期望的总高度
        int expectedHeight = pagesContainer.getPaddingTop() + pagesContainer.getPaddingBottom();
        for (int i = 0; i < pages.size(); i++) {
            if (i > 0) expectedHeight += PAGE_SPACING;
            expectedHeight += pageHeight; // 使用动态高度
        }

        Log.d(TAG, String.format("高度对比 - 实际: %d, 期望: %d, 差值: %d",
            pagesContainer.getHeight(), expectedHeight, pagesContainer.getHeight() - expectedHeight));
        Log.d(TAG, "===========================================");
    }

    // 使用标准 LinearLayout 作为容器

    private void sendReadyEvent() {
        WritableMap event = Arguments.createMap();
        event.putInt("totalPages", pages.size());
        event.putInt("currentPage", currentPage);
        sendEvent("onReady", event);
        Log.d(TAG, "分页笔记已就绪");
    }

    private void sendPageChangeEvent(int page) {
        WritableMap event = Arguments.createMap();
        event.putInt("page", page);
        event.putInt("totalPages", pages.size());
        sendEvent("onPageChange", event);
    }

    private void sendErrorEvent(String code, String message) {
        WritableMap event = Arguments.createMap();
        event.putString("code", code);
        event.putString("message", message);
        sendEvent("onError", event);
        Log.e(TAG, "错误: " + code + " - " + message);
    }

    private void sendEvent(String eventName, WritableMap params) {
        ReactContext reactContext = (ReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(getId(), eventName, params);
    }

    // 页面视图类
    private class PageView extends View {
        private int pageIndex;
        private PageData pageData;
        private Path currentPath;
        private Paint currentPaint;
        private List<StrokePoint> currentStrokePoints;

        private String currentTouchType = TouchTypeDetectionModule.TOUCH_TYPE_UNKNOWN;
        private boolean isStylusMode = false;

        // 父容器的缩放因子，用于触摸坐标转换（从缩放坐标系转回未缩放坐标系）
        private float parentScaleFactor = 1.0f;

        // 套索选择相关
        private Path lassoPath;
        private Paint lassoPaint;

        // 形状绘制相关
        private String currentShape = "line";
        private float shapeStartX;
        private float shapeStartY;
        private int currentStrokeColor = Color.BLACK;

        // 激光笔相关
        private Path laserPath;
        private Paint laserPaint;

        public PageView(Context context, int pageIndex, PageData pageData) {
            super(context);
            this.pageIndex = pageIndex;
            this.pageData = pageData;
            this.currentStrokePoints = new ArrayList<>();

            setWillNotDraw(false);
        }

        public void setParentScaleFactor(float scale) {
            if (this.parentScaleFactor != scale) {
                this.parentScaleFactor = scale;
                // 缩放因子改变，无需重绘（绘制由父容器缩放处理）
                // 此值仅用于触摸坐标转换
            }
        }

        @Override
        protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
            setMeasuredDimension(pageWidth, pageHeight);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);

            // 绘制背景
            drawBackground(canvas);

            // 绘制历史笔迹
            for (StrokeData stroke : pageData.strokes) {
                if (stroke instanceof ImageStrokeData) {
                    ImageStrokeData img = (ImageStrokeData) stroke;
                    if (img.bitmap != null) {
                        android.graphics.RectF dst = new android.graphics.RectF(
                            img.x, img.y, img.x + img.w, img.y + img.h
                        );
                        canvas.drawBitmap(img.bitmap, null, dst, null);
                    }
                } else {
                    // 确保历史笔迹在不同缩放级别下颜色深度一致
                    Paint renderPaint = new Paint(stroke.paint);
                    renderPaint.setDither(true);
                    renderPaint.setFilterBitmap(true);
                    canvas.drawPath(stroke.path, renderPaint);
                }
            }

            // 绘制当前笔迹
            if (currentPath != null && currentPaint != null) {
                canvas.drawPath(currentPath, currentPaint);
            }
        }

        private void drawBackground(Canvas canvas) {
            String bg = (String) styleConfig.getOrDefault("background", "blank");

            switch (bg) {
                case "lined":
                    drawLines(canvas);
                    break;
                case "grid":
                    drawGrid(canvas);
                    break;
                case "dotted":
                    drawDots(canvas);
                    break;
                case "cornell":
                    drawCornell(canvas);
                    break;
            }
        }

        private void drawLines(Canvas canvas) {
            Paint paint = new Paint();
            paint.setColor(Color.LTGRAY);
            paint.setStrokeWidth(1);

            float width = getWidth();
            float height = pageHeight;

            float spacing = 30;
            for (float y = spacing; y < height; y += spacing) {
                canvas.drawLine(20, y, width - 20, y, paint);
            }
        }

        private void drawGrid(Canvas canvas) {
            Paint paint = new Paint();
            paint.setColor(Color.LTGRAY);
            paint.setStrokeWidth(1);

            float width = getWidth();
            float height = pageHeight;

            float size = 20;
            for (float x = 0; x < width; x += size) {
                canvas.drawLine(x, 0, x, height, paint);
            }
            for (float y = 0; y < height; y += size) {
                canvas.drawLine(0, y, width, y, paint);
            }
        }

        private void drawDots(Canvas canvas) {
            Paint paint = new Paint();
            paint.setColor(Color.LTGRAY);

            float width = getWidth();
            float height = pageHeight;

            float spacing = 20;
            for (float x = spacing; x < width; x += spacing) {
                for (float y = spacing; y < height; y += spacing) {
                    canvas.drawCircle(x, y, 2, paint);
                }
            }
        }

        private void drawCornell(Canvas canvas) {
            Paint paint = new Paint();
            paint.setColor(Color.LTGRAY);
            paint.setStrokeWidth(1);

            float width = getWidth();
            float height = pageHeight;

            float leftMargin = width * 0.25f;
            float bottomMargin = height * 0.75f;

            canvas.drawLine(leftMargin, 0, leftMargin, height, paint);
            canvas.drawLine(0, bottomMargin, width, bottomMargin, paint);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            // 获取原始触摸坐标
            float rawX = event.getX();
            float rawY = event.getY();
            float pressure = event.getPressure();

            // ✅ 修正坐标：考虑缩放中心点的完整逆变换
            // 获取父容器的缩放中心点（水平居中，垂直从顶部）
            float pivotX = NativePagedNoteView.this.pagesContainer.getMeasuredWidth() / 2.0f;
            float pivotY = 0;

            // 计算触摸点在父容器坐标系中的位置
            float containerX = getLeft() + rawX;
            float containerY = getTop() + rawY;

            // 应用逆缩放变换（考虑缩放中心点）
            float unscaledContainerX = pivotX + (containerX - pivotX) / parentScaleFactor;
            float unscaledContainerY = pivotY + (containerY - pivotY) / parentScaleFactor;

            // 转换回 PageView 的局部坐标
            float x = unscaledContainerX - getLeft();
            float y = unscaledContainerY - getTop();

            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                currentTouchType = TouchTypeDetectionModule.detectTouchTypeFromMotionEvent(event, 0);
                isStylusMode = TouchTypeDetectionModule.TOUCH_TYPE_STYLUS.equals(currentTouchType);

                Log.d(TAG, String.format("PageView触摸检测 - 类型: %s, 是否手写笔: %s, 原始坐标: (%.1f, %.1f), 修正坐标: (%.1f, %.1f), 缩放: %.2f, 中心点: (%.1f, %.1f)",
                    currentTouchType, isStylusMode ? "是" : "否", rawX, rawY, x, y, parentScaleFactor, pivotX, pivotY));

                if (isStylusMode) {
                    getParent().requestDisallowInterceptTouchEvent(true);
                }
            }

            // 双指操作交给父视图处理（缩放）
            if (event.getPointerCount() == 2) {
                return false;
            } else if (isStylusMode) {
                // 使用修正后的坐标进行绘制
                // 由于父容器 Canvas 会缩放绘制，这里使用除以缩放因子后的坐标
                // 确保笔迹准确落在触摸点上

                // 手写笔绘制
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        Log.d(TAG, String.format("笔迹绘制开始 - 修正坐标: (%.1f, %.1f), 缩放: %.2f",
                            x, y, parentScaleFactor));
                        startStroke(x, y, pressure);
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        continueStroke(x, y, pressure);
                        return true;
                    case MotionEvent.ACTION_UP:
                        endStroke();
                        getParent().requestDisallowInterceptTouchEvent(false);
                        return true;
                }
            } else {
                // 非手写笔触摸，让父视图处理（滚动等）
                Log.d(TAG, String.format("PageView非手写笔触摸 - 类型: %s, 坐标: (%.1f, %.1f)",
                    currentTouchType, x, y));
                return false;
            }

            return false;
        }

        private void startStroke(float x, float y, float pressure) {
            // 请求父View不拦截触摸事件
            getParent().requestDisallowInterceptTouchEvent(true);

            Log.d(TAG, String.format("开始工具操作: %s", currentTool));

            // 根据工具类型处理
            if ("eraser".equals(currentTool)) {
                startErasing(x, y);
            } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
                startLassoSelection(x, y);
            } else if ("shape".equals(currentTool)) {
                startShape(x, y);
            } else if ("laser".equals(currentTool)) {
                startLaser(x, y);
            } else {
                // 默认绘图工具
                startDefaultDrawing(x, y, pressure);
            }
        }

        private void startDefaultDrawing(float x, float y, float pressure) {
            currentPath = new Path();
            currentPath.moveTo(x, y);

            currentPaint = new Paint();
            currentPaint.setColor(currentColor);
            currentPaint.setStrokeWidth(currentStrokeWidth * pressure);
            currentPaint.setStyle(Paint.Style.STROKE);
            currentPaint.setStrokeCap(Paint.Cap.ROUND);
            currentPaint.setStrokeJoin(Paint.Join.ROUND);
            currentPaint.setAntiAlias(true);
            currentPaint.setDither(true);
            currentPaint.setFilterBitmap(true);

            // 根据工具类型调整样式
            if ("highlighter".equals(currentTool)) {
                currentPaint.setAlpha(128);
                currentPaint.setStrokeWidth(currentStrokeWidth * 2);
            } else if ("pencil".equals(currentTool)) {
                currentPaint.setAlpha(179); // 70% opacity
                currentPaint.setStrokeWidth(currentStrokeWidth * 0.8f);
            } else if ("brush".equals(currentTool)) {
                currentPaint.setStrokeWidth(currentStrokeWidth * 1.5f);
            }

            currentStrokePoints.clear();
            currentStrokePoints.add(new StrokePoint(x, y, pressure));

            invalidate();
        }

        private void startErasing(float x, float y) {
            Log.d(TAG, "开始橡皮擦");
            eraseAt(x, y);
        }

        private void eraseAt(float x, float y) {
            if (pageData.strokes.isEmpty()) return;

            // 橡皮擦半径
            float eraserRadius = currentStrokeWidth * 3;

            // 从后往前检查笔迹，删除与橡皮擦相交的笔迹
            for (int i = pageData.strokes.size() - 1; i >= 0; i--) {
                StrokeData stroke = pageData.strokes.get(i);

                // 检查笔迹是否与橡皮擦点相交
                boolean shouldErase = false;

                // 方法1: 检查橡皮擦点是否在笔迹附近
                android.graphics.Path path = stroke.path;
                android.graphics.RectF bounds = new android.graphics.RectF();
                path.computeBounds(bounds, true);

                if (bounds.contains(x, y)) {
                    // 计算点到路径的最短距离
                    float minDistance = Float.MAX_VALUE;
                    android.graphics.PathMeasure pathMeasure = new android.graphics.PathMeasure(path, false);
                    float[] pos = new float[2];
                    float[] tan = new float[2];

                    for (float distance = 0; distance < pathMeasure.getLength(); distance += 5) {
                        pathMeasure.getPosTan(distance, pos, tan);
                        float dist = (float) Math.sqrt(
                            Math.pow(x - pos[0], 2) + Math.pow(y - pos[1], 2)
                        );
                        minDistance = Math.min(minDistance, dist);
                    }

                    if (minDistance <= eraserRadius) {
                        shouldErase = true;
                    }
                }

                // 方法2: 检查笔迹边界是否与橡皮擦区域相交
                if (!shouldErase) {
                    android.graphics.RectF eraserRect = new android.graphics.RectF(
                        x - eraserRadius, y - eraserRadius,
                        x + eraserRadius, y + eraserRadius
                    );

                    if (android.graphics.RectF.intersects(bounds, eraserRect)) {
                        // 检查重叠面积
                        android.graphics.RectF intersection = new android.graphics.RectF();
                        intersection.setIntersect(bounds, eraserRect);
                        float intersectionArea = intersection.width() * intersection.height();
                        float strokeArea = bounds.width() * bounds.height();

                        if (intersectionArea > strokeArea * 0.3) { // 30%重叠就删除
                            shouldErase = true;
                        }
                    }
                }

                if (shouldErase) {
                    pageData.strokes.remove(i);
                    invalidate();
                    Log.d(TAG, "擦除笔迹 " + i);
                    break; // 每次只擦除一个笔迹
                }
            }
        }

        private void startLassoSelection(float x, float y) {
            Log.d(TAG, "开始套索选择");
            lassoPath = new Path();
            lassoPath.moveTo(x, y);
            lassoPaint = new Paint();
            lassoPaint.setColor(Color.BLUE);
            lassoPaint.setStyle(Paint.Style.STROKE);
            lassoPaint.setStrokeWidth(2);
            lassoPaint.setAntiAlias(true);
        }

        private void startShape(float x, float y) {
            Log.d(TAG, "开始绘制形状: " + currentShape);
            shapeStartX = x;
            shapeStartY = y;
            currentPath = new Path();
            currentPaint = new Paint();
            currentPaint.setColor(currentStrokeColor);
            currentPaint.setStyle(Paint.Style.STROKE);
            currentPaint.setStrokeWidth(currentStrokeWidth);
            currentPaint.setAntiAlias(true);
            currentPaint.setStrokeCap(Paint.Cap.ROUND);
            currentPaint.setStrokeJoin(Paint.Join.ROUND);
        }

        private void startLaser(float x, float y) {
            Log.d(TAG, "开始激光笔");
            laserPath = new Path();
            laserPath.moveTo(x, y);
            laserPaint = new Paint();
            laserPaint.setColor(Color.RED);
            laserPaint.setStyle(Paint.Style.STROKE);
            laserPaint.setStrokeWidth(currentStrokeWidth * 2);
            laserPaint.setAntiAlias(true);
            laserPaint.setAlpha(204); // 80% alpha
        }

        private void continueLassoSelection(float x, float y) {
            if (lassoPath != null) {
                lassoPath.lineTo(x, y);
                invalidate();
            }
        }

        private void endLassoSelection() {
            if (lassoPath == null) return;

            lassoPath.close();
            Log.d(TAG, "套索选择结束");

            // 查找套索内的笔迹
            List<String> selectedStrokeIds = new ArrayList<>();

            for (StrokeData stroke : pageData.strokes) {
                if (isStrokeSelectedByLasso(stroke, lassoPath)) {
                    selectedStrokeIds.add(stroke.id);
                    Log.d(TAG, "选中笔迹: " + stroke.id);
                }
            }

            Log.d(TAG, "选中 " + selectedStrokeIds.size() + " 个笔迹");

            // 高亮显示选中的笔迹
            if (selectedStrokeIds.size() > 0) {
                lassoPaint.setColor(Color.GREEN);
                lassoPaint.setAlpha(51); // 20% alpha

                // 3秒后清除选择
                postDelayed(() -> {
                    lassoPath = null;
                    lassoPaint = null;
                    invalidate();
                }, 3000);
            } else {
                // 没有选中任何内容，立即清除
                lassoPath = null;
                lassoPaint = null;
                invalidate();
            }
        }

        private boolean isStrokeSelectedByLasso(StrokeData stroke, Path lassoPath) {
            android.graphics.RectF bounds = new android.graphics.RectF();
            stroke.path.computeBounds(bounds, true);

            // 检查笔迹边界是否与套索路径相交
            android.graphics.RectF lassoBounds = new android.graphics.RectF();
            lassoPath.computeBounds(lassoBounds, true);

            if (!android.graphics.RectF.intersects(bounds, lassoBounds)) {
                return false;
            }

            // 检查笔迹中心点是否在套索内
            float centerX = bounds.centerX();
            float centerY = bounds.centerY();

            // 使用Region来检查点是否在路径内
            android.graphics.Region region = new android.graphics.Region();
            android.graphics.Region clip = new android.graphics.Region(
                (int) lassoBounds.left - 1, (int) lassoBounds.top - 1,
                (int) lassoBounds.right + 1, (int) lassoBounds.bottom + 1
            );
            region.setPath(lassoPath, clip);

            return region.contains((int) centerX, (int) centerY);
        }

        private void continueLaser(float x, float y) {
            if (laserPath != null) {
                laserPath.lineTo(x, y);
                invalidate();
            }
        }

        private void endLaser() {
            if (laserPath == null) return;

            Log.d(TAG, "激光笔结束，开始淡出");

            // 创建淡出动画
            ValueAnimator fadeAnimator = ValueAnimator.ofFloat(0.8f, 0.0f);
            fadeAnimator.setDuration(3000);
            fadeAnimator.setInterpolator(new android.view.animation.DecelerateInterpolator());

            fadeAnimator.addUpdateListener(animation -> {
                float alpha = (float) animation.getAnimatedValue();
                if (laserPaint != null) {
                    laserPaint.setAlpha((int) (alpha * 255));
                    invalidate();
                }
            });

            fadeAnimator.addListener(new android.animation.AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(android.animation.Animator animation) {
                    laserPath = null;
                    laserPaint = null;
                    invalidate();
                }
            });

            fadeAnimator.start();
        }

        private void updateShapePath(float x, float y) {
            if (currentPath == null) return;

            currentPath.reset();

            if ("line".equals(currentShape)) {
                currentPath.moveTo(shapeStartX, shapeStartY);
                currentPath.lineTo(x, y);
            } else if ("rectangle".equals(currentShape)) {
                currentPath.addRect(
                    Math.min(shapeStartX, x),
                    Math.min(shapeStartY, y),
                    Math.max(shapeStartX, x),
                    Math.max(shapeStartY, y),
                    Path.Direction.CW
                );
            } else if ("circle".equals(currentShape)) {
                float radius = (float) Math.sqrt(
                    Math.pow(x - shapeStartX, 2) + Math.pow(y - shapeStartY, 2)
                );
                currentPath.addCircle(shapeStartX, shapeStartY, radius, Path.Direction.CW);
            } else if ("arrow".equals(currentShape)) {
                // 箭头
                currentPath.moveTo(shapeStartX, shapeStartY);
                currentPath.lineTo(x, y);

                double angle = Math.atan2(y - shapeStartY, x - shapeStartX);
                float arrowLength = 15;
                float arrowAngle = (float) (Math.PI / 6);

                currentPath.moveTo(x, y);
                currentPath.lineTo(
                    (float) (x - arrowLength * Math.cos(angle - arrowAngle)),
                    (float) (y - arrowLength * Math.sin(angle - arrowAngle))
                );
                currentPath.moveTo(x, y);
                currentPath.lineTo(
                    (float) (x - arrowLength * Math.cos(angle + arrowAngle)),
                    (float) (y - arrowLength * Math.sin(angle + arrowAngle))
                );
            } else if ("triangle".equals(currentShape)) {
                // 三角形
                float midX = (shapeStartX + x) / 2;
                currentPath.moveTo(midX, shapeStartY);
                currentPath.lineTo(shapeStartX, y);
                currentPath.lineTo(x, y);
                currentPath.close();
            } else if ("diamond".equals(currentShape)) {
                // 菱形
                float midX = (shapeStartX + x) / 2;
                float midY = (shapeStartY + y) / 2;
                currentPath.moveTo(midX, shapeStartY);
                currentPath.lineTo(x, midY);
                currentPath.lineTo(midX, y);
                currentPath.lineTo(shapeStartX, midY);
                currentPath.close();
            } else if ("star".equals(currentShape)) {
                // 五角星
                float centerX = (shapeStartX + x) / 2;
                float centerY = (shapeStartY + y) / 2;
                float radius = Math.min(Math.abs(x - shapeStartX), Math.abs(y - shapeStartY)) / 2;

                for (int i = 0; i < 5; i++) {
                    double angle = i * 2 * Math.PI / 5 - Math.PI / 2; // 从顶部开始
                    float pointX = centerX + radius * (float) Math.cos(angle);
                    float pointY = centerY + radius * (float) Math.sin(angle);

                    if (i == 0) {
                        currentPath.moveTo(pointX, pointY);
                    } else {
                        currentPath.lineTo(pointX, pointY);
                    }
                }
                currentPath.close();
            } else {
                // 默认直线
                currentPath.moveTo(shapeStartX, shapeStartY);
                currentPath.lineTo(x, y);
            }

            invalidate();
        }

        private void endShape() {
            if (currentPath != null && currentPaint != null) {
                // 保存形状
                String strokeId = UUID.randomUUID().toString();
                StrokeData newStroke = new StrokeData(strokeId, currentPath, currentPaint, new ArrayList<>());
                pageData.strokes.add(newStroke);

                // 发送笔迹提交事件
                WritableMap event = Arguments.createMap();
                event.putString("strokeId", strokeId);
                event.putString("tool", "shape");
                event.putString("shape", currentShape);
                sendEvent("onStrokeCommitted", event);

                Log.d(TAG, "形状绘制完成: " + currentShape);
            }

            // 清理
            currentPath = null;
            currentPaint = null;
            invalidate();
        }

        private void continueStroke(float x, float y, float pressure) {
            if ("eraser".equals(currentTool)) {
                eraseAt(x, y);
            } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
                continueLassoSelection(x, y);
            } else if ("shape".equals(currentTool)) {
                updateShapePath(x, y);
            } else if ("laser".equals(currentTool)) {
                continueLaser(x, y);
            } else {
                // 默认绘图
                if (currentPath != null) {
                    currentPath.lineTo(x, y);
                    currentStrokePoints.add(new StrokePoint(x, y, pressure));
                    invalidate();
                }
            }
        }

        private void endStroke() {
            if ("eraser".equals(currentTool)) {
                Log.d(TAG, "橡皮擦结束");
            } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
                endLassoSelection();
            } else if ("shape".equals(currentTool)) {
                endShape();
            } else if ("laser".equals(currentTool)) {
                endLaser();
            } else {
                // 默认绘图结束
                endDefaultDrawing();
            }

            // 恢复父View的触摸事件拦截
            getParent().requestDisallowInterceptTouchEvent(false);
        }

        private void endDefaultDrawing() {
            if (currentPath != null && currentPaint != null && currentStrokePoints.size() > 1) {
                StrokeData newStroke = new StrokeData(currentPath, currentPaint, new ArrayList<>(currentStrokePoints));
                pageData.strokes.add(newStroke);

                WritableMap event = Arguments.createMap();
                event.putString("strokeId", UUID.randomUUID().toString());
                event.putString("tool", currentTool);
                ReactContext reactContext = (ReactContext) getContext();
                reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                    NativePagedNoteView.this.getId(), "onStrokeCommitted", event);

                currentPath = null;
                currentPaint = null;
                currentStrokePoints.clear();
                invalidate();
            }
        }
    }

    // Setters
    public void setNoteId(String noteId) { this.noteId = noteId; }

    public void setStyleConfig(ReadableMap config) {
        this.styleConfig = new HashMap<>();
        if (config.hasKey("background")) this.styleConfig.put("background", config.getString("background"));
        for (PageView pageView : pageViews) {
            pageView.invalidate();
        }
    }

    public void setCurrentTool(String tool) { this.currentTool = tool; }
    public void setCurrentColor(String color) {
        if (color == null) {
            this.currentColor = Color.BLACK;
            return;
        }
        String trimmed = color.trim();
        if (trimmed.isEmpty()) {
            this.currentColor = Color.BLACK;
            return;
        }
        try {
            this.currentColor = Color.parseColor(trimmed);
        } catch (IllegalArgumentException ex) {
            Log.w(TAG, "Invalid currentColor received: " + color + ", fallback to BLACK", ex);
            this.currentColor = Color.BLACK;
        }
    }
    public void setCurrentStrokeWidth(float width) { this.currentStrokeWidth = width; }

    public void setToolConfig(String configJson) {
        Log.d("NativePagedNoteView", "Tool config received: " + configJson);
        // Tool configuration can be parsed and applied here if needed
    }

    /**
     * 验证坐标转换的准确性（调试用）
     */
    public void validateCoordinateTransformation() {
        Log.d(TAG, "========== 坐标转换验证 ==========");
        Log.d(TAG, String.format("当前缩放: %.2f, 容器宽度: %d, 缩放中心: (%.1f, 0)",
            scaleFactor, pagesContainer.getMeasuredWidth(), pagesContainer.getMeasuredWidth() / 2.0f));

        // 测试几个关键点的坐标转换
        float[] testPoints = {0, 100, 200, 400, 600}; // 测试不同的X坐标
        for (float testX : testPoints) {
            float pivotX = pagesContainer.getMeasuredWidth() / 2.0f;
            float scaledX = pivotX + (testX - pivotX) * scaleFactor;
            float backX = pivotX + (scaledX - pivotX) / scaleFactor;

            Log.d(TAG, String.format("测试点 X=%.1f -> 缩放后=%.1f -> 逆变换=%.1f (误差: %.3f)",
                testX, scaledX, backX, Math.abs(testX - backX)));
        }
        Log.d(TAG, "=====================================");
    }

    public void setCurrentPage(int page) {
        if (page >= 0 && page < pageViews.size()) {
            currentPage = page;
            // 找到对应的 PageView（跳过分隔器）
            int pageIndex = 0;
            for (int i = 0; i < pagesContainer.getChildCount(); i++) {
                View child = pagesContainer.getChildAt(i);
                if (child instanceof PageView) {
                    if (pageIndex == page) {
                        // 考虑缩放因子计算滚动位置
                        int targetY = (int)(child.getTop() * scaleFactor);
                        smoothScrollTo(0, targetY);
                        break;
                    }
                    pageIndex++;
                }
            }
        }
    }

    public void addPageFromPageControl() {
        // 直接添加新页面，不检查滚动位置（供页码器调用）
        if (!isAutoAddingPage) {
            isAutoAddingPage = true;
            post(new Runnable() {
                @Override
                public void run() {
                    addNewPage();
                    isAutoAddingPage = false;

                    // 自动滚动到新页面
                    postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            smoothScrollTo(0, pagesContainer.getHeight() - getHeight());
                        }
                    }, 100);
                }
            });
        }
    }

    public void undo() {
        if (currentPage >= 0 && currentPage < pageViews.size()) {
            PageView pageView = pageViews.get(currentPage);
            PageData pageData = pages.get(currentPage);
            if (!pageData.strokes.isEmpty()) {
                if (pageData.redoStack == null) pageData.redoStack = new java.util.ArrayList<>();
                StrokeData last = pageData.strokes.remove(pageData.strokes.size() - 1);
                pageData.redoStack.add(last);
                pageView.invalidate();
            }
        }
    }

    public void redo() {
        if (currentPage >= 0 && currentPage < pageViews.size()) {
            PageView pageView = pageViews.get(currentPage);
            PageData pageData = pages.get(currentPage);
            if (pageData.redoStack != null && !pageData.redoStack.isEmpty()) {
                StrokeData s = pageData.redoStack.remove(pageData.redoStack.size() - 1);
                pageData.strokes.add(s);
                pageView.invalidate();
            }
        }
    }

    public void clear() {
        if (currentPage >= 0 && currentPage < pageViews.size()) {
            PageData pageData = pages.get(currentPage);
            pageData.strokes.clear();
            pageViews.get(currentPage).invalidate();
        }
    }

    public void recognizeHandwriting(String strokeId) {
        if (strokeId == null || strokeId.isEmpty()) return;

        try {
            if (currentPage < 0 || currentPage >= pages.size()) return;
            PageData pageData = pages.get(currentPage);

            StrokeData targetStroke = null;
            for (StrokeData stroke : pageData.strokes) {
                if (strokeId.equals(stroke.id)) {
                    targetStroke = stroke;
                    break;
                }
            }

            if (targetStroke == null || targetStroke.points == null || targetStroke.points.isEmpty()) {
                Log.w(TAG, "Handwriting recognition: Stroke not found or has no points for ID: " + strokeId);
                return;
            }

            // Convert points to Ink.Stroke for ML Kit
            AIProcessingService.recognizeSingleStroke(targetStroke.points, new AIProcessingService.RecognitionCallback() {
                @Override
                public void onResult(String text, float confidence) {
                    WritableMap event = Arguments.createMap();
                    event.putString("strokeId", strokeId);
                    event.putString("recognizedText", text);
                    event.putDouble("confidence", confidence);
                    sendEvent("onHandwritingRecognized", event);
                }

                @Override
                public void onError(Exception e) {
                    Log.e(TAG, "Handwriting recognition failed for stroke: " + strokeId, e);
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Error in recognizeHandwriting", e);
        }
    }

    public void insertText(String text) {
        Log.d(TAG, "insertText: " + text);
    }

    public void addImage(String imageUri) {
        Log.d(TAG, "添加图片: " + imageUri);
        try {
            if (currentPage < 0 || currentPage >= pageViews.size()) return;
            PageData pageData = pages.get(currentPage);
            PageView pageView = pageViews.get(currentPage);
            Bitmap bitmap = null;
            if (imageUri != null && imageUri.startsWith("file://")) {
                String path = imageUri.substring(7);
                bitmap = BitmapFactory.decodeFile(path);
            } else {
                Uri uri = Uri.parse(imageUri);
                ContentResolver resolver = getContext().getContentResolver();
                try (InputStream is = resolver.openInputStream(uri)) {
                    if (is != null) bitmap = BitmapFactory.decodeStream(is);
                }
            }
            if (bitmap == null) return;
            // 以页面宽度60%添加至中心
            float pageW = pageView.getWidth() / scaleFactor;
            float pageH = pageView.getHeight() / scaleFactor;
            float targetW = pageW * 0.6f;
            float ratio = (float) bitmap.getHeight() / Math.max(1, bitmap.getWidth());
            float targetH = targetW * ratio;
            float x = (pageW - targetW) / 2f;
            float y = (pageH - targetH) / 2f;
            StrokeData imageStroke = Stroke.image(bitmap, x, y, targetW, targetH);
            pageData.strokes.add(imageStroke);
            if (pageData.redoStack != null) pageData.redoStack.clear();
            pageView.invalidate();
        } catch (Exception e) {
            Log.e(TAG, "addImage 失败", e);
        }
    }

    /**
     * 从JSON数据导入笔记（恢复保存的笔迹）
     */
    public void importNote(String jsonData) {
        try {
            org.json.JSONObject noteData = new org.json.JSONObject(jsonData);

            // 清除现有数据
            pages.clear();
            pageViews.clear();
            pagesContainer.removeAllViews();

            // 恢复缩放等级
            if (noteData.has("scale")) {
                scaleFactor = (float) noteData.getDouble("scale");
                pagesContainer.setScaleFactor(scaleFactor);
            }

            // 恢复所有页面
            org.json.JSONArray pagesArray = noteData.getJSONArray("pages");
            for (int i = 0; i < pagesArray.length(); i++) {
                org.json.JSONObject pageObj = pagesArray.getJSONObject(i);

                // 创建新页面
                PageData pageData = new PageData();

                // 恢复笔迹数据
                org.json.JSONArray strokesArray = pageObj.getJSONArray("strokes");
                for (int j = 0; j < strokesArray.length(); j++) {
                    org.json.JSONObject strokeObj = strokesArray.getJSONObject(j);

                    // 创建画笔
                    Paint paint = new Paint();
                    paint.setAntiAlias(true);
                    paint.setStyle(Paint.Style.STROKE);
                    paint.setStrokeCap(Paint.Cap.ROUND);
                    paint.setStrokeJoin(Paint.Join.ROUND);

                    // 恢复颜色和宽度
                    paint.setColor(Color.parseColor(strokeObj.getString("color")));
                    paint.setStrokeWidth((float) strokeObj.getDouble("strokeWidth"));
                    if (strokeObj.has("alpha")) {
                        paint.setAlpha(strokeObj.getInt("alpha"));
                    }

                    // 恢复笔迹点
                    List<StrokePoint> points = new ArrayList<>();
                    org.json.JSONArray pointsArray = strokeObj.getJSONArray("points");
                    Path path = new Path();

                    for (int k = 0; k < pointsArray.length(); k++) {
                        org.json.JSONObject pointObj = pointsArray.getJSONObject(k);
                        float x = (float) pointObj.getDouble("x");
                        float y = (float) pointObj.getDouble("y");
                        float pressure = (float) pointObj.getDouble("pressure");

                        points.add(new StrokePoint(x, y, pressure));

                        if (k == 0) {
                            path.moveTo(x, y);
                        } else {
                            path.lineTo(x, y);
                        }
                    }

                    // 添加笔迹到页面
                    pageData.strokes.add(new StrokeData(path, paint, points));
                }

                // 添加页面视图
                PageView pageView = new PageView(getContext(), i, pageData);

                pages.add(pageData);
                pageViews.add(pageView);

                LinearLayout.LayoutParams pageParams = new LinearLayout.LayoutParams(
                    pageWidth, pageHeight);
                pageParams.setMargins(horizontalMargin, 0, horizontalMargin, 0);
                pagesContainer.addView(pageView, pageParams);

                // 添加分隔符（除了最后一页）
                if (i < pagesArray.length() - 1) {
                    View separator = createSeparator();
                    LinearLayout.LayoutParams sepParams = new LinearLayout.LayoutParams(
                        pageWidth, PAGE_SPACING
                    );
                    sepParams.setMargins(horizontalMargin, 0, horizontalMargin, 0);
                    pagesContainer.addView(separator, sepParams);
                }
            }

            // 恢复当前页
            if (noteData.has("currentPage")) {
                currentPage = noteData.getInt("currentPage");
            }

            // 发送就绪事件
            sendReadyEvent();

            Log.d(TAG, "笔记数据导入成功，总页数: " + pages.size() +
                  ", 当前页: " + currentPage);

        } catch (Exception e) {
            Log.e(TAG, "导入笔记失败", e);
            sendErrorEvent("IMPORT_FAILED", "导入笔记失败: " + e.getMessage());
        }
    }

    public void exportNote(String noteId) {
        try {
            org.json.JSONObject noteData = new org.json.JSONObject();
            noteData.put("noteId", noteId);
            noteData.put("totalPages", pages.size());
            noteData.put("currentPage", currentPage);
            noteData.put("scale", scaleFactor);

            // 导出所有页面的笔迹数据
            org.json.JSONArray pagesArray = new org.json.JSONArray();
            for (int pageIndex = 0; pageIndex < pages.size(); pageIndex++) {
                PageData pageData = pages.get(pageIndex);
                org.json.JSONObject pageObj = new org.json.JSONObject();
                pageObj.put("pageNumber", pageIndex + 1);

                // 导出当前页的所有笔迹
                org.json.JSONArray strokesArray = new org.json.JSONArray();
                for (StrokeData stroke : pageData.strokes) {
                    org.json.JSONObject strokeObj = new org.json.JSONObject();

                    // 保存笔迹颜色和宽度
                    strokeObj.put("color", String.format("#%06X", (0xFFFFFF & stroke.paint.getColor())));
                    strokeObj.put("strokeWidth", stroke.paint.getStrokeWidth());
                    strokeObj.put("alpha", stroke.paint.getAlpha());

                    // 保存笔迹点数据
                    org.json.JSONArray pointsArray = new org.json.JSONArray();
                    for (StrokePoint point : stroke.points) {
                        org.json.JSONObject pointObj = new org.json.JSONObject();
                        pointObj.put("x", point.x);
                        pointObj.put("y", point.y);
                        pointObj.put("pressure", point.pressure);
                        pointsArray.put(pointObj);
                    }
                    strokeObj.put("points", pointsArray);
                    strokeObj.put("pointCount", stroke.points.size());

                    strokesArray.put(strokeObj);
                }
                pageObj.put("strokes", strokesArray);
                pageObj.put("strokeCount", strokesArray.length());

                pagesArray.put(pageObj);
            }
            noteData.put("pages", pagesArray);

            String jsonString = noteData.toString();
            Log.d(TAG, "笔记数据已导出，总页数: " + pages.size() +
                  ", JSON长度: " + jsonString.length());

            WritableMap event = Arguments.createMap();
            event.putString("noteId", noteId);
            event.putString("data", jsonString);
            event.putBoolean("success", true);
            sendEvent("onExportComplete", event);

        } catch (Exception e) {
            Log.e(TAG, "导出笔记失败", e);
            sendErrorEvent("EXPORT_FAILED", "导出笔记失败: " + e.getMessage());
        }
    }

    // 缩放手势监听器
    private class ScaleListener extends ScaleGestureDetector.SimpleOnScaleGestureListener {
        @Override
        public boolean onScale(ScaleGestureDetector detector) {
            float oldScale = scaleFactor;
            scaleFactor *= detector.getScaleFactor();
            scaleFactor = Math.max(MIN_SCALE, Math.min(scaleFactor, MAX_SCALE));

            // 计算缩放比例变化
            float scaleChange = scaleFactor / oldScale;

            // 保存当前滚动位置
            final int oldScrollY = getScrollY();

            // 设置容器的缩放因子（这会触发重新测量）
            pagesContainer.setScaleFactor(scaleFactor);

            // 更新所有PageView的缩放因子，以修正触摸坐标
            for (PageView pageView : pageViews) {
                pageView.setParentScaleFactor(scaleFactor);
            }

            // 调整滚动位置以保持视口内容
            post(new Runnable() {
                @Override
                public void run() {
                    int newScrollY = (int)(oldScrollY * scaleChange);
                    scrollTo(0, newScrollY);
                }
            });

            // 不在每次变化时发送事件，只在缩放结束时发送
            return true;
        }

        @Override
        public boolean onScaleBegin(ScaleGestureDetector detector) {
            WritableMap event = Arguments.createMap();
            event.putDouble("scale", scaleFactor);
            event.putBoolean("isScaling", true);
            sendEvent("onZoomChange", event);
            return true;
        }

        @Override
        public void onScaleEnd(ScaleGestureDetector detector) {
            WritableMap event = Arguments.createMap();
            event.putDouble("scale", scaleFactor);
            event.putBoolean("isScaling", false);
            sendEvent("onZoomChange", event);

            // 重新触发布局和滚动范围计算
            post(new Runnable() {
                @Override
                public void run() {
                    // 请求重新布局
                    pagesContainer.requestLayout();
                    requestLayout();

                    // 强制ScrollView重新计算滚动范围
                    computeScroll();
                    awakenScrollBars();
                    invalidate();

                    int scrollRange = computeVerticalScrollRange();
                    int scrollExtent = computeVerticalScrollExtent();
                    int maxScroll = scrollRange - scrollExtent;
                    int currentScrollY = getScrollY();

                    Log.d(TAG, String.format("缩放结束 - 缩放: %.2f, 容器高度: %d, 滚动范围: %d, 视口: %d, 最大滚动: %d, 当前滚动: %d",
                        scaleFactor, pagesContainer.getMeasuredHeight(), scrollRange, scrollExtent, maxScroll, currentScrollY));

                    // 验证坐标转换的准确性
                    validateCoordinateTransformation();

                    // 验证子View位置
                    if (pagesContainer.getChildCount() > 0) {
                        View firstChild = pagesContainer.getChildAt(0);
                        View lastChild = pagesContainer.getChildAt(pagesContainer.getChildCount() - 1);
                        Log.d(TAG, String.format("子View位置 - 第一个Top: %d, 最后一个Bottom: %d",
                            firstChild.getTop(), lastChild.getBottom()));
                    }
                }
            });
        }
    }

    @Override
    protected int computeVerticalScrollRange() {
        // 返回缩放后的实际内容高度
        return pagesContainer.getMeasuredHeight();
    }

    @Override
    protected int computeVerticalScrollOffset() {
        // 返回当前滚动位置
        return getScrollY();
    }

    @Override
    protected int computeVerticalScrollExtent() {
        // 返回可见视口高度
        return getHeight();
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        // 首先处理缩放手势
        boolean handled = scaleDetector.onTouchEvent(event);

        // 检测触摸类型
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            String touchType = TouchTypeDetectionModule.detectTouchTypeFromMotionEvent(event, 0);
            boolean isStylusTouch = TouchTypeDetectionModule.TOUCH_TYPE_STYLUS.equals(touchType);

            if (isStylusTouch) {
                // 手写笔触摸，不处理，让子View处理
                Log.d(TAG, "ScrollView检测到手写笔触摸，不处理");
                return false;
            }
        }

        // 多指操作（缩放）
        if (event.getPointerCount() > 1) {
            return true;
        }

        // 单指手指操作（滚动）
        return super.onTouchEvent(event);
    }

    @Override
    public boolean onInterceptTouchEvent(MotionEvent event) {
        // 检测触摸类型
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            String touchType = TouchTypeDetectionModule.detectTouchTypeFromMotionEvent(event, 0);
            boolean isStylusTouch = TouchTypeDetectionModule.TOUCH_TYPE_STYLUS.equals(touchType);

            // 如果是手写笔，不拦截事件，让子View处理绘制
            if (isStylusTouch) {
                Log.d(TAG, "检测到手写笔触摸，不拦截事件");
                return false;
            }
        }

        // 双指缩放手势，拦截事件由ScrollView处理
        if (event.getPointerCount() > 1) {
            Log.d(TAG, "检测到多指触摸，拦截事件进行缩放");
            return true;
        }

        // 单指手指触摸，允许滚动
        return super.onInterceptTouchEvent(event);
    }

    @Override
    protected void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);

        Log.d(TAG, "屏幕方向改变: " +
            (newConfig.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE ?
            "横屏" : "竖屏"));

        // 重新计算页面尺寸
        calculatePageDimensions();

        // 更新所有页面的布局参数
        for (int i = 0; i < pagesContainer.getChildCount(); i++) {
            View child = pagesContainer.getChildAt(i);
            if (child instanceof PageView) {
                LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) child.getLayoutParams();
                params.width = pageWidth;
                params.height = pageHeight;
                params.setMargins(horizontalMargin, 0, horizontalMargin, 0);
                child.setLayoutParams(params);
            }
        }

        // 请求重新布局
        pagesContainer.requestLayout();
        requestLayout();
    }

    // 数据类
    static class PageData {
        List<StrokeData> strokes = new ArrayList<>();
        List<StrokeData> redoStack = new ArrayList<>();
    }

    static class StrokeData {
        String id;
        Path path;
        Paint paint;
        List<StrokePoint> points;

        StrokeData(Path path, Paint paint, List<StrokePoint> points) {
            this.id = UUID.randomUUID().toString();
            this.path = new Path(path);
            this.paint = new Paint(paint);
            this.points = points;
        }

        StrokeData(String id, Path path, Paint paint, List<StrokePoint> points) {
            this.id = id;
            this.path = new Path(path);
            this.paint = new Paint(paint);
            this.points = points;
        }
    }

    // 简化的图像笔迹结构
    static class ImageStrokeData extends StrokeData {
        Bitmap bitmap;
        float x, y, w, h;
        ImageStrokeData(Bitmap bitmap, float x, float y, float w, float h) {
            super(new Path(), new Paint(Paint.ANTI_ALIAS_FLAG), new java.util.ArrayList<StrokePoint>());
            this.bitmap = bitmap;
            this.x = x; this.y = y; this.w = w; this.h = h;
        }
    }

    // 简化的统一 Stroke 工厂
    static class Stroke {
        static StrokeData image(Bitmap bitmap, float x, float y, float w, float h) {
            return new ImageStrokeData(bitmap, x, y, w, h);
        }
    }


    /**
     * 可缩放的 LinearLayout - 通过修改测量尺寸来实现真正的缩放
     * 这样 ScrollView 就能正确识别缩放后的内容高度
     */
    private class ScalableLinearLayout extends LinearLayout {
        private float scaleFactor = 1.0f;

        public ScalableLinearLayout(Context context) {
            super(context);
        }

        public void setScaleFactor(float scale) {
            if (this.scaleFactor != scale) {
                this.scaleFactor = scale;
                // 触发重新测量和布局
                requestLayout();
                invalidate();
            }
        }

        public float getScaleFactor() {
            return scaleFactor;
        }

        @Override
        protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
            // 先按正常方式测量
            super.onMeasure(widthMeasureSpec, heightMeasureSpec);

            // 获取测量后的尺寸
            int measuredWidth = getMeasuredWidth();
            int measuredHeight = getMeasuredHeight();

            // 只缩放高度，宽度保持不变（避免水平偏移）
            int scaledHeight = (int)(measuredHeight * scaleFactor);

            // 设置缩放后的测量尺寸
            setMeasuredDimension(measuredWidth, scaledHeight);
        }

        @Override
        public void draw(Canvas canvas) {
            // 保存 Canvas 状态
            canvas.save();

            // 计算缩放中心点（水平居中，垂直从顶部）
            // 由于宽度未缩放，直接使用宽度的一半作为水平中心
            float pivotX = getMeasuredWidth() / 2.0f;
            float pivotY = 0;

            // 应用缩放变换，从中心点缩放
            canvas.scale(scaleFactor, scaleFactor, pivotX, pivotY);

            // 设置抗锯齿和高质量渲染，确保缩放后颜色深度一致
            canvas.setDensity(getResources().getDisplayMetrics().densityDpi);

            // 绘制背景和内容
            super.draw(canvas);

            // 恢复 Canvas 状态
            canvas.restore();
        }
    }

    // ==================== ML Kit 文本识别和手写识别 ====================

    /**
     * 区域OCR：识别指定矩形区域内的文本
     * @param x 区域左上角X坐标（视图坐标）
     * @param y 区域左上角Y坐标（视图坐标）
     * @param width 区域宽度
     * @param height 区域高度
     * @param promise Promise回调
     */
    public void recognizeTextInRect(float x, float y, float width, float height, Promise promise) {
        try {
            int bitmapWidth = (int) width;
            int bitmapHeight = (int) height;

            if (bitmapWidth <= 0 || bitmapHeight <= 0) {
                promise.reject("E_INVALID_RECT", "Invalid region size");
                return;
            }

            Bitmap bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);

            canvas.save();
            canvas.translate(-x, -y);

            if (currentPage >= 0 && currentPage < pageViews.size()) {
                PageView pageView = pageViews.get(currentPage);
                pageView.draw(canvas);
            }

            canvas.restore();

            AIProcessingService.recognizeTextInBitmap(bitmap, x, y, promise);

        } catch (Exception e) {
            Log.e(TAG, "Region OCR failed", e);
            promise.reject("E_OCR_ERROR", "Error during region OCR: " + e.getMessage());
        }
    }

    /**
     * 手写识别：识别当前页最近的N笔笔迹
     * @param count 要识别的笔迹数量
     * @param promise Promise回调
     */
    public void recognizeHandwriting(int count, Promise promise) {
        try {
            if (count <= 0 || currentPage < 0 || currentPage >= pages.size()) {
                promise.resolve("");
                return;
            }

            PageData pageData = pages.get(currentPage);
            List<StrokeData> allStrokes = pageData.strokes;

            if (allStrokes.isEmpty()) {
                promise.resolve("");
                return;
            }

            List<Path> paths = new ArrayList<>();
            List<Paint> paints = new ArrayList<>();
            int startIndex = Math.max(0, allStrokes.size() - count);

            for (int i = startIndex; i < allStrokes.size(); i++) {
                StrokeData stroke = allStrokes.get(i);
                if (stroke.path != null && stroke.paint != null) {
                    paths.add(stroke.path);
                    paints.add(stroke.paint);
                }
            }

            if (paths.isEmpty()) {
                promise.resolve("");
                return;
            }

            AIProcessingService.recognizeHandwriting(paths, paints, promise);

        } catch (Exception e) {
            Log.e(TAG, "Handwriting recognition error", e);
            promise.reject("E_HANDWRITING_ERROR", "Error during handwriting recognition: " + e.getMessage());
        }
    }
}
