//
//  NativePDFView.m
//  ZeroIsle_Notes
//
//  原生 PDF 视图实现
//  核心功能：瓦片化渲染、手写注释、压感支持
//

#import "NativePDFView.h"
#import <mach/mach.h>

@interface NativePDFView () <PDFViewDelegate, UIGestureRecognizerDelegate>

@property (nonatomic, strong) PDFView *pdfView;
@property (nonatomic, strong) PDFDocument *pdfDocument;
@property (nonatomic, strong) NSMutableArray<PDFAnnotation *> *inkAnnotations;
@property (nonatomic, strong) UIBezierPath *currentStrokePath;
@property (nonatomic, strong) CAShapeLayer *currentStrokeLayer;
@property (nonatomic, strong) UIColor *currentStrokeColor;
@property (nonatomic, assign) CGFloat currentStrokeWidth;
@property (nonatomic, strong) NSMutableArray *currentStrokePoints;

// 性能监控
@property (nonatomic, assign) CFTimeInterval lastFrameTime;
@property (nonatomic, assign) NSInteger frameCount;
@property (nonatomic, assign) CGFloat currentFPS;

@end

@implementation NativePDFView

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
  self.pdfView.minScaleFactor = 0.5;
  self.pdfView.maxScaleFactor = 4.0;
  
  [self addSubview:self.pdfView];
  
  // 监听页面变化
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(handlePageChanged:)
                                               name:PDFViewPageChangedNotification
                                             object:self.pdfView];
}

- (void)setupGestures
{
  // 长按开始手写
  UILongPressGestureRecognizer *longPress = [[UILongPressGestureRecognizer alloc] initWithTarget:self action:@selector(handleLongPress:)];
  longPress.minimumPressDuration = 0.3;
  longPress.delegate = self;
  [self.pdfView addGestureRecognizer:longPress];
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

// MARK: - PDF Loading

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
  // 更新绘制模式
  if ([tool isEqualToString:@"pen"]) {
    self.pdfView.userInteractionEnabled = YES;
  } else if ([tool isEqualToString:@"highlighter"]) {
    self.pdfView.userInteractionEnabled = YES;
  } else if ([tool isEqualToString:@"eraser"]) {
    self.pdfView.userInteractionEnabled = YES;
  }
}

- (void)setDrawingColor:(NSString *)color
{
  self.currentStrokeColor = [self colorFromHexString:color];
}

- (void)setDrawingWidth:(CGFloat)width
{
  self.currentStrokeWidth = width;
}

- (void)setScale:(CGFloat)scale focalPoint:(CGPoint)focalPoint
{
  // 保持焦点不动的缩放
  CGFloat oldScale = self.pdfView.scaleFactor;
  CGPoint convertedPoint = [self.pdfView convertPoint:focalPoint toPage:self.pdfView.currentPage];
  
  self.pdfView.scaleFactor = scale;
  
  // 调整滚动位置使焦点保持不变
  CGPoint newPoint = [self.pdfView convertPoint:convertedPoint fromPage:self.pdfView.currentPage];
  CGPoint offset = self.pdfView.documentView.contentOffset;
  offset.x += (newPoint.x - focalPoint.x);
  offset.y += (newPoint.y - focalPoint.y);
  [self.pdfView.documentView setContentOffset:offset animated:NO];
}

// MARK: - Handwriting (Ink Annotations)

- (void)handleLongPress:(UILongPressGestureRecognizer *)gesture
{
  CGPoint location = [gesture locationInView:self.pdfView];
  PDFPage *page = [self.pdfView pageForPoint:location nearest:YES];
  CGPoint pagePoint = [self.pdfView convertPoint:location toPage:page];
  
  // 调试日志
  NSLog(@"[NativePDFView] Touch event: state=%ld, tool=%@, x=%.2f, y=%.2f", 
        (long)gesture.state, self.currentTool, pagePoint.x, pagePoint.y);
  
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
- (void)handleTouchDownAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Touch down: tool=%@, x=%.2f, y=%.2f", self.currentTool, point.x, point.y);
  
  if ([self.currentTool isEqualToString:@"pen"] || 
      [self.currentTool isEqualToString:@"highlighter"] || 
      [self.currentTool isEqualToString:@"marker"]) {
    [self startDrawingAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"eraser"]) {
    [self startErasingAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    [self startTextInputAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"select"]) {
    [self startSelectionAtPoint:point onPage:page];
  } else {
    NSLog(@"[NativePDFView] Unknown tool type: %@, defaulting to drawing", self.currentTool);
    [self startDrawingAtPoint:point onPage:page];
  }
}

- (void)handleTouchMoveToPoint:(CGPoint)point
{
  if ([self.currentTool isEqualToString:@"pen"] || 
      [self.currentTool isEqualToString:@"highlighter"] || 
      [self.currentTool isEqualToString:@"marker"]) {
    [self continueDrawingToPoint:point];
  } else if ([self.currentTool isEqualToString:@"eraser"]) {
    [self continueErasingToPoint:point];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    // 文本工具不需要移动处理
  } else if ([self.currentTool isEqualToString:@"select"]) {
    [self continueSelectionToPoint:point];
  } else {
    [self continueDrawingToPoint:point];
  }
}

- (void)handleTouchUpAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Touch up: tool=%@, x=%.2f, y=%.2f", self.currentTool, point.x, point.y);
  
  if ([self.currentTool isEqualToString:@"pen"] || 
      [self.currentTool isEqualToString:@"highlighter"] || 
      [self.currentTool isEqualToString:@"marker"]) {
    [self endDrawingOnPage:page];
  } else if ([self.currentTool isEqualToString:@"eraser"]) {
    [self endErasingOnPage:page];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    [self endTextInputAtPoint:point onPage:page];
  } else if ([self.currentTool isEqualToString:@"select"]) {
    [self endSelectionAtPoint:point onPage:page];
  } else {
    [self endDrawingOnPage:page];
  }
}

// 绘制操作
- (void)startDrawingAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  self.currentStrokePath = [UIBezierPath bezierPath];
  self.currentStrokePath.lineWidth = self.currentStrokeWidth;
  self.currentStrokePath.lineCapStyle = kCGLineCapRound;
  self.currentStrokePath.lineJoinStyle = kCGLineJoinRound;
  [self.currentStrokePath moveToPoint:point];
  
  [self.currentStrokePoints removeAllObjects];
  [self.currentStrokePoints addObject:[NSValue valueWithCGPoint:point]];
  
  // 创建实时绘制层
  self.currentStrokeLayer = [CAShapeLayer layer];
  self.currentStrokeLayer.strokeColor = self.currentStrokeColor.CGColor;
  self.currentStrokeLayer.fillColor = nil;
  self.currentStrokeLayer.lineWidth = self.currentStrokeWidth;
  self.currentStrokeLayer.lineCap = kCALineCapRound;
  self.currentStrokeLayer.lineJoin = kCALineJoinRound;
  
  // 高亮笔特殊处理
  if ([self.currentTool isEqualToString:@"highlighter"]) {
    self.currentStrokeLayer.opacity = 0.5; // 半透明
    self.currentStrokeLayer.lineWidth = self.currentStrokeWidth * 2; // 更粗
  }
  
  NSLog(@"[NativePDFView] Started drawing: color=%@, width=%.2f, alpha=%.2f", 
        self.currentStrokeColor, self.currentStrokeWidth, self.currentStrokeLayer.opacity);
  
  [self.pdfView.layer addSublayer:self.currentStrokeLayer];
}

- (void)continueDrawingToPoint:(CGPoint)point
{
  if (!self.currentStrokePath) return;
  
  [self.currentStrokePath addLineToPoint:point];
  [self.currentStrokePoints addObject:[NSValue valueWithCGPoint:point]];
  
  // 更新实时绘制层
  self.currentStrokeLayer.path = self.currentStrokePath.CGPath;
}

- (void)endDrawingOnPage:(PDFPage *)page
{
  if (!self.currentStrokePath) return;
  
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
  
  [page addAnnotation:annotation];
  
  NSLog(@"[NativePDFView] Ended drawing: stroke count=%lu", (unsigned long)self.currentStrokePoints.count);
  
  // 发送笔迹提交事件
  NSString *strokeId = [[NSUUID UUID] UUIDString];
  [self sendStrokeCommittedEvent:strokeId];
  
  // 清理
  [self.currentStrokeLayer removeFromSuperlayer];
  self.currentStrokeLayer = nil;
  self.currentStrokePath = nil;
  [self.currentStrokePoints removeAllObjects];
}

// 橡皮擦操作
- (void)startErasingAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started erasing");
  [self eraseNearPoint:point onPage:page];
}

- (void)continueErasingToPoint:(CGPoint)point
{
  [self eraseNearPoint:point onPage:nil];
}

- (void)endErasingOnPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Ended erasing");
}

- (void)eraseNearPoint:(CGPoint)point onPage:(PDFPage *)page
{
  if (!page) return;
  
  // 简单的橡皮擦实现：删除附近的注释
  NSArray *annotations = [page annotations];
  for (PDFAnnotation *annotation in annotations) {
    if ([annotation.type isEqualToString:PDFAnnotationSubtypeInk]) {
      // 检查注释是否在橡皮擦范围内
      CGRect annotationBounds = annotation.bounds;
      CGFloat eraserRadius = self.currentStrokeWidth * 2;
      CGRect eraserRect = CGRectMake(point.x - eraserRadius, point.y - eraserRadius, 
                                   eraserRadius * 2, eraserRadius * 2);
      
      if (CGRectIntersectsRect(annotationBounds, eraserRect)) {
        [page removeAnnotation:annotation];
        NSLog(@"[NativePDFView] Erased annotation");
      }
    }
  }
}

// 文本输入操作
- (void)startTextInputAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started text input at (%.2f, %.2f)", point.x, point.y);
  // 文本输入逻辑
}

- (void)endTextInputAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Ended text input");
  // 完成文本输入
}

// 选择操作
- (void)startSelectionAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Started selection at (%.2f, %.2f)", point.x, point.y);
  // 选择逻辑
}

- (void)continueSelectionToPoint:(CGPoint)point
{
  // 更新选择区域
}

- (void)endSelectionAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  NSLog(@"[NativePDFView] Ended selection");
  // 完成选择
}

// 保持原有的方法名以兼容现有代码
- (void)startStrokeAtPoint:(CGPoint)point onPage:(PDFPage *)page
{
  [self startDrawingAtPoint:point onPage:page];
}

- (void)continueStrokeToPoint:(CGPoint)point
{
  if (!self.currentStrokePath) return;
  
  [self.currentStrokePath addLineToPoint:point];
  [self.currentStrokePoints addObject:[NSValue valueWithCGPoint:point]];
  
  // 更新实时绘制层
  self.currentStrokeLayer.path = self.currentStrokePath.CGPath;
  
  // 性能监控
  [self updateFPS];
}

- (void)endStrokeOnPage:(PDFPage *)page
{
  if (!self.currentStrokePath || !page) return;
  
  // 移除实时绘制层
  [self.currentStrokeLayer removeFromSuperlayer];
  self.currentStrokeLayer = nil;
  
  // 创建 PDF Ink 注释
  PDFAnnotation *annotation = [[PDFAnnotation alloc] initWithBounds:page.boundsForBox:kPDFDisplayBoxMediaBox
                                                      forType:PDFAnnotationSubtypeInk];
  annotation.color = self.currentStrokeColor;
  
  // 转换路径为注释格式
  NSMutableArray *bezierPaths = [NSMutableArray array];
  [bezierPaths addObject:self.currentStrokePath];
  
  // 设置笔迹路径（使用私有 API 或公开方法）
  if ([annotation respondsToSelector:@selector(setPaths:)]) {
    [annotation performSelector:@selector(setPaths:) withObject:bezierPaths];
  }
  
  [page addAnnotation:annotation];
  [self.inkAnnotations addObject:annotation];
  
  // 通知 RN 层笔迹已提交
  NSString *strokeId = [[NSUUID UUID] UUIDString];
  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": strokeId,
      @"pointCount": @(self.currentStrokePoints.count)
    });
  }
  
  // 清理
  self.currentStrokePath = nil;
  [self.currentStrokePoints removeAllObjects];
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
  return [self.pdfDocument writeToURL:url];
}

// MARK: - PDFViewDelegate

- (void)handlePageChanged:(NSNotification *)notification
{
  if (self.onPageChange && self.pdfView.currentPage) {
    NSInteger pageIndex = [self.pdfDocument indexForPage:self.pdfView.currentPage];
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

// MARK: - Cleanup

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end
