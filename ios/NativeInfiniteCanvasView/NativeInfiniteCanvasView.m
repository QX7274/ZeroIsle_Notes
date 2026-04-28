//
//  NativeInfiniteCanvasView.m
//  ZeroIsle_Notes
//
//  无限画布实现 - 世界坐标系统
//

#import "NativeInfiniteCanvasView.h"
#import <Vision/Vision.h>

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


// 叠加层用于非Metal快速渲染（最低可行实现）
@property (nonatomic, strong) UIImageView *strokesImageView;


// 激光笔相关
@property (nonatomic, strong) CAShapeLayer *laserLayer;
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
- (void)setViewport:(NSDictionary *)viewport {
  if (viewport[@"x"]) self.viewportX = [viewport[@"x"] doubleValue];
  if (viewport[@"y"]) self.viewportY = [viewport[@"y"] doubleValue];
  if (viewport[@"scale"]) self.viewportScale = [viewport[@"scale"] doubleValue];
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

  self.toolConfig = config;
  NSLog(@"[NativeInfiniteCanvasView] 工具配置更新: %@", config);

  if (config[@"shape"]) {
    self.currentShape = config[@"shape"];
  }
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
  if (self.strokes.count == 0) return;

  // 橡皮擦半径
  CGFloat eraserRadius = self.currentStrokeWidth * 3;

  // 从后往前检查笔迹，删除与橡皮擦相交的笔迹
  for (NSInteger i = self.strokes.count - 1; i >= 0; i--) {
    NSDictionary *stroke = self.strokes[i];
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
      [self.strokes removeObjectAtIndex:i];
      [self.metalView setNeedsDisplay];
      NSLog(@"[NativeInfiniteCanvasView] 擦除笔迹 %ld", (long)i);
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
  NSLog(@"[NativeInfiniteCanvasView] 文本输入完成: %@", text);

  if (text.length > 0) {
    // 保存文本作为笔迹
    [self.strokes addObject:@{
      @"type": @"text",
      @"text": text,
      @"position": NSStringFromCGPoint(self.textInputPoint),
      @"color": [self hexFromColor:self.currentColor],
      @"tool": @"text"
    }];

    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{
        @"strokeId": [[NSUUID UUID] UUIDString],
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
  NSLog(@"[NativeInfiniteCanvasView] 开始套索选择");

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

  if (self.onStrokesSelected) {
    self.onStrokesSelected(@{@"strokeIds": selectedStrokeIds});
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
    NSLog(@"[NativeInfiniteCanvasView] 形状绘制完成");

    // 保存形状作为笔迹
    [self.strokes addObject:@{
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
  const CGFloat *components = CGColorGetComponents(color.CGColor);
  CGFloat r = components[0];
  CGFloat g = components[1];
  CGFloat b = components[2];

  return [NSString stringWithFormat:@"#%02X%02X%02X",
          (int)(r * 255), (int)(g * 255), (int)(b * 255)];
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
}

- (void)clear:(NSString *)clearType {
  NSLog(@"[NativeInfiniteCanvasView] 清除类型: %@", clearType);

  if ([clearType isEqualToString:@"current_view"]) {
    // 清除当前视图可见区域的笔迹
    // TODO: 实现基于视口的清除
    NSLog(@"[NativeInfiniteCanvasView] 清除当前视图功能待实现");
  } else if ([clearType isEqualToString:@"entire_document"]) {
    // 清除所有笔迹
        [self.strokesDict removeAllObjects];
    [self.strokeOrder removeAllObjects];
    [self.redoStack removeAllObjects]; // Clearing should also clear the redo stack
    [self.metalView setNeedsDisplay];
    [self redrawStrokesOnOverlay];

  } else if ([clearType isEqualToString:@"selected"]) {


    // 清除选中的笔迹
    if (self.selectedStrokes.count > 0) {
      // 从 strokes 数组中移除选中的笔迹


      // 需要从高到低排序索引，以避免在删除时索引错乱
      NSArray *sortedIndexes = [self.selectedStrokes sortedArrayUsingDescriptors:@[[NSSortDescriptor sortDescriptorWithKey:@"self" ascending:NO]]];

      for (NSNumber *index in sortedIndexes) {
        [self.strokes removeObjectAtIndex:[index integerValue]];
      }

      // 清空选中状态并移除高亮
      [self.selectedStrokes removeAllObjects];
      [self.lassoLayer removeFromSuperlayer];
      self.lassoLayer = nil;
      self.lassoPath = nil;

      [self.metalView setNeedsDisplay];
    }
  }
}

- (void)exportCanvas:(NSString *)canvasId {
  NSLog(@"[NativeInfiniteCanvasView] 导出画布: %@", canvasId);



  @try {
    // 构建导出数据
    NSMutableArray *strokesOut = [NSMutableArray arrayWithCapacity:self.strokeOrder.count];

    for (NSString *strokeId in self.strokeOrder) {
      NSDictionary *stroke = self.strokesDict[strokeId];


      if (!stroke) continue;
      NSArray *points = stroke[@"points"];
      NSMutableArray *pointsOut = [NSMutableArray arrayWithCapacity:points.count];

      for (NSValue *pointValue in points) {
        CGPoint p = [pointValue CGPointValue];
        CGFloat exportedWidth = [stroke[@"width"] doubleValue];
        CGFloat normalizedPressure = self.currentStrokeWidth > 0 ? exportedWidth / self.currentStrokeWidth : 1.0;
        normalizedPressure = [self clampedStrokeIntensity:normalizedPressure];
        [pointsOut addObject:@{
          @"x": @(p.x),
          @"y": @(p.y),
          @"pressure": @(normalizedPressure)
        }];
      }

      NSString *color = stroke[@"color"] ?: @"#000000";
      NSNumber *width = stroke[@"width"] ?: @(2.0);
      NSString *tool = stroke[@"tool"] ?: @"pen";

      [strokesOut addObject:@{
        @"color": color,
        @"strokeWidth": width,
        @"alpha": @(255),
        @"points": pointsOut,
        @"tool": tool
      }];
    }

    // 序列化为JSON
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:strokesOut options:0 error:nil];
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

- (void)addImage:(NSString *)imageUri {
  NSLog(@"[NativeInfiniteCanvasView] 添加图片: %@", imageUri);

  // 在视口中心位置添加图片
  CGPoint centerPoint = CGPointMake(self.viewportX, self.viewportY);

  [self.strokes addObject:@{
    @"type": @"image",
    @"uri": imageUri,
    @"position": NSStringFromCGPoint(centerPoint),
    @"tool": @"image"
  }];

  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": [[NSUUID UUID] UUIDString],
      @"tool": @"image"
    });
  }

  [self.metalView setNeedsDisplay];
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

@end

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

- (void)redrawStrokesOnOverlay {
  // Get the current transform from the Metal view to apply to the overlay
  CGAffineTransform transform = self.transform;

  // Create an image context with the view's bounds
  UIGraphicsBeginImageContextWithOptions(self.bounds.size, NO, self.window.screen.scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  // We need to invert the view's transform to draw strokes in their original world coordinates
  // and have them appear correctly within the transformed view.
  CGContextConcatCTM(context, transform);

  // Draw all the strokes from our data source
  for (NSString *strokeId in self.strokeOrder) {
    NSDictionary *strokeDict = self.strokesDict[strokeId];
    if (!strokeDict) continue;

    NSArray *points = strokeDict[@"points"];
    if (!points || points.count < 2) continue;

    UIColor *color = [self colorFromHexString:strokeDict[@"color"]];
    CGFloat width = [strokeDict[@"width"] floatValue];

    CGContextSetStrokeColorWithColor(context, color.CGColor);
    CGContextSetLineWidth(context, width);
    CGContextSetLineCap(context, kCGLineCapRound);
    CGContextSetLineJoin(context, kCGLineJoinRound);

    CGPoint firstPoint = [[points firstObject] CGPointValue];
    CGContextMoveToPoint(context, firstPoint.x, firstPoint.y);

    for (NSUInteger i = 1; i < points.count; i++) {
      CGPoint point = [points[i] CGPointValue];
      CGContextAddLineToPoint(context, point.x, point.y);
    }
    CGContextStrokePath(context);
  }

  // Create the image and set it on the overlay
  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  self.strokesImageView.image = image;
}


@end
