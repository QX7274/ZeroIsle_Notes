//
//  NativeInfiniteCanvasView.m
//  ZeroIsle_Notes
//
//  无限画布实现 - 世界坐标系统
//

#import "NativeInfiniteCanvasView.h"
#import <Vision/Vision.h>
// 相册 asset（ph://）必须经 Photos 取图，否则从相册插入的图片永远空白。
#import <Photos/Photos.h>

#define WORLD_SIZE 100000.0

@interface NativeInfiniteCanvasView () <MTKViewDelegate, UITextViewDelegate, UIGestureRecognizerDelegate>

@property (nonatomic, strong) MTKView *metalView;
@property (nonatomic, strong) id<MTLDevice> device;
@property (nonatomic, strong) id<MTLCommandQueue> commandQueue;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSDictionary *> *strokesDict;
@property (nonatomic, strong) NSMutableArray<NSString *> *strokeOrder;
@property (nonatomic, assign) CGFloat viewportX;
@property (nonatomic, assign) CGFloat viewportY;
@property (nonatomic, assign) CGFloat viewportScale;
@property (nonatomic, strong) NSMutableArray *currentStroke;
@property (nonatomic, assign) CGPoint lastStrokePoint;
@property (nonatomic, assign) CGFloat lastStrokeIntensity;
@property (nonatomic, assign) CGFloat activeStrokeWidth;
@property (nonatomic, assign) CFTimeInterval lastStrokeTimestamp;
@property (nonatomic, assign) CGFloat filteredStrokeSpeed;

// 工具相关属性
@property (nonatomic, strong) NSString *currentTool;
@property (nonatomic, strong) UIColor *currentColor;
@property (nonatomic, assign) CGFloat currentStrokeWidth;
// 注意：这个属性必须叫 toolConfigDictionary，不能叫 toolConfig。
// 因为视图还有一个用于接收命令的 -setToolConfig:(NSString *)（命令名就叫 setToolConfig），
// @property toolConfig 会自动合成同名的 setToolConfig: setter，两者签名冲突：
// 要么编译报 "type of property does not match type of accessor"，
// 要么在运行时把 NSDictionary 当成 NSString 用（曾导致
// "-[__NSDictionaryI dataUsingEncoding:]: unrecognized selector" 崩溃）。
@property (nonatomic, strong) NSDictionary *toolConfigDictionary;
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
// 形状起止点存「世界坐标」（与笔迹/文本/图片一致，才能跟随视口变换）；
// 预览 layer 是屏幕空间，因此终点单独持有，不能从 layer.path 反读。
@property (nonatomic, assign) CGPoint shapeStartPoint;
@property (nonatomic, assign) CGPoint shapeEndPoint;
@property (nonatomic, strong) CAShapeLayer *shapePreviewLayer;


// 叠加层用于非Metal快速渲染（最低可行实现）
@property (nonatomic, strong) UIImageView *strokesImageView;

// 图片解码缓存：视口每次变化都会重建内容层，不缓存就会反复解码同一张图。
@property (nonatomic, strong) NSCache<NSString *, UIImage *> *imageCache;
// 首帧渲染诊断只打一次，避免每次重绘刷屏
@property (nonatomic, assign) BOOL didLogRenderSummary;





// 激光笔相关
@property (nonatomic, strong) CAShapeLayer *laserLayer;
// 平移手势（用于按防误触配置限制可接受的触点类型）
@property (nonatomic, strong) UIPanGestureRecognizer *panGestureRecognizer;
@property (nonatomic, strong) NSTimer *laserFadeTimer;

// 背景样式相关
@property (nonatomic, strong) NSString *backgroundStyle;
@property (nonatomic, strong) UIColor *backgroundColor;
@property (nonatomic, assign) BOOL hasPattern;
@property (nonatomic, strong) NSString *patternType;

// 撤销/重做相关
@property (nonatomic, strong) NSMutableArray *redoStack;

// 手势状态
@property (nonatomic, assign) BOOL isCanvasPanning;
@property (nonatomic, assign) CGPoint lastPanTranslation;
@property (nonatomic, assign) CGFloat gestureScaleBaseline;

// 以下绘制方法实现落在文件尾部的分类里（历史结构），但主实现要调用它们。
// 在类扩展中先声明，编译器才能解析这些 selector（否则报 no visible @interface）。
- (void)redrawStrokesOnOverlay;
- (void)drawImageEntryInContext:(CGContextRef)context entry:(NSDictionary *)entry;
- (void)drawTextEntryInContext:(CGContextRef)context entry:(NSDictionary *)entry;
- (void)drawToolbarOverlaysInContext:(CGContextRef)context transform:(CGAffineTransform)transform;
- (UIFont *)fontWithSize:(CGFloat)size bold:(BOOL)bold italic:(BOOL)italic;
- (CGPoint)pointFromEntry:(NSDictionary *)entry fallback:(CGPoint)fallback;
- (UIImage *)decodedImageForEntry:(NSDictionary *)entry;
- (UIImage *)imageFromBase64:(NSString *)base64;
- (UIImage *)loadPhotoAssetWithURI:(NSString *)uri;
- (NSString *)renderDebugDescription;
- (NSString *)jsonStringFromObject:(NSDictionary *)object;
- (NSDictionary *)dictionaryFromJSONString:(NSString *)json;
- (NSString *)normalizedColorHex:(id)value fallback:(UIColor *)fallback;
- (NSString *)normalizedAlignment:(id)value;
- (NSDictionary *)exportedEntryFromEntry:(NSDictionary *)entry;
- (NSDictionary *)importedEntryFromJSON:(NSDictionary *)raw entryId:(NSString *)entryId;
- (void)updateLassoLayerFromWorldPath;
- (UIBezierPath *)createShapePathFrom:(CGPoint)start to:(CGPoint)end shapeName:(NSString *)shapeName;

@end

@implementation NativeInfiniteCanvasView

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    [self setupMetal];
        _strokesDict = [NSMutableDictionary dictionary];
    _strokeOrder = [NSMutableArray array];
    _viewportX = 0;
    _viewportY = 0;
    _viewportScale = 1.0;

    // 初始化工具相关属性
    _currentTool = @"pen";
    _currentColor = [UIColor blackColor];
    _currentStrokeWidth = 2.0;
    _currentShape = @"line";
    _erasedStrokeIds = [NSMutableSet set];
    _selectedStrokes = [NSMutableArray array];

    // 初始化背景样式
    _backgroundStyle = @"white";
    _backgroundColor = [UIColor whiteColor];
    _hasPattern = NO;
    _patternType = nil;

    // 初始化重做栈
    _redoStack = [NSMutableArray array];
    // 最低可行实现：使用 UIImageView 叠加层
    self.strokesImageView = [[UIImageView alloc] initWithFrame:self.bounds];
    self.strokesImageView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.strokesImageView.contentMode = UIViewContentModeScaleToFill;
    [self addSubview:self.strokesImageView];

    self.imageCache = [[NSCache alloc] init];
    self.imageCache.countLimit = 24;

    [self setupGestures];
  }
  return self;
}


- (void)setupMetal {
  self.device = MTLCreateSystemDefaultDevice();
  self.commandQueue = [self.device newCommandQueue];

  self.metalView = [[MTKView alloc] initWithFrame:self.bounds device:self.device];
  self.metalView.delegate = self;
  self.metalView.clearColor = MTLClearColorMake(1, 1, 1, 1);
  self.metalView.enableSetNeedsDisplay = YES;
  self.metalView.paused = YES;
  [self addSubview:self.metalView];
}

static const CGFloat kUnifiedPanMinDelta = 0.35;
static const CGFloat kUnifiedMinScale = 0.5;
static const CGFloat kUnifiedMaxScale = 4.0;

- (BOOL)isDrawingToolActive
{
  NSSet *drawingTools = [NSSet setWithArray:@[@"pen", @"highlighter", @"marker", @"pencil", @"brush", @"eraser", @"shape", @"laser", @"select", @"lasso", @"text"]];
  return [drawingTools containsObject:(self.currentTool ?: @"pen")];
}

- (CGPoint)screenToWorld:(CGPoint)screenPoint
{
  CGPoint center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
  CGFloat scale = MAX(0.1, self.viewportScale);
  return CGPointMake(self.viewportX + (screenPoint.x - center.x) / scale,
                     self.viewportY + (screenPoint.y - center.y) / scale);
}

- (CGPoint)worldToScreen:(CGPoint)worldPoint
{
  CGPoint center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
  return CGPointMake((worldPoint.x - self.viewportX) * self.viewportScale + center.x,
                     (worldPoint.y - self.viewportY) * self.viewportScale + center.y);
}

- (void)emitViewportChange
{
  if (self.onViewportChange) {
    self.onViewportChange(@{ @"x": @(self.viewportX), @"y": @(self.viewportY), @"scale": @(self.viewportScale) });
  }
}

- (void)setupGestures {
  UIPinchGestureRecognizer *pinch = [[UIPinchGestureRecognizer alloc] initWithTarget:self action:@selector(handlePinch:)];
  UIPanGestureRecognizer *pan = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
  pinch.delegate = self;
  pan.delegate = self;
  pan.minimumNumberOfTouches = 1;
  pan.maximumNumberOfTouches = 1;
  [self addGestureRecognizer:pinch];
  [self addGestureRecognizer:pan];
  self.panGestureRecognizer = pan;
  [self updateAllowedTouchTypes];
}

/**
 * 依据「是否绘制工具 + 是否开启防误触」决定平移手势接受哪些触点类型。
 * 绘制工具 + 防误触：只有 Apple Pencil 能触发绘制，手指留给平移；
 * 其余情况：手指也可参与手势。
 */
- (void)updateAllowedTouchTypes
{
  if (!self.panGestureRecognizer) {
    return;
  }

  BOOL palmRejection = YES;
  if (self.toolConfigDictionary[@"palmRejectionEnabled"]) {
    palmRejection = [self.toolConfigDictionary[@"palmRejectionEnabled"] boolValue];
  }

  if ([self isDrawingToolActive] && palmRejection) {
    if (@available(iOS 9.1, *)) {
      self.panGestureRecognizer.allowedTouchTypes = @[ @(UITouchTypePencil) ];
    }
  } else if (@available(iOS 9.1, *)) {
    self.panGestureRecognizer.allowedTouchTypes = @[ @(UITouchTypeDirect), @(UITouchTypePencil) ];
  }
}

- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer
{
  return ([gestureRecognizer isKindOfClass:[UIPinchGestureRecognizer class]] || [otherGestureRecognizer isKindOfClass:[UIPinchGestureRecognizer class]]);
}

- (void)handlePinch:(UIPinchGestureRecognizer *)gesture {
  CGPoint focal = [gesture locationInView:self];
  if (gesture.state == UIGestureRecognizerStateBegan) {
    self.gestureScaleBaseline = self.viewportScale;
    return;
  }

  if (gesture.state == UIGestureRecognizerStateChanged) {
    CGFloat oldScale = MAX(0.1, self.viewportScale);
    CGPoint center = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
    CGPoint worldAtFocalBefore = [self screenToWorld:focal];

    CGFloat newScale = self.gestureScaleBaseline * gesture.scale;
    self.viewportScale = MAX(kUnifiedMinScale, MIN(kUnifiedMaxScale, newScale));

    self.viewportX = worldAtFocalBefore.x - (focal.x - center.x) / self.viewportScale;
    self.viewportY = worldAtFocalBefore.y - (focal.y - center.y) / self.viewportScale;

    if (fabs(oldScale - self.viewportScale) > 0.0001) {
      [self emitViewportChange];
      [self.metalView setNeedsDisplay];
      [self redrawStrokesOnOverlay];
    }
  }
}

- (void)handlePan:(UIPanGestureRecognizer *)gesture {
  CGPoint location = [gesture locationInView:self];
  BOOL drawingMode = [self isDrawingToolActive];

  if (!drawingMode) {
    CGPoint translation = [gesture translationInView:self];

    if (gesture.state == UIGestureRecognizerStateBegan) {
      self.isCanvasPanning = YES;
      self.lastPanTranslation = translation;
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
      [self emitViewportChange];
      [self.metalView setNeedsDisplay];
      [self redrawStrokesOnOverlay];
      return;
    }

    if (gesture.state == UIGestureRecognizerStateEnded || gesture.state == UIGestureRecognizerStateCancelled) {
      self.isCanvasPanning = NO;
      return;
    }
    return;
  }

  switch (gesture.state) {
    case UIGestureRecognizerStateBegan:
      [self startToolAtPoint:location];
      break;
    case UIGestureRecognizerStateChanged:
      [self continueToolToPoint:location];
      break;
    case UIGestureRecognizerStateEnded:
    case UIGestureRecognizerStateCancelled:
      [self endTool];
      break;
    default:
      break;
  }
}

- (void)drawInMTKView:(MTKView *)view {
  id<MTLCommandBuffer> commandBuffer = [self.commandQueue commandBuffer];
  MTLRenderPassDescriptor *renderPassDescriptor = view.currentRenderPassDescriptor;

  if (renderPassDescriptor) {

    id<MTLRenderCommandEncoder> encoder = [commandBuffer renderCommandEncoderWithDescriptor:renderPassDescriptor];

    // 渲染背景样式
    [self renderBackgroundWithEncoder:encoder];

    // 渲染笔迹（占位）
    // TODO: 实现笔迹渲染

    [encoder endEncoding];
    [commandBuffer presentDrawable:view.currentDrawable];
    [commandBuffer commit];
  }
}

- (void)renderBackgroundWithEncoder:(id<MTLRenderCommandEncoder>)encoder {
  // 背景色已通过 clearColor 设置，这里处理图案
  if (self.hasPattern && self.patternType) {
    // 使用Core Graphics预渲染图案到纹理
    [self renderPatternToTexture];
  }

  // 占位：避免空encoder
  (void)encoder;
}

- (void)renderPatternToTexture {
  if (!self.hasPattern || !self.patternType) return;

  CGSize size = self.bounds.size;
  if (size.width <= 0 || size.height <= 0) return;

  UIGraphicsBeginImageContextWithOptions(size, NO, [UIScreen mainScreen].scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  // 设置图案颜色
  CGContextSetStrokeColorWithColor(context, [[UIColor lightGrayColor] colorWithAlphaComponent:0.3].CGColor);
  CGContextSetLineWidth(context, 1.0);

  if ([self.patternType isEqualToString:@"grid"]) {
    const CGFloat gridSize = 50.0;
    // 绘制垂直线
    for (CGFloat x = 0; x < size.width; x += gridSize) {
      CGContextMoveToPoint(context, x, 0);
      CGContextAddLineToPoint(context, x, size.height);
    }
    // 绘制水平线
    for (CGFloat y = 0; y < size.height; y += gridSize) {
      CGContextMoveToPoint(context, 0, y);
      CGContextAddLineToPoint(context, size.width, y);
    }
    CGContextStrokePath(context);

  } else if ([self.patternType isEqualToString:@"lines"]) {
    const CGFloat lineSpacing = 30.0;
    for (CGFloat y = lineSpacing; y < size.height; y += lineSpacing) {
      CGContextMoveToPoint(context, 20, y);
      CGContextAddLineToPoint(context, size.width - 20, y);
    }
    CGContextStrokePath(context);
  }

  UIImage *patternImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  // TODO: 将patternImage转换为Metal纹理并渲染
  (void)patternImage;
}

- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {}

- (void)setCanvasId:(NSString *)canvasId {}

// 尺寸变化时内容层要跟着改尺寸并重建：所有绘制都以屏幕坐标算，
// 不重建的话旋转/分屏后会留在旧尺寸上。
- (void)layoutSubviews {
  [super layoutSubviews];
  self.strokesImageView.frame = self.bounds;
  [self redrawStrokesOnOverlay];
}

- (void)setViewport:(NSDictionary *)viewport {
  if (viewport[@"x"]) self.viewportX = [viewport[@"x"] doubleValue];
  if (viewport[@"y"]) self.viewportY = [viewport[@"y"] doubleValue];
  if (viewport[@"scale"]) self.viewportScale = [viewport[@"scale"] doubleValue];
  // 视口变化后必须重建内容层，否则 JS 侧编程式移动视口时笔迹不会跟随。
  [self redrawStrokesOnOverlay];
  [self.metalView setNeedsDisplay];
}
- (void)setStyleConfig:(NSDictionary *)config {
  if (config && config[@"background"]) {
    self.backgroundStyle = config[@"background"];
    [self applyBackgroundStyle];
    NSLog(@"[NativeInfiniteCanvasView] 画布样式已设置: %@", self.backgroundStyle);
  }
}

- (void)applyBackgroundStyle {
  if ([self.backgroundStyle isEqualToString:@"white"]) {
    self.backgroundColor = [UIColor whiteColor];
    self.hasPattern = NO;
    self.patternType = nil;
  } else if ([self.backgroundStyle isEqualToString:@"yellow"]) {
    self.backgroundColor = [UIColor colorWithRed:0.97 green:0.97 blue:0.86 alpha:1.0]; // #FFF8DC
    self.hasPattern = NO;
    self.patternType = nil;
  } else if ([self.backgroundStyle isEqualToString:@"grid"]) {
    self.backgroundColor = [UIColor whiteColor];
    self.hasPattern = YES;
    self.patternType = @"grid";
  } else if ([self.backgroundStyle isEqualToString:@"lines"]) {
    self.backgroundColor = [UIColor whiteColor];
    self.hasPattern = YES;
    self.patternType = @"lines";
  } else {
    self.backgroundColor = [UIColor whiteColor];
    self.hasPattern = NO;
    self.patternType = nil;
  }

  // 更新Metal视图的背景色
  if (self.metalView) {
    CGFloat red, green, blue, alpha;
    [self.backgroundColor getRed:&red green:&green blue:&blue alpha:&alpha];
    self.metalView.clearColor = MTLClearColorMake(red, green, blue, alpha);
  }

  [self.metalView setNeedsDisplay];
}

- (void)setCurrentTool:(NSString *)tool {
  self.currentTool = tool;
  NSLog(@"[NativeInfiniteCanvasView] 工具切换到: %@", tool);
  [self updateAllowedTouchTypes];
}

- (void)setCurrentColor:(NSString *)color {
  self.currentColor = [self colorFromHexString:color];
  NSLog(@"[NativeInfiniteCanvasView] 颜色更新: %@", color);
}

- (void)setCurrentStrokeWidth:(CGFloat)width {
  self.currentStrokeWidth = width;
  NSLog(@"[NativeInfiniteCanvasView] 线宽更新: %.2f", width);
}

- (void)setToolConfig:(NSString *)configJson {
  NSError *error = nil;
  NSDictionary *config = [NSJSONSerialization JSONObjectWithData:[configJson dataUsingEncoding:NSUTF8StringEncoding]
                                                        options:0
                                                          error:&error];
  if (error) {
    NSLog(@"[NativeInfiniteCanvasView] 解析工具配置失败: %@", error);
    return;
  }

  self.toolConfigDictionary = config;
  NSLog(@"[NativeInfiniteCanvasView] 工具配置更新: %@", config);

  if (config[@"shape"]) {
    self.currentShape = config[@"shape"];
  }
  [self updateAllowedTouchTypes];
  [self redrawStrokesOnOverlay];
  [self.metalView setNeedsDisplay];
}

/** 交互模式：ink 只画、gesture 只手势、mixed 二者并存。 */
- (void)setInteractionMode:(NSString *)mode
{
  if (!mode || mode.length == 0) {
    return;
  }
  NSMutableDictionary *next = [self.toolConfigDictionary mutableCopy] ?: [NSMutableDictionary dictionary];
  next[@"interactionMode"] = mode;
  self.toolConfigDictionary = next;
  NSLog(@"[NativeInfiniteCanvasView] 交互模式更新: %@", mode);
}

/** 通知 JS 撤销/重做是否可用。 */
- (void)emitHistoryStateChange
{
  if (!self.onHistoryStateChange) {
    return;
  }
  self.onHistoryStateChange(@{
    @"canUndo": @(self.strokeOrder.count > 0),
    @"canRedo": @(self.redoStack.count > 0)
  });
}

// MARK: - 工具实现

- (void)startToolAtPoint:(CGPoint)point
{
  // 在开始新操作前，清除之前的套索选择
  if (self.lassoLayer) {
    [self.lassoLayer removeFromSuperlayer];
    self.lassoLayer = nil;
    self.lassoPath = nil;
    [self.selectedStrokes removeAllObjects];
  }

  NSLog(@"[NativeInfiniteCanvasView] 开始工具操作: %@", self.currentTool);

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

- (CGFloat)clampedStrokeIntensity:(CGFloat)intensity
{
  return MAX(0.62, MIN(1.65, intensity));
}

- (CGFloat)dynamicStrokeWidthWithIntensity:(CGFloat)intensity
{
  CGFloat minWidth = MAX(0.6, self.currentStrokeWidth * 0.45);
  return MAX(minWidth, self.currentStrokeWidth * [self clampedStrokeIntensity:intensity]);
}

- (CGFloat)strokeIntensityForSpeed:(CGFloat)speed
{
  // 速度越快，强度越小（更细）；速度越慢，强度越大（更饱满）
  CGFloat normalized = MIN(MAX(speed / 1800.0, 0.0), 1.0);
  CGFloat targetIntensity = 1.28 - normalized * 0.46;
  return [self clampedStrokeIntensity:targetIntensity];
}

// 默认绘图工具
- (void)startStrokeAtPoint:(CGPoint)point
{
  CGPoint worldPoint = [self screenToWorld:point];
  self.currentStroke = [NSMutableArray arrayWithObject:[NSValue valueWithCGPoint:worldPoint]];
  self.lastStrokePoint = worldPoint;
  self.lastStrokeTimestamp = CACurrentMediaTime();
  self.filteredStrokeSpeed = 0.0;
  self.lastStrokeIntensity = 1.15;
  self.activeStrokeWidth = [self dynamicStrokeWidthWithIntensity:self.lastStrokeIntensity];
  [self.metalView setNeedsDisplay];
}

- (void)continueStrokeToPoint:(CGPoint)point
{
  if (self.currentStroke) {
    CGPoint worldPoint = [self screenToWorld:point];

    CGFloat dx = worldPoint.x - self.lastStrokePoint.x;
    CGFloat dy = worldPoint.y - self.lastStrokePoint.y;
    CGFloat distance = sqrt(dx * dx + dy * dy);

    CFTimeInterval now = CACurrentMediaTime();
    CFTimeInterval deltaTime = MAX(0.001, now - self.lastStrokeTimestamp);
    CGFloat instantSpeed = distance / deltaTime;

    // 低通滤波：抑制单点抖动带来的速度尖峰
    self.filteredStrokeSpeed = self.filteredStrokeSpeed * 0.72 + instantSpeed * 0.28;

    CGFloat targetIntensity = [self strokeIntensityForSpeed:self.filteredStrokeSpeed];
    CGFloat blendedIntensity = self.lastStrokeIntensity * 0.70 + targetIntensity * 0.30;

    // 转折保真：短距离急转时适度回增线宽，避免转角变尖/断裂感
    CGFloat turnBoost = MIN(distance / 12.0, 0.12);
    blendedIntensity = [self clampedStrokeIntensity:(blendedIntensity + turnBoost)];

    self.activeStrokeWidth = [self dynamicStrokeWidthWithIntensity:blendedIntensity];

    CGPoint midPoint = CGPointMake((self.lastStrokePoint.x + worldPoint.x) * 0.5,
                                   (self.lastStrokePoint.y + worldPoint.y) * 0.5);
    [self.currentStroke addObject:[NSValue valueWithCGPoint:midPoint]];
    [self.currentStroke addObject:[NSValue valueWithCGPoint:worldPoint]];

    self.lastStrokePoint = worldPoint;
    self.lastStrokeTimestamp = now;
    self.lastStrokeIntensity = blendedIntensity;
    [self.metalView setNeedsDisplay];
  }
}

- (void)endStroke
{
  if (self.currentStroke && self.currentStroke.count > 1) {
    NSString *strokeId = [[NSUUID UUID] UUIDString];
    NSDictionary *strokeData = @{
      @"id": strokeId,
      @"points": [self.currentStroke copy],
      @"color": [self hexFromColor:self.currentColor],
      @"width": @(self.activeStrokeWidth > 0 ? self.activeStrokeWidth : self.currentStrokeWidth),
      @"tool": self.currentTool
    };

    self.strokesDict[strokeId] = strokeData;
    [self.strokeOrder addObject:strokeId];

    // A new stroke was added, so clear the redo stack
    [self.redoStack removeAllObjects];

    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{
        @"strokeId": strokeId,
        @"tool": self.currentTool
      });
    }
    [self emitHistoryStateChange];

    self.currentStroke = nil;
    self.lastStrokePoint = CGPointZero;
    self.lastStrokeTimestamp = 0;
    self.filteredStrokeSpeed = 0;
    self.lastStrokeIntensity = 1.0;
    self.activeStrokeWidth = 0;
    [self.metalView setNeedsDisplay];
    [self redrawStrokesOnOverlay];
  }
}

// 橡皮擦工具
- (void)startErasingAtPoint:(CGPoint)point
{
  NSLog(@"[NativeInfiniteCanvasView] 开始橡皮擦");
  [self eraseAtPoint:point];
}

- (void)continueErasingToPoint:(CGPoint)point
{
  [self eraseAtPoint:point];
}

- (void)endErasing
{
  NSLog(@"[NativeInfiniteCanvasView] 橡皮擦结束");
  [self.erasedStrokeIds removeAllObjects];
}

- (void)eraseAtPoint:(CGPoint)point
{
  if (self.strokeOrder.count == 0) return;

  // 入参是屏幕坐标（来自手势），而笔迹点存的是世界坐标：
  // 不换算的话放大/平移之后橡皮擦会「擦不到笔迹」。
  CGPoint worldPoint = [self screenToWorld:point];

  // 橡皮擦半径要把视图缩放折算进世界坐标，否则放大后橡皮擦显得变小。
  CGFloat eraserRadius = (self.currentStrokeWidth * 3) / MAX(0.1, self.viewportScale);

  // 从后往前检查（后画的在上面，优先被擦）
  for (NSInteger i = (NSInteger)self.strokeOrder.count - 1; i >= 0; i--) {
    NSString *strokeId = self.strokeOrder[(NSUInteger)i];
    NSDictionary *stroke = self.strokesDict[strokeId];
    if (![stroke isKindOfClass:[NSDictionary class]]) continue;

    NSArray *points = stroke[@"points"];
    if (![points isKindOfClass:[NSArray class]] || points.count == 0) continue;

    BOOL shouldErase = NO;

    // 方法1: 检查橡皮擦点是否在笔迹附近
    for (NSValue *pointValue in points) {
      CGPoint strokePoint = [pointValue CGPointValue];
      CGFloat distance = sqrt(pow(worldPoint.x - strokePoint.x, 2) + pow(worldPoint.y - strokePoint.y, 2));
      if (distance <= eraserRadius) {
        shouldErase = YES;
        break;
      }
    }

    // 方法2: 检查笔迹边界是否与橡皮擦区域相交
    if (!shouldErase) {
      CGRect strokeBounds = [self calculateStrokeBounds:points];
      CGRect eraserRect = CGRectMake(worldPoint.x - eraserRadius, worldPoint.y - eraserRadius,
                                   eraserRadius * 2, eraserRadius * 2);
      if (CGRectIntersectsRect(strokeBounds, eraserRect)) {
        shouldErase = YES;
      }
    }

    if (shouldErase) {
      [self.strokesDict removeObjectForKey:strokeId];
      [self.strokeOrder removeObjectAtIndex:(NSUInteger)i];
      // 旧代码写成 [self.redrawStrokesOnOverlay]（点语法当消息用），
      // 是既有编译错误；这里改为正常的消息发送，并真正触发重绘。
      [self redrawStrokesOnOverlay];
      [self.metalView setNeedsDisplay];
      NSLog(@"[NativeInfiniteCanvasView] 擦除笔迹 %@", strokeId);
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
  NSLog(@"[NativeInfiniteCanvasView] 开始文本输入");

  // 入参是屏幕坐标，而记录一律存世界坐标（见 redrawStrokesOnOverlay 的变换）；
  // 输入框是 UI 控件，仍用屏幕坐标定位。
  self.textInputPoint = [self screenToWorld:point];

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
  NSLog(@"[NativeInfiniteCanvasView] 文本输入完成: %@", text);

  if (text.length > 0) {
    // 画布内输入的文字也要带样式与坐标，走同一条落库路径（可导出/导入还原）。
    CGFloat fontSize = self.textInputView.font.pointSize;
    NSString *styleJson = [self jsonStringFromObject:@{
      @"x": @(self.textInputPoint.x),
      @"y": @(self.textInputPoint.y),
      @"fontSize": @(fontSize),
      @"color": [self hexFromColor:self.currentColor],
      @"alignment": @"left",
    }];

    [self.textInputView removeFromSuperview];
    self.textInputView = nil;
    [self insertText:text styleJson:styleJson];
    return;
  }

  [self.textInputView removeFromSuperview];
  self.textInputView = nil;
}

// MARK: - 文本 / 图片命令

/**
 * 插入文本（JS 协议命令 addText 落到这里）。
 *
 * 此前无限画布的命令表里根本没有 addText，JS 发过来的 addText 在别名解析阶段
 * 就找不到命令而被静默丢弃；即使到达，旧实现也只把它塞进一个不存在的
 * self.strokes 数组。现在按坐标+样式真正落库，并在下次重绘时画出来。
 *
 * @param styleJson fontSize/color/bold/italic/underline/alignment，可选 x/y
 */
- (void)insertText:(NSString *)text styleJson:(NSString *)styleJson
{
  if (![text isKindOfClass:[NSString class]] || text.length == 0) {
    NSLog(@"[NativeInfiniteCanvasView] addText: 文本为空，忽略");
    return;
  }

  NSDictionary *style = [self dictionaryFromJSONString:styleJson];
  CGFloat fontSize = [style[@"fontSize"] doubleValue];
  if (!(fontSize > 0)) {
    fontSize = 16.0;
  }
  // 默认落点＝当前视口中心（世界坐标），与「不给坐标就放在看得到的地方」一致。
  CGFloat x = style[@"x"] != nil ? [style[@"x"] doubleValue] : self.viewportX;
  CGFloat y = style[@"y"] != nil ? [style[@"y"] doubleValue] : self.viewportY;

  NSString *textId = [[NSUUID UUID] UUIDString];
  self.strokesDict[textId] = @{
    @"id": textId,
    @"type": @"text",
    @"text": text,
    @"position": NSStringFromCGPoint(CGPointMake(x, y)),
    @"x": @(x),
    @"y": @(y),
    @"fontSize": @(fontSize),
    @"color": [self normalizedColorHex:style[@"color"] fallback:self.currentColor],
    @"bold": @([style[@"bold"] boolValue]),
    @"italic": @([style[@"italic"] boolValue]),
    @"underline": @([style[@"underline"] boolValue]),
    @"alignment": [self normalizedAlignment:style[@"alignment"]],
    @"tool": @"text"
  };
  [self.strokeOrder addObject:textId];
  [self.redoStack removeAllObjects];

  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": textId,
      @"tool": @"text",
      @"text": text
    });
  }

  [self emitHistoryStateChange];
  [self redrawStrokesOnOverlay];
  [self.metalView setNeedsDisplay];
}

/** 兼容旧签名：不带样式时按默认样式插入（JS 协议名 addTextElement 的别名路径）。 */
- (void)insertText:(NSString *)text {
  [self insertText:text styleJson:nil];
}

/** 兼容旧命名：历史上叫 addTextElement。 */
- (void)addTextElement:(NSString *)text {
  [self insertText:text styleJson:nil];
}

// MARK: - 选中笔迹操作（JS 协议命令 deleteSelectedStrokes / duplicateSelectedStrokes /
//         moveSelectedStrokes / clearStrokeSelection）

/** 解析 JS 下发的选中 id 数组（JSON 字符串）。 */
- (NSArray<NSString *> *)strokeIdsFromJSON:(NSString *)json
{
  if (![json isKindOfClass:[NSString class]] || json.length == 0) {
    return @[];
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![parsed isKindOfClass:[NSArray class]]) {
    return @[];
  }
  NSMutableArray<NSString *> *ids = [NSMutableArray array];
  for (id item in parsed) {
    if ([item isKindOfClass:[NSString class]] && [item length] > 0) {
      [ids addObject:item];
    }
  }
  return ids;
}

/** 删除选中的笔迹。 */
- (void)deleteSelectedStrokes:(NSString *)strokeIdsJson
{
  NSArray<NSString *> *ids = [self strokeIdsFromJSON:strokeIdsJson];
  if (ids.count == 0) {
    return;
  }
  for (NSString *strokeId in ids) {
    [self.strokesDict removeObjectForKey:strokeId];
    [self.strokeOrder removeObject:strokeId];
  }
  [self.selectedStrokes removeAllObjects];
  [self.redoStack removeAllObjects];
  [self redrawStrokesOnOverlay];
  [self.metalView setNeedsDisplay];
  [self emitHistoryStateChange];
}

/** 复制选中的笔迹（偏移 dx/dy）。 */
- (void)duplicateSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy
{
  NSArray<NSString *> *ids = [self strokeIdsFromJSON:strokeIdsJson];
  if (ids.count == 0) {
    return;
  }
  NSMutableArray<NSString *> *newIds = [NSMutableArray array];
  for (NSString *strokeId in ids) {
    NSDictionary *stroke = self.strokesDict[strokeId];
    if (![stroke isKindOfClass:[NSDictionary class]]) continue;
    NSString *copyId = [[NSUUID UUID] UUIDString];
    NSMutableDictionary *copy = [[self strokeEntryCopy:stroke offsetX:dx offsetY:dy] mutableCopy];
    if (!copy) continue;
    copy[@"id"] = copyId;
    self.strokesDict[copyId] = copy;
    [newIds addObject:copyId];
  }
  if (newIds.count == 0) {
    return;
  }
  // 副本排在最后（保持一致的重绘顺序：后画者在上）
  [self.strokeOrder addObjectsFromArray:newIds];
  [self.redoStack removeAllObjects];
  [self redrawStrokesOnOverlay];
  [self.metalView setNeedsDisplay];
  [self emitHistoryStateChange];
}

/** 移动选中的笔迹（原地替换，保留 id）。 */
- (void)moveSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy
{
  NSArray<NSString *> *ids = [self strokeIdsFromJSON:strokeIdsJson];
  if (ids.count == 0) {
    return;
  }
  BOOL moved = NO;
  for (NSString *strokeId in ids) {
    NSDictionary *stroke = self.strokesDict[strokeId];
    if (![stroke isKindOfClass:[NSDictionary class]]) continue;
    NSMutableDictionary *shifted = [self strokeEntryCopy:stroke offsetX:dx offsetY:dy];
    if (!shifted) continue;
    shifted[@"id"] = strokeId;
    self.strokesDict[strokeId] = shifted;
    moved = YES;
  }
  if (!moved) {
    return;
  }
  [self.redoStack removeAllObjects];
  [self redrawStrokesOnOverlay];
  [self.metalView setNeedsDisplay];
  [self emitHistoryStateChange];
}

/** 清除选中态。 */
- (void)clearStrokeSelection
{
  [self.selectedStrokes removeAllObjects];
  [self.lassoLayer removeFromSuperlayer];
  self.lassoLayer = nil;
  self.lassoPath = nil;
  if (self.onStrokesSelected) {
    self.onStrokesSelected(@{ @"strokeIds": @[], @"count": @(0) });
  }
}

/**
 * 复制/偏移一条记录。
 *
 * points 用 NSValue 数组存世界坐标；文本/图片/形状用坐标字段。
 * 必须按类型分别偏移，只改 position 的话笔迹点不动，
 * 副本会与原笔迹完全重叠（用户以为「复制没反应」）。
 */
- (NSMutableDictionary *)strokeEntryCopy:(NSDictionary *)entry offsetX:(CGFloat)dx offsetY:(CGFloat)dy
{
  if (![entry isKindOfClass:[NSDictionary class]]) {
    return nil;
  }
  NSMutableDictionary *copy = [entry mutableCopy];

  NSArray *points = entry[@"points"];
  if ([points isKindOfClass:[NSArray class]] && points.count > 0) {
    NSMutableArray *shifted = [NSMutableArray arrayWithCapacity:points.count];
    for (NSValue *value in points) {
      if (![value isKindOfClass:[NSValue class]]) continue;
      CGPoint p = [value CGPointValue];
      [shifted addObject:[NSValue valueWithCGPoint:CGPointMake(p.x + dx, p.y + dy)]];
    }
    copy[@"points"] = shifted;
  }

  if (copy[@"position"]) {
    CGPoint center = CGPointFromString(copy[@"position"]);
    copy[@"position"] = NSStringFromCGPoint(CGPointMake(center.x + dx, center.y + dy));
  }
  if (copy[@"x"]) {
    copy[@"x"] = @([copy[@"x"] doubleValue] + dx);
  }
  if (copy[@"y"]) {
    copy[@"y"] = @([copy[@"y"] doubleValue] + dy);
  }
  if (copy[@"startPoint"]) {
    CGPoint p = CGPointFromString(copy[@"startPoint"]);
    copy[@"startPoint"] = NSStringFromCGPoint(CGPointMake(p.x + dx, p.y + dy));
  }
  if (copy[@"endPoint"]) {
    CGPoint p = CGPointFromString(copy[@"endPoint"]);
    copy[@"endPoint"] = NSStringFromCGPoint(CGPointMake(p.x + dx, p.y + dy));
  }
  return copy;
}

/** 把对象序列化成 JSON 字符串（命令参数需要字符串形态）。 */
- (NSString *)jsonStringFromObject:(NSDictionary *)object
{
  NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
  return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
}

/** 解析命令里的 JSON 字符串；脏数据当空字典，绝不中断渲染。 */
- (NSDictionary *)dictionaryFromJSONString:(NSString *)json
{
  if (![json isKindOfClass:[NSString class]] || json.length == 0) {
    return @{};
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  if (!data) return @{};
  id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  return [parsed isKindOfClass:[NSDictionary class]] ? parsed : @{};
}

/** 颜色合法性校验：非法色值回落到当前颜色。 */
- (NSString *)normalizedColorHex:(id)value fallback:(UIColor *)fallback
{
  if ([value isKindOfClass:[NSString class]] && [value hasPrefix:@"#"] &&
      ([value length] == 7 || [value length] == 9)) {
    return value;
  }
  return [self hexFromColor:fallback];
}

/** 对齐值收敛到三种，未知按左对齐。 */
- (NSString *)normalizedAlignment:(id)value
{
  if ([value isKindOfClass:[NSString class]] &&
      ([value isEqualToString:@"left"] || [value isEqualToString:@"center"] || [value isEqualToString:@"right"])) {
    return value;
  }
  return @"left";
}

// CGPathApply 的回调是 C 函数指针（不能写 block），用上下文结构体
// 携带「视图（做 worldToScreen 换算）」与「输出路径」。
typedef struct {
  __unsafe_unretained NativeInfiniteCanvasView *view;
  __unsafe_unretained UIBezierPath *output;
} ZeroIsleLassoConvertContext;

static void ZeroIsleLassoConvert(void *info, const CGPathElement *element)
{
  ZeroIsleLassoConvertContext *ctx = (ZeroIsleLassoConvertContext *)info;
  NativeInfiniteCanvasView *view = ctx->view;
  UIBezierPath *out = ctx->output;
  if (!view || !out) return;

  const CGPoint *points = element->points;
  switch (element->type) {
    case kCGPathElementMoveToPoint:
      [out moveToPoint:[view worldToScreen:points[0]]];
      break;
    case kCGPathElementAddLineToPoint:
      [out addLineToPoint:[view worldToScreen:points[0]]];
      break;
    case kCGPathElementCloseSubpath:
      [out closePath];
      break;
    default:
      // 套索只由直线段构成，其它元素按直线处理即可。
      [out addLineToPoint:[view worldToScreen:points[0]]];
      break;
  }
}

// 套索选择工具
- (void)startLassoSelectionAtPoint:(CGPoint)point
{
  NSLog(@"[NativeInfiniteCanvasView] 开始套索选择");

  // 命中判定用的 lassoPath 存世界坐标（笔迹点也是世界坐标）；
  // 显示用的 layer 是屏幕坐标，必须分开维护，否则套索会与画面错位。
  self.lassoPath = [UIBezierPath bezierPath];
  [self.lassoPath moveToPoint:[self screenToWorld:point]];

  self.lassoLayer = [CAShapeLayer layer];
  self.lassoLayer.strokeColor = [UIColor blueColor].CGColor;
  self.lassoLayer.fillColor = [[UIColor blueColor] colorWithAlphaComponent:0.1].CGColor;
  self.lassoLayer.lineWidth = 2.0;
  self.lassoLayer.lineDashPattern = @[@5, @3];

  [self.layer addSublayer:self.lassoLayer];
  [self updateLassoLayerFromWorldPath];
}

/** 世界坐标 lassoPath -> 屏幕坐标显示路径。 */
- (void)updateLassoLayerFromWorldPath
{
  if (!self.lassoPath || !self.lassoLayer) {
    return;
  }
  UIBezierPath *screenPath = [UIBezierPath bezierPath];
  CGPathApply(self.lassoPath.CGPath, (__bridge void *)screenPath, ZeroIsleLassoConvert);
  self.lassoLayer.path = screenPath.CGPath;
}

- (void)continueLassoSelectionToPoint:(CGPoint)point
{
  if (self.lassoPath) {
    [self.lassoPath addLineToPoint:[self screenToWorld:point]];
    [self updateLassoLayerFromWorldPath];
  }
}

/**
 * 用 JS 下发的套索路径更新当前选区。
 *
 * 为什么需要：工具栏的「套索」按钮是在 JS 侧收集手势点的，命令表里
 * lassoStart/lassoUpdate 此前没有 switch 分支，选中的路径永远到不了原生，
 * 表现为「套一圈什么都没选中」。这里把 JSON 点串还原成 UIBezierPath。
 */
- (void)updateLassoFromJSON:(NSString *)json
{
  if (![json isKindOfClass:[NSString class]] || json.length == 0) {
    return;
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  NSArray *pointArray = nil;
  if ([parsed isKindOfClass:[NSArray class]]) {
    pointArray = parsed;
  } else if ([parsed isKindOfClass:[NSDictionary class]] && [parsed[@"points"] isKindOfClass:[NSArray class]]) {
    pointArray = parsed[@"points"];
  }
  if (pointArray.count == 0) {
    return;
  }

  // JS 侧的套索点是屏幕坐标，存成世界坐标用于命中判定；
  // 显示按世界坐标算回屏幕，保证换视口后仍对齐。
  UIBezierPath *path = [UIBezierPath bezierPath];
  BOOL first = YES;
  for (NSDictionary *pt in pointArray) {
    if (![pt isKindOfClass:[NSDictionary class]]) continue;
    CGPoint screenPoint = CGPointMake([pt[@"x"] doubleValue], [pt[@"y"] doubleValue]);
    CGPoint worldPoint = [self screenToWorld:screenPoint];
    if (first) {
      [path moveToPoint:worldPoint];
      first = NO;
    } else {
      [path addLineToPoint:worldPoint];
    }
  }
  if (path.isEmpty) {
    return;
  }

  [self.lassoLayer removeFromSuperlayer];
  self.lassoPath = path;
  self.lassoLayer = [CAShapeLayer layer];
  self.lassoLayer.strokeColor = [UIColor blueColor].CGColor;
  self.lassoLayer.fillColor = [[UIColor blueColor] colorWithAlphaComponent:0.1].CGColor;
  self.lassoLayer.lineWidth = 2.0;
  self.lassoLayer.lineDashPattern = @[@5, @3];
  [self.layer addSublayer:self.lassoLayer];
  [self updateLassoLayerFromWorldPath];
}

- (void)endLassoSelection
{
  // 没有路径时不能直接 return：JS 可能只发 lassoComplete，
  // 此时应当至少把上一次的选区高亮清掉。
  if (!self.lassoPath) {
    [self.lassoLayer removeFromSuperlayer];
    self.lassoLayer = nil;
    [self.selectedStrokes removeAllObjects];
    if (self.onStrokesSelected) {
      self.onStrokesSelected(@{@"strokeIds": @[]});
    }
    return;
  }

  [self.lassoPath closePath];
  [self updateLassoLayerFromWorldPath];

  NSLog(@"[NativeInfiniteCanvasView] 套索选择完成");

  // 查找套索内的笔迹
  [self.selectedStrokes removeAllObjects];
  NSMutableArray<NSString *> *selectedStrokeIds = [NSMutableArray array];

  for (NSString *strokeId in self.strokeOrder) {
    NSDictionary *stroke = self.strokesDict[strokeId];
    if (!stroke) continue;

    NSArray *points = stroke[@"points"];
    if (!points || points.count == 0) continue;

    BOOL isSelected = [self isStrokeSelected:points byLassoPath:self.lassoPath];

    if (isSelected) {
      [selectedStrokeIds addObject:strokeId];
    }
  }

  NSLog(@"[NativeInfiniteCanvasView] 选中 %lu 个笔迹", (unsigned long)selectedStrokeIds.count);

  // 选区必须留在 selectedStrokes 里，否则「清除选中」拿到的是空集合。
  [self.selectedStrokes addObjectsFromArray:selectedStrokeIds];

  if (self.onStrokesSelected) {
    self.onStrokesSelected(@{@"strokeIds": selectedStrokeIds, @"count": @(selectedStrokeIds.count)});
  }

  // 清除套索路径，因为识别已触发
  [self.lassoLayer removeFromSuperlayer];
  self.lassoLayer = nil;
  self.lassoPath = nil;
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
  NSLog(@"[NativeInfiniteCanvasView] 开始绘制形状: %@", self.currentShape);

  // 入参是屏幕坐标；落库用世界坐标，预览层用屏幕坐标。
  self.shapeStartPoint = [self screenToWorld:point];
  self.shapeEndPoint = self.shapeStartPoint;

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
    // 预览直接画在屏幕坐标上；同时更新世界坐标终点（不能从 layer 反读，
    // 那是屏幕坐标，存进库会让形状在换缩放级别后错位）。
    UIBezierPath *shapePath = [self createShapePathFrom:[self worldToScreen:self.shapeStartPoint]
                                                     to:point
                                              shapeName:self.currentShape];
    self.shapePreviewLayer.path = shapePath.CGPath;
    self.shapeEndPoint = [self screenToWorld:point];
  }
}

- (void)endShape
{
  if (self.shapePreviewLayer) {
    NSLog(@"[NativeInfiniteCanvasView] 形状绘制完成");

    // 保存形状：必须写进 strokesDict/strokeOrder（不是不存在的 self.strokes），
    // 否则形状既不会被重绘，也不会被导出。
    NSString *shapeId = [[NSUUID UUID] UUIDString];
    self.strokesDict[shapeId] = @{
      @"id": shapeId,
      @"type": @"shape",
      @"shape": self.currentShape,
      @"startPoint": NSStringFromCGPoint(self.shapeStartPoint),
      // 用显式记录的世界坐标终点；从预览 layer 反读会拿到屏幕坐标。
      @"endPoint": NSStringFromCGPoint(self.shapeEndPoint),
      @"color": [self hexFromColor:self.currentColor],
      @"width": @(self.currentStrokeWidth),
      @"tool": @"shape"
    };
    [self.strokeOrder addObject:shapeId];
    [self.redoStack removeAllObjects];

    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{
        @"strokeId": shapeId,
        @"tool": @"shape"
      });
    }

    [self.shapePreviewLayer removeFromSuperlayer];
    self.shapePreviewLayer = nil;
  }
}

- (UIBezierPath *)createShapePathFrom:(CGPoint)start to:(CGPoint)end
{
  return [self createShapePathFrom:start to:end shapeName:(self.currentShape ?: @"line")];
}

/**
 * 按显式形状名生成路径。
 *
 * 为什么要显式传入：重绘历史形状时不能依赖 self.currentShape——
 * 用户画完矩形后又切到箭头工具，历史矩形会被重绘成箭头。
 */
- (UIBezierPath *)createShapePathFrom:(CGPoint)start to:(CGPoint)end shapeName:(NSString *)shapeName
{
  NSString *shape = shapeName.length > 0 ? shapeName : @"line";
  UIBezierPath *path = [UIBezierPath bezierPath];
  path.lineWidth = self.currentStrokeWidth;
  path.lineCapStyle = kCGLineCapRound;
  path.lineJoinStyle = kCGLineJoinRound;

  if ([shape isEqualToString:@"line"]) {
    [path moveToPoint:start];
    [path addLineToPoint:end];
  } else if ([shape isEqualToString:@"rectangle"]) {
    CGRect rect = CGRectMake(MIN(start.x, end.x), MIN(start.y, end.y),
                            ABS(end.x - start.x), ABS(end.y - start.y));
    [path appendPath:[UIBezierPath bezierPathWithRect:rect]];
  } else if ([shape isEqualToString:@"circle"]) {
    CGRect rect = CGRectMake(MIN(start.x, end.x), MIN(start.y, end.y),
                            ABS(end.x - start.x), ABS(end.y - start.y));
    [path appendPath:[UIBezierPath bezierPathWithOvalInRect:rect]];
  } else if ([shape isEqualToString:@"arrow"]) {
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
  } else if ([shape isEqualToString:@"triangle"]) {
    // 三角形
    CGFloat midX = (start.x + end.x) / 2;
    [path moveToPoint:CGPointMake(midX, start.y)];
    [path addLineToPoint:CGPointMake(start.x, end.y)];
    [path addLineToPoint:CGPointMake(end.x, end.y)];
    [path closePath];
  } else if ([shape isEqualToString:@"diamond"]) {
    // 菱形
    CGFloat midX = (start.x + end.x) / 2;
    CGFloat midY = (start.y + end.y) / 2;
    [path moveToPoint:CGPointMake(midX, start.y)];
    [path addLineToPoint:CGPointMake(end.x, midY)];
    [path addLineToPoint:CGPointMake(midX, end.y)];
    [path addLineToPoint:CGPointMake(start.x, midY)];
    [path closePath];
  } else if ([shape isEqualToString:@"star"]) {
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
  } else if ([shape isEqualToString:@"heart"]) {
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
    // 默认直线
    [path moveToPoint:start];
    [path addLineToPoint:end];
  }

  return path;
}

// 激光笔工具
- (void)startLaserAtPoint:(CGPoint)point
{
  NSLog(@"[NativeInfiniteCanvasView] 开始激光笔");

  // currentStroke 存世界坐标（与笔迹一致）；laserLayer 是屏幕空间，绘制时换算。
  self.currentStroke = [NSMutableArray arrayWithObject:[NSValue valueWithCGPoint:[self screenToWorld:point]]];

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
    [self.currentStroke addObject:[NSValue valueWithCGPoint:[self screenToWorld:point]]];

    // 更新激光笔路径：存的是世界坐标，layer 在屏幕空间，必须逐点换算，
    // 否则平移/缩放后激光轨迹会与手指错位。
    UIBezierPath *laserPath = [UIBezierPath bezierPath];
    for (NSInteger i = 0; i < self.currentStroke.count; i++) {
      CGPoint strokePoint = [self worldToScreen:[self.currentStroke[i] CGPointValue]];
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

  NSLog(@"[NativeInfiniteCanvasView] 激光笔结束，开始淡出");

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

// 辅助方法
- (UIColor *)colorFromHexString:(NSString *)hexString
{
  // 脏数据防御：导入的 JSON 里 color 可能是 null/数字/空串，
  // 直接 [hexString hasPrefix:] 会因 unrecognized selector 崩溃，
  // 一条坏记录就会让整幅画布渲染中断。
  if (![hexString isKindOfClass:[NSString class]] || hexString.length == 0) {
    return [UIColor blackColor];
  }
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

- (NSString *)hexFromColor:(UIColor *)color
{
  // 不用 CGColorGetComponents：灰度色（如 [UIColor blackColor] 在某些色彩空间下）
  // 只有 2 个分量，直接取 [2] 会越界读到垃圾值。getRed:green:blue:alpha: 会
  // 在必要时自动做色彩空间转换，是安全接口。
  CGFloat r = 0, g = 0, b = 0, a = 1;
  if (!color || ![color getRed:&r green:&g blue:&b alpha:&a]) {
    return @"#000000";
  }
  return [NSString stringWithFormat:@"#%02X%02X%02X",
          (int)lround(r * 255), (int)lround(g * 255), (int)lround(b * 255)];
}

// MARK: - 命令方法

- (void)undo {
  if (self.strokeOrder.count > 0) {
    // 将最后一个笔迹ID移到重做栈
    NSString *lastStrokeId = [self.strokeOrder lastObject];
    NSDictionary *lastStroke = self.strokesDict[lastStrokeId];

    if (lastStroke) {
        [self.redoStack addObject:lastStroke];
        [self.strokeOrder removeLastObject];
        [self.strokesDict removeObjectForKey:lastStrokeId];
        [self.metalView setNeedsDisplay];
    [self redrawStrokesOnOverlay];

        NSLog(@"[NativeInfiniteCanvasView] 撤销完成，剩余笔迹: %lu", (unsigned long)self.strokeOrder.count);
    }
  }
  [self emitHistoryStateChange];
}

- (void)redo {
  if (self.redoStack.count > 0) {
    // 将最后一个重做项移回笔迹
    NSDictionary *lastRedoStroke = [self.redoStack lastObject];
    NSString *strokeId = lastRedoStroke[@"id"];

    if (strokeId) {
        [self.redoStack removeLastObject];
        self.strokesDict[strokeId] = lastRedoStroke;
        [self.strokeOrder addObject:strokeId];
        [self.metalView setNeedsDisplay];
        [self redrawStrokesOnOverlay];
        NSLog(@"[NativeInfiniteCanvasView] 重做完成，当前笔迹: %lu", (unsigned long)self.strokeOrder.count);
    }
  }
  [self emitHistoryStateChange];
}

- (void)clear:(NSString *)clearType {
  NSLog(@"[NativeInfiniteCanvasView] 清除类型: %@", clearType);
  NSString *scope = clearType.length > 0 ? clearType : @"current_view";

  if ([scope isEqualToString:@"current_view"] || [scope isEqualToString:@"current_page"]) {
    // 清除当前视图可见区域的笔迹
    // TODO: 实现基于视口的清除
    NSLog(@"[NativeInfiniteCanvasView] 清除当前视图功能待实现");
  } else if ([scope isEqualToString:@"entire_document"] || [scope isEqualToString:@"all"]) {
    // 清除所有笔迹
        [self.strokesDict removeAllObjects];
    [self.strokeOrder removeAllObjects];
    [self.redoStack removeAllObjects]; // Clearing should also clear the redo stack
    [self.metalView setNeedsDisplay];
    [self redrawStrokesOnOverlay];

  } else if ([clearType isEqualToString:@"selected"]) {


    // 清除选中的笔迹
    if (self.selectedStrokes.count > 0) {
      // selectedStrokes 里存的是 strokeId（endLassoSelection 放进去的），
      // 旧实现却把它当数组下标去 removeObjectAtIndex:，属于必然越界的误用。
      for (NSString *strokeId in [self.selectedStrokes copy]) {
        if (![strokeId isKindOfClass:[NSString class]]) continue;
        [self.strokesDict removeObjectForKey:strokeId];
        [self.strokeOrder removeObject:strokeId];
      }
      [self redrawStrokesOnOverlay];

      // 清空选中状态并移除高亮
      [self.selectedStrokes removeAllObjects];
      [self.lassoLayer removeFromSuperlayer];
      self.lassoLayer = nil;
      self.lassoPath = nil;

      [self.metalView setNeedsDisplay];
    }
  }
  [self emitHistoryStateChange];
}

- (void)exportCanvas:(NSString *)canvasId {
  NSLog(@"[NativeInfiniteCanvasView] 导出画布: %@", canvasId);



  @try {
    // 构建导出数据
    NSMutableArray *entriesOut = [NSMutableArray arrayWithCapacity:self.strokeOrder.count];

    for (NSString *strokeId in self.strokeOrder) {
      NSDictionary *stroke = self.strokesDict[strokeId];
      if (![stroke isKindOfClass:[NSDictionary class]]) continue;

      NSDictionary *out = [self exportedEntryFromEntry:stroke];
      if (out) {
        [entriesOut addObject:out];
      }
    }

    // 序列化为JSON：既带 entries（新格式，含文本/图片），也带 strokes（旧读者兼容）
    NSDictionary *payload = @{
      @"canvasId": canvasId ?: @"",
      @"viewport": @{ @"x": @(self.viewportX), @"y": @(self.viewportY), @"scale": @(self.viewportScale) },
      @"entries": entriesOut,
      @"strokes": entriesOut
    };
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
    NSString *jsonStr = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];

    // 触发导出完成事件
    if (self.onExportComplete) {
      self.onExportComplete(@{
        @"canvasId": canvasId ?: @"",
        @"data": jsonStr ?: @"",
        @"success": @YES
      });
    }
  } @catch (NSException *exception) {
    if (self.onExportComplete) {
      self.onExportComplete(@{
        @"canvasId": canvasId ?: @"",
        @"success": @NO,
        @"error": exception.reason ?: @"error"
      });
    }
  }
}

/** 单条记录的导出序列化：文本/图片单独成支，否则「只存 points」会让它们静默丢失。 */
- (NSDictionary *)exportedEntryFromEntry:(NSDictionary *)entry
{
  NSString *type = entry[@"type"] ?: @"stroke";

  if ([type isEqualToString:@"text"]) {
    CGPoint anchor = [self pointFromEntry:entry fallback:CGPointMake(self.viewportX, self.viewportY)];
    CGFloat fontSize = [entry[@"fontSize"] doubleValue];
    if (!(fontSize > 0)) {
      fontSize = 16.0;
    }
    return @{
      @"type": @"text",
      @"text": entry[@"text"] ?: @"",
      @"x": @(anchor.x),
      @"y": @(anchor.y),
      @"fontSize": @(fontSize),
      @"color": entry[@"color"] ?: @"#000000",
      @"bold": @([entry[@"bold"] boolValue]),
      @"italic": @([entry[@"italic"] boolValue]),
      @"underline": @([entry[@"underline"] boolValue]),
      @"alignment": [self normalizedAlignment:entry[@"alignment"]],
      @"tool": @"text"
    };
  }

  if ([type isEqualToString:@"image"]) {
    NSMutableDictionary *out = [@{
      @"type": @"image",
      @"x": @([entry[@"x"] doubleValue]),
      @"y": @([entry[@"y"] doubleValue]),
      @"w": @([entry[@"w"] doubleValue]),
      @"h": @([entry[@"h"] doubleValue]),
      @"tool": @"image"
    } mutableCopy];
    if ([entry[@"fileName"] isKindOfClass:[NSString class]]) {
      out[@"fileName"] = entry[@"fileName"];
    }
    // 导出那一刻才压成 PNG base64：本地路径换设备即失效，内嵌是唯一可靠的还原方式。
    UIImage *image = [self decodedImageForEntry:entry];
    NSData *png = image ? UIImagePNGRepresentation(image) : nil;
    if (png.length > 0) {
      out[@"bitmapBase64"] = [png base64EncodedStringWithOptions:0];
    } else {
      NSLog(@"[NativeInfiniteCanvasView] 导出时无法解码图片，仅保留 uri: %@", entry[@"uri"] ?: @"(无 uri)");
      if ([entry[@"uri"] isKindOfClass:[NSString class]]) {
        out[@"uri"] = entry[@"uri"];
      }
    }
    return out;
  }

  if ([type isEqualToString:@"shape"]) {
    return @{
      @"type": @"shape",
      @"shape": entry[@"shape"] ?: @"line",
      @"startPoint": entry[@"startPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"endPoint": entry[@"endPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"color": entry[@"color"] ?: @"#000000",
      @"strokeWidth": entry[@"width"] ?: @(2.0),
      @"tool": @"shape"
    };
  }

  NSArray *points = [entry[@"points"] isKindOfClass:[NSArray class]] ? entry[@"points"] : @[];
  NSMutableArray *pointsOut = [NSMutableArray arrayWithCapacity:points.count];
  CGFloat entryWidth = [entry[@"width"] doubleValue];
  for (NSValue *pointValue in points) {
    if (![pointValue isKindOfClass:[NSValue class]]) continue;
    CGPoint p = [pointValue CGPointValue];
    CGFloat normalizedPressure = self.currentStrokeWidth > 0 ? entryWidth / self.currentStrokeWidth : 1.0;
    normalizedPressure = [self clampedStrokeIntensity:normalizedPressure];
    [pointsOut addObject:@{ @"x": @(p.x), @"y": @(p.y), @"pressure": @(normalizedPressure) }];
  }
  if (pointsOut.count == 0) {
    return nil;
  }
  return @{
    @"type": @"stroke",
    @"color": entry[@"color"] ?: @"#000000",
    @"strokeWidth": entry[@"width"] ?: @(2.0),
    @"alpha": @(255),
    @"points": pointsOut,
    @"tool": entry[@"tool"] ?: @"pen"
  };
}

/**
 * 导入画布数据（JS 协议名 importAnnotations，别名 importCanvas）。
 *
 * 与导出对称：文本/图片必须按 type 还原，否则「保存的笔记重新打开后
 * 只剩手写线」——这正是本轮要修的核心缺陷之一。
 */
- (void)importCanvas:(NSString *)jsonData
{
  if (![jsonData isKindOfClass:[NSString class]] || jsonData.length == 0) {
    return;
  }
  @try {
    NSDictionary *parsed = [self dictionaryFromJSONString:jsonData];
    // 兼容两种载荷：{entries:[...]}/{strokes:[...]} 或直接是数组字符串。
    NSArray *entries = [parsed[@"entries"] isKindOfClass:[NSArray class]] ? parsed[@"entries"] : nil;
    if (!entries) {
      entries = [parsed[@"strokes"] isKindOfClass:[NSArray class]] ? parsed[@"strokes"] : nil;
    }
    if (!entries) {
      NSData *data = [jsonData dataUsingEncoding:NSUTF8StringEncoding];
      id raw = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
      entries = [raw isKindOfClass:[NSArray class]] ? raw : @[];
    }

    [self.strokesDict removeAllObjects];
    [self.strokeOrder removeAllObjects];
    [self.redoStack removeAllObjects];

    for (NSDictionary *raw in entries) {
      if (![raw isKindOfClass:[NSDictionary class]]) continue;
      NSString *entryId = [raw[@"id"] isKindOfClass:[NSString class]] ? raw[@"id"] : [[NSUUID UUID] UUIDString];
      NSDictionary *entry = [self importedEntryFromJSON:raw entryId:entryId];
      if (entry) {
        self.strokesDict[entryId] = entry;
        [self.strokeOrder addObject:entryId];
      }
    }

    NSDictionary *viewport = [parsed[@"viewport"] isKindOfClass:[NSDictionary class]] ? parsed[@"viewport"] : nil;
    if (viewport) {
      [self setViewport:viewport];
    }

    [self redrawStrokesOnOverlay];
    [self.metalView setNeedsDisplay];
    [self emitHistoryStateChange];
  } @catch (NSException *e) {
    NSLog(@"[NativeInfiniteCanvasView] importCanvas 失败: %@", e.reason);
  }
}

/** 单条 JSON -> 内部记录；无法识别返回 nil（宁可跳过一条也不要整幅失败）。 */
- (NSDictionary *)importedEntryFromJSON:(NSDictionary *)raw entryId:(NSString *)entryId
{
  NSString *type = raw[@"type"] ?: @"stroke";

  if ([type isEqualToString:@"text"]) {
    CGFloat x = raw[@"x"] != nil ? [raw[@"x"] doubleValue] : CGPointFromString(raw[@"position"]).x;
    CGFloat y = raw[@"y"] != nil ? [raw[@"y"] doubleValue] : CGPointFromString(raw[@"position"]).y;
    CGFloat fontSize = [raw[@"fontSize"] doubleValue];
    if (!(fontSize > 0)) {
      fontSize = 16.0;
    }
    return @{
      @"id": entryId,
      @"type": @"text",
      @"text": raw[@"text"] ?: @"",
      @"position": NSStringFromCGPoint(CGPointMake(x, y)),
      @"x": @(x),
      @"y": @(y),
      @"fontSize": @(fontSize),
      @"color": raw[@"color"] ?: @"#000000",
      @"bold": @([raw[@"bold"] boolValue]),
      @"italic": @([raw[@"italic"] boolValue]),
      @"underline": @([raw[@"underline"] boolValue]),
      @"alignment": [self normalizedAlignment:raw[@"alignment"]],
      @"tool": @"text"
    };
  }

  if ([type isEqualToString:@"image"]) {
    NSMutableDictionary *entry = [@{
      @"id": entryId,
      @"type": @"image",
      @"x": @([raw[@"x"] doubleValue]),
      @"y": @([raw[@"y"] doubleValue]),
      @"w": @([raw[@"w"] doubleValue]),
      @"h": @([raw[@"h"] doubleValue]),
      @"position": NSStringFromCGPoint(CGPointMake([raw[@"x"] doubleValue] + [raw[@"w"] doubleValue] / 2.0,
                                                   [raw[@"y"] doubleValue] + [raw[@"h"] doubleValue] / 2.0)),
      @"tool": @"image"
    } mutableCopy];
    if ([raw[@"bitmapBase64"] isKindOfClass:[NSString class]] && [raw[@"bitmapBase64"] length] > 0) {
      entry[@"bitmapBase64"] = raw[@"bitmapBase64"];
    }
    if ([raw[@"uri"] isKindOfClass:[NSString class]] && [raw[@"uri"] length] > 0) {
      entry[@"uri"] = raw[@"uri"];
    }
    if ([raw[@"fileName"] isKindOfClass:[NSString class]]) {
      entry[@"fileName"] = raw[@"fileName"];
    }
    return entry;
  }

  if ([type isEqualToString:@"shape"]) {
    return @{
      @"id": entryId,
      @"type": @"shape",
      @"shape": raw[@"shape"] ?: @"line",
      @"startPoint": raw[@"startPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"endPoint": raw[@"endPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"color": raw[@"color"] ?: @"#000000",
      @"width": raw[@"strokeWidth"] ?: raw[@"width"] ?: @(2.0),
      @"tool": @"shape"
    };
  }

  NSArray *points = [raw[@"points"] isKindOfClass:[NSArray class]] ? raw[@"points"] : @[];
  NSMutableArray *ptValues = [NSMutableArray arrayWithCapacity:points.count];
  for (NSDictionary *pt in points) {
    if (![pt isKindOfClass:[NSDictionary class]]) continue;
    [ptValues addObject:[NSValue valueWithCGPoint:CGPointMake([pt[@"x"] doubleValue], [pt[@"y"] doubleValue])]];
  }
  if (ptValues.count == 0) {
    return nil;
  }
  return @{
    @"id": entryId,
    @"type": @"stroke",
    @"points": ptValues,
    @"color": raw[@"color"] ?: @"#000000",
    @"width": raw[@"strokeWidth"] ?: raw[@"width"] ?: @(2.0),
    @"tool": raw[@"tool"] ?: @"pen"
  };
}

/**
 * 添加图片（JS 协议命令 addImage 落到这里）。
 *
 * metaJson 带 width/height/fileName：宽高比决定落图尺寸，
 * 只发 uri 时原生只能猜比例，横图会被压成方的。
 * 默认宽度取视口宽度的 60%、居中，与工具栏面板语义一致。
 */
- (void)addImage:(NSString *)imageUri metaJson:(NSString *)metaJson
{
  NSLog(@"[NativeInfiniteCanvasView] 添加图片: %@", imageUri);
  if (![imageUri isKindOfClass:[NSString class]] || imageUri.length == 0) {
    return;
  }

  NSDictionary *meta = [self dictionaryFromJSONString:metaJson];
  UIImage *image = [self decodedImageForEntry:@{ @"uri": imageUri }];
  CGFloat metaW = [meta[@"width"] doubleValue];
  CGFloat metaH = [meta[@"height"] doubleValue];

  CGFloat ratio = 0.75; // 4:3 兜底
  if (metaW > 0 && metaH > 0) {
    ratio = metaH / metaW;
  } else if (image && image.size.width > 0) {
    ratio = image.size.height / image.size.width;
  } else {
    // 解不出来也要留记录并打日志：用户至少能知道是哪张图出了问题。
    NSLog(@"[NativeInfiniteCanvasView] addImage: 无法解码图片，按 4:3 记录: %@", imageUri);
  }

  // 尺寸存世界坐标：半径按当前缩放折算，保证「看到的 60% 就是 60%」。
  CGFloat viewportWidthInWorld = self.bounds.size.width / MAX(0.1, self.viewportScale);
  CGFloat width = viewportWidthInWorld * 0.6;
  CGFloat height = width * ratio;
  CGPoint center = CGPointMake(self.viewportX, self.viewportY);

  NSString *imageId = [[NSUUID UUID] UUIDString];
  NSMutableDictionary *entry = [@{
    @"id": imageId,
    @"type": @"image",
    @"uri": imageUri,
    @"position": NSStringFromCGPoint(center),
    // x/y 为左上角（与 Android 导出一致），position 为中心点（本视图落点语义）
    @"x": @(center.x - width / 2.0),
    @"y": @(center.y - height / 2.0),
    @"w": @(width),
    @"h": @(height),
    @"tool": @"image"
  } mutableCopy];
  if (meta[@"fileName"]) entry[@"fileName"] = meta[@"fileName"];
  if (meta[@"fileSize"]) entry[@"fileSize"] = meta[@"fileSize"];

  self.strokesDict[imageId] = entry;
  [self.strokeOrder addObject:imageId];
  [self.redoStack removeAllObjects];

  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": imageId,
      @"tool": @"image"
    });
  }

  [self emitHistoryStateChange];
  [self redrawStrokesOnOverlay];
  [self.metalView setNeedsDisplay];
}

/** 兼容旧签名：不带元数据时按图片真实比例落图。 */
- (void)addImage:(NSString *)imageUri {
  [self addImage:imageUri metaJson:nil];
}

@end

// MARK: - OCR Extension

@implementation NativeInfiniteCanvasView (OCR)

- (void)recognizeTextInRect:(CGRect)rect completion:(void (^)(NSArray<NSDictionary *> *results, NSError *error))completion
{
  UIGraphicsBeginImageContextWithOptions(self.bounds.size, NO, [UIScreen mainScreen].scale);
  [self.layer renderInContext:UIGraphicsGetCurrentContext()];
  UIImage *fullImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  if (!fullImage) {
    if (completion) completion(nil, [NSError errorWithDomain:@"NativeInfiniteCanvasView" code:-1 userInfo:@{NSLocalizedDescriptionKey: @"渲染失败"}]);
    return;
  }

  CGRect cropRect = CGRectIntersection(rect, CGRectMake(0, 0, fullImage.size.width, fullImage.size.height));
  if (CGRectIsEmpty(cropRect)) {
    if (completion) completion(@[], nil);
    return;
  }

  CGImageRef cg = CGImageCreateWithImageInRect(fullImage.CGImage, cropRect);
  if (!cg) {
    if (completion) completion(nil, [NSError errorWithDomain:@"NativeInfiniteCanvasView" code:-2 userInfo:@{NSLocalizedDescriptionKey: @"裁剪失败"}]);
    return;
  }
  UIImage *regionImage = [UIImage imageWithCGImage:cg];
  CGImageRelease(cg);

  VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull req, NSError * _Nullable err) {
    if (err) {
      if (completion) completion(nil, err);
      return;
    }
    NSMutableArray<NSDictionary *> *resultsArray = [NSMutableArray array];
    for (VNRecognizedTextObservation *obs in req.results) {
      VNRecognizedText *top = [[obs topCandidates:1] firstObject];
      if (top) {
        // Vision's boundingBox is normalized with origin at bottom-left.
        // Convert to top-left UIKit coordinates relative to the cropped image.
        CGRect boundingBox = obs.boundingBox;
        CGFloat imageWidth = regionImage.size.width;
        CGFloat imageHeight = regionImage.size.height;

        CGRect convertedRect = CGRectMake(
          boundingBox.origin.x * imageWidth,
          (1 - boundingBox.origin.y - boundingBox.size.height) * imageHeight,
          boundingBox.size.width * imageWidth,
          boundingBox.size.height * imageHeight
        );

        // Adjust coordinates to be relative to the full view, not just the cropped region.
        convertedRect.origin.x += cropRect.origin.x;
        convertedRect.origin.y += cropRect.origin.y;

        NSDictionary *textBlock = @{
          @"text": top.string,
          @"confidence": @(top.confidence),
          @"frame": @{
            @"x": @(convertedRect.origin.x),
            @"y": @(convertedRect.origin.y),
            @"width": @(convertedRect.size.width),
            @"height": @(convertedRect.size.height)
          }
        };
        [resultsArray addObject:textBlock];
      }
    }
    if (completion) completion(resultsArray, nil);
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

// 说明：这里原有第二个多余的 @end（既有编译错误，@end 必须处于 ObjC 上下文），已删除。

// MARK: - Handwriting Recognition Extension

@implementation NativeInfiniteCanvasView (HandwritingRecognition)



- (void)recognizeHandwritingInStrokes:(NSArray<NSString *> *)strokeIds completion:(void (^)(NSDictionary *result, NSError *error))completion
{
  if (strokeIds.count == 0) {
    if (completion) completion(@{ @"text": @"", @"confidence": @(0.0), @"alternatives": @[], @"language": @"auto" }, nil);
    return;
  }

  // 1. 根据ID获取笔迹数据
  NSMutableArray *targetStrokes = [NSMutableArray new];
  CGRect strokesBoundingBox = CGRectNull;

  for (NSString *strokeId in strokeIds) {
    NSDictionary *strokeDict = self.strokesDict[strokeId];
    if (!strokeDict) continue;

    NSString *tool = strokeDict[@"tool"];
    if ([tool isEqualToString:@"pen"] || [tool isEqualToString:@"pencil"] || [tool isEqualToString:@"brush"]) {
      NSArray *points = strokeDict[@"points"];
      if (points && [points isKindOfClass:[NSArray class]] && points.count > 0) {
        [targetStrokes addObject:strokeDict];

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
    if (completion) completion(@{ @"text": @"", @"confidence": @(0.0), @"alternatives": @[], @"language": @"auto" }, nil);
    return;
  }

  // 2. 将笔迹渲染为图像
  CGFloat padding = 20.0;
  CGRect imageRect = CGRectInset(strokesBoundingBox, -padding, -padding);

  UIGraphicsBeginImageContextWithOptions(imageRect.size, NO, [UIScreen mainScreen].scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  CGContextSetFillColorWithColor(context, [UIColor whiteColor].CGColor);
  CGContextFillRect(context, CGRectMake(0, 0, imageRect.size.width, imageRect.size.height));

  // 转换坐标系，将笔迹绘制到图片上
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
    dispatch_async(dispatch_get_main_queue(), ^{
      if (err) {
        if (completion) completion(nil, err);
        return;
      }

      NSMutableString *result = [NSMutableString new];
      NSMutableArray *alternatives = [NSMutableArray new];
      float totalConfidence = 0.0;
      NSUInteger candidateCount = 0;

      for (VNRecognizedTextObservation *obs in req.results) {
        NSArray<VNRecognizedText *> *candidates = [obs topCandidates:3];
        if (candidates.count > 0) {
          VNRecognizedText *topCandidate = candidates.firstObject;
          [result appendString:topCandidate.string];
          [result appendString:@" "];
          totalConfidence += topCandidate.confidence;
          candidateCount++;

          // Add alternatives
          for (NSUInteger i = 1; i < candidates.count; i++) {
            VNRecognizedText *alt = candidates[i];
            [alternatives addObject:@{
              @"text": alt.string,
              @"confidence": @(alt.confidence)
            }];
          }
        }
      }

      float avgConfidence = candidateCount > 0 ? totalConfidence / candidateCount : 0.0;
      NSString *recognizedText = [result stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];

      NSDictionary *resultDict = @{
        @"text": recognizedText ?: @"",
        @"confidence": @(avgConfidence),
        @"alternatives": alternatives,
        @"language": @"auto"
      };

      if (completion) completion(resultDict, nil);
    });
  }];

  request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
  request.recognitionLanguages = @[@"zh-Hans", @"en-US"];
  request.usesLanguageCorrection = YES;

  VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:handwritingImage.CGImage options:@{}];

  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError *e = nil;
    [handler performRequests:@[request] error:&e];
    if (e && completion) {
      dispatch_async(dispatch_get_main_queue(), ^{
        completion(nil, e);
      });
    }
  });
}

// MARK: - Overlay Drawing (Minimum Viable Product)

/**
 * 重建无限画布的全部内容（图片 / 笔迹 / 文本）。
 *
 * 关键修复一：坐标变换。
 * 旧实现 concat 的是 self.transform（恒为单位阵），完全没有把 viewportX/Y/scale
 * 算进去——于是平移/缩放之后笔迹不会跟着动。这里改成真正的
 * 世界坐标 -> 屏幕坐标 变换。
 *
 * 关键修复二：内容分派。
 * 旧实现只遍历 points，文本（text/position）与图片（uri/x/y/w/h）
 * 一个都不会画。现在按 type 分派，且顺序固定为：
 *   图片（垫底） -> 笔迹 -> 文本（最上层）
 * 这与笔记「照片上写字、文字压最上」的直觉一致。
 */
- (void)redrawStrokesOnOverlay {
  CGFloat scale = MAX(0.1, self.viewportScale);
  CGFloat cx = CGRectGetMidX(self.bounds);
  CGFloat cy = CGRectGetMidY(self.bounds);

  UIGraphicsBeginImageContextWithOptions(self.bounds.size, NO, [UIScreen mainScreen].scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  // world -> screen：先平移到视口原点，再按 scale 放大，最后移到视图中心
  CGAffineTransform worldToScreen = CGAffineTransformConcat(
    CGAffineTransformMakeTranslation(cx, cy),
    CGAffineTransformConcat(
      CGAffineTransformMakeScale(scale, scale),
      CGAffineTransformMakeTranslation(-self.viewportX, -self.viewportY)));

  CGContextSaveGState(context);
  CGContextConcatCTM(context, worldToScreen);

  // 1) 图片层（最底）
  for (NSString *entryId in self.strokeOrder) {
    NSDictionary *entry = self.strokesDict[entryId];
    if (![entry isKindOfClass:[NSDictionary class]]) continue;
    if (![entry[@"type"] isEqualToString:@"image"]) continue;
    [self drawImageEntryInContext:context entry:entry];
  }

  // 2) 笔迹层（含形状：形状本质是路径，不画的话用户画的矩形/箭头会消失）
  for (NSString *strokeId in self.strokeOrder) {
    NSDictionary *strokeDict = self.strokesDict[strokeId];
    if (!strokeDict) continue;
    NSString *type = strokeDict[@"type"] ?: @"stroke";

    UIColor *color = [self colorFromHexString:strokeDict[@"color"]];
    CGFloat width = [strokeDict[@"width"] floatValue];
    if (!(width > 0)) width = self.currentStrokeWidth;

    CGContextSetStrokeColorWithColor(context, color.CGColor);
    CGContextSetLineWidth(context, width);
    CGContextSetLineCap(context, kCGLineCapRound);
    CGContextSetLineJoin(context, kCGLineJoinRound);

    if ([type isEqualToString:@"shape"]) {
      // 形状的起止点是世界坐标，当前上下文已是世界坐标，直接按记录里的形状名还原。
      if (!strokeDict[@"startPoint"] || !strokeDict[@"endPoint"]) continue;
      CGPoint start = CGPointFromString(strokeDict[@"startPoint"]);
      CGPoint end = CGPointFromString(strokeDict[@"endPoint"]);
      UIBezierPath *shapePath = [self createShapePathFrom:start
                                                      to:end
                                               shapeName:(strokeDict[@"shape"] ?: @"line")];
      if (shapePath.isEmpty) continue;
      CGContextAddPath(context, shapePath.CGPath);
      CGContextStrokePath(context);
      continue;
    }

    if (![type isEqualToString:@"stroke"]) continue;

    NSArray *points = strokeDict[@"points"];
    if (![points isKindOfClass:[NSArray class]] || points.count < 2) continue;

    CGPoint firstPoint = [[points firstObject] CGPointValue];
    CGContextMoveToPoint(context, firstPoint.x, firstPoint.y);

    for (NSUInteger i = 1; i < points.count; i++) {
      CGPoint point = [points[i] CGPointValue];
      CGContextAddLineToPoint(context, point.x, point.y);
    }
    CGContextStrokePath(context);
  }

  // 3) 文本层（最上）
  for (NSString *entryId in self.strokeOrder) {
    NSDictionary *entry = self.strokesDict[entryId];
    if (![entry isKindOfClass:[NSDictionary class]]) continue;
    if (![entry[@"type"] isEqualToString:@"text"]) continue;
    [self drawTextEntryInContext:context entry:entry];
  }

  CGContextRestoreGState(context);

  // 覆盖层（网格/标尺）走屏幕坐标，不随视口缩放
  [self drawToolbarOverlaysInContext:context transform:CGAffineTransformIdentity];

  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  self.strokesImageView.image = image;

  if (!self.didLogRenderSummary) {
    self.didLogRenderSummary = YES;
    NSLog(@"[NativeInfiniteCanvasView] %@", [self renderDebugDescription]);
  }
}

/**
 * 在已经应用了 world->screen 变换的上下文里绘制一条图片记录。
 * x/y 是左上角（与 Android 导出一致）；缺 x/y 时按视口中心落图。
 */
- (void)drawImageEntryInContext:(CGContextRef)context entry:(NSDictionary *)entry
{
  UIImage *image = [self decodedImageForEntry:entry];
  if (!image) {
    // 失败必须可诊断，否则用户只知道「点了没反应」。
    NSLog(@"[NativeInfiniteCanvasView] 图片加载失败（本次不绘制）: uri=%@",
          entry[@"uri"] ?: @"(内嵌 base64)");
    return;
  }

  CGFloat width = [entry[@"w"] doubleValue];
  CGFloat height = [entry[@"h"] doubleValue];
  CGFloat ratio = (width > 1.0 && height > 1.0)
    ? height / width
    : (image.size.width > 0 ? image.size.height / image.size.width : 0.75);
  if (!(width > 1.0)) {
    // 默认宽度取「视口宽度的 60%」换算到世界坐标，与工具栏语义一致。
    width = (self.bounds.size.width / MAX(0.1, self.viewportScale)) * 0.6;
  }
  if (!(height > 1.0)) {
    height = width * ratio;
  }

  // 只有缺坐标、或 (0,0) 且带 position 的占位记录才居中，
  // 避免把「真的放在原点附近」的图片误移。
  BOOL hasOrigin = (entry[@"x"] != nil && entry[@"y"] != nil);
  CGFloat x = [entry[@"x"] doubleValue];
  CGFloat y = [entry[@"y"] doubleValue];
  BOOL looksLikePlaceholder = (fabs(x) < 0.5 && fabs(y) < 0.5) && entry[@"position"] != nil;
  if (!hasOrigin || looksLikePlaceholder) {
    // 无坐标：以视口中心为图片中心
    x = self.viewportX - width / 2.0;
    y = self.viewportY - height / 2.0;
  }

  // CGContextDrawImage 在 UIKit 翻转坐标系里会把图上下颠倒，
  // 因此先把该区域局部翻回来（保存/恢复 GState，避免影响后续绘制）。
  CGContextSaveGState(context);
  CGContextTranslateCTM(context, x, y + height);
  CGContextScaleCTM(context, 1.0, -1.0);
  CGContextDrawImage(context, CGRectMake(0, 0, width, height), image.CGImage);
  CGContextRestoreGState(context);
}

/**
 * 在已经应用了 world->screen 变换的上下文里绘制一条文本记录。
 * x/y 是文字基线起点；alignment 决定以该点为左端/中心/右端，
 * 与 Android 的 drawText 语义保持一致，跨端才能还原到同一位置。
 */
- (void)drawTextEntryInContext:(CGContextRef)context entry:(NSDictionary *)entry
{
  NSString *text = entry[@"text"];
  if (![text isKindOfClass:[NSString class]] || text.length == 0) {
    return;
  }

  CGFloat fontSize = [entry[@"fontSize"] doubleValue];
  if (!(fontSize > 0)) {
    fontSize = 16.0;
  }
  UIFont *font = [self fontWithSize:fontSize
                               bold:[entry[@"bold"] boolValue]
                             italic:[entry[@"italic"] boolValue]];
  UIColor *color = [self colorFromHexString:entry[@"color"]];
  NSString *alignment = [entry[@"alignment"] isKindOfClass:[NSString class]] ? entry[@"alignment"] : @"left";
  BOOL underline = [entry[@"underline"] boolValue];

  CGPoint anchor = [self pointFromEntry:entry fallback:CGPointMake(self.viewportX, self.viewportY)];
  CGFloat lineHeight = fontSize * 1.2;
  NSArray<NSString *> *lines = [text componentsSeparatedByString:@"\n"];

  CGContextSaveGState(context);
  // 让 UIKit 字符串绘制在「y 向下」的 UIKit 上下文里正确定位
  UIGraphicsPushContext(context);
  for (NSUInteger i = 0; i < lines.count; i++) {
    NSString *line = lines[i];
    if (line.length == 0) continue;

    NSDictionary *attrs = @{
      NSFontAttributeName: font,
      NSForegroundColorAttributeName: color,
      NSUnderlineStyleAttributeName: underline ? @(NSUnderlineStyleSingle) : @(NSUnderlineStyleNone),
    };
    CGSize lineSize = [line sizeWithAttributes:attrs];
    CGFloat drawX = anchor.x;
    if ([alignment isEqualToString:@"center"]) {
      drawX = anchor.x - lineSize.width / 2.0;
    } else if ([alignment isEqualToString:@"right"]) {
      drawX = anchor.x - lineSize.width;
    }
    // NSString 的 drawAtPoint 以「文字左上角」为原点，而记录里的 y 是基线，
    // 因此上移一个 ascender 才能和 Android 的基线语义对齐。
    [line drawAtPoint:CGPointMake(drawX, anchor.y - font.ascender + i * lineHeight) withAttributes:attrs];
  }
  UIGraphicsPopContext();
  CGContextRestoreGState(context);
}

/** bold/italic 组合字体（系统字体没有 italic 面时用符号特征回退）。 */
- (UIFont *)fontWithSize:(CGFloat)size bold:(BOOL)bold italic:(BOOL)italic
{
  UIFont *base = [UIFont systemFontOfSize:size];
  UIFontDescriptorSymbolicTraits traits = 0;
  if (bold) traits |= UIFontDescriptorTraitBold;
  if (italic) traits |= UIFontDescriptorTraitItalic;
  if (traits == 0) {
    return base;
  }
  UIFontDescriptor *descriptor = [base.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
  UIFont *font = descriptor ? [UIFont fontWithDescriptor:descriptor size:size] : nil;
  return font ?: base;
}

/** 从 position(NSStringFromCGPoint) 或 x/y 取落点，兼容 Android 导出的格式。 */
- (CGPoint)pointFromEntry:(NSDictionary *)entry fallback:(CGPoint)fallback
{
  NSString *position = entry[@"position"];
  if ([position isKindOfClass:[NSString class]] && position.length > 0) {
    return CGPointFromString(position);
  }
  if (entry[@"x"] != nil || entry[@"y"] != nil) {
    return CGPointMake([entry[@"x"] doubleValue], [entry[@"y"] doubleValue]);
  }
  return fallback;
}

/**
 * 图片解码：内嵌 base64 / ph://（相册）/ file:// / 本地路径 / 图片名 五条路径。
 * 全部失败返回 nil，由调用方打日志，绝不让整幅画布变空白。
 */
- (UIImage *)decodedImageForEntry:(NSDictionary *)entry
{
  NSString *base64 = entry[@"bitmapBase64"] ?: entry[@"imageBase64"] ?: entry[@"base64"];
  if ([base64 isKindOfClass:[NSString class]] && base64.length > 0) {
    UIImage *cached = [self.imageCache objectForKey:base64];
    if (cached) return cached;
    UIImage *image = [self imageFromBase64:base64];
    if (image) [self.imageCache setObject:image forKey:base64];
    return image;
  }

  NSString *uri = entry[@"uri"];
  if (![uri isKindOfClass:[NSString class]] || uri.length == 0) {
    return nil;
  }
  UIImage *cached = [self.imageCache objectForKey:uri];
  if (cached) return cached;

  UIImage *image = nil;
  if ([uri hasPrefix:@"ph://"] || [uri hasPrefix:@"assets-library://"]) {
    image = [self loadPhotoAssetWithURI:uri];
  } else if ([uri hasPrefix:@"file://"]) {
    image = [UIImage imageWithContentsOfFile:[uri substringFromIndex:7]];
  } else if ([uri hasPrefix:@"http://"] || [uri hasPrefix:@"https://"]) {
    // 渲染路径绝不做网络 IO：redrawStrokesOnOverlay 在每次平移/缩放都会调用，
    // 同步请求会直接卡死主线程。缓存未命中返回 nil，
    // JS 侧应先下载为 file:// 或带 bitmapBase64 再插入。
    //
    // 单独打日志，把「远端图未下载」与「file:// 文件缺失」区分开：
    // 两者最终都表现为空白，不区分就无法定位。
    NSLog(@"[NativeInfiniteCanvasView] 跳过远端图片（渲染期不下载，请先落盘或内嵌 base64）: %@", uri);
    image = nil;
  } else if ([uri hasPrefix:@"/"]) {
    image = [UIImage imageWithContentsOfFile:uri];
  } else {
    image = [UIImage imageNamed:uri];
  }

  if (image) [self.imageCache setObject:image forKey:uri];
  return image;
}

/** 相册 asset 同步取图（渲染路径需要当次拿到结果）。 */
- (UIImage *)loadPhotoAssetWithURI:(NSString *)uri
{
  NSString *localIdentifier = uri;
  NSRange slashRange = [uri rangeOfString:@"//"];
  if (slashRange.location != NSNotFound) {
    localIdentifier = [uri substringFromIndex:slashRange.location + slashRange.length];
  }
  NSRange queryRange = [localIdentifier rangeOfString:@"?"];
  if (queryRange.location != NSNotFound) {
    localIdentifier = [localIdentifier substringToIndex:queryRange.location];
  }
  if (localIdentifier.length == 0) {
    return nil;
  }

  PHAsset *asset = [PHAsset fetchAssetsWithLocalIdentifiers:@[localIdentifier] options:nil].firstObject;
  if (!asset) {
    return nil;
  }

  __block UIImage *result = nil;
  PHImageRequestOptions *options = [[PHImageRequestOptions alloc] init];
  options.synchronous = YES;
  options.deliveryMode = PHImageRequestOptionsDeliveryModeHighQualityFormat;
  options.networkAccessAllowed = YES;

  CGFloat targetWidth = MAX(320.0, self.bounds.size.width * [UIScreen mainScreen].scale);
  [[PHImageManager defaultManager] requestImageForAsset:asset
                                             targetSize:CGSizeMake(targetWidth, targetWidth)
                                            contentMode:PHImageContentModeAspectFit
                                                options:options
                                          resultHandler:^(UIImage * _Nullable image, NSDictionary * _Nullable info) {
    result = image;
  }];
  return result;
}

/** 从 base64 还原图片，兼容 data URL 前缀。 */
- (UIImage *)imageFromBase64:(NSString *)base64
{
  if (![base64 isKindOfClass:[NSString class]] || base64.length == 0) {
    return nil;
  }
  NSRange comma = [base64 rangeOfString:@","];
  NSString *payload = (comma.location != NSNotFound && base64.length > comma.location + 1)
    ? [base64 substringFromIndex:comma.location + 1]
    : base64;
  NSData *data = [[NSData alloc] initWithBase64EncodedString:payload
                                                     options:NSDataBase64DecodingIgnoreUnknownCharacters];
  return data.length > 0 ? [UIImage imageWithData:data] : nil;
}

/**
 * 内容现况诊断：条目数不等于图层数，文本/图片过去就是「有数据没画面」，
 * 这行日志能一眼区分是数据问题还是渲染问题。
 */
- (NSString *)renderDebugDescription
{
  NSInteger inkCount = 0, textCount = 0, imageCount = 0;
  for (NSString *entryId in self.strokeOrder) {
    NSDictionary *entry = self.strokesDict[entryId];
    if (![entry isKindOfClass:[NSDictionary class]]) continue;
    NSString *type = entry[@"type"] ?: @"stroke";
    if ([type isEqualToString:@"text"]) {
      textCount++;
    } else if ([type isEqualToString:@"image"]) {
      imageCount++;
    } else {
      inkCount++;
    }
  }
  return [NSString stringWithFormat:@"条目(ink=%ld text=%ld image=%ld) viewport=(%.1f,%.1f scale=%.2f)",
          (long)inkCount, (long)textCount, (long)imageCount,
          self.viewportX, self.viewportY, self.viewportScale];
}

/**
 * 工具栏覆盖层：网格（showGrid）/ 标尺（showRuler）。
 * 两者此前只改 JS 本地 state、从不下发原生，属于死接线。
 * 这里把上下文恢复到屏幕坐标后再画，保证覆盖层不随视口缩放。
 */
- (void)drawToolbarOverlaysInContext:(CGContextRef)context transform:(CGAffineTransform)transform
{
  BOOL showGrid = [self.toolConfigDictionary[@"showGrid"] boolValue];
  BOOL showRuler = [self.toolConfigDictionary[@"showRuler"] boolValue];
  if (!showGrid && !showRuler) {
    return;
  }

  CGSize size = self.bounds.size;
  if (size.width <= 0 || size.height <= 0) {
    return;
  }

  CGContextSaveGState(context);
  // 回到屏幕坐标（redrawStrokesOnOverlay 里 concat 了 view 的 transform）
  CGContextConcatCTM(context, CGAffineTransformInvert(transform));

  if (showGrid) {
    CGContextSetStrokeColorWithColor(context, [[UIColor colorWithRed:0.69 green:0.75 blue:0.77 alpha:0.30] CGColor]);
    CGContextSetLineWidth(context, 1.0);
    CGFloat gridSize = 40.0;
    for (CGFloat x = 0; x <= size.width; x += gridSize) {
      CGContextMoveToPoint(context, x, 0);
      CGContextAddLineToPoint(context, x, size.height);
    }
    for (CGFloat y = 0; y <= size.height; y += gridSize) {
      CGContextMoveToPoint(context, 0, y);
      CGContextAddLineToPoint(context, size.width, y);
    }
    CGContextStrokePath(context);
  }

  if (showRuler) {
    CGContextSetStrokeColorWithColor(context, [[UIColor colorWithRed:0.38 green:0.49 blue:0.55 alpha:0.6] CGColor]);
    CGContextSetLineWidth(context, 1.0);
    NSDictionary *textAttrs = @{
      NSFontAttributeName: [UIFont systemFontOfSize:9.0],
      NSForegroundColorAttributeName: [UIColor colorWithRed:0.27 green:0.35 blue:0.39 alpha:0.75]
    };
    CGFloat minor = 10.0;
    CGFloat major = 50.0;

    for (CGFloat x = 0; x <= size.width; x += minor) {
      BOOL isMajor = ((NSInteger)lround(x) % (NSInteger)major) == 0;
      CGFloat len = isMajor ? 12.0 : 6.0;
      CGContextMoveToPoint(context, x, 0);
      CGContextAddLineToPoint(context, x, len);
      if (isMajor) {
        [[NSString stringWithFormat:@"%d", (int)x] drawAtPoint:CGPointMake(x + 2, len + 1) withAttributes:textAttrs];
      }
    }
    CGContextStrokePath(context);

    for (CGFloat y = 0; y <= size.height; y += minor) {
      BOOL isMajor = ((NSInteger)lround(y) % (NSInteger)major) == 0;
      CGFloat len = isMajor ? 12.0 : 6.0;
      CGContextMoveToPoint(context, 0, y);
      CGContextAddLineToPoint(context, len, y);
      if (isMajor) {
        [[NSString stringWithFormat:@"%d", (int)y] drawAtPoint:CGPointMake(len + 2, y + 1) withAttributes:textAttrs];
      }
    }
    CGContextStrokePath(context);
  }

  CGContextRestoreGState(context);
}


@end
