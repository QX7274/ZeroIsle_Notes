//
//  NativePagedNoteView.m
//  ZeroIsle_Notes
//
//  原生分页笔记视图实现
//  Metal 渲染 + 压感支持
//

#import "NativePagedNoteView.h"
#import <Vision/Vision.h>

@interface NativePagedNoteView () <MTKViewDelegate, UITextViewDelegate, UIGestureRecognizerDelegate>

@property (nonatomic, strong) MTKView *metalView;
@property (nonatomic, strong) id<MTLDevice> device;
@property (nonatomic, strong) id<MTLCommandQueue> commandQueue;
@property (nonatomic, strong) NSMutableArray *pages;
@property (nonatomic, assign) NSInteger currentPage;
@property (nonatomic, strong) NSString *noteId;
@property (nonatomic, strong) NSDictionary *styleConfig;
@property (nonatomic, strong) NSString *currentTool;
@property (nonatomic, strong) UIColor *currentColor;
@property (nonatomic, assign) CGFloat currentStrokeWidth;
@property (nonatomic, strong) NSMutableArray *currentStroke;

// 工具相关属性
@property (nonatomic, strong) NSDictionary *toolConfig;
@property (nonatomic, strong) NSString *currentShape;

// 橡皮擦相关
@property (nonatomic, strong) NSMutableSet *erasedStrokeIds;

// 文本输入相关
@property (nonatomic, strong) UITextView *textInputView;
@property (nonatomic, assign) CGPoint textInputPoint;

// 套索选择相关
@property (nonatomic, strong) UIBezierPath *lassoPath;
@property (nonatomic, strong) CAShapeLayer *lassoLayer;
@property (nonatomic, strong) NSMutableArray *selectedStrokes;

// 形状工具相关
@property (nonatomic, assign) CGPoint shapeStartPoint;
@property (nonatomic, strong) CAShapeLayer *shapePreviewLayer;

// 激光笔相关
@property (nonatomic, strong) CAShapeLayer *laserLayer;
@property (nonatomic, strong) NSTimer *laserFadeTimer;

// 撤销/重做相关
@property (nonatomic, strong) NSMutableArray *redoStack;

// 视口与手势状态
@property (nonatomic, assign) CGFloat viewportX;
@property (nonatomic, assign) CGFloat viewportY;
@property (nonatomic, assign) CGFloat viewportScale;
@property (nonatomic, assign) BOOL isCanvasPanning;
@property (nonatomic, assign) CGPoint lastPanTranslation;
@property (nonatomic, assign) CGFloat pinchScaleBaseline;
@property (nonatomic, assign) BOOL suppressTouchStroke;

@end

@implementation NativePagedNoteView

- (instancetype)initWithFrame:(CGRect)frame
{
  self = [super initWithFrame:frame];
  if (self) {
    [self setupMetal];
    [self setupPages];
    [self setupGestures];

    _currentPage = 0;
    _currentTool = @"pen";
    _currentColor = [UIColor blackColor];
    _currentStrokeWidth = 2.0;
    _currentShape = @"line";
    _viewportX = 0;
    _viewportY = 0;
    _viewportScale = 1.0;

    // 初始化工具相关属性
    _erasedStrokeIds = [NSMutableSet set];
    _selectedStrokes = [NSMutableArray array];

    // 初始化重做栈
    _redoStack = [NSMutableArray array];
  }
  return self;
}

- (void)setupMetal
{
  self.device = MTLCreateSystemDefaultDevice();
  self.commandQueue = [self.device newCommandQueue];

  self.metalView = [[MTKView alloc] initWithFrame:self.bounds device:self.device];
  self.metalView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  self.metalView.delegate = self;
  self.metalView.clearColor = MTLClearColorMake(1.0, 1.0, 1.0, 1.0);
  self.metalView.enableSetNeedsDisplay = YES;
  self.metalView.paused = YES;

  [self addSubview:self.metalView];
}

- (void)setupPages
{
  self.pages = [NSMutableArray arrayWithObject:@{@"strokes": [NSMutableArray array]}];
}

static const CGFloat kUnifiedPanMinDelta = 0.35;
static const CGFloat kUnifiedMinScale = 0.5;
static const CGFloat kUnifiedMaxScale = 4.0;

- (BOOL)isDrawingToolActive
{
  NSSet *drawTools = [NSSet setWithArray:@[@"pen", @"highlighter", @"marker", @"pencil", @"brush", @"eraser", @"shape", @"laser", @"select", @"lasso", @"text"]];
  return [drawTools containsObject:(self.currentTool ?: @"pen")];
}

- (CGPoint)screenToWorld:(CGPoint)screenPoint
{
  CGPoint center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
  CGFloat scale = MAX(0.1, self.viewportScale);
  return CGPointMake(self.viewportX + (screenPoint.x - center.x) / scale,
                     self.viewportY + (screenPoint.y - center.y) / scale);
}

- (void)emitZoomChange
{
  if (self.onZoomChange) {
    self.onZoomChange(@{ @"scale": @(self.viewportScale), @"x": @(self.viewportX), @"y": @(self.viewportY) });
  }
}

- (void)setupGestures
{
  UIPanGestureRecognizer *pan = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
  UIPinchGestureRecognizer *pinch = [[UIPinchGestureRecognizer alloc] initWithTarget:self action:@selector(handlePinch:)];
  pan.delegate = self;
  pinch.delegate = self;
  [self addGestureRecognizer:pan];
  [self addGestureRecognizer:pinch];
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer
{
  return ([gestureRecognizer isKindOfClass:[UIPinchGestureRecognizer class]] || [otherGestureRecognizer isKindOfClass:[UIPinchGestureRecognizer class]]);
}

- (void)handlePinch:(UIPinchGestureRecognizer *)gesture
{
  CGPoint focal = [gesture locationInView:self];
  if (gesture.state == UIGestureRecognizerStateBegan) {
    self.pinchScaleBaseline = self.viewportScale;
    self.suppressTouchStroke = YES;
    return;
  }

  if (gesture.state == UIGestureRecognizerStateChanged) {
    CGPoint center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
    CGPoint worldBefore = [self screenToWorld:focal];

    self.viewportScale = MAX(kUnifiedMinScale, MIN(kUnifiedMaxScale, self.pinchScaleBaseline * gesture.scale));
    self.viewportX = worldBefore.x - (focal.x - center.x) / self.viewportScale;
    self.viewportY = worldBefore.y - (focal.y - center.y) / self.viewportScale;

    [self emitZoomChange];
    [self.metalView setNeedsDisplay];
    return;
  }

  if (gesture.state == UIGestureRecognizerStateEnded || gesture.state == UIGestureRecognizerStateCancelled || gesture.state == UIGestureRecognizerStateFailed) {
    self.suppressTouchStroke = NO;
  }
}

// Gesture Handling
- (void)handlePan:(UIPanGestureRecognizer *)gesture
{
  CGPoint location = [gesture locationInView:self];
  BOOL drawingMode = [self isDrawingToolActive];

  if (!drawingMode) {
    CGPoint translation = [gesture translationInView:self];
    if (gesture.state == UIGestureRecognizerStateBegan) {
      self.isCanvasPanning = YES;
      self.lastPanTranslation = translation;
      self.suppressTouchStroke = YES;
      return;
    }

    if (gesture.state == UIGestureRecognizerStateChanged) {
      CGPoint delta = CGPointMake(translation.x - self.lastPanTranslation.x, translation.y - self.lastPanTranslation.y);
      self.lastPanTranslation = translation;
      if (fabs(delta.x) + fabs(delta.y) < kUnifiedPanMinDelta) {
        return;
      }
      self.viewportX -= delta.x / MAX(0.1, self.viewportScale);
      self.viewportY -= delta.y / MAX(0.1, self.viewportScale);
      [self emitZoomChange];
      [self.metalView setNeedsDisplay];
      return;
    }

    if (gesture.state == UIGestureRecognizerStateEnded || gesture.state == UIGestureRecognizerStateCancelled || gesture.state == UIGestureRecognizerStateFailed) {
      self.isCanvasPanning = NO;
      self.suppressTouchStroke = NO;
      return;
    }
  }

  switch (gesture.state) {
    case UIGestureRecognizerStateBegan:
      self.suppressTouchStroke = YES;
      [self startToolAtPoint:location];
      break;
    case UIGestureRecognizerStateChanged:
      [self continueToolToPoint:location];
      break;
    case UIGestureRecognizerStateEnded:
    case UIGestureRecognizerStateCancelled:
    case UIGestureRecognizerStateFailed:
      [self endTool];
      self.suppressTouchStroke = NO;
      break;
    default:
      break;
  }
}

- (void)startStrokeAtPoint:(CGPoint)point
{
  self.currentStroke = [NSMutableArray arrayWithObject:[NSValue valueWithCGPoint:point]];
}

- (void)continueStrokeToPoint:(CGPoint)point
{
  if (self.currentStroke) {
    [self.currentStroke addObject:[NSValue valueWithCGPoint:point]];
    [self.metalView setNeedsDisplay];
  }
}

- (void)endStroke
{
  if (self.currentStroke && self.currentStroke.count > 1) {
    NSMutableDictionary *page = self.pages[self.currentPage];
    NSMutableArray *strokes = page[@"strokes"];

    [strokes addObject:@{
      @"points": [self.currentStroke copy],
      @"color": [self hexFromColor:self.currentColor],
      @"width": @(self.currentStrokeWidth),
      @"tool": self.currentTool
    }];

    // 清空重做栈，因为添加了新的笔迹
    [self.redoStack removeAllObjects];

    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{@"strokeId": [[NSUUID UUID] UUIDString]});
    }
  }

  self.currentStroke = nil;
  [self.metalView setNeedsDisplay];
}

// MTKViewDelegate
- (void)drawInMTKView:(MTKView *)view
{
  id<MTLCommandBuffer> commandBuffer = [self.commandQueue commandBuffer];
  MTLRenderPassDescriptor *renderPassDescriptor = view.currentRenderPassDescriptor;

  if (renderPassDescriptor) {
    id<MTLRenderCommandEncoder> renderEncoder = [commandBuffer renderCommandEncoderWithDescriptor:renderPassDescriptor];

    // TODO: Metal 绘制实现
    [self renderBackgroundWithEncoder:renderEncoder];
    [self renderStrokesWithEncoder:renderEncoder];

    [renderEncoder endEncoding];
    [commandBuffer presentDrawable:view.currentDrawable];
    [commandBuffer commit];
  }
}

- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {}

// Background Rendering
- (void)renderBackgroundWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  NSString *background = self.styleConfig[@"background"] ?: @"blank";

  if ([background isEqualToString:@"lined"]) {
    [self renderLinesWithEncoder:encoder];
  } else if ([background isEqualToString:@"grid"]) {
    [self renderGridWithEncoder:encoder];
  } else if ([background isEqualToString:@"dotted"]) {
    [self renderDotsWithEncoder:encoder];
  }
}

- (void)renderLinesWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  // 占位：仅触发一次 encoder 使用，避免空渲染
  (void)encoder;
}

- (void)renderGridWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  (void)encoder;
}

- (void)renderDotsWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  (void)encoder;
}

- (void)renderStrokesWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  (void)encoder;
}

// Public Methods
- (void)setNoteId:(NSString *)noteId { _noteId = noteId; }
- (void)setStyleConfig:(NSDictionary *)config { _styleConfig = config; [self.metalView setNeedsDisplay]; }
- (void)setCurrentTool:(NSString *)tool { _currentTool = tool; }
- (void)setCurrentColor:(NSString *)color { _currentColor = [self colorFromHex:color]; }
- (void)setCurrentStrokeWidth:(CGFloat)width { _currentStrokeWidth = width; }
- (void)setCurrentPage:(NSInteger)page {
  _currentPage = page;
  [self.metalView setNeedsDisplay];
}

- (void)addNewPage {
  [self.pages addObject:@{@"strokes": [NSMutableArray array]}];
  if (self.onPageAdded) {
    self.onPageAdded(@{@"totalPages": @(self.pages.count)});
  }
}

- (void)undo {
  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];
  if (strokes.count > 0) {
    // 将最后一个笔迹移到重做栈
    NSDictionary *lastStroke = [strokes lastObject];
    [self.redoStack addObject:lastStroke];
    [strokes removeLastObject];
    [self.metalView setNeedsDisplay];
  }
}

- (void)redo {
  if (self.redoStack.count > 0) {
    // 从重做栈中取出最后一个笔迹，添加回当前页面
    NSDictionary *strokeToRedo = [self.redoStack lastObject];
    [self.redoStack removeLastObject];

    NSMutableDictionary *page = self.pages[self.currentPage];
    NSMutableArray *strokes = page[@"strokes"];
    [strokes addObject:strokeToRedo];

    [self.metalView setNeedsDisplay];
  }
}

- (void)clear:(NSString *)clearType {
  NSLog(@"[NativePagedNoteView] 清除类型: %@", clearType);

  if ([clearType isEqualToString:@"current_page"]) {
    // 清除当前页面
    NSMutableDictionary *page = self.pages[self.currentPage];
    page[@"strokes"] = [NSMutableArray array];
    [self.metalView setNeedsDisplay];
  } else if ([clearType isEqualToString:@"entire_document"]) {
    // 清除整个文档
    for (NSMutableDictionary *page in self.pages) {
      page[@"strokes"] = [NSMutableArray array];
    }
    [self.metalView setNeedsDisplay];
  } else if ([clearType isEqualToString:@"selected"]) {
    // 清除选中内容（需要套索选择功能支持）
    NSLog(@"[NativePagedNoteView] 清除选中内容功能待实现");
  }
}

- (void)insertText:(NSString *)text {
  NSLog(@"[NativePagedNoteView] 插入文本: %@", text);

  // 在当前页面中心位置插入文本
  CGPoint centerPoint = CGPointMake(self.bounds.size.width / 2, self.bounds.size.height / 2);

  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];

  [strokes addObject:@{
    @"type": @"text",
    @"text": text,
    @"position": NSStringFromCGPoint(centerPoint),
    @"color": [self hexFromColor:self.currentColor],
    @"tool": @"text"
  }];

  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": [[NSUUID UUID] UUIDString],
      @"page": @(self.currentPage),
      @"tool": @"text"
    });
  }

  [self.metalView setNeedsDisplay];
}

- (void)addImage:(NSString *)imageUri {
  NSLog(@"[NativePagedNoteView] 添加图片: %@", imageUri);

  // 在当前页面中心位置添加图片
  CGPoint centerPoint = CGPointMake(self.bounds.size.width / 2, self.bounds.size.height / 2);

  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];

  [strokes addObject:@{
    @"type": @"image",
    @"uri": imageUri,
    @"position": NSStringFromCGPoint(centerPoint),
    @"tool": @"image"
  }];

  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": [[NSUUID UUID] UUIDString],
      @"page": @(self.currentPage),
      @"tool": @"image"
    });
  }

  [self.metalView setNeedsDisplay];
}

#pragma mark - Import/Export

- (void)importNote:(NSString *)jsonData
{
  if (!jsonData || jsonData.length == 0) return;
  @try {
    NSData *data = [jsonData dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *note = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![note isKindOfClass:[NSDictionary class]]) return;

    NSNumber *current = note[@"currentPage"];
    NSArray *pagesArray = note[@"pages"];

    NSMutableArray *newPages = [NSMutableArray array];
    for (NSDictionary *p in pagesArray) {
      NSArray *strokesSrc = p[@"strokes"] ?: @[];
      NSMutableArray *strokes = [NSMutableArray array];
      for (NSDictionary *s in strokesSrc) {
        NSArray *pts = s[@"points"] ?: @[];
        NSMutableArray *ptValues = [NSMutableArray arrayWithCapacity:pts.count];
        for (NSDictionary *pt in pts) {
          CGFloat x = [pt[@"x"] doubleValue];
          CGFloat y = [pt[@"y"] doubleValue];
          [ptValues addObject:[NSValue valueWithCGPoint:CGPointMake(x, y)]];
        }
        NSString *hex = s[@"color"] ?: @"#000000";
        NSNumber *w = s[@"strokeWidth"] ?: s[@"width"] ?: @(2.0);
        NSString *tool = s[@"tool"] ?: @"pen";
        [strokes addObject:@{ @"points": ptValues,
                              @"color": hex,
                              @"width": w,
                              @"tool": tool }];
      }
      [newPages addObject:@{ @"strokes": strokes.mutableCopy }];
    }

    self.pages = newPages.count > 0 ? newPages : [@[ @{ @"strokes": [NSMutableArray array] } ] mutableCopy];
    if (current) self.currentPage = [current integerValue];
    [self.metalView setNeedsDisplay];

    if (self.onReady) {
      self.onReady(@{ @"totalPages": @(self.pages.count), @"currentPage": @(self.currentPage) });
    }
  } @catch (__unused NSException *e) {}
}

- (void)exportNote:(NSString *)noteId
{
  @try {
    NSMutableArray *pagesOut = [NSMutableArray arrayWithCapacity:self.pages.count];
    for (NSDictionary *page in self.pages) {
      NSArray *strokes = page[@"strokes"] ?: @[];
      NSMutableArray *strokesOut = [NSMutableArray arrayWithCapacity:strokes.count];
      for (NSDictionary *s in strokes) {
        NSArray *pts = s[@"points"] ?: @[];
        NSMutableArray *ptsOut = [NSMutableArray arrayWithCapacity:pts.count];
        for (NSValue *v in pts) {
          CGPoint p = [v CGPointValue];
          [ptsOut addObject:@{ @"x": @(p.x), @"y": @(p.y), @"pressure": @(1.0) }];
        }
        NSString *hex = s[@"color"] ?: @"#000000";
        NSNumber *w = s[@"width"] ?: @(2.0);
        NSString *tool = s[@"tool"] ?: @"pen";
        [strokesOut addObject:@{ @"color": hex, @"strokeWidth": w, @"alpha": @(255), @"points": ptsOut, @"tool": tool }];
      }
      [pagesOut addObject:@{ @"pageNumber": @([pagesOut count] + 1), @"strokes": strokesOut }];
    }

    NSDictionary *payload = @{ @"noteId": noteId ?: @"",
                                @"totalPages": @(self.pages.count),
                                @"currentPage": @(self.currentPage),
                                @"scale": @(1.0),
                                @"pages": pagesOut };
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
    NSString *jsonStr = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];

    if (self.onExportComplete) {
      self.onExportComplete(@{ @"noteId": noteId ?: @"", @"data": jsonStr ?: @"", @"success": @YES });
    }
  } @catch (NSException *exception) {
    if (self.onExportComplete) {
      self.onExportComplete(@{ @"noteId": noteId ?: @"", @"success": @NO, @"error": exception.reason ?: @"error" });
    }
  }
}

- (UIColor *)colorFromHex:(NSString *)hex {
  unsigned rgbValue = 0;
  NSScanner *scanner = [NSScanner scannerWithString:hex];
  if ([hex hasPrefix:@"#"]) [scanner setScanLocation:1];
  [scanner scanHexInt:&rgbValue];
  return [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16)/255.0
                         green:((rgbValue & 0xFF00) >> 8)/255.0
                          blue:(rgbValue & 0xFF)/255.0 alpha:1.0];
}

- (NSString *)hexFromColor:(UIColor *)color {
  CGFloat r, g, b, a;
  [color getRed:&r green:&g blue:&b alpha:&a];
  return [NSString stringWithFormat:@"#%02X%02X%02X",
          (int)(r*255), (int)(g*255), (int)(b*255)];
}



// Enhanced Touch Handling with Pressure
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesBegan:touches withEvent:event];
  if (self.suppressTouchStroke || ![self isDrawingToolActive]) {
    return;
  }

  UITouch *touch = [touches anyObject];
  if (!touch) {
    return;
  }
  CGPoint location = [touch locationInView:self];
  [self startStrokeAtPoint:location];
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesMoved:touches withEvent:event];
  if (self.suppressTouchStroke || ![self isDrawingToolActive]) {
    return;
  }

  UITouch *touch = [touches anyObject];
  if (!touch) {
    return;
  }

  NSArray *coalescedTouches = [event coalescedTouchesForTouch:touch];
  if (coalescedTouches.count == 0) {
    CGPoint location = [touch locationInView:self];
    [self continueStrokeToPoint:location];
    return;
  }

  for (UITouch *coalescedTouch in coalescedTouches) {
    CGPoint location = [coalescedTouch locationInView:self];
    [self continueStrokeToPoint:location];
  }
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesEnded:touches withEvent:event];
  if (self.suppressTouchStroke || ![self isDrawingToolActive]) {
    return;
  }
  [self endStroke];
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesCancelled:touches withEvent:event];
  if (self.suppressTouchStroke || ![self isDrawingToolActive]) {
    return;
  }
  [self endStroke];
}

// Background Rendering with Core Graphics
- (void)renderBackgroundWithEncoder:(id<MTLRenderCommandEncoder>)encoder {
  // 使用 Core Graphics 预渲染背景到纹理
  NSString *bg = self.styleConfig[@"background"] ?: @"blank";

  if ([bg isEqualToString:@"blank"]) {
    return;
  }

  CGSize size = self.bounds.size;
  UIGraphicsBeginImageContextWithOptions(size, YES, [UIScreen mainScreen].scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  // 白色背景
  CGContextSetFillColorWithColor(context, [UIColor whiteColor].CGColor);
  CGContextFillRect(context, CGRectMake(0, 0, size.width, size.height));

  CGContextSetStrokeColorWithColor(context, [[UIColor lightGrayColor] colorWithAlphaComponent:0.3].CGColor);
  CGContextSetLineWidth(context, 1.0);

  if ([bg isEqualToString:@"lined"]) {
    CGFloat spacing = 30.0;
    for (CGFloat y = spacing; y < size.height; y += spacing) {
      CGContextMoveToPoint(context, 20, y);
      CGContextAddLineToPoint(context, size.width - 20, y);
    }
    CGContextStrokePath(context);

  } else if ([bg isEqualToString:@"grid"]) {
    CGFloat gridSize = 20.0;
    for (CGFloat x = 0; x < size.width; x += gridSize) {
      CGContextMoveToPoint(context, x, 0);
      CGContextAddLineToPoint(context, x, size.height);
    }
    for (CGFloat y = 0; y < size.height; y += gridSize) {
      CGContextMoveToPoint(context, 0, y);
      CGContextAddLineToPoint(context, size.width, y);
    }
    CGContextStrokePath(context);

  } else if ([bg isEqualToString:@"dotted"]) {
    CGFloat spacing = 20.0;
    for (CGFloat x = spacing; x < size.width; x += spacing) {
      for (CGFloat y = spacing; y < size.height; y += spacing) {
        CGContextFillEllipseInRect(context, CGRectMake(x - 1, y - 1, 2, 2));
      }
    }

  } else if ([bg isEqualToString:@"cornell"]) {
    CGFloat leftMargin = size.width * 0.25;
    CGFloat bottomMargin = size.height * 0.75;

    CGContextMoveToPoint(context, leftMargin, 0);
    CGContextAddLineToPoint(context, leftMargin, size.height);
    CGContextMoveToPoint(context, 0, bottomMargin);
    CGContextAddLineToPoint(context, size.width, bottomMargin);
    CGContextStrokePath(context);

    CGFloat lineSpacing = 30.0;
    for (CGFloat y = lineSpacing; y < bottomMargin; y += lineSpacing) {
      CGContextMoveToPoint(context, leftMargin + 10, y);
      CGContextAddLineToPoint(context, size.width - 20, y);
    }
    CGContextStrokePath(context);
  }

  UIImage *backgroundImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  // TODO: 转换为 Metal 纹理并渲染
}

// MARK: - 工具实现

- (void)startToolAtPoint:(CGPoint)point
{
  NSLog(@"[NativePagedNoteView] 开始工具操作: %@", self.currentTool);

  if ([self.currentTool isEqualToString:@"eraser"]) {
    [self startErasingAtPoint:point];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    [self startTextInputAtPoint:point];
  } else if ([self.currentTool isEqualToString:@"lasso"] || [self.currentTool isEqualToString:@"select"]) {
    [self startLassoSelectionAtPoint:point];
  } else if ([self.currentTool isEqualToString:@"shape"]) {
    [self startShapeAtPoint:point];
  } else if ([self.currentTool isEqualToString:@"laser"]) {
    [self startLaserAtPoint:point];
  } else {
    // 默认绘图工具
    [self startStrokeAtPoint:point];
  }
}

- (void)continueToolToPoint:(CGPoint)point
{
  if ([self.currentTool isEqualToString:@"eraser"]) {
    [self continueErasingToPoint:point];
  } else if ([self.currentTool isEqualToString:@"lasso"] || [self.currentTool isEqualToString:@"select"]) {
    [self continueLassoSelectionToPoint:point];
  } else if ([self.currentTool isEqualToString:@"shape"]) {
    [self continueShapeToPoint:point];
  } else if ([self.currentTool isEqualToString:@"laser"]) {
    [self continueLaserToPoint:point];
  } else {
    // 默认绘图工具
    [self continueStrokeToPoint:point];
  }
}

- (void)endTool
{
  if ([self.currentTool isEqualToString:@"eraser"]) {
    [self endErasing];
  } else if ([self.currentTool isEqualToString:@"text"]) {
    // 文本输入在点击时完成
  } else if ([self.currentTool isEqualToString:@"lasso"] || [self.currentTool isEqualToString:@"select"]) {
    [self endLassoSelection];
  } else if ([self.currentTool isEqualToString:@"shape"]) {
    [self endShape];
  } else if ([self.currentTool isEqualToString:@"laser"]) {
    [self endLaser];
  } else {
    // 默认绘图工具
    [self endStroke];
  }
}

// 橡皮擦工具
- (void)startErasingAtPoint:(CGPoint)point
{
  NSLog(@"[NativePagedNoteView] 开始橡皮擦");
  [self eraseAtPoint:point];
}

- (void)continueErasingToPoint:(CGPoint)point
{
  [self eraseAtPoint:point];
}

- (void)endErasing
{
  NSLog(@"[NativePagedNoteView] 橡皮擦结束");
  [self.erasedStrokeIds removeAllObjects];
}

- (void)eraseAtPoint:(CGPoint)point
{
  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];

  if (strokes.count == 0) return;

  // 橡皮擦半径
  CGFloat eraserRadius = self.currentStrokeWidth * 3;

  // 从后往前检查笔迹，删除与橡皮擦相交的笔迹
  for (NSInteger i = strokes.count - 1; i >= 0; i--) {
    NSDictionary *stroke = strokes[i];
    NSArray *points = stroke[@"points"];

    if (!points || points.count == 0) continue;

    // 检查笔迹是否与橡皮擦点相交
    BOOL shouldErase = NO;

    // 方法1: 检查橡皮擦点是否在笔迹附近
    for (NSValue *pointValue in points) {
      CGPoint strokePoint = [pointValue CGPointValue];
      CGFloat distance = sqrt(pow(point.x - strokePoint.x, 2) + pow(point.y - strokePoint.y, 2));

      if (distance <= eraserRadius) {
        shouldErase = YES;
        break;
      }
    }

    // 方法2: 检查笔迹边界是否与橡皮擦区域相交
    if (!shouldErase) {
      CGRect strokeBounds = [self calculateStrokeBounds:points];
      CGRect eraserRect = CGRectMake(point.x - eraserRadius, point.y - eraserRadius,
                                   eraserRadius * 2, eraserRadius * 2);

      if (CGRectIntersectsRect(strokeBounds, eraserRect)) {
        shouldErase = YES;
      }
    }

    if (shouldErase) {
      [strokes removeObjectAtIndex:i];
      [self.metalView setNeedsDisplay];
      NSLog(@"[NativePagedNoteView] 擦除笔迹 %ld", (long)i);
      break; // 每次只擦除一个笔迹
    }
  }
}

// 计算笔迹的边界
- (CGRect)calculateStrokeBounds:(NSArray *)points
{
  if (points.count == 0) return CGRectZero;

  CGPoint firstPoint = [points[0] CGPointValue];
  CGFloat minX = firstPoint.x, maxX = firstPoint.x;
  CGFloat minY = firstPoint.y, maxY = firstPoint.y;

  for (NSValue *pointValue in points) {
    CGPoint point = [pointValue CGPointValue];
    minX = MIN(minX, point.x);
    maxX = MAX(maxX, point.x);
    minY = MIN(minY, point.y);
    maxY = MAX(maxY, point.y);
  }

  return CGRectMake(minX, minY, maxX - minX, maxY - minY);
}

// 文本输入工具
- (void)startTextInputAtPoint:(CGPoint)point
{
  NSLog(@"[NativePagedNoteView] 开始文本输入");

  self.textInputPoint = point;

  // 创建文本输入框
  CGFloat width = 200;
  CGFloat height = 100;
  CGRect textFrame = CGRectMake(point.x, point.y, width, height);

  self.textInputView = [[UITextView alloc] initWithFrame:textFrame];
  self.textInputView.delegate = self;
  self.textInputView.font = [UIFont systemFontOfSize:16];
  self.textInputView.textColor = self.currentColor;
  self.textInputView.backgroundColor = [[UIColor whiteColor] colorWithAlphaComponent:0.9];
  self.textInputView.layer.borderColor = self.currentColor.CGColor;
  self.textInputView.layer.borderWidth = 2.0;
  self.textInputView.layer.cornerRadius = 4.0;
  self.textInputView.returnKeyType = UIReturnKeyDone;

  [self addSubview:self.textInputView];
  [self.textInputView becomeFirstResponder];
}

// UITextViewDelegate
- (BOOL)textView:(UITextView *)textView shouldChangeTextInRange:(NSRange)range replacementText:(NSString *)text
{
  if ([text isEqualToString:@"\n"]) {
    [textView resignFirstResponder];
    [self endTextInput];
    return NO;
  }
  return YES;
}

- (void)endTextInput
{
  if (!self.textInputView) return;

  NSString *text = self.textInputView.text;
  NSLog(@"[NativePagedNoteView] 文本输入完成: %@", text);

  if (text.length > 0) {
    // 保存文本作为笔迹（简化实现）
    NSMutableDictionary *page = self.pages[self.currentPage];
    NSMutableArray *strokes = page[@"strokes"];

    [strokes addObject:@{
      @"type": @"text",
      @"text": text,
      @"position": NSStringFromCGPoint(self.textInputPoint),
      @"color": [self hexFromColor:self.currentColor],
      @"tool": @"text"
    }];

    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{
        @"strokeId": [[NSUUID UUID] UUIDString],
        @"page": @(self.currentPage),
        @"tool": @"text"
      });
    }
  }

  [self.textInputView removeFromSuperview];
  self.textInputView = nil;
}

// 套索选择工具
- (void)startLassoSelectionAtPoint:(CGPoint)point
{
  NSLog(@"[NativePagedNoteView] 开始套索选择");

  self.lassoPath = [UIBezierPath bezierPath];
  [self.lassoPath moveToPoint:point];

  self.lassoLayer = [CAShapeLayer layer];
  self.lassoLayer.strokeColor = [UIColor blueColor].CGColor;
  self.lassoLayer.fillColor = [[UIColor blueColor] colorWithAlphaComponent:0.1].CGColor;
  self.lassoLayer.lineWidth = 2.0;
  self.lassoLayer.lineDashPattern = @[@5, @3];

  [self.layer addSublayer:self.lassoLayer];
}

- (void)continueLassoSelectionToPoint:(CGPoint)point
{
  if (self.lassoPath) {
    [self.lassoPath addLineToPoint:point];
    self.lassoLayer.path = self.lassoPath.CGPath;
  }
}

- (void)endLassoSelection
{
  if (!self.lassoPath) return;

  [self.lassoPath closePath];
  self.lassoLayer.path = self.lassoPath.CGPath;

  NSLog(@"[NativePagedNoteView] 套索选择完成");

  // 查找套索内的笔迹
  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];
  NSMutableArray *selectedStrokes = [NSMutableArray array];

  for (NSInteger i = 0; i < strokes.count; i++) {
    NSDictionary *stroke = strokes[i];
    NSArray *points = stroke[@"points"];

    if (!points || points.count == 0) continue;

    // 检查笔迹是否在套索内
    BOOL isSelected = [self isStrokeSelected:points byLassoPath:self.lassoPath];

    if (isSelected) {
      [selectedStrokes addObject:@(i)];
      NSLog(@"[NativePagedNoteView] 选中笔迹 %ld", (long)i);
    }
  }

  NSLog(@"[NativePagedNoteView] 选中 %lu 个笔迹", (unsigned long)selectedStrokes.count);

  // 高亮显示选中的笔迹
  if (selectedStrokes.count > 0) {
    self.lassoLayer.strokeColor = [UIColor greenColor].CGColor;
    self.lassoLayer.fillColor = [[UIColor greenColor] colorWithAlphaComponent:0.1].CGColor;

    // 3秒后清除选择
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(3.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self.lassoLayer removeFromSuperlayer];
      self.lassoLayer = nil;
      self.lassoPath = nil;
    });
  } else {
    // 没有选中任何内容，立即清除
    [self.lassoLayer removeFromSuperlayer];
    self.lassoLayer = nil;
    self.lassoPath = nil;
  }
}

// 检查笔迹是否被套索选中
- (BOOL)isStrokeSelected:(NSArray *)strokePoints byLassoPath:(UIBezierPath *)lassoPath
{
  if (!strokePoints || strokePoints.count == 0) return NO;

  // 检查笔迹的每个点是否在套索内
  int pointsInside = 0;
  for (NSValue *pointValue in strokePoints) {
    CGPoint point = [pointValue CGPointValue];
    if ([lassoPath containsPoint:point]) {
      pointsInside++;
    }
  }

  // 如果超过一半的点在套索内，则认为被选中
  return pointsInside > strokePoints.count / 2;
}

// 形状工具
- (void)startShapeAtPoint:(CGPoint)point
{
  NSLog(@"[NativePagedNoteView] 开始绘制形状: %@", self.currentShape);

  self.shapeStartPoint = point;

  self.shapePreviewLayer = [CAShapeLayer layer];
  self.shapePreviewLayer.strokeColor = self.currentColor.CGColor;
  self.shapePreviewLayer.fillColor = nil;
  self.shapePreviewLayer.lineWidth = self.currentStrokeWidth;
  self.shapePreviewLayer.lineCap = kCALineCapRound;

  [self.layer addSublayer:self.shapePreviewLayer];
}

- (void)continueShapeToPoint:(CGPoint)point
{
  if (self.shapePreviewLayer) {
    UIBezierPath *shapePath = [self createShapePathFrom:self.shapeStartPoint to:point];
    self.shapePreviewLayer.path = shapePath.CGPath;
  }
}

- (void)endShape
{
  if (self.shapePreviewLayer) {
    NSLog(@"[NativePagedNoteView] 形状绘制完成");

    // 保存形状作为笔迹
    NSMutableDictionary *page = self.pages[self.currentPage];
    NSMutableArray *strokes = page[@"strokes"];

    [strokes addObject:@{
      @"type": @"shape",
      @"shape": self.currentShape,
      @"startPoint": NSStringFromCGPoint(self.shapeStartPoint),
      @"endPoint": NSStringFromCGPoint(self.shapePreviewLayer.path ? CGPathGetCurrentPoint(self.shapePreviewLayer.path) : CGPointZero),
      @"color": [self hexFromColor:self.currentColor],
      @"width": @(self.currentStrokeWidth),
      @"tool": @"shape"
    }];

    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{
        @"strokeId": [[NSUUID UUID] UUIDString],
        @"page": @(self.currentPage),
        @"tool": @"shape"
      });
    }

    [self.shapePreviewLayer removeFromSuperlayer];
    self.shapePreviewLayer = nil;
  }
}

- (UIBezierPath *)createShapePathFrom:(CGPoint)start to:(CGPoint)end
{
  UIBezierPath *path = [UIBezierPath bezierPath];
  path.lineWidth = self.currentStrokeWidth;
  path.lineCapStyle = kCGLineCapRound;
  path.lineJoinStyle = kCGLineJoinRound;

  if ([self.currentShape isEqualToString:@"line"]) {
    [path moveToPoint:start];
    [path addLineToPoint:end];
  } else if ([self.currentShape isEqualToString:@"rectangle"]) {
    CGRect rect = CGRectMake(MIN(start.x, end.x), MIN(start.y, end.y),
                            ABS(end.x - start.x), ABS(end.y - start.y));
    [path appendPath:[UIBezierPath bezierPathWithRect:rect]];
  } else if ([self.currentShape isEqualToString:@"circle"]) {
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
  } else {
    // 默认直线
    [path moveToPoint:start];
    [path addLineToPoint:end];
  }

  return path;
}

// 激光笔工具
- (void)startLaserAtPoint:(CGPoint)point
{
  NSLog(@"[NativePagedNoteView] 开始激光笔");

  self.currentStroke = [NSMutableArray arrayWithObject:[NSValue valueWithCGPoint:point]];

  self.laserLayer = [CAShapeLayer layer];
  self.laserLayer.strokeColor = [UIColor redColor].CGColor;
  self.laserLayer.fillColor = nil;
  self.laserLayer.lineWidth = self.currentStrokeWidth * 2;
  self.laserLayer.lineCap = kCALineCapRound;
  self.laserLayer.lineJoin = kCALineJoinRound;
  self.laserLayer.opacity = 0.8;

  [self.layer addSublayer:self.laserLayer];
}

- (void)continueLaserToPoint:(CGPoint)point
{
  if (self.currentStroke) {
    [self.currentStroke addObject:[NSValue valueWithCGPoint:point]];

    // 更新激光笔路径
    UIBezierPath *laserPath = [UIBezierPath bezierPath];
    for (NSInteger i = 0; i < self.currentStroke.count; i++) {
      CGPoint strokePoint = [self.currentStroke[i] CGPointValue];
      if (i == 0) {
        [laserPath moveToPoint:strokePoint];
      } else {
        [laserPath addLineToPoint:strokePoint];
      }
    }
    self.laserLayer.path = laserPath.CGPath;
  }
}

- (void)endLaser
{
  if (!self.laserLayer) return;

  NSLog(@"[NativePagedNoteView] 激光笔结束，开始淡出");




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
    self.currentStroke = nil;
  });
}

// 工具配置
- (void)setToolConfig:(NSString *)configJson
{
  NSError *error = nil;
  NSDictionary *config = [NSJSONSerialization JSONObjectWithData:[configJson dataUsingEncoding:NSUTF8StringEncoding]
                                                        options:0
                                                          error:&error];
  if (error) {
    NSLog(@"[NativePagedNoteView] 解析工具配置失败: %@", error);
    return;
  }

  self.toolConfig = config;
  NSLog(@"[NativePagedNoteView] 工具配置更新: %@", config);

  if (config[@"shape"]) {
    self.currentShape = config[@"shape"];
  }
}


// MARK: - Handwriting Recognition Extension

@implementation NativePagedNoteView (HandwritingRecognition)

- (void)recognizeHandwritingWithCount:(NSInteger)count completion:(void (^)(NSString *text, NSError *error))completion
{
  if (count <= 0 || self.currentPage < 0 || self.currentPage >= self.pages.count) {
    if (completion) completion(@"", nil);
    return;
  }

  // 1. 收集当前页的最近笔迹
  NSMutableArray *allStrokesOnPage = self.pages[self.currentPage][@"strokes"];
  NSMutableArray *targetStrokes = [NSMutableArray new];
  CGRect strokesBoundingBox = CGRectNull;

  NSEnumerator *reverseEnumerator = [allStrokesOnPage reverseObjectEnumerator];
  for (NSDictionary *strokeDict in reverseEnumerator) {
    if (targetStrokes.count >= count) break;

    NSString *tool = strokeDict[@"tool"];
    if ([tool isEqualToString:@"pen"] || [tool isEqualToString:@"pencil"] || [tool isEqualToString:@"brush"]) {
      NSArray *points = strokeDict[@"points"];
      if (points && [points isKindOfClass:[NSArray class]] && points.count > 0) {



        [targetStrokes insertObject:strokeDict atIndex:0]; // 保持原始顺序

        for (NSValue *pointValue in points) {
          CGPoint point = [pointValue CGPointValue];
          if (CGRectIsNull(strokesBoundingBox)) {
            strokesBoundingBox = CGRectMake(point.x, point.y, 0, 0);
          } else {
            strokesBoundingBox = CGRectUnion(strokesBoundingBox, CGRectMake(point.x, point.y, 0, 0));
          }
        }
      }
    }
  }

  if (targetStrokes.count == 0) {
    if (completion) completion(@"", nil);
    return;
  }

  // 2. 将笔迹渲染为图像
  CGFloat padding = 20.0;
  CGRect imageRect = CGRectInset(strokesBoundingBox, -padding, -padding);

  UIGraphicsBeginImageContextWithOptions(imageRect.size, NO, [UIScreen mainScreen].scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  CGContextSetFillColorWithColor(context, [UIColor whiteColor].CGColor);
  CGContextFillRect(context, CGRectMake(0, 0, imageRect.size.width, imageRect.size.height));

  CGContextTranslateCTM(context, -imageRect.origin.x, -imageRect.origin.y);

  for (NSDictionary *strokeDict in targetStrokes) {
    NSArray *points = strokeDict[@"points"];
    UIColor *color = [self colorFromHexString:strokeDict[@"color"]];
    CGFloat width = [strokeDict[@"width"] floatValue];

    CGContextSetStrokeColorWithColor(context, color.CGColor);
    CGContextSetLineWidth(context, width);
    CGContextSetLineCap(context, kCGLineCapRound);
    CGContextSetLineJoin(context, kCGLineJoinRound);

    if (points.count > 1) {
      CGPoint firstPoint = [points.firstObject CGPointValue];
      CGContextMoveToPoint(context, firstPoint.x, firstPoint.y);
      for (NSUInteger i = 1; i < points.count; i++) {
        CGPoint point = [points[i] CGPointValue];
        CGContextAddLineToPoint(context, point.x, point.y);
      }
      CGContextStrokePath(context);
    }
  }

  UIImage *handwritingImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  if (!handwritingImage) {
    if (completion) completion(nil, [NSError errorWithDomain:@"HandwritingRecognition" code:-1 userInfo:@{NSLocalizedDescriptionKey: @"渲染笔迹失败"}]);
    return;
  }

  // 3. 使用Vision框架识别手写文本
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
        [result appendString:@" "];
      }
    }

    if (completion) completion([result stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]], nil);
  }];

  request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
  request.recognitionLanguages = @[@"zh-Hans", @"en-US"];
  request.usesLanguageCorrection = YES;

  VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:handwritingImage.CGImage options:@{}];
  NSError *e = nil;
  [handler performRequests:@[request] error:&e];
  if (e && completion) completion(nil, e);
}

@end

// MARK: - OCR

- (void)recognizeTextInRect:(CGRect)rect completion:(void (^)(NSString *text, NSError *error))completion {
  // 1. Render the view to an image
  UIGraphicsBeginImageContextWithOptions(self.bounds.size, NO, self.window.screen.scale);
  [self.layer renderInContext:UIGraphicsGetCurrentContext()];
  UIImage *fullImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  if (!fullImage) {
    if (completion) completion(nil, [NSError errorWithDomain:@"PagedNoteOCRError" code:1 userInfo:@{NSLocalizedDescriptionKey: @"Failed to render view to image."}]);
    return;
  }

  // 2. Crop the image to the specified rect
  CGRect cropRect = rect;
  CGImageRef cgImage = CGImageCreateWithImageInRect(fullImage.CGImage, cropRect);
  if (!cgImage) {
    if (completion) completion(nil, [NSError errorWithDomain:@"PagedNoteOCRError" code:2 userInfo:@{NSLocalizedDescriptionKey: @"Failed to crop image."}]);
    return;
  }
  UIImage *croppedImage = [UIImage imageWithCGImage:cgImage];
  CGImageRelease(cgImage);

  // 3. Use Vision to recognize text
  VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull req, NSError * _Nullable err) {
    if (err) {
      if (completion) completion(nil, err);
      return;
    }

    NSMutableString *resultText = [NSMutableString string];
    for (VNRecognizedTextObservation *observation in req.results) {
      VNRecognizedText *topCandidate = [observation topCandidates:1].firstObject;
      if (topCandidate) {
        [resultText appendString:topCandidate.string];
        [resultText appendString:@" "];
      }
    }

    if (completion) completion([resultText stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]], nil);
  }];

  request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
  request.recognitionLanguages = @[@"zh-Hans", @"en-US"];
  request.usesLanguageCorrection = YES;

  VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:croppedImage.CGImage options:@{}];
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError *e = nil;
    [handler performRequests:@[request] error:&e];
    if (e) {
      if (completion) completion(nil, e);
    }
  });
}

