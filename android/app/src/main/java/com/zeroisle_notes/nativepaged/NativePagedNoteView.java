package com.zeroisle_notes.nativepaged;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.Log;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import android.view.ViewGroup;
 

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
                // 确保历史笔迹在不同缩放级别下颜色深度一致
                Paint renderPaint = new Paint(stroke.paint);
                renderPaint.setDither(true);
                renderPaint.setFilterBitmap(true);
                canvas.drawPath(stroke.path, renderPaint);
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
            
            currentPath = new Path();
            currentPath.moveTo(x, y);
            
            currentPaint = new Paint();
            currentPaint.setColor(currentColor);
            currentPaint.setStrokeWidth(currentStrokeWidth * pressure);
            currentPaint.setStyle(Paint.Style.STROKE);
            currentPaint.setStrokeCap(Paint.Cap.ROUND);
            currentPaint.setStrokeJoin(Paint.Join.ROUND);
            currentPaint.setAntiAlias(true);
            // 确保在不同缩放级别下颜色深度一致
            currentPaint.setDither(true);
            currentPaint.setFilterBitmap(true);
            
            currentStrokePoints.clear();
            currentStrokePoints.add(new StrokePoint(x, y, pressure));
            
            invalidate();
        }
        
        private void continueStroke(float x, float y, float pressure) {
            if (currentPath != null) {
                currentPath.lineTo(x, y);
                currentStrokePoints.add(new StrokePoint(x, y, pressure));
                invalidate();
            }
        }
        
        private void endStroke() {
            if (currentPath != null && currentPaint != null && currentStrokePoints.size() > 1) {
                StrokeData newStroke = new StrokeData(currentPath, currentPaint, new ArrayList<>(currentStrokePoints));
                pageData.strokes.add(newStroke);
                
                WritableMap event = Arguments.createMap();
                event.putString("strokeId", UUID.randomUUID().toString());
                ReactContext reactContext = (ReactContext) getContext();
                reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                    NativePagedNoteView.this.getId(), "onStrokeCommitted", event);
                
                currentPath = null;
                currentPaint = null;
                currentStrokePoints.clear();
                invalidate();
            }
            
            // 恢复父View的触摸事件拦截
            getParent().requestDisallowInterceptTouchEvent(false);
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
    public void setCurrentColor(String color) { this.currentColor = Color.parseColor(color); }
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
                pageData.strokes.remove(pageData.strokes.size() - 1);
                pageView.invalidate();
            }
        }
    }
    
    public void redo() {
        // TODO: 实现重做
    }
    
    public void clear() {
        if (currentPage >= 0 && currentPage < pageViews.size()) {
            PageData pageData = pages.get(currentPage);
            pageData.strokes.clear();
            pageViews.get(currentPage).invalidate();
        }
    }
    
    public void recognizeHandwriting(String strokeId) {
        Log.d(TAG, "recognizeHandwriting 尚未实现: " + strokeId);
    }
    
    public void insertText(String text) {
        Log.d(TAG, "insertText: " + text);
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
    }
    
    static class StrokeData {
        Path path;
        Paint paint;
        List<StrokePoint> points;
        
        StrokeData(Path path, Paint paint, List<StrokePoint> points) {
            this.path = new Path(path);
            this.paint = new Paint(paint);
            this.points = points;
        }
    }
    
    static class StrokePoint {
        float x, y, pressure;
        StrokePoint(float x, float y, float pressure) {
            this.x = x;
            this.y = y;
            this.pressure = pressure;
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
}
