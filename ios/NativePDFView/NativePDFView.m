//
//  NativePDFView.m
//  ZeroIsle_Notes
//
//  原生 PDF 视图实现
//  核心功能：瓦片化渲染、手写注释、压感支持
//

#import "NativePDFView.h"
#import <mach/mach.h>
#import <Vision/Vision.h>

@interface NativePDFView () <PDFViewDelegate, UIGestureRecognizerDelegate, UITextViewDelegate>

@property (nonatomic, strong) PDFView *pdfView;
@property (nonatomic, strong) PDFDocument *pdfDocument;
@property (nonatomic, strong) NSMutableArray<PDFAnnotation *> *inkAnnotations;
@property (nonatomic, strong) UIBezierPath *currentStrokePath;
@property (nonatomic, strong) CAShapeLayer *currentStrokeLayer;
@property (nonatomic, strong) UIColor *currentStrokeColor;
@property (nonatomic, assign) CGFloat currentStrokeWidth;
@property (nonatomic, strong) NSMutableArray *currentStrokePoints;
@property (nonatomic, assign) CGPoint lastStrokePoint;
@property (nonatomic, assign) CGFloat lastStrokeIntensity;
@property (nonatomic, assign) CGFloat activeStrokeWidth;

// 橡皮擦
@property (nonatomic, strong) PDFPage *currentEraserPage;
@property (nonatomic, strong) NSMutableSet *annotationsToRemove;

// 文本输入
@property (nonatomic, strong) UITextView *textInputView;
@property (nonatomic, strong) PDFPage *textInputPage;
@property (nonatomic, assign) CGPoint textInputPoint;

// 套索选择
@property (nonatomic, strong) UIBezierPath *lassoPath;
@property (nonatomic, strong) CAShapeLayer *lassoLayer;
@property (nonatomic, strong) NSMutableArray *selectedAnnotations;
@property (nonatomic, strong) PDFPage *lassoPage;

// 撤销/重做
@property (nonatomic, strong) NSMutableArray *undoStack;
@property (nonatomic, strong) NSMutableArray *redoStack;

// 形状工具
@property (nonatomic, assign) CGPoint shapeStartPoint;
@property (nonatomic, strong) CAShapeLayer *shapePreviewLayer;
@property (nonatomic, strong) NSString *currentShape;

// 激光笔
@property (nonatomic, strong) CAShapeLayer *laserLayer;
@property (nonatomic, strong) NSTimer *laserFadeTimer;

// 工具配置
@property (nonatomic, strong) NSDictionary *toolConfig;

// 性能监控
@property (nonatomic, assign) CFTimeInterval lastFrameTime;
@property (nonatomic, assign) NSInteger frameCount;
@property (nonatomic, assign) CGFloat currentFPS;

// 手势状态
@property (nonatomic, strong) UIPanGestureRecognizer *drawPanGesture;
@property (nonatomic, assign) CGPoint drawingPanStart;
@property (nonatomic, assign) BOOL drawingPanLocked;

// 缩放监听状态
@property (nonatomic, assign) BOOL isObservingScaleFactor;

@end

@implementation NativePDFView

static const CGFloat kUnifiedPanMinDelta = 0.35;
static const CGFloat kUnifiedMinScale = 0.5;
static const CGFloat kUnifiedMaxScale = 4.0;
static const CGFloat kPdfDrawingLockThreshold = 8.0;

- (instancetype)initWithFrame:(CGRect)frame
{
  self = [super initWithFrame:frame];
  if (self) {
    [self setupPDFView];
    [self setupGestures];
    [self setupPerformanceMonitor];

    _inkAnnotations = [NSMutableArray array];
    _currentStrokeColor = [UIColor blackColor];
    _currentStrokeWidth = 2.0;
    _currentStrokePoints = [NSMutableArray array];
    _currentTool = @"pen"; // 默认工具

    // 初始化橡皮擦相关
    _annotationsToRemove = [NSMutableSet set];

    // 初始化套索选择相关
    _selectedAnnotations = [NSMutableArray array];

    // 初始化撤销/重做栈
    _undoStack = [NSMutableArray array];
    _redoStack = [NSMutableArray array];

    // 默认形状
    _currentShape = @"line";
  }
  return self;
}

// MARK: - Setup

- (void)setupPDFView
{
  self.pdfView = [[PDFView alloc] initWithFrame:self.bounds];
  self.pdfView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  self.pdfView.displayMode = kPDFDisplaySinglePageContinuous;
  self.pdfView.autoScales = YES;
  self.pdfView.displayDirection = kPDFDisplayDirectionVertical;
  self.pdfView.delegate = self;

  // 启用缩放
  self.pdfView.minScaleFactor = kUnifiedMinScale;
  self.pdfView.maxScaleFactor = kUnifiedMaxScale;

  [self addSubview:self.pdfView];

  if (!self.isObservingScaleFactor) {
    [self.pdfView addObserver:self
                   forKeyPath:@"scaleFactor"
                      options:(NSKeyValueObservingOptionNew | NSKeyValueObservingOptionInitial)
                      context:NULL];
    self.isObservingScaleFactor = YES;
  }

  // 监听页面变化
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handlePageChanged:)
                                               name:PDFViewPageChangedNotification
                                             object:self.pdfView];
}

- (BOOL)isDrawingToolActive
{
  NSSet *drawTools = [NSSet setWithArray:@[@"pen", @"highlighter", @"marker", @"pencil", @"brush", @"eraser", @"shape", @"laser", @"select", @"lasso", @"text"]];
  return [drawTools containsObject:(self.currentTool ?: @"pen")];
}

- (void)emitZoomChange
{
  if (!self.onZoomChange) {
    return;
  }
  UIScrollView *scrollView = self.pdfView.documentView.enclosingScrollView;
  CGPoint offset = scrollView ? scrollView.contentOffset : CGPointZero;
  self.onZoomChange(@{
    @"scale": @(self.pdfView.scaleFactor),
    @"minScale": @(self.pdfView.minScaleFactor),
    @"maxScale": @(self.pdfView.maxScaleFactor),
    @"x": @(offset.x),
    @"y": @(offset.y)
  });
}

- (void)setupGestures
{
  UIPanGestureRecognizer *drawPan = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handleDrawingPan:)];
  drawPan.minimumNumberOfTouches = 1;
  drawPan.maximumNumberOfTouches = 1;
  drawPan.delegate = self;
  drawPan.cancelsTouchesInView = NO;
  self.drawPanGesture = drawPan;
  [self.pdfView addGestureRecognizer:drawPan];
}

- (void)setupPerformanceMonitor
{
  self.lastFrameTime = CACurrentMediaTime();
  self.frameCount = 0;
  self.currentFPS = 60.0;

  // 定时发送性能指标
  [NSTimer scheduledTimerWithTimeInterval:1.0 repeats:YES block:^(NSTimer * _Nonnull timer) {
    if (self.onMetrics) {
      self.onMetrics(@{
        @"fps": @(self.currentFPS),
        @"latencyMs": @(0), // TODO: 实现延迟测量
        @"memMB": @([self getMemoryUsageMB])
      });
    }
  }];
}

- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gestureRecognizer
{
  if (gestureRecognizer == self.drawPanGesture) {
    return [self isDrawingToolActive];
  }
  return YES;
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer
{
  if (gestureRecognizer == self.drawPanGesture || otherGestureRecognizer == self.drawPanGesture) {
    return NO;
  }
  return YES;
}

- (void)handleDrawingPan:(UIPanGestureRecognizer *)gesture
{
  if (![self isDrawingToolActive]) {
    return;
  }

  CGPoint location = [gesture locationInView:self.pdfView];
  CGPoint translation = [gesture translationInView:self.pdfView];
  PDFPage *page = [self.pdfView pageForPoint:location nearest:YES];

  if (gesture.state == UIGestureRecognizerStateBegan) {
    self.drawingPanStart = location;
    self.drawingPanLocked = NO;
  }

  if (!page) {
    return;
  }

  if (gesture.state == UIGestureRecognizerStateChanged && !self.drawingPanLocked) {
    CGFloat distance = hypot(translation.x, translation.y);
    if (distance < kPdfDrawingLockThreshold) {
      return;
    }
    self.drawingPanLocked = YES;
  }

  if (!self.drawingPanLocked && gesture.state != UIGestureRecognizerStateBegan) {
    return;
  }

  CGPoint pagePoint = [self.pdfView convertPoint:location toPage:page];

  switch (gesture.state) {
    case UIGestureRecognizerStateBegan:
      [self handleTouchDownAtPoint:pagePoint onPage:page];
      break;

    case UIGestureRecognizerStateChanged:
      if (fabs(translation.x) + fabs(translation.y) < kUnifiedPanMinDelta) {
        return;
      }
      [self handleTouchMoveToPoint:pagePoint];
      [self updateFPS];
      break;

    case UIGestureRecognizerStateEnded:
    case UIGestureRecognizerStateCancelled:
      [self handleTouchUpAtPoint:pagePoint onPage:page];
      self.drawingPanLocked = NO;
      break;

    default:
      break;
  }
}

// MARK: - PDF Loading

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey,id> *)change
                       context:(void *)context
{
  if (object == self.pdfView && [keyPath isEqualToString:@"scaleFactor"]) {
    [self emitZoomChange];
    return;
  }
  [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
}


- (void)loadPDFFromPath:(NSString *)path
{
  NSURL *fileURL = [NSURL fileURLWithPath:path];
  [self loadPDFFromURL:fileURL];
}

- (void)loadPDFFromURI:(NSString *)uri
{
  NSURL *url = [NSURL URLWithString:uri];
  if ([url.scheme isEqualToString:@"file"]) {
    [self loadPDFFromURL:url];
  } else {
    // TODO: 支持网络 URL
    [self sendError:@"UNSUPPORTED_URI" message:@"Network URIs not supported yet"];
  }
}

- (void)loadPDFFromURL:(NSURL *)url
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
    PDFDocument *document = [[PDFDocument alloc] initWithURL:url];

    dispatch_async(dispatch_get_main_queue(), ^{
      if (document) {
        self.pdfDocument = document;
        self.pdfView.document = document;

        if (self.onReady) {
          self.onReady(@{
            @"totalPages": @(document.pageCount)
          });
        }
        [self sendHistoryStateChangeEvent];
      } else {
        [self sendError:@"LOAD_FAILED" message:@"Failed to load PDF document"];
      }
    });
  });
}

// MARK: - Page Navigation

- (void)setCurrentPage:(NSInteger)page
{
  if (self.pdfDocument && page >= 0 && page < self.pdfDocument.pageCount) {
    PDFPage *pdfPage = [self.pdfDocument pageAtIndex:page];
    [self.pdfView goToPage:pdfPage];
  }
}

- (void)goToPage:(NSInteger)page
{
  [self setCurrentPage:page];
}

- (void)setDrawingTool:(NSString *)tool
{
  self.currentTool = tool;
  NSLog(@"[NativePDFView] Setting drawing tool to: %@", tool);

  // 清理之前工具的状态
  [self cleanupCurrentTool];

  // 所有工具都启用用户交互
    self.pdfView.userInteractionEnabled = YES;
}

- (void)setDrawingColor:(NSString *)color
{
  self.currentStrokeColor = [self colorFromHexString:color];
  NSLog(@"[NativePDFView] Setting color to: %@", color);
}

- (void)setDrawingWidth:(CGFloat)width
{
  self.currentStrokeWidth = width;
  NSLog(@"[NativePDFView] Setting stroke width to: %.2f", width);
}

- (void)setToolConfig:(NSString *)configJson
{
  NSError *error = nil;
  NSDictionary *config = [NSJSONSerialization JSONObjectWithData:[configJson dataUsingEncoding:NSUTF8StringEncoding]
                                                        options:0
                                                          error:&error];
  if (error) {
    NSLog(@"[NativePDFView] Failed to parse tool config: %@", error);
    return;
  }

  self.toolConfig = config;
  NSLog(@"[NativePDFView] Tool config updated: %@", config);

  // 根据配置更新工具设置
  if (config[@"shape"]) {
    self.currentShape = config[@"shape"];
  }
}

- (void)cleanupCurrentTool
{
  // 清理文本输入
  if (self.textInputView) {
    [self.textInputView removeFromSuperview];
    self.textInputView = nil;
  }

  // 清理套索选择
  if (self.lassoLayer) {
    [self.lassoLayer removeFromSuperlayer];
    self.lassoLayer = nil;
  }
  self.lassoPath = nil;
  [self.selectedAnnotations removeAllObjects];

  // 清理形状预览
  if (self.shapePreviewLayer) {
    [self.shapePreviewLayer removeFromSuperlayer];
    self.shapePreviewLayer = nil;
  }

  // 清理激光笔
  if (self.laserLayer) {
    [self.laserLayer removeFromSuperlayer];
    self.laserLayer = nil;
  }
  if (self.laserFadeTimer) {
    [self.laserFadeTimer invalidate];
    self.laserFadeTimer = nil;
  }
}

- (void)setScale:(CGFloat)scale focalPoint:(CGPoint)focalPoint
{
  // 保持焦点不动的缩放
  CGFloat oldScale = self.pdfView.scaleFactor;
  CGPoint convertedPoint = [self.pdfView convertPoint:focalPoint toPage:self.pdfView.currentPage];

  CGFloat clampedScale = MAX(kUnifiedMinScale, MIN(kUnifiedMaxScale, scale));
  self.pdfView.scaleFactor = clampedScale;

  // 调整滚动位置使焦点保持不变
  CGPoint newPoint = [self.pdfView convertPoint:convertedPoint fromPage:self.pdfView.currentPage];
  CGPoint offset = self.pdfView.documentView.contentOffset;
  offset.x += (newPoint.x - focalPoint.x);
  offset.y += (newPoint.y - focalPoint.y);
  [self.pdfView.documentView setContentOffset:offset animated:NO];
  if (fabs(oldScale - clampedScale) > 0.0001) {
    [self emitZoomChange];
  }
}

// MARK: - Handwriting (Ink Annotations)

- (void)handleLongPress:(UILongPressGestureRecognizer *)gesture
{
  CGPoint location = [gesture locationInView:self.pdfView];
  PDFPage *page = [self.pdfView pageForPoint:location nearest:YES];
  CGPoint pagePoint = [self.pdfView convertPoint:location toPage:page];

  // ✅ 确保页面有效
  if (!page) {
    NSLog(@"[NativePDFView] 警告: 无法获取有效页面，跳过触摸事件");
    return;
  }

  // 获取当前页面索引用于调试
  NSInteger pageIndex = [self.pdfDocument indexForPage:page];

  // 调试日志
  NSLog(@"[NativePDFView] 触摸事件: 状态=%ld, 工具=%@, 页面=%ld, 坐标=(%.2f, %.2f)",
        (long)gesture.state, self.currentTool, (long)pageIndex, pagePoint.x, pagePoint.y);

  switch (gesture.state) {
    case UIGestureRecognizerStateBegan:
      [self handleTouchDownAtPoint:pagePoint onPage:page];
      break;

    case UIGestureRecognizerStateChanged:
      [self handleTouchMoveToPoint:pagePoint];
      break;

    case UIGestureRecognizerStateEnded:
    case UIGestureRecognizerStateCancelled:
      [self handleTouchUpAtPoint:pagePoint onPage:page];
      break;

    default:
      break;
  }
}

// 根据工具类型处理触摸事件
- (CGFloat)resolvedBaseWidthForCurrentTool
{
  if ([self.currentTool isEqualToString:@"highlighter"] || [self.currentTool isEqualToString:@"marker"]) {
    return self.currentStrokeWidth * 2.0;
  }
  if ([self.currentTool isEqualToString:@"pencil"]) {
    return self.currentStrokeWidth * 0.8;
  }
  if ([self.currentTool isEqualToString:@"brush"]) {
    return self.currentStrokeWidth * 1.5;
  }
  return self.currentStrokeWidth;
}

- (CGFloat)clampedStrokeIntensity:(CGFloat)intensity
{
  return MAX(0.6, MIN(1.8, intensity));
}

- (CGFloat)dynamicStrokeWidthWithIntensity:(CGFloat)intensity
{
  CGFloat baseWidth = [self resolvedBaseWidthForCurrentTool];
  return MAX(0.5, baseWidth * [self clampedStrokeIntensity:intensity]);
}

- (void)handleTouchDownAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  // 在开始新操作前，清除之前的套索选择
  if (self.lassoLayer) {
    [self clearSelection];
  }

  NSLog(@"[NativePDFView] Touch down: tool=%@, x=%.2f, y=%.2f", self.currentTool, point.x, point.y);

  if ([self.currentTool isEqualToString:@"pen"] ||
      [self.currentTool isEqualToString:@"highlighter"] ||
      [self.currentTool isEqualToString:@"marker"] ||
      [self.currentTool isEqualToString:@"pencil"] ||
      [self.currentTool isEqualToString:@"brush"]) {
    [self startDrawingAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"eraser"]) {
    [self startErasingAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    [self startTextInputAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"select"] || [self.currentTool isEqualToString:@"lasso"]) {
    [self startSelectionAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"shape"]) {
    [self startShapeAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"laser"]) {
    [self startLaserAtPoint:point onPage:page];
  } else {
    NSLog(@"[NativePDFView] Unknown tool type: %@, defaulting to drawing", self.currentTool);
    [self startDrawingAtPoint:point onPage:page];
  }
}

- (void)handleTouchMoveToPoint:(CGPoint)point
{
  if ([self.currentTool isEqualToString:@"pen"] ||
      [self.currentTool isEqualToString:@"highlighter"] ||
      [self.currentTool isEqualToString:@"marker"] ||
      [self.currentTool isEqualToString:@"pencil"] ||
      [self.currentTool isEqualToString:@"brush"]) {
    [self continueDrawingToPoint:point];
  } else if ([self.currentTool isEqualToString:@"eraser"]) {
    [self continueErasingToPoint:point];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    // 文本工具不需要移动处理
  } else if ([self.currentTool isEqualToString:@"select"] || [self.currentTool isEqualToString:@"lasso"]) {
    [self continueSelectionToPoint:point];
  } else if ([self.currentTool isEqualToString:@"shape"]) {
    [self continueShapeToPoint:point];
  } else if ([self.currentTool isEqualToString:@"laser"]) {
    [self continueLaserToPoint:point];
  } else {
    [self continueDrawingToPoint:point];
  }
}

- (void)handleTouchUpAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Touch up: tool=%@, x=%.2f, y=%.2f", self.currentTool, point.x, point.y);

  if ([self.currentTool isEqualToString:@"pen"] ||
      [self.currentTool isEqualToString:@"highlighter"] ||
      [self.currentTool isEqualToString:@"marker"] ||
      [self.currentTool isEqualToString:@"pencil"] ||
      [self.currentTool isEqualToString:@"brush"]) {
    [self endDrawingOnPage:page];
  } else if ([self.currentTool isEqualToString:@"eraser"]) {
    [self endErasingOnPage:page];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    [self endTextInputAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"select"] || [self.currentTool isEqualToString:@"lasso"]) {
    [self endSelectionAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"shape"]) {
    [self endShapeAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"laser"]) {
    [self endLaserOnPage:page];
  } else {
    [self endDrawingOnPage:page];
  }
}

// 绘制操作
- (void)startDrawingAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  self.currentStrokePath = [UIBezierPath bezierPath];
  self.currentStrokePath.lineCapStyle = kCGLineCapRound;
  self.currentStrokePath.lineJoinStyle = kCGLineJoinRound;
  [self.currentStrokePath moveToPoint:point];

  [self.currentStrokePoints removeAllObjects];
  [self.currentStrokePoints addObject:[NSValue valueWithCGPoint:point]];

  self.lastStrokePoint = point;
  self.lastStrokeIntensity = 1.0;
  self.activeStrokeWidth = [self dynamicStrokeWidthWithIntensity:self.lastStrokeIntensity];
  self.currentStrokePath.lineWidth = self.activeStrokeWidth;

  // 创建实时绘制层
  self.currentStrokeLayer = [CAShapeLayer layer];
  self.currentStrokeLayer.strokeColor = self.currentStrokeColor.CGColor;
  self.currentStrokeLayer.fillColor = nil;
  self.currentStrokeLayer.lineWidth = self.activeStrokeWidth;
  self.currentStrokeLayer.lineCap = kCALineCapRound;
  self.currentStrokeLayer.lineJoin = kCALineJoinRound;
  self.currentStrokeLayer.opacity = 1.0;

  if ([self.currentTool isEqualToString:@"highlighter"] || [self.currentTool isEqualToString:@"marker"]) {
    self.currentStrokeLayer.opacity = 0.5;
  } else if ([self.currentTool isEqualToString:@"pencil"]) {
    self.currentStrokeLayer.opacity = 0.7;
  }

  NSLog(@"[NativePDFView] Started drawing with %@: color=%@, width=%.2f, alpha=%.2f",
        self.currentTool, self.currentStrokeColor, self.currentStrokeLayer.lineWidth, self.currentStrokeLayer.opacity);

  [self.pdfView.layer addSublayer:self.currentStrokeLayer];
}

- (void)continueDrawingToPoint:(CGPoint)point
{
  if (!self.currentStrokePath) return;

  CGFloat dx = point.x - self.lastStrokePoint.x;
  CGFloat dy = point.y - self.lastStrokePoint.y;
  CGFloat distance = sqrt(dx * dx + dy * dy);
  CGFloat speedFactor = MIN(distance / 6.0, 1.2);
  CGFloat intensity = [self clampedStrokeIntensity:(1.0 + speedFactor * 0.35)];

  self.activeStrokeWidth = [self dynamicStrokeWidthWithIntensity:intensity];
  self.currentStrokeLayer.lineWidth = self.activeStrokeWidth;

  CGPoint midPoint = CGPointMake((self.lastStrokePoint.x + point.x) * 0.5,
                                 (self.lastStrokePoint.y + point.y) * 0.5);
  [self.currentStrokePath addQuadCurveToPoint:midPoint controlPoint:self.lastStrokePoint];
  [self.currentStrokePoints addObject:[NSValue valueWithCGPoint:point]];

  self.currentStrokeLayer.path = self.currentStrokePath.CGPath;
  self.lastStrokePoint = point;
  self.lastStrokeIntensity = intensity;
}

- (void)endDrawingOnPage:(PDFPage *)page
{
  if (!self.currentStrokePath || !page) return;

  // ✅ 确保页面有效且笔迹点不为空
  if (self.currentStrokePoints.count == 0) {
    NSLog(@"[NativePDFView] 警告: 笔迹点为空，跳过保存");
    return;
  }

  // 创建PDF注释
  PDFAnnotation *annotation = [[PDFAnnotation alloc] initWithBounds:page.boundsForBox:kPDFDisplayBoxMediaBox
                                                      forType:PDFAnnotationSubtypeInk];
  annotation.color = self.currentStrokeColor;

  // 转换点坐标
  NSMutableArray *inkPoints = [NSMutableArray array];
  for (NSValue *pointValue in self.currentStrokePoints) {
    CGPoint point = [pointValue CGPointValue];
    [inkPoints addObject:[NSValue valueWithCGPoint:point]];
  }
  annotation.inklist = inkPoints;

  PDFBorder *border = [[PDFBorder alloc] init];
  border.lineWidth = self.activeStrokeWidth > 0 ? self.activeStrokeWidth : self.currentStrokeWidth;
  annotation.border = border;

  // ✅ 确保注释正确添加到页面
  [page addAnnotation:annotation];
  [self.inkAnnotations addObject:annotation];

  // 获取当前页面索引用于调试
  NSInteger pageIndex = [self.pdfDocument indexForPage:page];
  NSLog(@"[NativePDFView] 笔迹已保存到页面 %ld: 笔迹点数=%lu, 工具=%@",
        (long)pageIndex, (unsigned long)self.currentStrokePoints.count, self.currentTool);

  // 发送笔迹提交事件
  NSString *strokeId = [[NSUUID UUID] UUIDString];
  [self sendStrokeCommittedEvent:strokeId];
  [self sendHistoryStateChangeEvent];
  annotation.userName = strokeId; // Use userName (/T key) to store a unique ID


  // 清理
  [self.currentStrokeLayer removeFromSuperlayer];
  self.currentStrokeLayer = nil;
  self.currentStrokePath = nil;
  self.lastStrokeIntensity = 1.0;
  self.activeStrokeWidth = 0;
  self.lastStrokePoint = CGPointZero;
  [self.currentStrokePoints removeAllObjects];
}

// 橡皮擦操作
- (void)startErasingAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started erasing at (%.2f, %.2f)", point.x, point.y);
  self.currentEraserPage = page;
  [self.annotationsToRemove removeAllObjects];
  [self eraseNearPoint:point onPage:page];
}

- (void)continueErasingToPoint:(CGPoint)point
{
  if (self.currentEraserPage) {
    [self eraseNearPoint:point onPage:self.currentEraserPage];
  }
}

- (void)endErasingOnPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Ended erasing, removed %lu annotations", (unsigned long)self.annotationsToRemove.count);
  [self.annotationsToRemove removeAllObjects];
  self.currentEraserPage = nil;
}

- (void)eraseNearPoint:(CGPoint)point onPage:(PDFPage *)page
{
  if (!page) return;

  // 橡皮擦半径
  CGFloat eraserRadius = self.currentStrokeWidth * 3;

  // 检查所有墨迹注释
  NSArray *annotations = [page.annotations copy];
  for (PDFAnnotation *annotation in annotations) {
    if ([annotation.type isEqualToString:PDFAnnotationSubtypeInk]) {
      // 避免重复删除
      if ([self.annotationsToRemove containsObject:annotation]) {
        continue;
      }

      // 获取注释的路径点
      NSArray *inkPoints = annotation.inklist;
      if (!inkPoints || inkPoints.count == 0) {
        continue;
      }

      // 检查橡皮擦点是否与注释路径相交
      BOOL shouldErase = NO;

      // 方法1: 检查点是否在注释边界内且距离路径足够近
      CGRect annotationBounds = annotation.bounds;
      if (CGRectContainsPoint(annotationBounds, point)) {
        // 计算点到路径的最短距离
        CGFloat minDistance = CGFLOAT_MAX;

        for (NSInteger i = 0; i < inkPoints.count - 1; i++) {
          CGPoint p1 = [inkPoints[i] CGPointValue];
          CGPoint p2 = [inkPoints[i + 1] CGPointValue];

          CGFloat distance = [self distanceFromPoint:point toLineSegmentFrom:p1 to:p2];
          minDistance = MIN(minDistance, distance);
        }

        if (minDistance <= eraserRadius) {
          shouldErase = YES;
        }
      }

      // 方法2: 如果注释边界与橡皮擦区域相交，也考虑删除
      if (!shouldErase) {
        CGRect eraserRect = CGRectMake(point.x - eraserRadius, point.y - eraserRadius,
                                     eraserRadius * 2, eraserRadius * 2);
        if (CGRectIntersectsRect(annotationBounds, eraserRect)) {
          // 对于相交的注释，检查是否有足够的重叠
          CGRect intersection = CGRectIntersection(annotationBounds, eraserRect);
          CGFloat intersectionArea = intersection.size.width * intersection.size.height;
          CGFloat annotationArea = annotationBounds.size.width * annotationBounds.size.height;

          if (intersectionArea > annotationArea * 0.3) { // 30%重叠就删除
            shouldErase = YES;
          }
        }
      }

      if (shouldErase) {
        [page removeAnnotation:annotation];
        [self.annotationsToRemove addObject:annotation];
        NSLog(@"[NativePDFView] Erased annotation at (%.2f, %.2f)", point.x, point.y);
      }
    }
  }
}

// 计算点到线段的最短距离
- (CGFloat)distanceFromPoint:(CGPoint)point toLineSegmentFrom:(CGPoint)start to:(CGPoint)end
{
  CGPoint line = CGPointMake(end.x - start.x, end.y - start.y);
  CGPoint pointToStart = CGPointMake(point.x - start.x, point.y - start.y);

  CGFloat lineLengthSquared = line.x * line.x + line.y * line.y;

  if (lineLengthSquared == 0) {
    // 线段退化为点
    return sqrt(pointToStart.x * pointToStart.x + pointToStart.y * pointToStart.y);
  }

  CGFloat t = MAX(0, MIN(1, (pointToStart.x * line.x + pointToStart.y * line.y) / lineLengthSquared));

  CGPoint projection = CGPointMake(start.x + t * line.x, start.y + t * line.y);
  CGPoint diff = CGPointMake(point.x - projection.x, point.y - projection.y);

  return sqrt(diff.x * diff.x + diff.y * diff.y);
}

// 文本输入操作
- (void)startTextInputAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started text input at (%.2f, %.2f)", point.x, point.y);

  self.textInputPage = page;
  self.textInputPoint = point;

  // 创建文本输入框
  CGFloat width = 200;
  CGFloat height = 100;
  CGRect textFrame = CGRectMake(point.x, point.y, width, height);

  self.textInputView = [[UITextView alloc] initWithFrame:textFrame];
  self.textInputView.delegate = self;
  self.textInputView.font = [UIFont systemFontOfSize:16];
  self.textInputView.textColor = self.currentStrokeColor;
  self.textInputView.backgroundColor = [[UIColor whiteColor] colorWithAlphaComponent:0.9];
  self.textInputView.layer.borderColor = self.currentStrokeColor.CGColor;
  self.textInputView.layer.borderWidth = 2.0;
  self.textInputView.layer.cornerRadius = 4.0;
  self.textInputView.returnKeyType = UIReturnKeyDone;

  [self.pdfView addSubview:self.textInputView];
  [self.textInputView becomeFirstResponder];
}

- (void)endTextInputAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  if (!self.textInputView || !self.textInputPage) {
    return;
  }

  NSString *text = self.textInputView.text;
  NSLog(@"[NativePDFView] Ended text input: %@", text);

  if (text.length > 0) {
    // 将屏幕坐标转换为PDF页面坐标
    CGPoint pagePoint = [self.pdfView convertPoint:self.textInputPoint toPage:self.textInputPage];

    // 创建文本注释
    CGRect textBounds = CGRectMake(pagePoint.x, pagePoint.y, 200, 100);
    PDFAnnotation *annotation = [[PDFAnnotation alloc] initWithBounds:textBounds
                                                            forType:PDFAnnotationSubtypeFreeText];

    // 设置文本属性
    annotation.fontColor = self.currentStrokeColor;
    annotation.color = [UIColor clearColor]; // 背景透明

    // 设置文本内容
    if ([annotation respondsToSelector:@selector(setContents:)]) {
      annotation.contents = text;
    }

    // 设置字体
    if ([annotation respondsToSelector:@selector(setFont:)]) {
      UIFont *font = [UIFont systemFontOfSize:16];
      [annotation performSelector:@selector(setFont:) withObject:font];
    }

    // 设置文本对齐
    if ([annotation respondsToSelector:@selector(setAlignment:)]) {
      [annotation performSelector:@selector(setAlignment:) withObject:@(NSTextAlignmentLeft)];
    }

    [self.textInputPage addAnnotation:annotation];
    NSLog(@"[NativePDFView] Added text annotation: %@ at (%.2f, %.2f)", text, pagePoint.x, pagePoint.y);

    // 发送笔迹提交事件
    NSString *strokeId = [[NSUUID UUID] UUIDString];
    [self sendStrokeCommittedEvent:strokeId];
    [self sendHistoryStateChangeEvent];
  }

  // 清理文本输入框
  [self.textInputView removeFromSuperview];
  self.textInputView = nil;
  self.textInputPage = nil;
}

// UITextViewDelegate
- (BOOL)textView:(UITextView *)textView shouldChangeTextInRange:(NSRange)range replacementText:(NSString *)text
{
  if ([text isEqualToString:@"\n"]) {
    [textView resignFirstResponder];
    [self endTextInputAtPoint:self.textInputPoint onPage:self.textInputPage];
    return NO;
  }
  return YES;
}

// 选择操作（套索）
- (void)startSelectionAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started lasso selection at (%.2f, %.2f)", point.x, point.y);

  self.lassoPage = page;
  self.lassoPath = [UIBezierPath bezierPath];
  [self.lassoPath moveToPoint:point];

  // 创建套索可视化层
  self.lassoLayer = [CAShapeLayer layer];
  self.lassoLayer.strokeColor = [UIColor blueColor].CGColor;
  self.lassoLayer.fillColor = [[UIColor blueColor] colorWithAlphaComponent:0.1].CGColor;
  self.lassoLayer.lineWidth = 2.0;
  self.lassoLayer.lineDashPattern = @[@5, @3]; // 虚线

  [self.pdfView.layer addSublayer:self.lassoLayer];
}

- (void)continueSelectionToPoint:(CGPoint)point
{
  if (!self.lassoPath) return;

  [self.lassoPath addLineToPoint:point];
  self.lassoLayer.path = self.lassoPath.CGPath;
}

- (void)endSelectionAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  if (!self.lassoPath || !self.lassoPage) return;

  // 闭合套索路径
  [self.lassoPath closePath];
  self.lassoLayer.path = self.lassoPath.CGPath;

  NSLog(@"[NativePDFView] Ended lasso selection");

  // 查找套索内的注释
  [self.selectedAnnotations removeAllObjects];
  NSArray *annotations = [self.lassoPage.annotations copy];

  for (PDFAnnotation *annotation in annotations) {
    if ([annotation.type isEqualToString:PDFAnnotationSubtypeInk]) {
      // 检查注释是否与套索路径相交
      BOOL isSelected = [self isAnnotationSelected:annotation byLassoPath:self.lassoPath];

      if (isSelected) {
        [self.selectedAnnotations addObject:annotation];
        NSLog(@"[NativePDFView] Selected annotation");
      }
    }
  }

  NSLog(@"[NativePDFView] Selected %lu annotations", (unsigned long)self.selectedAnnotations.count);

  // 高亮显示选中的注释
  if (self.selectedAnnotations.count > 0) {
    self.lassoLayer.strokeColor = [UIColor greenColor].CGColor;
    self.lassoLayer.fillColor = [[UIColor greenColor] colorWithAlphaComponent:0.2].CGColor;

    // 为选中的注释添加高亮效果
    for (PDFAnnotation *annotation in self.selectedAnnotations) {
      [self highlightAnnotation:annotation];
    }
    // 保持选中状态，直到用户执行下一步操作
  } else {
    // 没有选中任何内容，立即清除套索
    [self clearSelection];
  }
}

// 检查注释是否被套索选中
- (BOOL)isAnnotationSelected:(PDFAnnotation *)annotation byLassoPath:(UIBezierPath *)lassoPath
{
  CGRect bounds = annotation.bounds;

  // 方法1: 检查注释中心点是否在套索内
  CGPoint center = CGPointMake(CGRectGetMidX(bounds), CGRectGetMidY(bounds));
  if ([lassoPath containsPoint:center]) {
    return YES;
  }

  // 方法2: 检查注释的四个角点
  CGPoint topLeft = CGPointMake(bounds.origin.x, bounds.origin.y);
  CGPoint topRight = CGPointMake(bounds.origin.x + bounds.size.width, bounds.origin.y);
  CGPoint bottomLeft = CGPointMake(bounds.origin.x, bounds.origin.y + bounds.size.height);
  CGPoint bottomRight = CGPointMake(bounds.origin.x + bounds.size.width, bounds.origin.y + bounds.size.height);

  int pointsInside = 0;
  if ([lassoPath containsPoint:topLeft]) pointsInside++;
  if ([lassoPath containsPoint:topRight]) pointsInside++;
  if ([lassoPath containsPoint:bottomLeft]) pointsInside++;
  if ([lassoPath containsPoint:bottomRight]) pointsInside++;

  // 如果超过一半的角点在套索内，则认为被选中
  return pointsInside >= 2;
}

// 高亮显示选中的注释
- (void)highlightAnnotation:(PDFAnnotation *)annotation
{
  // 创建高亮层
  CAShapeLayer *highlightLayer = [CAShapeLayer layer];
  highlightLayer.strokeColor = [UIColor yellowColor].CGColor;
  highlightLayer.fillColor = [[UIColor yellowColor] colorWithAlphaComponent:0.2].CGColor;
  highlightLayer.lineWidth = 2.0;
  highlightLayer.lineDashPattern = @[@3, @3];

  // 使用注释的边界作为高亮路径
  UIBezierPath *highlightPath = [UIBezierPath bezierPathWithRect:annotation.bounds];
  highlightLayer.path = highlightPath.CGPath;

  [self.pdfView.layer addSublayer:highlightLayer];

  // 3秒后移除高亮
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [highlightLayer removeFromSuperlayer];
  });
}

// 清除选择
- (void)clearSelection
{
  [self.lassoLayer removeFromSuperlayer];
  self.lassoLayer = nil;
  self.lassoPath = nil;
  [self.selectedAnnotations removeAllObjects];
}

// 形状工具
- (void)startShapeAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started drawing shape: %@", self.currentShape);

  self.shapeStartPoint = point;

  // 创建形状预览层
  self.shapePreviewLayer = [CAShapeLayer layer];
  self.shapePreviewLayer.strokeColor = self.currentStrokeColor.CGColor;
  self.shapePreviewLayer.fillColor = nil;
  self.shapePreviewLayer.lineWidth = self.currentStrokeWidth;
  self.shapePreviewLayer.lineCap = kCALineCapRound;

  [self.pdfView.layer addSublayer:self.shapePreviewLayer];
}

- (void)continueShapeToPoint:(CGPoint)point
{
  if (!self.shapePreviewLayer) return;

  UIBezierPath *shapePath = [self createShapePathFrom:self.shapeStartPoint to:point];
  self.shapePreviewLayer.path = shapePath.CGPath;
}

- (void)endShapeAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  if (!self.shapePreviewLayer || !page) return;

  NSLog(@"[NativePDFView] Ended drawing shape: %@", self.currentShape);

  // 创建最终形状路径
  UIBezierPath *shapePath = [self createShapePathFrom:self.shapeStartPoint to:point];

  // 创建PDF墨迹注释
  PDFAnnotation *annotation = [[PDFAnnotation alloc] initWithBounds:page.boundsForBox:kPDFDisplayBoxMediaBox
                                                      forType:PDFAnnotationSubtypeInk];
  annotation.color = self.currentStrokeColor;

  NSMutableArray *bezierPaths = [NSMutableArray array];
  [bezierPaths addObject:shapePath];

  if ([annotation respondsToSelector:@selector(setPaths:)]) {
    [annotation performSelector:@selector(setPaths:) withObject:bezierPaths];
  }

  [page addAnnotation:annotation];
  [self.inkAnnotations addObject:annotation];

  // 清理预览层
  [self.shapePreviewLayer removeFromSuperlayer];
  self.shapePreviewLayer = nil;

  // 通知RN层
  NSString *strokeId = [[NSUUID UUID] UUIDString];
  [self sendStrokeCommittedEvent:strokeId];
  [self sendHistoryStateChangeEvent];
}

- (UIBezierPath *)createShapePathFrom:(CGPoint)start to:(CGPoint)end
{
  UIBezierPath *path = [UIBezierPath bezierPath];
  path.lineWidth = self.currentStrokeWidth;
  path.lineCapStyle = kCGLineCapRound;
  path.lineJoinStyle = kCGLineJoinRound;

  if ([self.currentShape isEqualToString:@"line"]) {
    // 直线
    [path moveToPoint:start];
    [path addLineToPoint:end];
  } else if ([self.currentShape isEqualToString:@"rectangle"]) {
    // 矩形
    CGRect rect = CGRectMake(MIN(start.x, end.x), MIN(start.y, end.y),
                            ABS(end.x - start.x), ABS(end.y - start.y));
    [path appendPath:[UIBezierPath bezierPathWithRect:rect]];
  } else if ([self.currentShape isEqualToString:@"circle"]) {
    // 圆形
    CGRect rect = CGRectMake(MIN(start.x, end.x), MIN(start.y, end.y),
                            ABS(end.x - start.x), ABS(end.y - start.y));
    [path appendPath:[UIBezierPath bezierPathWithOvalInRect:rect]];
  } else if ([self.currentShape isEqualToString:@"arrow"]) {
    // 箭头
    [path moveToPoint:start];
    [path addLineToPoint:end];

    // 计算箭头角度
    CGFloat angle = atan2(end.y - start.y, end.x - start.x);
    CGFloat arrowLength = 15.0;
    CGFloat arrowAngle = M_PI / 6; // 30度

    CGPoint arrowPoint1 = CGPointMake(
      end.x - arrowLength * cos(angle - arrowAngle),
      end.y - arrowLength * sin(angle - arrowAngle)
    );
    CGPoint arrowPoint2 = CGPointMake(
      end.x - arrowLength * cos(angle + arrowAngle),
      end.y - arrowLength * sin(angle + arrowAngle)
    );

    [path moveToPoint:end];
    [path addLineToPoint:arrowPoint1];
    [path moveToPoint:end];
    [path addLineToPoint:arrowPoint2];
  } else if ([self.currentShape isEqualToString:@"triangle"]) {
    // 三角形
    CGFloat midX = (start.x + end.x) / 2;
    [path moveToPoint:CGPointMake(midX, start.y)];
    [path addLineToPoint:CGPointMake(start.x, end.y)];
    [path addLineToPoint:CGPointMake(end.x, end.y)];
    [path closePath];
  } else if ([self.currentShape isEqualToString:@"diamond"]) {
    // 菱形
    CGFloat midX = (start.x + end.x) / 2;
    CGFloat midY = (start.y + end.y) / 2;
    [path moveToPoint:CGPointMake(midX, start.y)];
    [path addLineToPoint:CGPointMake(end.x, midY)];
    [path addLineToPoint:CGPointMake(midX, end.y)];
    [path addLineToPoint:CGPointMake(start.x, midY)];
    [path closePath];
  } else if ([self.currentShape isEqualToString:@"star"]) {
    // 五角星
    CGFloat centerX = (start.x + end.x) / 2;
    CGFloat centerY = (start.y + end.y) / 2;
    CGFloat radius = MIN(ABS(end.x - start.x), ABS(end.y - start.y)) / 2;

    for (int i = 0; i < 5; i++) {
      CGFloat angle = i * 2 * M_PI / 5 - M_PI / 2; // 从顶部开始
      CGFloat x = centerX + radius * cos(angle);
      CGFloat y = centerY + radius * sin(angle);

      if (i == 0) {
        [path moveToPoint:CGPointMake(x, y)];
      } else {
        [path addLineToPoint:CGPointMake(x, y)];
      }
    }
    [path closePath];
  } else if ([self.currentShape isEqualToString:@"heart"]) {
    // 心形
    CGFloat centerX = (start.x + end.x) / 2;
    CGFloat centerY = (start.y + end.y) / 2;
    CGFloat width = ABS(end.x - start.x) / 2;
    CGFloat height = ABS(end.y - start.y) / 2;

    // 简化的心形路径
    [path moveToPoint:CGPointMake(centerX, centerY + height * 0.3)];
    [path addCurveToPoint:CGPointMake(centerX - width * 0.5, centerY - height * 0.2)
            controlPoint1:CGPointMake(centerX - width * 0.5, centerY + height * 0.1)
            controlPoint2:CGPointMake(centerX - width * 0.5, centerY - height * 0.1)];
    [path addCurveToPoint:CGPointMake(centerX, centerY - height * 0.5)
            controlPoint1:CGPointMake(centerX - width * 0.5, centerY - height * 0.3)
            controlPoint2:CGPointMake(centerX - width * 0.2, centerY - height * 0.5)];
    [path addCurveToPoint:CGPointMake(centerX + width * 0.5, centerY - height * 0.2)
            controlPoint1:CGPointMake(centerX + width * 0.2, centerY - height * 0.5)
            controlPoint2:CGPointMake(centerX + width * 0.5, centerY - height * 0.3)];
    [path addCurveToPoint:CGPointMake(centerX, centerY + height * 0.3)
            controlPoint1:CGPointMake(centerX + width * 0.5, centerY - height * 0.1)
            controlPoint2:CGPointMake(centerX + width * 0.5, centerY + height * 0.1)];
    [path closePath];
  } else {
    // 默认为直线
    [path moveToPoint:start];
    [path addLineToPoint:end];
  }

  return path;
}

// 激光笔工具
- (void)startLaserAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started laser pointer");

  // 创建激光笔路径
  self.currentStrokePath = [UIBezierPath bezierPath];
  [self.currentStrokePath moveToPoint:point];

  // 创建激光笔可视化层（红色，半透明）
  self.laserLayer = [CAShapeLayer layer];
  self.laserLayer.strokeColor = [UIColor redColor].CGColor;
  self.laserLayer.fillColor = nil;
  self.laserLayer.lineWidth = self.currentStrokeWidth * 2;
  self.laserLayer.lineCap = kCALineCapRound;
  self.laserLayer.lineJoin = kCALineJoinRound;
  self.laserLayer.opacity = 0.8;

  [self.pdfView.layer addSublayer:self.laserLayer];
}

- (void)continueLaserToPoint:(CGPoint)point
{
  if (!self.currentStrokePath || !self.laserLayer) return;

  [self.currentStrokePath addLineToPoint:point];
  self.laserLayer.path = self.currentStrokePath.CGPath;
}

- (void)endLaserOnPage:(PDFPage *)page
{
  if (!self.laserLayer) return;

  NSLog(@"[NativePDFView] Ended laser pointer, fading out...");

  // 创建激光笔淡出动画
  CABasicAnimation *fadeAnimation = [CABasicAnimation animationWithKeyPath:@"opacity"];
  fadeAnimation.fromValue = @(0.8);
  fadeAnimation.toValue = @(0.0);
  fadeAnimation.duration = 3.0;
  fadeAnimation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseOut];

  // 添加发光效果
  CABasicAnimation *glowAnimation = [CABasicAnimation animationWithKeyPath:@"shadowOpacity"];
  glowAnimation.fromValue = @(0.5);
  glowAnimation.toValue = @(0.0);
  glowAnimation.duration = 3.0;

  // 添加路径动画（激光笔路径逐渐变细）
  CABasicAnimation *lineWidthAnimation = [CABasicAnimation animationWithKeyPath:@"lineWidth"];
  lineWidthAnimation.fromValue = @(self.currentStrokeWidth * 2);
  lineWidthAnimation.toValue = @(1.0);
  lineWidthAnimation.duration = 3.0;

  // 应用动画
  [self.laserLayer addAnimation:fadeAnimation forKey:@"fadeOut"];
  [self.laserLayer addAnimation:glowAnimation forKey:@"glowOut"];
  [self.laserLayer addAnimation:lineWidthAnimation forKey:@"lineWidthOut"];

  // 动画完成后清理
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    [self.laserLayer removeFromSuperlayer];
    self.laserLayer = nil;
    self.currentStrokePath = nil;
  });
}

// 保持原有的方法名以兼容现有代码
- (void)startStrokeAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  [self startDrawingAtPoint:point onPage:page];
}

- (void)continueStrokeToPoint:(CGPoint)point
{
  [self continueDrawingToPoint:point];
  [self updateFPS];
}

- (void)endStrokeOnPage:(PDFPage *)page
{
  [self endDrawingOnPage:page];
}

// MARK: - Public Methods (从 RN 调用)

- (NSString *)addStrokeWithPoints:(NSArray *)points color:(NSString *)color width:(CGFloat)width
{
  // 解析颜色
  self.currentStrokeColor = [self colorFromHexString:color];
  self.currentStrokeWidth = width;

  // 获取当前页面
  PDFPage *page = self.pdfView.currentPage;
  if (!page || points.count < 2) return nil;

  // 创建路径
  UIBezierPath *path = [UIBezierPath bezierPath];
  path.lineWidth = width;
  path.lineCapStyle = kCGLineCapRound;
  path.lineJoinStyle = kCGLineJoinRound;

  for (NSInteger i = 0; i < points.count; i++) {
    NSDictionary *pointDict = points[i];
    CGFloat x = [pointDict[@"x"] doubleValue];
    CGFloat y = [pointDict[@"y"] doubleValue];
    CGPoint point = CGPointMake(x, y);

    if (i == 0) {
      [path moveToPoint:point];
    } else {
      [path addLineToPoint:point];
    }
  }

  // 创建 PDF 注释
  PDFAnnotation *annotation = [[PDFAnnotation alloc] initWithBounds:page.boundsForBox:kPDFDisplayBoxMediaBox
                                                      forType:PDFAnnotationSubtypeInk];
  annotation.color = self.currentStrokeColor;

  NSMutableArray *bezierPaths = [NSMutableArray array];
  [bezierPaths addObject:path];

  if ([annotation respondsToSelector:@selector(setPaths:)]) {
    [annotation performSelector:@selector(setPaths:) withObject:bezierPaths];
  }

  [page addAnnotation:annotation];
  [self.inkAnnotations addObject:annotation];

  return [[NSUUID UUID] UUIDString];
}

- (BOOL)exportPDFToPath:(NSString *)outputPath
{
  if (!self.pdfDocument) return NO;

  NSURL *url = [NSURL fileURLWithPath:outputPath];
  BOOL ok = [self.pdfDocument writeToURL:url];
  if (ok) {
    [self emitExportCompleteWithOutputPath:outputPath];
  }
  return ok;
}

// 导出完成事件：序列化所有墨迹注释为 JSON 并发送
- (void)emitExportCompleteWithOutputPath:(NSString *)outputPath
{
  if (!self.onExportComplete || !self.pdfDocument) return;

  @try {
    // 构建 { totalPages, pages: [{ page, strokes: [...] }] }
    NSMutableDictionary *annotationsData = [NSMutableDictionary dictionary];
    annotationsData[@"version"] = @"1.0";
    annotationsData[@"totalPages"] = @(self.pdfDocument.pageCount);

    NSMutableArray *pagesArray = [NSMutableArray array];
    for (NSInteger pageIndex = 0; pageIndex < self.pdfDocument.pageCount; pageIndex++) {
      PDFPage *page = [self.pdfDocument pageAtIndex:pageIndex];
      NSArray<PDFAnnotation *> *anns = page.annotations;
      NSMutableArray *strokesArray = [NSMutableArray array];

      for (PDFAnnotation *ann in anns) {
        if (![ann.type isEqualToString:PDFAnnotationSubtypeInk]) continue;

        // 颜色（ARGB转int，与Android一致）
        UIColor *color = ann.color ?: [UIColor blackColor];
        CGFloat r, g, b, a; [color getRed:&r green:&g blue:&b alpha:&a];
        int argb = ((int)(a*255) << 24) | ((int)(r*255) << 16) | ((int)(g*255) << 8) | (int)(b*255);

        // 线宽
        CGFloat width = ann.border ? ann.border.lineWidth : self.currentStrokeWidth;

        // 从 InkList 读取点，序列化为 "x1,y1,x2,y2,..."
        NSArray *inkList = [ann valueForAnnotationKey:@"/InkList"]; // 数组(数组点)
        NSMutableString *pathData = [NSMutableString string];
        if ([inkList isKindOfClass:[NSArray class]] && inkList.count > 0) {
          // 取第一条路径
          NSArray *pts = inkList.firstObject;
          BOOL first = YES;
          for (NSValue *v in pts) {
            CGPoint pt = [v CGPointValue];
            if (!first) [pathData appendString:@","];
            [pathData appendFormat:@"%.2f,%.2f", pt.x, pt.y];
            first = NO;
          }
        }

        NSMutableDictionary *strokeObj = [NSMutableDictionary dictionary];
        strokeObj[@"id"] = [[NSUUID UUID] UUIDString];
        strokeObj[@"toolType"] = self.currentTool ?: @"pen";
        strokeObj[@"color"] = @(argb);
        strokeObj[@"strokeWidth"] = @(width);
        strokeObj[@"alpha"] = @((int)(a*255));
        strokeObj[@"pathData"] = pathData;

        [strokesArray addObject:strokeObj];
      }

      [pagesArray addObject:@{ @"page": @(pageIndex), @"strokes": strokesArray }];
    }

    annotationsData[@"pages"] = pagesArray;

    NSError *err = nil;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:annotationsData options:0 error:&err];
    NSString *jsonStr = err ? @"" : [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];

    self.onExportComplete(@{
      @"outputPath": outputPath ?: @"",
      @"annotationsData": jsonStr ?: @"",
      @"success": @YES
    });
  } @catch (NSException *exception) {
    if (self.onExportComplete) {
      self.onExportComplete(@{ @"outputPath": outputPath ?: @"", @"success": @NO, @"error": exception.reason ?: @"error" });
    }
  }
}

// MARK: - PDFViewDelegate

- (void)handlePageChanged:(NSNotification *)notification
{
  if (self.onPageChange && self.pdfView.currentPage) {
    NSInteger pageIndex = [self.pdfDocument indexForPage:self.pdfView.currentPage];

    // ✅ 添加页面切换调试信息
    NSLog(@"[NativePDFView] 页面切换: %ld/%lu", (long)pageIndex, (unsigned long)self.pdfDocument.pageCount);

    // ✅ 清理当前绘制状态，避免跨页面绘制问题
    if (self.currentStrokeLayer) {
      [self.currentStrokeLayer removeFromSuperlayer];
      self.currentStrokeLayer = nil;
    }
    if (self.currentStrokePath) {
      self.currentStrokePath = nil;
    }
    if (self.currentStrokePoints) {
      [self.currentStrokePoints removeAllObjects];
    }

    self.onPageChange(@{
      @"page": @(pageIndex)
    });
  }
}

// MARK: - Utility Methods

- (UIColor *)colorFromHexString:(NSString *)hexString
{
  unsigned rgbValue = 0;
  NSScanner *scanner = [NSScanner scannerWithString:hexString];
  if ([hexString hasPrefix:@"#"]) {
    [scanner setScanLocation:1];
  }
  [scanner scanHexInt:&rgbValue];

  return [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16)/255.0
                         green:((rgbValue & 0x00FF00) >> 8)/255.0
                          blue:(rgbValue & 0x0000FF)/255.0
                         alpha:1.0];
}

- (void)updateFPS
{
  self.frameCount++;
  CFTimeInterval currentTime = CACurrentMediaTime();
  CFTimeInterval elapsed = currentTime - self.lastFrameTime;

  if (elapsed >= 1.0) {
    self.currentFPS = self.frameCount / elapsed;
    self.frameCount = 0;
    self.lastFrameTime = currentTime;
  }
}

- (CGFloat)getMemoryUsageMB
{
  struct task_basic_info info;
  mach_msg_type_number_t size = sizeof(info);
  kern_return_t kerr = task_info(mach_task_self(), TASK_BASIC_INFO, (task_info_t)&info, &size);

  if (kerr == KERN_SUCCESS) {
    return info.resident_size / 1024.0 / 1024.0;
  }
  return 0;
}

- (void)sendError:(NSString *)code message:(NSString *)message
{
  if (self.onError) {
    self.onError(@{
      @"code": code,
      @"message": message
    });
  }
}

- (void)sendStrokeCommittedEvent:(NSString *)strokeId
{
  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": strokeId,
      @"tool": self.currentTool ?: @"pen"
    });
  }
}

- (void)sendHistoryStateChangeEvent
{
  if (self.onHistoryStateChange) {
    self.onHistoryStateChange(@{
      @"canUndo": @(self.undoStack.count > 0),
      @"canRedo": @(self.redoStack.count > 0)
    });
  }
}

// MARK: - Import Annotations

/**
 * 导入保存的注释数据
 * 期望格式：{totalPages, pages:[{page, strokes:[{id, pathData, color, strokeWidth, alpha, toolType}]}]}
 */
- (void)importAnnotations:(NSString *)annotationsJson
{
  NSLog(@"📥 [NativePDFView] 开始导入注释数据...");

  @try {
    NSError *error = nil;
    NSData *jsonData = [annotationsJson dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *annotationsDict = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];

    if (error) {
      NSLog(@"❌ [NativePDFView] 解析注释JSON失败: %@", error);
      [self sendError:@"PARSE_ERROR" message:[NSString stringWithFormat:@"解析JSON失败: %@", error.localizedDescription]];
      return;
    }

    NSInteger savedTotalPages = [annotationsDict[@"totalPages"] integerValue];
    NSArray *pagesArray = annotationsDict[@"pages"];

    if (!pagesArray) {
      NSLog(@"⚠️ [NativePDFView] 注释数据中没有 pages 数组");
      return;
    }

    NSInteger importedStrokes = 0;

    for (NSDictionary *pageData in pagesArray) {
      NSInteger pageIndex = [pageData[@"page"] integerValue];
      NSArray *strokesArray = pageData[@"strokes"];

      if (!strokesArray || pageIndex < 0 || pageIndex >= self.pdfDocument.pageCount) {
        continue;
      }

      PDFPage *page = [self.pdfDocument pageAtIndex:pageIndex];
      if (!page) {
        continue;
      }

      for (NSDictionary *strokeData in strokesArray) {
        @try {
          // 创建 PDFAnnotation
          PDFAnnotation *annotation = [[PDFAnnotation alloc] initWithBounds:CGRectZero forType:PDFAnnotationSubtypeInk withProperties:nil];

          // 解析路径数据
          NSString *pathDataStr = strokeData[@"pathData"];
          if (!pathDataStr || [pathDataStr length] == 0) {
            continue;
          }

          // 解析颜色
          NSNumber *colorInt = strokeData[@"color"];
          UIColor *strokeColor = [self colorFromInt:[colorInt intValue]];

          // 解析线宽
          CGFloat strokeWidth = [strokeData[@"strokeWidth"] doubleValue];

          // 设置注释属性
          annotation.color = strokeColor;
          annotation.border = [[PDFBorder alloc] init];
          annotation.border.lineWidth = strokeWidth;

          // 解析路径点
          UIBezierPath *path = [self pathFromDataString:pathDataStr];

          if (path) {
            // 将路径添加到注释
            // PDFAnnotation 的 Ink 类型需要 NSArray of NSArray of NSPoint
            NSMutableArray *bezierPaths = [NSMutableArray array];
            NSMutableArray *points = [NSMutableArray array];

            CGPathRef cgPath = path.CGPath;
            CGPathApply(cgPath, (__bridge void *)points, ^(void *info, const CGPathElement *element) {
              NSMutableArray *pts = (__bridge NSMutableArray *)info;
              switch (element->type) {
                case kCGPathElementMoveToPoint:
                case kCGPathElementAddLineToPoint: {
                  CGPoint pt = element->points[0];
                  [pts addObject:[NSValue valueWithCGPoint:pt]];
                  break;
                }
                default:
                  break;
              }
            });

            if (points.count > 0) {
              [bezierPaths addObject:points];

              // 设置注释的 paths
              if ([annotation respondsToSelector:@selector(setValue:forAnnotationKey:)]) {
                [annotation setValue:bezierPaths forAnnotationKey:@"/InkList"];
              }

              // 计算边界框
              CGRect bounds = path.bounds;
              bounds = CGRectInset(bounds, -strokeWidth, -strokeWidth);
              annotation.bounds = bounds;

              // 添加到页面
              [page addAnnotation:annotation];
              [self.inkAnnotations addObject:annotation];

              importedStrokes++;
            }
          }
        } @catch (NSException *exception) {
          NSLog(@"⚠️ [NativePDFView] 导入单个笔迹失败: %@", exception);
        }
      }

      NSLog(@"📄 [NativePDFView] 页面 %ld: 导入 %lu 个笔迹",
            (long)pageIndex, (unsigned long)[strokesArray count]);
    }

    // 刷新显示
    [self.pdfView setNeedsDisplay];

    NSLog(@"✅ [NativePDFView] 注释导入成功，总计 %ld 个笔迹", (long)importedStrokes);

  } @catch (NSException *exception) {
    NSLog(@"❌ [NativePDFView] 导入注释失败: %@", exception);
    [self sendError:@"IMPORT_FAILED" message:[NSString stringWithFormat:@"导入失败: %@", exception.reason]];
  }
}

/**
 * 从整数创建 UIColor
 */
- (UIColor *)colorFromInt:(int)colorInt
{
  return [UIColor colorWithRed:((colorInt >> 16) & 0xFF) / 255.0
                         green:((colorInt >> 8) & 0xFF) / 255.0
                          blue:(colorInt & 0xFF) / 255.0
                         alpha:((colorInt >> 24) & 0xFF) / 255.0];
}

/**
 * 从字符串数据创建 UIBezierPath
 * 格式: "x1,y1,x2,y2,x3,y3,..."
 */
- (UIBezierPath *)pathFromDataString:(NSString *)pathData
{
  if (!pathData || [pathData length] == 0) {
    return nil;
  }

  NSArray *components = [pathData componentsSeparatedByString:@","];
  if ([components count] < 2) {
    return nil;
  }

  UIBezierPath *path = [UIBezierPath bezierPath];

  // 第一个点
  CGFloat x = [components[0] floatValue];
  CGFloat y = [components[1] floatValue];
  [path moveToPoint:CGPointMake(x, y)];

  // 后续点
  for (NSInteger i = 2; i < [components count]; i += 2) {
    if (i + 1 < [components count]) {
      x = [components[i] floatValue];
      y = [components[i + 1] floatValue];
      [path addLineToPoint:CGPointMake(x, y)];
    }
  }

  return path;
}

// MARK: - Cleanup

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
  if (self.isObservingScaleFactor) {
    @try {
      [self.pdfView removeObserver:self forKeyPath:@"scaleFactor"];
    } @catch (NSException *exception) {
      NSLog(@"[NativePDFView] removeObserver(scaleFactor) ignored: %@", exception.reason);
    }
    self.isObservingScaleFactor = NO;
  }
}

// MARK: - Handwriting Recognition

- (void)recognizeHandwriting:(NSString *)strokeId
{
  if (!strokeId || [strokeId length] == 0) {
    return;
  }

  // 1. Find the annotation on the current page
  PDFPage *currentPage = [self.pdfView currentPage];
  if (!currentPage) return;

  PDFAnnotation *targetAnnotation = nil;
  for (PDFAnnotation *annotation in [currentPage annotations]) {
    if ([annotation.userName isEqualToString:strokeId]) {
      targetAnnotation = annotation;
      break;
    }
  }

  if (!targetAnnotation || ![targetAnnotation.type isEqualToString:PDFAnnotationSubtypeInk]) {
    NSLog(@"[NativePDFView] Handwriting recognition: Annotation not found or not an ink annotation for strokeId: %@", strokeId);
    return;
  }

  // 2. Render the annotation path to an image
  UIBezierPath *path = [targetAnnotation.paths firstObject];
  if (!path) return;

  CGRect boundingBox = path.bounds;
  CGFloat padding = 20.0;
  CGRect imageRect = CGRectInset(boundingBox, -padding, -padding);

  UIGraphicsBeginImageContextWithOptions(imageRect.size, NO, [UIScreen mainScreen].scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  // Fill background with white
  CGContextSetFillColorWithColor(context, [UIColor whiteColor].CGColor);
  CGContextFillRect(context, CGRectMake(0, 0, imageRect.size.width, imageRect.size.height));

  // Translate context to draw the path correctly
  CGContextTranslateCTM(context, -imageRect.origin.x, -imageRect.origin.y);

  // Set stroke properties from annotation
  CGContextSetStrokeColorWithColor(context, targetAnnotation.color.CGColor);
  CGContextSetLineWidth(context, targetAnnotation.border.lineWidth);
  CGContextSetLineCap(context, kCGLineCapRound);
  CGContextSetLineJoin(context, kCGLineJoinRound);

  // Draw the path
  CGContextAddPath(context, path.CGPath);
  CGContextStrokePath(context);

  UIImage *handwritingImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  if (!handwritingImage) {
    NSLog(@"[NativePDFView] Failed to render handwriting image for strokeId: %@", strokeId);
    return;
  }

  // 3. Use Vision framework to recognize text
  VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull req, NSError * _Nullable err) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (err) {
        NSLog(@"[NativePDFView] Handwriting recognition error: %@", err.localizedDescription);
        return;
      }

      NSMutableString *resultText = [NSMutableString new];
      float totalConfidence = 0.0;
      NSUInteger candidateCount = 0;

      for (VNRecognizedTextObservation *obs in req.results) {
        NSArray<VNRecognizedText *> *candidates = [obs topCandidates:1];
        if (candidates.count > 0) {
          VNRecognizedText *topCandidate = candidates.firstObject;
          [resultText appendString:topCandidate.string];
          [resultText appendString:@" "];
          totalConfidence += topCandidate.confidence;
          candidateCount++;
        }
      }

      float avgConfidence = candidateCount > 0 ? totalConfidence / candidateCount : 0.0;
      NSString *recognizedText = [resultText stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];

      if (self.onHandwritingRecognized) {
        self.onHandwritingRecognized(@{
          @"strokeId": strokeId,
          @"recognizedText": recognizedText ?: @"",
          @"confidence": @(avgConfidence)
        });
      }
    });
  }];

  request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
  request.recognitionLanguages = @[@"zh-Hans", @"en-US"];
  request.usesLanguageCorrection = YES;

  VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:handwritingImage.CGImage options:@{}];

  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError *e = nil;
    [handler performRequests:@[request] error:&e];
    if (e) {
      NSLog(@"[NativePDFView] Failed to perform handwriting recognition request: %@", e.localizedDescription);
    }
  });
}



@end

// MARK: - OCR Extension

// MARK: - Commands

- (void)undo {
  if (self.undoStack.count > 0) {
    // 将当前状态保存到重做栈
    [self.redoStack addObject:[self.inkAnnotations copy]];

    // 恢复上一个状态
    NSArray *previousStrokes = [self.undoStack lastObject];
    [self.undoStack removeLastObject];

    // 移除所有当前笔迹
    for (PDFAnnotation *annotation in self.inkAnnotations) {
      [annotation.page removeAnnotation:annotation];
    }
    [self.inkAnnotations removeAllObjects];

    // 添加恢复的笔迹
    for (PDFAnnotation *annotation in previousStrokes) {
      [annotation.page addAnnotation:annotation];
      [self.inkAnnotations addObject:annotation];
    }

    [self.pdfView setNeedsDisplay];
  }
  [self sendHistoryStateChangeEvent];
}

- (void)redo {
  if (self.redoStack.count > 0) {
    // 将当前状态保存到撤销栈
    [self.undoStack addObject:[self.inkAnnotations copy]];

    // 恢复重做的状态
    NSArray *redoStrokes = [self.redoStack lastObject];
    [self.redoStack removeLastObject];

    // 移除所有当前笔迹
    for (PDFAnnotation *annotation in self.inkAnnotations) {
      [annotation.page removeAnnotation:annotation];
    }
    [self.inkAnnotations removeAllObjects];

    // 添加恢复的笔迹
    for (PDFAnnotation *annotation in redoStrokes) {
      [annotation.page addAnnotation:annotation];
      [self.inkAnnotations addObject:annotation];
    }

    [self.pdfView setNeedsDisplay];
  }
  [self sendHistoryStateChangeEvent];
}

- (void)clear:(NSString *)clearType {
  if ([clearType isEqualToString:@"selected"]) {
    if (self.selectedAnnotations.count > 0) {
      [self.undoStack addObject:[self.inkAnnotations copy]];
      [self.redoStack removeAllObjects];

      for (PDFAnnotation *annotation in self.selectedAnnotations) {
        [annotation.page removeAnnotation:annotation];
        [self.inkAnnotations removeObject:annotation];
      }

      [self clearSelection];
      [self.pdfView setNeedsDisplay];
    }
  } else if ([clearType isEqualToString:@"all"]) {
    [self.undoStack addObject:[self.inkAnnotations copy]];
    [self.redoStack removeAllObjects];

    for (PDFAnnotation *annotation in self.inkAnnotations) {
      [annotation.page removeAnnotation:annotation];
    }
    [self.inkAnnotations removeAllObjects];
    [self.pdfView setNeedsDisplay];
  }
  [self sendHistoryStateChangeEvent];
}

@implementation NativePDFView (OCR)

- (void)recognizeTextInRect:(CGRect)rect completion:(void (^)(NSString *text, NSError *error))completion
{
  UIGraphicsBeginImageContextWithOptions(self.bounds.size, NO, [UIScreen mainScreen].scale);
  [self.layer renderInContext:UIGraphicsGetCurrentContext()];
  UIImage *fullImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  if (!fullImage) {
    if (completion) completion(nil, [NSError errorWithDomain:@"NativePDFView" code:-1 userInfo:@{NSLocalizedDescriptionKey: @"渲染失败"}]);
    return;
  }

  CGRect cropRect = CGRectIntersection(rect, CGRectMake(0, 0, fullImage.size.width, fullImage.size.height));
  if (CGRectIsEmpty(cropRect)) {
    if (completion) completion(@"", nil);
    return;
  }

  CGImageRef cg = CGImageCreateWithImageInRect(fullImage.CGImage, cropRect);
  if (!cg) {
    if (completion) completion(nil, [NSError errorWithDomain:@"NativePDFView" code:-2 userInfo:@{NSLocalizedDescriptionKey: @"裁剪失败"}]);
    return;
  }
  UIImage *regionImage = [UIImage imageWithCGImage:cg];
  CGImageRelease(cg);

  VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull req, NSError * _Nullable err) {
    if (err) {
      if (completion) completion(nil, err);
      return;
    }
    NSMutableString *result = [NSMutableString new];
    for (VNRecognizedTextObservation *obs in req.results) {
      VNRecognizedText *top = [[obs topCandidates:1] firstObject];
      if (top) {
        [result appendString:top.string];
        [result appendString:@"\n"];
      }
    }
    if (completion) completion(result.copy, nil);
  }];
  request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
  request.recognitionLanguages = @[@"zh-Hans", @"en-US"];
  request.usesLanguageCorrection = YES;

  VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:regionImage.CGImage options:@{}];
  NSError *e = nil;
  [handler performRequests:@[request] error:&e];
  if (e && completion) completion(nil, e);
}

@end
