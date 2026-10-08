//
//  NativePagedNoteView.m
//  ZeroIsle_Notes
//
//  原生分页笔记视图实现
//  Metal 渲染 + 压感支持
//

#import "NativePagedNoteView.h"
#import <Vision/Vision.h>
// 相册 asset（ph:// 与旧的 assets-library://）必须经 Photos 取图，
// 否则「从相册插入的图片」在画布上永远是空白。
#import <Photos/Photos.h>

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
@property (nonatomic, assign) CGPoint shapeStartPoint;
// 形状终点单独持有「页面坐标」：从预览 layer 反读会拿到屏幕坐标（已含缩放），
// 直接存库会让导出/换缩放级别后的形状错位。
@property (nonatomic, assign) CGPoint shapeEndPoint;
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

// 笔迹渲染图层（iOS 侧此前没有真实绘制路径）
@property (nonatomic, strong) CAShapeLayer *strokeLayer;
// 文本层：分页画布此前把 text 当笔迹塞进 strokes，appendStroke: 又只读 points，
// 结果文本永远画不出来。文本与笔迹的绘制模型完全不同（前者填字、后者描边），
// 所以单独一层容器，每次重建时按 type 分派。
@property (nonatomic, strong) CALayer *textLayerContainer;
// 图片层：同上，图片由内容（而不是路径）决定外观，必须独立成层。
@property (nonatomic, strong) CALayer *imageLayerContainer;

// 图片解码缓存：每次平移/缩放都会重建图层，若不做缓存就会重复解码
// 同一张 base64（大图可达数 MB），造成明显卡顿。
@property (nonatomic, strong) NSCache<NSString *, UIImage *> *imageCache;

// 首帧渲染诊断只打一次，避免每次重绘刷屏
@property (nonatomic, assign) BOOL didLogRenderSummary;

// 文本光栅化缓存：重建是「整页重画」（每写一个点都会触发），
// 若每次都把全部文本重新排版+画成位图，长笔记会明显掉帧。
// 键里包含所有影响像素的入参（内容/字号/样式/尺寸），命中即可直接复用。
@property (nonatomic, strong) NSCache<NSString *, UIImage *> *textImageCache;

// 工具栏覆盖层：网格 / 标尺（由 setToolConfig 的 showGrid/showRuler 驱动）
@property (nonatomic, strong) UIImageView *overlayImageView;

// 新增页面事件：addNewPage 会发它，但类扩展与头文件都漏了声明，属既有编译错误。
@property (nonatomic, copy) RCTBubblingEventBlock onPageAdded;

// 平移手势（用于按防误触配置限制可接受的触点类型）
@property (nonatomic, strong) UIPanGestureRecognizer *panGestureRecognizer;

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

    // 图片解码缓存：按 uri/base64 命中，容量按「张数」而不是字节粗略限制即可，
    // 目的在于同一张图在连续重绘中只解码一次。
    _imageCache = [[NSCache alloc] init];
    _imageCache.countLimit = 24;

    _textImageCache = [[NSCache alloc] init];
    _textImageCache.countLimit = 128;
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

// 尺寸变化时重建覆盖层（网格/标尺按 bounds 生成，需跟随布局）
- (void)layoutSubviews
{
  [super layoutSubviews];
  // 三个内容层都跟随视图尺寸：它们都以屏幕坐标绘制，
  // 不重建的话旋转/分屏后会留在旧尺寸上。
  self.strokeLayer.frame = self.bounds;
  self.textLayerContainer.frame = self.bounds;
  self.imageLayerContainer.frame = self.bounds;
  [self rebuildStrokeLayers];
}

static const CGFloat kUnifiedPanMinDelta = 0.35;
static const CGFloat kUnifiedMinScale = 0.5;
static const CGFloat kUnifiedMaxScale = 4.0;

- (BOOL)isDrawingToolActive
{
  NSSet *drawTools = [NSSet setWithArray:@[@"pen", @"highlighter", @"marker", @"pencil", @"brush", @"eraser", @"shape", @"laser", @"select", @"lasso", @"text"]];
  return [drawTools containsObject:(self.currentTool ?: @"pen")];
}

/**
 * 是否用该触点绘制（防误触 / 手指模式）。
 *
 * 此前 iOS 不做任何 UITouch.type 判断：手指和 Apple Pencil 都会被当成笔，
 * 掌托压到屏幕就会留下墨迹。现在：
 *  - palmRejectionEnabled=YES（默认）：只有 Pencil（UITouchTypePencil）能画；
 *  - palmRejectionEnabled=NO 且 fingerMode 允许时：手指也能书写。
 */
- (BOOL)shouldDrawWithTouch:(UITouch *)touch
{
  BOOL isPencil = NO;
  if (@available(iOS 9.1, *)) {
    isPencil = (touch.type == UITouchTypePencil);
  }
  if (isPencil) {
    return YES;
  }

  BOOL palmRejection = YES;
  if (self.toolConfigDictionary[@"palmRejectionEnabled"]) {
    palmRejection = [self.toolConfigDictionary[@"palmRejectionEnabled"] boolValue];
  }
  if (!palmRejection) {
    NSString *fingerMode = self.toolConfigDictionary[@"fingerMode"] ?: @"gesture_only";
    return [fingerMode isEqualToString:@"draw"] ||
           [fingerMode isEqualToString:@"draw_with_finger"] ||
           [fingerMode isEqualToString:@"any"];
  }
  return NO;
}

/**
 * 坐标模型（本轮统一，务必保持一致）：
 *   内容（笔迹点 / 文本锚点 / 图片矩形 / 形状端点）一律存「页面坐标」；
 *   屏幕坐标 = (页面坐标 - 视口原点) * 缩放。
 * 约定 viewportX/Y 就是「视图左上角对应的页面坐标」。
 *
 * 为什么去掉原来的 center 偏移：旧实现 屏幕 = (页面 - 视口)*缩放 + 视图中心，
 * 而采集时又把屏幕坐标直接当页面坐标存。默认视口下两者叠加会把所有内容
 * 平移半个视图；更致命的是「默认落在页面中心」的文本会被算到 (w, h)——
 * 正好是屏幕右下角之外，等于文本永远看不见。这正是本轮要修的缺陷。
 */
- (CGPoint)screenToWorld:(CGPoint)screenPoint
{
  CGFloat scale = MAX(0.1, self.viewportScale);
  return CGPointMake(self.viewportX + screenPoint.x / scale,
                     self.viewportY + screenPoint.y / scale);
}

// 页面坐标 -> 屏幕坐标（绘制用，与 screenToWorld 互逆）
- (CGPoint)worldToScreen:(CGPoint)worldPoint
{
  CGFloat scale = MAX(0.1, self.viewportScale);
  return CGPointMake((worldPoint.x - self.viewportX) * scale,
                     (worldPoint.y - self.viewportY) * scale);
}

- (void)emitZoomChange
{
  if (self.onZoomChange) {
    self.onZoomChange(@{ @"scale": @(self.viewportScale), @"x": @(self.viewportX), @"y": @(self.viewportY) });
  }
}

/**
 * 「页面中心」在当前坐标系下的值（页面坐标）。
 * 用可视区域中心反解：默认视口(0,0,scale=1)时正好等于 bounds/2，
 * 与旧行为一致；缩放/平移后也不会把新文本丢到画面外。
 */
- (CGPoint)pageCenterPoint
{
  CGPoint viewCenter = CGPointMake(CGRectGetMidX(self.bounds), CGRectGetMidY(self.bounds));
  return [self screenToWorld:viewCenter];
}

- (void)setupGestures
{
  UIPanGestureRecognizer *pan = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
  UIPinchGestureRecognizer *pinch = [[UIPinchGestureRecognizer alloc] initWithTarget:self action:@selector(handlePinch:)];
  pan.delegate = self;
  pinch.delegate = self;
  [self addGestureRecognizer:pan];
  [self addGestureRecognizer:pinch];
  self.panGestureRecognizer = pan;
  [self updateAllowedTouchTypes];
}

/**
 * 依据「是否绘制工具 + 是否开启防误触」决定平移手势接受哪些触点类型。
 * 绘制工具 + 防误触：只有 Apple Pencil 能触发绘制，手指留给滚动/平移；
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

- (void)handlePinch:(UIPinchGestureRecognizer *)gesture
{
  CGPoint focal = [gesture locationInView:self];
  if (gesture.state == UIGestureRecognizerStateBegan) {
    self.pinchScaleBaseline = self.viewportScale;
    self.suppressTouchStroke = YES;
    return;
  }

  if (gesture.state == UIGestureRecognizerStateChanged) {
    // 保持「手指下的页面点不动」：先记下 focal 对应的页面坐标，
    // 缩放后再反解出新的视口原点。
    CGPoint worldAtFocal = [self screenToWorld:focal];

    self.viewportScale = MAX(kUnifiedMinScale, MIN(kUnifiedMaxScale, self.pinchScaleBaseline * gesture.scale));
    self.viewportX = worldAtFocal.x - focal.x / self.viewportScale;
    self.viewportY = worldAtFocal.y - focal.y / self.viewportScale;

    [self emitZoomChange];
    [self rebuildStrokeLayers];
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
      [self rebuildStrokeLayers];
      [self.metalView setNeedsDisplay];
      return;
    }

    if (gesture.state == UIGestureRecognizerStateEnded || gesture.state == UIGestureRecognizerStateCancelled || gesture.state == UIGestureRecognizerStateFailed) {
      self.isCanvasPanning = NO;
      self.suppressTouchStroke = NO;
      return;
    }
  }

  // 手势位置是屏幕坐标，而工具栏分派（文本/套索/形状/笔迹）统一按页面坐标存储，
  // 因此在这里一次性换算，下游所有工具都拿到同一坐标系。
  CGPoint pageLocation = [self screenToWorld:location];

  switch (gesture.state) {
    case UIGestureRecognizerStateBegan:
      self.suppressTouchStroke = YES;
      [self startToolAtPoint:pageLocation];
      break;
    case UIGestureRecognizerStateChanged:
      [self continueToolToPoint:pageLocation];
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

    // 每条内容都要带稳定字符串 id：JS 的选中操作通道只接受 string id
    // （serializeStrokeIds 会把数字过滤掉），没有 id 就无从删除/移动/复制。
    NSString *strokeId = [[NSUUID UUID] UUIDString];
    [strokes addObject:@{
      @"id": strokeId,
      @"points": [self.currentStroke copy],
      @"color": [self hexFromColor:self.currentColor],
      @"width": @(self.currentStrokeWidth),
      @"tool": self.currentTool
    }];

    // 清空重做栈，因为添加了新的笔迹
    [self.redoStack removeAllObjects];

    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{@"strokeId": strokeId});
    }

    [self emitHistoryStateChange];
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
  // Metal 的 Core Graphics 互操作层（MTLCommandBuffer/CGContext 桥接）在不同
  // Xcode/SDK 组合下行为不一致，这里改用稳定的 CAShapeLayer 图层渲染：
  // 每次重绘时重建笔迹图层，避免依赖未初始化的 Metal pipeline。
  (void)encoder;
  [self rebuildStrokeLayers];
}

/**
 * 建立三层内容容器：笔迹 / 文本 / 图片。
 *
 * 为什么要分层：此前所有内容共用一个 CAShapeLayer，而 CAShapeLayer 只有
 * 一个 strokeColor。这直接决定了「多条不同颜色的笔迹」根本画不对——
 * 最后一条笔迹的颜色会覆盖整页；文本与图片更是连 draw 都要分派。
 * 分层后每层只负责一种绘制模型，且层级顺序固定为：
 *   背景(Metal) < 图片 < 笔迹 < 文本 < 覆盖层(网格/标尺)，
 * 与「图片垫底、文字压在最上面」的笔记直觉一致。
 */
- (void)setupContentLayersIfNeeded
{
  if (!self.strokeLayer) {
    self.strokeLayer = [CAShapeLayer layer];
    self.strokeLayer.fillColor = [UIColor clearColor].CGColor;
    self.strokeLayer.lineCap = kCALineCapRound;
    self.strokeLayer.lineJoin = kCALineJoinRound;
    self.strokeLayer.frame = self.bounds;
    [self.layer insertSublayer:self.strokeLayer above:self.metalView.layer];
  }

  if (!self.imageLayerContainer) {
    self.imageLayerContainer = [CALayer layer];
    self.imageLayerContainer.frame = self.bounds;
    // 图片在笔迹之下：手写标注应该压在照片上面而不是被盖住。
    [self.layer insertSublayer:self.imageLayerContainer below:self.strokeLayer];
  }

  if (!self.textLayerContainer) {
    self.textLayerContainer = [CALayer layer];
    self.textLayerContainer.frame = self.bounds;
    [self.layer insertSublayer:self.textLayerContainer above:self.strokeLayer];
  }
}

/**
 * 重建当前页的全部内容层。
 *
 * 分派规则（这是此前最大的功能缺口）：
 *   type == "text"  -> 文本层（fill 语义，不能走 UIBezierPath）
 *   type == "image" -> 图片层
 *   type == "shape" -> 笔迹层（形状本质是路径，只是需要 pathData 还原）
 *   其它/带 points -> 笔迹层
 * 旧实现把 text/image 也丢给 appendStroke:，而后者只读 points，
 * 于是「数据写进去了、屏幕上什么都没有」。
 *
 * ⚠️ 维护约定：本视图的文本层/图片层是**按数据整层重建**的，
 * 凡是改动 pages[..][@"strokes"] 或 currentStroke 的路径，
 * 改完都必须调用本方法（只 setNeedsDisplay 不会更新这两层）。
 * 当前需要调用的地方：insertText: / addImage: / undo / redo / clear: /
 * eraseAtPoint: / setCurrentPage: / setToolConfig: / setViewport: /
 * resetViewport / pinch / pan / layoutSubviews / importNote:。
 * 新增任何“增删改内容”的命令时，请先在这里确认是否漏挂。
 */
- (void)rebuildStrokeLayers
{
  [self setupContentLayersIfNeeded];

  // 重建前先清空：文本/图片层的子层数量随内容变化，必须整体重建，
  // 否则删除/撤销后会残留上一次的图层。
  [self.strokeLayer.sublayers makeObjectsPerformSelector:@selector(removeFromSuperlayer)];
  [self.textLayerContainer.sublayers makeObjectsPerformSelector:@selector(removeFromSuperlayer)];
  [self.imageLayerContainer.sublayers makeObjectsPerformSelector:@selector(removeFromSuperlayer)];

  NSArray *strokes = @[];
  if (self.currentPage >= 0 && self.currentPage < (NSInteger)self.pages.count) {
    strokes = self.pages[self.currentPage][@"strokes"] ?: @[];
  }

  for (NSDictionary *stroke in strokes) {
    [self renderStrokeEntry:stroke];
  }

  // 进行中的笔迹单独画：它还没有落进 pages，但必须实时可见。
  if (self.currentStroke.count > 0) {
    [self renderStrokeEntry:@{ @"type": @"stroke",
                               @"points": self.currentStroke,
                               @"color": [self hexFromColor:self.currentColor],
                               @"width": @(self.currentStrokeWidth),
                               @"tool": self.currentTool ?: @"pen" }];
  }

  [self rebuildOverlayLayers];

  // 首次重建时做一次「逐条落层」诊断：文本/图片过去完全不显示，
  // 光看截图无法区分「没数据」还是「没渲染」，这行日志能直接给出答案。
  if (!self.didLogRenderSummary) {
    self.didLogRenderSummary = YES;
    NSLog(@"[NativePagedNoteView] %@", [self renderDebugDescription]);
  }
}

/**
 * 内容层现况的一句话诊断（供 onMetrics/排查使用）。
 * 为什么不只报 strokes.count：条目数包含文本/图片，而图层数才是「真的画出来了」的证据。
 */
- (NSString *)renderDebugDescription
{
  NSInteger inkCount = 0;
  NSInteger textCount = 0;
  NSInteger imageCount = 0;
  NSArray *strokes = @[];
  if (self.currentPage >= 0 && self.currentPage < (NSInteger)self.pages.count) {
    strokes = self.pages[self.currentPage][@"strokes"] ?: @[];
  }
  for (NSDictionary *stroke in strokes) {
    if (![stroke isKindOfClass:[NSDictionary class]]) continue;
    NSString *type = stroke[@"type"] ?: @"stroke";
    if ([type isEqualToString:@"text"]) {
      textCount++;
    } else if ([type isEqualToString:@"image"]) {
      imageCount++;
    } else {
      inkCount++;
    }
  }
  return [NSString stringWithFormat:
          @"page=%ld 记录(ink=%ld text=%ld image=%ld) 图层(ink=%lu text=%lu image=%lu)",
          (long)self.currentPage,
          (long)inkCount, (long)textCount, (long)imageCount,
          (unsigned long)self.strokeLayer.sublayers.count,
          (unsigned long)self.textLayerContainer.sublayers.count,
          (unsigned long)self.imageLayerContainer.sublayers.count];
}

/** 按 type 把一条记录分派到对应图层。 */
- (void)renderStrokeEntry:(NSDictionary *)stroke
{
  if (![stroke isKindOfClass:[NSDictionary class]]) {
    return;
  }

  NSString *type = stroke[@"type"];
  if (![type isKindOfClass:[NSString class]] || type.length == 0) {
    type = @"stroke";
  }

  if ([type isEqualToString:@"text"]) {
    [self renderTextEntry:stroke];
    return;
  }
  if ([type isEqualToString:@"image"]) {
    [self renderImageEntry:stroke];
    return;
  }

  // 形状存的是 startPoint/endPoint 而不是 points：若不当成笔迹还原，
  // 用户画的矩形/箭头在重绘后就消失了。
  if ([type isEqualToString:@"shape"] && stroke[@"startPoint"]) {
    [self renderShapeEntry:stroke];
    return;
  }

  [self renderInkEntry:stroke];
}

/**
 * 笔迹：一条笔迹一个 CAShapeLayer。
 *
 * 为什么不复用单个 layer：单层只能有一个 strokeColor/lineWidth，
 * 而每条笔迹的颜色、线宽、透明度都可以不同（工具栏每笔都能换色）。
 * 逐条成层是唯一能保证「所见即所存」的做法。
 */
- (void)renderInkEntry:(NSDictionary *)stroke
{
  NSArray *points = stroke[@"points"];
  if (![points isKindOfClass:[NSArray class]] || points.count == 0) {
    return;
  }

  UIBezierPath *path = [UIBezierPath bezierPath];
  BOOL first = YES;
  // 坐标约定（详见 screenToWorld: 的说明）：笔迹点存的是「页面坐标」，
  // 绘制时经 worldToScreen: 换算到屏幕。文本/图片/形状走同一变换，
  // 四者才能在同一次平移/缩放里保持相对位置。
  for (NSValue *value in points) {
    if (![value isKindOfClass:[NSValue class]]) continue;
    CGPoint p = [self worldToScreen:[value CGPointValue]];
    if (first) {
      [path moveToPoint:p];
      first = NO;
    } else {
      [path addLineToPoint:p];
    }
  }
  if (path.isEmpty) {
    return;
  }

  CAShapeLayer *layer = [CAShapeLayer layer];
  layer.path = path.CGPath;
  layer.fillColor = [UIColor clearColor].CGColor;
  layer.strokeColor = [self colorFromHex:(stroke[@"color"] ?: @"#000000")].CGColor;
  layer.lineWidth = [self strokeWidthForEntry:stroke];
  layer.lineCap = kCALineCapRound;
  layer.lineJoin = kCALineJoinRound;
  layer.opacity = (float)[self opacityForEntry:stroke];
  [self.strokeLayer addSublayer:layer];
}

/** 形状：按 startPoint/endPoint 还原成路径，再走笔迹层。 */
- (void)renderShapeEntry:(NSDictionary *)stroke
{
  // 与笔迹同样经 worldToScreen: 还原（见 renderInkEntry 的坐标约定说明）。
  CGPoint start = [self worldToScreen:CGPointFromString(stroke[@"startPoint"])];
  CGPoint end = [self worldToScreen:CGPointFromString(stroke[@"endPoint"])];
  NSString *shape = stroke[@"shape"] ?: @"line";

  UIBezierPath *path = [self createShapePathFrom:start to:end shapeName:shape];
  if (!path || path.isEmpty) {
    return;
  }

  CAShapeLayer *layer = [CAShapeLayer layer];
  layer.path = path.CGPath;
  layer.fillColor = [UIColor clearColor].CGColor;
  layer.strokeColor = [self colorFromHex:(stroke[@"color"] ?: @"#000000")].CGColor;
  layer.lineWidth = [self strokeWidthForEntry:stroke];
  layer.lineCap = kCALineCapRound;
  layer.lineJoin = kCALineJoinRound;
  [self.strokeLayer addSublayer:layer];
}

/**
 * 文本：用 drawInRect:withAttributes: 光栅化到一张按需大小的图片，
 * 再放进 CATextLayer 式的图片层。
 *
 * 为什么不用 CATextLayer：CATextLayer 的 contentsScale/换行/下划线在不同
 * 系统版本上表现不一致，且 underline 要额外拼 NSAttributedString，
 * 用 Core Graphics 一次画准，落到图和 Android 的 drawText 语义一致。
 * 坐标系与 Android 保持一致（t.x/t.y 是文字基线起点），才能跨端还原。
 */
- (void)renderTextEntry:(NSDictionary *)stroke
{
  NSString *text = stroke[@"text"];
  if (![text isKindOfClass:[NSString class]] || text.length == 0) {
    return;
  }

  // 与笔迹同样经 worldToScreen: 还原（见 renderInkEntry 的坐标约定说明）；
  // 字号同样要乘视口缩放，否则放大后文字会「留在原地变小」，与落点脱节。
  CGPoint anchor = [self worldToScreen:[self pointFromEntry:stroke
                                                   fallback:CGPointMake(self.bounds.size.width / 2, self.bounds.size.height / 2)]];
  CGFloat fontSize = [self fontSizeForEntry:stroke] * MAX(0.1, self.viewportScale);
  UIColor *color = [self colorFromHex:(stroke[@"color"] ?: @"#000000")];
  // 旧数据可能落在屏幕右半边，若按 center 对齐会溢出到画布外，
  // 因此以页面宽度为约束做换行排版。
  CGFloat maxWidth = MAX(40.0, self.bounds.size.width - anchor.x - 8.0);

  UIFont *font = [self fontWithSize:fontSize
                               bold:[stroke[@"bold"] boolValue]
                             italic:[stroke[@"italic"] boolValue]];
  NSMutableParagraphStyle *paragraph = [[NSMutableParagraphStyle alloc] init];
  paragraph.lineBreakMode = NSLineBreakByWordWrapping;
  NSString *alignment = stroke[@"alignment"];
  if ([alignment isEqualToString:@"center"]) {
    paragraph.alignment = NSTextAlignmentCenter;
  } else if ([alignment isEqualToString:@"right"]) {
    paragraph.alignment = NSTextAlignmentRight;
  } else {
    paragraph.alignment = NSTextAlignmentLeft;
  }

  NSDictionary *attrs = @{
    NSFontAttributeName: font,
    NSForegroundColorAttributeName: color,
    NSParagraphStyleAttributeName: paragraph,
    NSUnderlineStyleAttributeName: [stroke[@"underline"] boolValue] ? @(NSUnderlineStyleSingle) : @(NSUnderlineStyleNone),
  };

  CGRect textRect = [text boundingRectWithSize:CGSizeMake(maxWidth, CGFLOAT_MAX)
                                       options:NSStringDrawingUsesLineFragmentOrigin | NSStringDrawingUsesFontLeading
                                    attributes:attrs
                                       context:nil];
  // 位图宽度严格等于文本排版宽度、绘制原点取 (0,0)：
  // 若在左右留内边距，居中对齐会被「盒子宽度」污染，落点会比锚点偏几 pt，
  // 与 Android 的 drawText（x 就是每行的中心）对不上。
  // 高度多留 2pt 只为兜住下划线与降部被裁掉的情况——它不影响落点
  // （originY 由 ascender 决定，与高度无关）。
  CGSize drawSize = CGSizeMake(ceil(MAX(textRect.size.width, 1.0)),
                               ceil(MAX(textRect.size.height, 1.0)) + 2.0);
  if (drawSize.width <= 1.0 || drawSize.height <= 1.0) {
    return;
  }

  // 文字基线锚点 -> 绘制矩形原点（drawInRect 从左上角起排）
  CGFloat originX = anchor.x;
  if ([alignment isEqualToString:@"center"]) {
    originX = anchor.x - drawSize.width / 2.0;
  } else if ([alignment isEqualToString:@"right"]) {
    originX = anchor.x - drawSize.width;
  }
  // 记录里的 y 是文字基线（与 Android 一致），首行基线距位图顶部约一个 ascender。
  CGFloat originY = anchor.y - font.ascender;

  // 缓存键必须包含所有影响像素的入参（含颜色）；少一个就会出现
  // 「改完颜色/对齐还是旧图」这类极难排查的脏缓存。
  NSString *cacheKey = [NSString stringWithFormat:@"%@|%.1fx%.1f|%.1f|%d%d%d|%@|%@",
                        [self hexFromColor:color], drawSize.width, drawSize.height, fontSize,
                        [stroke[@"bold"] boolValue], [stroke[@"italic"] boolValue], [stroke[@"underline"] boolValue],
                        alignment ?: @"left", text];
  UIImage *image = [self.textImageCache objectForKey:cacheKey];
  if (!image) {
    UIGraphicsBeginImageContextWithOptions(drawSize, NO, [UIScreen mainScreen].scale);
    [text drawInRect:CGRectMake(0, 0, drawSize.width, drawSize.height) withAttributes:attrs];
    image = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    if (image) {
      [self.textImageCache setObject:image forKey:cacheKey];
    }
  }
  if (!image) {
    NSLog(@"[NativePagedNoteView] 文本光栅化失败，已跳过该条: %@", text);
    return;
  }

  CALayer *layer = [CALayer layer];
  layer.frame = CGRectMake(floor(originX), floor(originY), drawSize.width, drawSize.height);
  layer.contents = (__bridge id)image.CGImage;
  // contentsGravity 用 resize 会把字拉变形，这里保持原尺寸。
  layer.contentsGravity = kCAGravityResize;
  layer.contentsScale = [UIScreen mainScreen].scale;
  layer.masksToBounds = NO;
  [self.textLayerContainer addSublayer:layer];
}

/**
 * 图片：按 uri 或内嵌 base64 解码，按元数据宽高比落图。
 *
 * 宽高比优先用导入的 w/h（跨设备唯一可靠），其次用真实像素尺寸，
 * 都没有时退回 4:3；默认宽度取页宽的 60%，与工具栏面板的语义一致。
 */
- (void)renderImageEntry:(NSDictionary *)stroke
{
  UIImage *image = [self decodedImageForEntry:stroke];
  if (!image) {
    // 加载失败必须留痕：否则用户只看到「点添加图片没反应」，无从排查。
    NSLog(@"[NativePagedNoteView] 图片加载失败（已保留记录，仅本次不绘制）: uri=%@",
          stroke[@"uri"] ?: @"(内嵌 base64)");
    return;
  }

  // 与笔迹同样经 worldToScreen: 还原（见 renderInkEntry 的坐标约定说明）。
  CGRect worldFrame = [self imageFrameForEntry:stroke decodedSize:image.size];
  CGPoint screenOrigin = [self worldToScreen:worldFrame.origin];
  CGFloat screenScale = MAX(0.1, self.viewportScale);
  // 图片要跟着视口一起缩放：w/h 存的是世界尺寸，屏幕尺寸需乘缩放系数。
  CGRect frame = CGRectMake(screenOrigin.x, screenOrigin.y,
                            worldFrame.size.width * screenScale,
                            worldFrame.size.height * screenScale);

  CALayer *layer = [CALayer layer];
  layer.frame = frame;
  layer.contents = (__bridge id)image.CGImage;
  layer.contentsGravity = kCAGravityResizeAspect;
  layer.contentsScale = image.scale;
  layer.masksToBounds = YES;
  [self.imageLayerContainer addSublayer:layer];
}

/**
 * 图片解码：ph://（相册）、file://、http(s) 与内嵌 base64 四条路径。
 * 全部失败返回 nil，由调用方打诊断日志，绝不让整页渲染中断。
 */
- (UIImage *)decodedImageForEntry:(NSDictionary *)stroke
{
  // 1) 内嵌 base64 优先：它不依赖任何本机路径，是跨设备还原的唯一可靠来源。
  NSString *base64 = stroke[@"bitmapBase64"] ?: stroke[@"imageBase64"] ?: stroke[@"base64"];
  if ([base64 isKindOfClass:[NSString class]] && base64.length > 0) {
    UIImage *cached = [self.imageCache objectForKey:base64];
    if (cached) {
      return cached;
    }
    UIImage *image = [self imageFromBase64:base64];
    if (image) {
      [self.imageCache setObject:image forKey:base64];
    }
    return image;
  }

  NSString *uri = stroke[@"uri"];
  if (![uri isKindOfClass:[NSString class]] || uri.length == 0) {
    return nil;
  }
  UIImage *cached = [self.imageCache objectForKey:uri];
  if (cached) {
    return cached;
  }

  UIImage *image = nil;
  if ([uri hasPrefix:@"ph://"] || [uri hasPrefix:@"assets-library://"]) {
    image = [self loadPhotoAssetWithURI:uri];
  } else if ([uri hasPrefix:@"file://"]) {
    image = [UIImage imageWithContentsOfFile:[uri substringFromIndex:7]];
  } else if ([uri hasPrefix:@"http://"] || [uri hasPrefix:@"https://"]) {
    // 渲染路径绝不做网络 IO：这是每次平移/缩放都会走到的同步调用，
    // 一旦发起请求就会卡住主线程（滚动会直接掉帧/无响应）。
    // 缓存未命中就返回 nil；JS 侧应先下载为 file:// 或带 bitmapBase64 再插入。
    //
    // 这里单独打一条「远端 URL 不在渲染期下载」的日志：与「file:// 文件不存在」
    // 必须能区分开，否则两种情况都只是空白，排查时会误判为渲染失效。
    NSLog(@"[NativePagedNoteView] 跳过远端图片（渲染期不下载，请先落盘或内嵌 base64）: %@", uri);
    image = nil;
  } else if ([uri hasPrefix:@"/"]) {
    image = [UIImage imageWithContentsOfFile:uri];
  } else {
    image = [UIImage imageNamed:uri];
  }

  if (image) {
    [self.imageCache setObject:image forKey:uri];
  }
  return image;
}

/** 相册 asset：用 PHAsset 取原图，同步等待（渲染路径要求当次就拿到图）。 */
- (UIImage *)loadPhotoAssetWithURI:(NSString *)uri
{
  NSString *localIdentifier = uri;
  NSRange slashRange = [uri rangeOfString:@"//"];
  if (slashRange.location != NSNotFound) {
    localIdentifier = [uri substringFromIndex:slashRange.location + slashRange.length];
  }
  // assets-library URL 带查询串，PHAsset 只认纯 localIdentifier。
  NSRange queryRange = [localIdentifier rangeOfString:@"?"];
  if (queryRange.location != NSNotFound) {
    localIdentifier = [localIdentifier substringToIndex:queryRange.location];
  }
  if (localIdentifier.length == 0) {
    return nil;
  }

  PHFetchResult<PHAsset *> *assets = [PHAsset fetchAssetsWithLocalIdentifiers:@[localIdentifier] options:nil];
  PHAsset *asset = assets.firstObject;
  if (!asset) {
    return nil;
  }

  __block UIImage *result = nil;
  PHImageRequestOptions *options = [[PHImageRequestOptions alloc] init];
  options.synchronous = YES;      // 渲染路径需要同步结果
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

/**
 * 从 base64 还原图片。
 *
 * 兼容 data URL 前缀（"data:image/png;base64,..."）：Android/JS 侧
 * 可能带上它，直接丢给 NSData 会因为前缀不是合法 base64 而整体解码失败。
 */
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
 * 图片条目 -> 内容矩形（左上角 x/y + 宽高）。
 *
 * 兼容三种记录形态：
 *  1) 新格式：x/y/w/h（与 Android 导出一致）；
 *  2) 旧格式：只有 position（中心点）+ 无尺寸 -> 默认页宽 60%、按真实比例；
 *  3) 只有 w/h 没有比例信息 -> 用解码后的真实像素尺寸补比例。
 */
- (CGRect)imageFrameForEntry:(NSDictionary *)stroke decodedSize:(CGSize)decodedSize
{
  CGFloat pageWidth = MAX(1.0, self.bounds.size.width);
  CGFloat pageHeight = MAX(1.0, self.bounds.size.height);

  CGFloat width = [stroke[@"w"] doubleValue];
  CGFloat height = [stroke[@"h"] doubleValue];
  BOOL hasRatio = (width > 1.0 && height > 1.0);
  CGFloat ratio = 0.75; // 4:3 兜底
  if (hasRatio) {
    ratio = height / width;
  } else if (decodedSize.width > 0 && decodedSize.height > 0) {
    ratio = decodedSize.height / decodedSize.width;
  }

  if (!(width > 1.0)) {
    width = pageWidth * 0.6;
  }
  if (!(height > 1.0)) {
    height = width * ratio;
  }

  BOOL hasOrigin = (stroke[@"x"] != nil && stroke[@"y"] != nil);
  CGFloat x = [stroke[@"x"] doubleValue];
  CGFloat y = [stroke[@"y"] doubleValue];
  // 只有在 x/y 缺失、或 (0,0) 且同时带了 position 时才按中心点反推：
  // 旧记录只有 position（无 x/y），不反推会全堆到左上角；而 (0,0) 且无 position
  // 是「还没落位的占位记录」，同样要居中。真·放在原点的图片（有 x/y=0 且
  // 有 position 冲突时才需要判断）不满足这两个条件，不会被误移。
  BOOL looksLikePlaceholder = (fabs(x) < 0.5 && fabs(y) < 0.5) && stroke[@"position"] != nil;
  if (!hasOrigin || looksLikePlaceholder) {
    CGPoint center = [self pointFromEntry:stroke fallback:CGPointMake(pageWidth / 2.0, pageHeight / 2.0)];
    x = center.x - width / 2.0;
    y = center.y - height / 2.0;
  }

  return CGRectMake(x, y, width, height);
}

/** 文本/图片条目的字号。 */
- (CGFloat)fontSizeForEntry:(NSDictionary *)stroke
{
  CGFloat size = [stroke[@"fontSize"] doubleValue];
  if (!(size > 0)) {
    size = 16.0;
  }
  return MAX(4.0, MIN(512.0, size));
}

/** 按 bold/italic 组字体。 */
- (UIFont *)fontWithSize:(CGFloat)size bold:(BOOL)bold italic:(BOOL)italic
{
  UIFont *base = [UIFont systemFontOfSize:size];
  UIFontDescriptor *descriptor = base.fontDescriptor;
  UIFontDescriptorSymbolicTraits traits = 0;
  if (bold) traits |= UIFontDescriptorTraitBold;
  if (italic) traits |= UIFontDescriptorTraitItalic;
  if (traits != 0) {
    UIFontDescriptor *traited = [descriptor fontDescriptorWithSymbolicTraits:traits];
    if (traited) {
      UIFont *font = [UIFont fontWithDescriptor:traited size:size];
      if (font) {
        return font;
      }
    }
  }
  return base;
}

/** 从 position(NSStringFromCGPoint) 或 x/y 数字取落点，兼容 Android 导出的格式。 */
- (CGPoint)pointFromEntry:(NSDictionary *)stroke fallback:(CGPoint)fallback
{
  NSString *position = stroke[@"position"];
  if ([position isKindOfClass:[NSString class]] && position.length > 0) {
    return CGPointFromString(position);
  }
  if (stroke[@"x"] != nil || stroke[@"y"] != nil) {
    CGFloat x = [stroke[@"x"] doubleValue];
    CGFloat y = [stroke[@"y"] doubleValue];
    return CGPointMake(x, y);
  }
  return fallback;
}

/** 单条笔迹的线宽（记录里的 width 优先，缺省才回落到当前工具宽度）。 */
- (CGFloat)strokeWidthForEntry:(NSDictionary *)stroke
{
  CGFloat width = [stroke[@"width"] doubleValue];
  if (!(width > 0)) {
    width = [stroke[@"strokeWidth"] doubleValue];
  }
  if (!(width > 0)) {
    // 记录里连宽度都没有（脏数据）时才回落到当前工具的推导线宽，
    // 保证「一条宽度为 0 的笔迹」不会变成看不见的细丝。
    width = [self effectiveStrokeWidth];
  }
  return MAX(0.5, width);
}

/** 单条笔迹的不透明度：alpha(0-255) 与 opacity(0-1) 两种写法都接受。 */
- (CGFloat)opacityForEntry:(NSDictionary *)stroke
{
  if (stroke[@"opacity"] != nil) {
    CGFloat value = [stroke[@"opacity"] doubleValue];
    return MAX(0.0, MIN(1.0, value));
  }
  if (stroke[@"alpha"] != nil) {
    CGFloat value = [stroke[@"alpha"] doubleValue];
    // 导出格式里 alpha 是 0-255；部分旧数据直接存 0-1。
    if (value > 1.0) {
      value = value / 255.0;
    }
    return MAX(0.0, MIN(1.0, value));
  }
  return [self effectiveOpacityForTool:stroke[@"tool"]];
}

/** 按工具推导透明度（高亮笔半透明、铅笔略淡）。 */
- (CGFloat)effectiveOpacityForTool:(NSString *)tool
{
  CGFloat opacity = 1.0;
  if (self.toolConfigDictionary[@"opacity"]) {
    opacity = [self.toolConfigDictionary[@"opacity"] doubleValue];
  }
  opacity = MAX(0.0, MIN(1.0, opacity));
  if ([tool isEqualToString:@"highlighter"]) {
    return opacity * 0.5;
  }
  if ([tool isEqualToString:@"pencil"]) {
    return opacity * 0.7;
  }
  return opacity;
}

/**
 * 重建工具栏覆盖层：网格（showGrid）与标尺（showRuler）。
 * 两者此前只改 JS 本地 state、从不下发原生，属于死接线。
 * 用 Core Graphics 渲染成一张图片，刻度与数字天然对齐。
 */
- (void)rebuildOverlayLayers
{
  BOOL showGrid = [self.toolConfigDictionary[@"showGrid"] boolValue];
  BOOL showRuler = [self.toolConfigDictionary[@"showRuler"] boolValue];
  CGSize size = self.bounds.size;

  if (!showGrid && !showRuler) {
    self.overlayImageView.image = nil;
    return;
  }
  if (size.width <= 0 || size.height <= 0) {
    return;
  }

  if (!self.overlayImageView) {
    self.overlayImageView = [[UIImageView alloc] initWithFrame:self.bounds];
    self.overlayImageView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    self.overlayImageView.userInteractionEnabled = NO;
    [self addSubview:self.overlayImageView];
  }
  self.overlayImageView.frame = self.bounds;

  UIGraphicsBeginImageContextWithOptions(size, NO, [UIScreen mainScreen].scale);
  CGContextRef context = UIGraphicsGetCurrentContext();

  if (showGrid) {
    CGContextSetStrokeColorWithColor(context, [[UIColor colorWithRed:0.69 green:0.75 blue:0.77 alpha:0.35] CGColor]);
    CGContextSetLineWidth(context, 1.0);
    CGFloat gridSize = 20.0;
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

  UIImage *overlayImage = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  self.overlayImageView.image = overlayImage;
}

// 说明：原 appendStroke:toPath: 只读 points，text/image 条目会被直接 return，
// 是「数据进去了但屏幕上什么都没有」的直接原因。它已被 renderInkEntry: /
// renderTextEntry: / renderImageEntry: 的分派渲染取代，这里彻底删除，
// 避免以后有人再把它接回主渲染路径。

/** 由笔型/工具/压感配置推导出的线宽。 */
- (CGFloat)effectiveStrokeWidth
{
  CGFloat base = self.currentStrokeWidth;
  NSString *tool = self.currentTool ?: @"pen";
  NSString *profile = self.toolConfigDictionary[@"penProfile"] ?: @"fountain";

  if ([tool isEqualToString:@"highlighter"]) {
    base *= 2.0;
  } else if ([tool isEqualToString:@"pencil"]) {
    base *= 0.8;
  } else if ([tool isEqualToString:@"brush"]) {
    base *= 1.5;
  } else if ([profile isEqualToString:@"ballpoint"]) {
    base *= 0.85;
  }
  return MAX(0.5, base);
}

// Public Methods
- (void)setNoteId:(NSString *)noteId { _noteId = noteId; }
- (void)setStyleConfig:(NSDictionary *)config { _styleConfig = config; [self.metalView setNeedsDisplay]; }
- (void)setCurrentTool:(NSString *)tool { _currentTool = tool; [self updateAllowedTouchTypes]; }
- (void)setCurrentColor:(NSString *)color { _currentColor = [self colorFromHex:color]; }
- (void)setCurrentStrokeWidth:(CGFloat)width { _currentStrokeWidth = width; }
- (void)setCurrentPage:(NSInteger)page {
  _currentPage = page;
  // 换页必须重建内容层：文本/图片层是逐页重建的，不重建会看到上一页的内容。
  [self rebuildStrokeLayers];
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
    // 撤销可能撤掉的是文本/图片条目，必须重建内容层而不是只 setNeedsDisplay。
    [self rebuildStrokeLayers];
    [self.metalView setNeedsDisplay];
  }
  [self emitHistoryStateChange];
}

- (void)redo {
  if (self.redoStack.count > 0) {
    // 从重做栈中取出最后一个笔迹，添加回当前页面
    NSDictionary *strokeToRedo = [self.redoStack lastObject];
    [self.redoStack removeLastObject];

    NSMutableDictionary *page = self.pages[self.currentPage];
    NSMutableArray *strokes = page[@"strokes"];
    [strokes addObject:strokeToRedo];

    [self rebuildStrokeLayers];
    [self.metalView setNeedsDisplay];
  }
  [self emitHistoryStateChange];
}

- (void)clear:(NSString *)clearType {
  NSLog(@"[NativePagedNoteView] 清除类型: %@", clearType);

  NSString *scope = clearType.length > 0 ? clearType : @"current_page";

  if ([scope isEqualToString:@"current_page"]) {
    // 清除当前页面
    NSMutableDictionary *page = self.pages[self.currentPage];
    page[@"strokes"] = [NSMutableArray array];
    [self.redoStack removeAllObjects];
    [self rebuildStrokeLayers];
    [self.metalView setNeedsDisplay];
  } else if ([scope isEqualToString:@"entire_document"] || [scope isEqualToString:@"all"]) {
    // 清除整个文档
    for (NSMutableDictionary *page in self.pages) {
      page[@"strokes"] = [NSMutableArray array];
    }
    [self.redoStack removeAllObjects];
    [self rebuildStrokeLayers];
    [self.metalView setNeedsDisplay];
  } else if ([scope isEqualToString:@"selected"]) {
    // 清除选中内容（需要套索选择功能支持）
    NSLog(@"[NativePagedNoteView] 清除选中内容功能待实现");
  }
  [self emitHistoryStateChange];
}

/**
 * 插入文本（带样式）。
 *
 * 为什么要收 styleJson：JS 文本面板能调字号/颜色/粗斜体/下划线/对齐，
 * 而这五个字段过去在桥接层就被丢掉了，原生只能存一个「纯文本」。
 * 用户看到的与画布上落下的必须一致，所以样式必须随命令一起存进记录。
 *
 * @param styleJson fontSize/color/bold/italic/underline/alignment，可选 x/y
 */
- (void)insertText:(NSString *)text styleJson:(NSString *)styleJson
{
  if (![text isKindOfClass:[NSString class]] || text.length == 0) {
    NSLog(@"[NativePagedNoteView] insertText: 文本为空，忽略");
    return;
  }
  if (self.currentPage < 0 || self.currentPage >= (NSInteger)self.pages.count) {
    NSLog(@"[NativePagedNoteView] insertText: 当前页无效 page=%ld", (long)self.currentPage);
    return;
  }

  NSDictionary *style = [self parseJSONDictionary:styleJson];
  // 默认落点＝页面中心，与工具栏「不给坐标就直接放在中间」的直觉一致。
  CGPoint centerPoint = [self pageCenterPoint];
  CGFloat x = style[@"x"] != nil ? [style[@"x"] doubleValue] : centerPoint.x;
  CGFloat y = style[@"y"] != nil ? [style[@"y"] doubleValue] : centerPoint.y;

  CGFloat fontSize = [style[@"fontSize"] doubleValue];
  if (!(fontSize > 0)) {
    fontSize = 16.0;
  }

  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];

  [strokes addObject:@{
    @"id": [[NSUUID UUID] UUIDString],
    @"type": @"text",
    @"text": text,
    // position 是人类可读的旧字段，x/y 与 Android 导出的字段名一致，
    // 两者都写是为了双向兼容（旧版本读 position，新版本/Android 读 x,y）。
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
  }];

  // 新内容入栈后重做栈必须清空，否则「撤销→再画→重做」会重放出被撤销的旧内容。
  [self.redoStack removeAllObjects];

  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": [[NSUUID UUID] UUIDString],
      @"page": @(self.currentPage),
      @"tool": @"text",
      @"text": text
    });
  }

  [self emitHistoryStateChange];
  // 立即重建，不等 MTKView 的异步 draw 回调：否则「点添加文本」后
  // 画面上要等下一帧才出现，用户会以为没生效。
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
}

/** 兼容旧签名：不带样式时按默认样式插入。 */
- (void)insertText:(NSString *)text {
  [self insertText:text styleJson:nil];
}

/**
 * 添加图片（带元数据）。
 *
 * metaJson 里带 width/height/fileName：宽高比决定落图尺寸，
 * 只发 uri 的话原生只能猜比例，横图会被压成方的。
 * 默认宽度取页宽的 60%、居中，与 JS 面板语义一致。
 */
- (void)addImage:(NSString *)imageUri metaJson:(NSString *)metaJson
{
  if (![imageUri isKindOfClass:[NSString class]] || imageUri.length == 0) {
    NSLog(@"[NativePagedNoteView] addImage: uri 为空，忽略");
    return;
  }
  if (self.currentPage < 0 || self.currentPage >= (NSInteger)self.pages.count) {
    NSLog(@"[NativePagedNoteView] addImage: 当前页无效 page=%ld", (long)self.currentPage);
    return;
  }

  NSDictionary *meta = [self parseJSONDictionary:metaJson];

  // 先尽力解码一次：既拿到真实比例，也把「加载失败」提前暴露成日志，
  // 避免用户点了添加却毫无反馈（记录仍会保存，导出时不会丢）。
  UIImage *image = [self decodedImageForEntry:@{ @"uri": imageUri }];
  CGFloat metaW = [meta[@"width"] doubleValue];
  CGFloat metaH = [meta[@"height"] doubleValue];

  CGFloat ratio = 0.75; // 4:3 兜底
  if (metaW > 0 && metaH > 0) {
    ratio = metaH / metaW;
  } else if (image && image.size.width > 0) {
    ratio = image.size.height / image.size.width;
  } else {
    NSLog(@"[NativePagedNoteView] addImage: 无法解码图片，按 4:3 记录: %@", imageUri);
  }

  CGFloat pageWidth = self.bounds.size.width;
  CGFloat targetWidth = pageWidth * 0.6;
  CGFloat targetHeight = targetWidth * ratio;
  CGPoint center = [self pageCenterPoint];

  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];

  NSMutableDictionary *entry = [@{
    @"id": [[NSUUID UUID] UUIDString],
    @"type": @"image",
    @"uri": imageUri,
    @"position": NSStringFromCGPoint(center),
    // w/h 与 Android 的导出字段同名，跨端可读；x/y 是左上角（与 Android 一致），
    // position 是中心点（本视图的落点语义）。
    @"x": @(center.x - targetWidth / 2.0),
    @"y": @(center.y - targetHeight / 2.0),
    @"w": @(targetWidth),
    @"h": @(targetHeight),
    @"tool": @"image"
  } mutableCopy];
  if (meta[@"fileName"]) entry[@"fileName"] = meta[@"fileName"];
  if (meta[@"fileSize"]) entry[@"fileSize"] = meta[@"fileSize"];

  [strokes addObject:entry];
  [self.redoStack removeAllObjects];

  if (self.onStrokeCommitted) {
    self.onStrokeCommitted(@{
      @"strokeId": [[NSUUID UUID] UUIDString],
      @"page": @(self.currentPage),
      @"tool": @"image"
    });
  }

  [self emitHistoryStateChange];
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
}

/** 兼容旧签名：不带元数据时按图片真实比例落图。 */
- (void)addImage:(NSString *)imageUri {
  [self addImage:imageUri metaJson:nil];
}

/** 解析命令里的 JSON 字符串；脏数据一律当作空字典，绝不抛异常中断渲染。 */
- (NSDictionary *)parseJSONDictionary:(NSString *)json
{
  if (![json isKindOfClass:[NSString class]] || json.length == 0) {
    return @{};
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  if (!data) {
    return @{};
  }
  id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  return [parsed isKindOfClass:[NSDictionary class]] ? parsed : @{};
}

/** 颜色合法性校验：样式里的非法色值不能污染笔迹，回落到当前颜色。 */
- (NSString *)normalizedColorHex:(id)value fallback:(UIColor *)fallback
{
  if ([value isKindOfClass:[NSString class]] && [value hasPrefix:@"#"]) {
    NSString *hex = value;
    if (hex.length == 7 || hex.length == 9) {
      return hex;
    }
  }
  return [self hexFromColor:fallback];
}

/** 对齐值收敛到原生认识的三种；未知值按左对齐（与 JS 默认一致）。 */
- (NSString *)normalizedAlignment:(id)value
{
  if ([value isKindOfClass:[NSString class]]) {
    if ([value isEqualToString:@"center"] || [value isEqualToString:@"right"] || [value isEqualToString:@"left"]) {
      return value;
    }
  }
  return @"left";
}

#pragma mark - Import/Export

/**
 * 导入分页笔记。
 *
 * 此前的实现**只**重建 points 字段：text（靠 text/position 表达）与
 * image（靠 uri 表达）会被整体丢掉，等于「保存后重新打开，文字和图片消失」。
 * 现在按 type 分派，并把 Android 导出的字段名（x/y/w/h/bitmapBase64）
 * 一并接受，保证双端互通。
 */
- (void)importNote:(NSString *)jsonData
{
  if (!jsonData || jsonData.length == 0) return;
  @try {
    NSData *data = [jsonData dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *note = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![note isKindOfClass:[NSDictionary class]]) return;

    NSNumber *current = note[@"currentPage"];
    NSArray *pagesArray = [note[@"pages"] isKindOfClass:[NSArray class]] ? note[@"pages"] : @[];

    NSMutableArray *newPages = [NSMutableArray array];
    for (NSDictionary *p in pagesArray) {
      if (![p isKindOfClass:[NSDictionary class]]) continue;
      NSArray *strokesSrc = [p[@"strokes"] isKindOfClass:[NSArray class]] ? p[@"strokes"] : @[];
      NSMutableArray *strokes = [NSMutableArray array];
      for (NSDictionary *s in strokesSrc) {
        NSDictionary *entry = [self importedEntryFromJSON:s];
        if (entry) {
          [strokes addObject:entry];
        }
      }
      [newPages addObject:@{ @"strokes": strokes }];
    }

    self.pages = newPages.count > 0 ? newPages : [@[ @{ @"strokes": [NSMutableArray array] } ] mutableCopy];
    if (current) self.currentPage = MAX(0, MIN((NSInteger)self.pages.count - 1, [current integerValue]));
    [self.metalView setNeedsDisplay];

    if (self.onReady) {
      self.onReady(@{ @"totalPages": @(self.pages.count), @"currentPage": @(self.currentPage) });
    }
  } @catch (NSException *e) {
    NSLog(@"[NativePagedNoteView] importNote 失败: %@", e.reason);
  }
}

/** 把一条 JSON 记录还原成内部记录；无法识别返回 nil（宁可跳过一条也不要整篇失败）。 */
- (NSDictionary *)importedEntryFromJSON:(NSDictionary *)s
{
  if (![s isKindOfClass:[NSDictionary class]]) {
    return nil;
  }
  NSString *type = s[@"type"] ?: @"stroke";

  if ([type isEqualToString:@"text"]) {
    CGFloat x = s[@"x"] != nil ? [s[@"x"] doubleValue] : CGPointFromString(s[@"position"]).x;
    CGFloat y = s[@"y"] != nil ? [s[@"y"] doubleValue] : CGPointFromString(s[@"position"]).y;
    CGFloat fontSize = [s[@"fontSize"] doubleValue];
    if (!(fontSize > 0)) {
      fontSize = 16.0;
    }
    return @{
      @"type": @"text",
      @"text": s[@"text"] ?: @"",
      @"position": NSStringFromCGPoint(CGPointMake(x, y)),
      @"x": @(x),
      @"y": @(y),
      @"fontSize": @(fontSize),
      @"color": [s[@"color"] isKindOfClass:[NSString class]] ? s[@"color"] : @"#000000",
      @"bold": @([s[@"bold"] boolValue]),
      @"italic": @([s[@"italic"] boolValue]),
      @"underline": @([s[@"underline"] boolValue]),
      @"alignment": [self normalizedAlignment:s[@"alignment"]],
      @"tool": @"text"
    };
  }

  if ([type isEqualToString:@"image"]) {
    NSMutableDictionary *entry = [@{
      @"type": @"image",
      @"position": NSStringFromCGPoint(CGPointMake([s[@"x"] doubleValue] + [s[@"w"] doubleValue] / 2.0,
                                                   [s[@"y"] doubleValue] + [s[@"h"] doubleValue] / 2.0)),
      @"x": @([s[@"x"] doubleValue]),
      @"y": @([s[@"y"] doubleValue]),
      @"w": @([s[@"w"] doubleValue]),
      @"h": @([s[@"h"] doubleValue]),
      @"tool": @"image"
    } mutableCopy];
    // 位图内嵌优先（跨设备唯一可靠），否则退回 uri（同机可用）。
    if ([s[@"bitmapBase64"] isKindOfClass:[NSString class]] && [s[@"bitmapBase64"] length] > 0) {
      entry[@"bitmapBase64"] = s[@"bitmapBase64"];
    }
    if ([s[@"uri"] isKindOfClass:[NSString class]] && [s[@"uri"] length] > 0) {
      entry[@"uri"] = s[@"uri"];
    }
    if ([s[@"fileName"] isKindOfClass:[NSString class]]) {
      entry[@"fileName"] = s[@"fileName"];
    }
    return entry;
  }

  if ([type isEqualToString:@"shape"]) {
    return @{
      @"type": @"shape",
      @"shape": s[@"shape"] ?: @"line",
      @"startPoint": s[@"startPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"endPoint": s[@"endPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"color": [s[@"color"] isKindOfClass:[NSString class]] ? s[@"color"] : @"#000000",
      @"width": s[@"strokeWidth"] ?: s[@"width"] ?: @(2.0),
      @"tool": @"shape"
    };
  }

  NSArray *pts = [s[@"points"] isKindOfClass:[NSArray class]] ? s[@"points"] : @[];
  NSMutableArray *ptValues = [NSMutableArray arrayWithCapacity:pts.count];
  for (NSDictionary *pt in pts) {
    if (![pt isKindOfClass:[NSDictionary class]]) continue;
    [ptValues addObject:[NSValue valueWithCGPoint:CGPointMake([pt[@"x"] doubleValue], [pt[@"y"] doubleValue])]];
  }
  if (ptValues.count == 0) {
    return nil;
  }
  return @{
    @"type": @"stroke",
    @"points": ptValues,
    @"color": [s[@"color"] isKindOfClass:[NSString class]] ? s[@"color"] : @"#000000",
    @"width": s[@"strokeWidth"] ?: s[@"width"] ?: @(2.0),
    @"alpha": s[@"alpha"] ?: @(255),
    @"tool": s[@"tool"] ?: @"pen"
  };
}

/**
 * 导出分页笔记。
 *
 * 文本与图片必须单独序列化：它们不靠 points 表达内容，
 * 沿用「只存 points」的旧逻辑会在导出时静默丢失。
 * 图片用 PNG base64 内嵌——本地路径换设备就失效，这是唯一能跨设备还原的方式。
 */
- (void)exportNote:(NSString *)noteId
{
  @try {
    NSMutableArray *pagesOut = [NSMutableArray arrayWithCapacity:self.pages.count];
    for (NSDictionary *page in self.pages) {
      NSArray *strokes = [page[@"strokes"] isKindOfClass:[NSArray class]] ? page[@"strokes"] : @[];
      NSMutableArray *strokesOut = [NSMutableArray arrayWithCapacity:strokes.count];
      for (NSDictionary *s in strokes) {
        NSDictionary *out = [self exportedEntryFromStroke:s];
        if (out) {
          [strokesOut addObject:out];
        }
      }
      [pagesOut addObject:@{ @"pageNumber": @([pagesOut count] + 1),
                             @"strokeCount": @(strokesOut.count),
                             @"strokes": strokesOut }];
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

/** 单条记录的导出序列化；字段名与 Android 侧保持一致以便双端互读。 */
- (NSDictionary *)exportedEntryFromStroke:(NSDictionary *)s
{
  if (![s isKindOfClass:[NSDictionary class]]) {
    return nil;
  }
  NSString *type = s[@"type"] ?: @"stroke";

  if ([type isEqualToString:@"text"]) {
    CGPoint anchor = [self pointFromEntry:s fallback:CGPointMake(self.bounds.size.width / 2.0, self.bounds.size.height / 2.0)];
    CGFloat fontSize = [s[@"fontSize"] doubleValue];
    if (!(fontSize > 0)) {
      fontSize = 16.0;
    }
    return @{
      @"type": @"text",
      @"text": s[@"text"] ?: @"",
      @"x": @(anchor.x),
      @"y": @(anchor.y),
      @"fontSize": @(fontSize),
      @"color": s[@"color"] ?: @"#000000",
      @"bold": @([s[@"bold"] boolValue]),
      @"italic": @([s[@"italic"] boolValue]),
      @"underline": @([s[@"underline"] boolValue]),
      @"alignment": [self normalizedAlignment:s[@"alignment"]],
      @"tool": @"text"
    };
  }

  if ([type isEqualToString:@"image"]) {
    NSMutableDictionary *out = [@{
      @"type": @"image",
      @"x": @([s[@"x"] doubleValue]),
      @"y": @([s[@"y"] doubleValue]),
      @"w": @([s[@"w"] doubleValue]),
      @"h": @([s[@"h"] doubleValue]),
      @"tool": @"image"
    } mutableCopy];
    if ([s[@"fileName"] isKindOfClass:[NSString class]]) {
      out[@"fileName"] = s[@"fileName"];
    }
    // 导出那一刻才压缩成 PNG：平时不占额外内存，且能跨设备还原。
    UIImage *image = [self decodedImageForEntry:s];
    NSData *png = image ? UIImagePNGRepresentation(image) : nil;
    if (png.length > 0) {
      out[@"bitmapBase64"] = [png base64EncodedStringWithOptions:0];
    } else {
      // 解不出来时至少留下 uri，避免导出直接丢记录；日志便于定位是哪张图。
      NSLog(@"[NativePagedNoteView] 导出时无法解码图片，仅保留 uri: %@", s[@"uri"] ?: @"(无 uri)");
      if ([s[@"uri"] isKindOfClass:[NSString class]]) {
        out[@"uri"] = s[@"uri"];
      }
    }
    return out;
  }

  if ([type isEqualToString:@"shape"]) {
    return @{
      @"type": @"shape",
      @"shape": s[@"shape"] ?: @"line",
      @"startPoint": s[@"startPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"endPoint": s[@"endPoint"] ?: NSStringFromCGPoint(CGPointZero),
      @"color": s[@"color"] ?: @"#000000",
      @"strokeWidth": s[@"width"] ?: @(2.0),
      @"alpha": @(255),
      @"tool": @"shape"
    };
  }

  NSArray *pts = [s[@"points"] isKindOfClass:[NSArray class]] ? s[@"points"] : @[];
  NSMutableArray *ptsOut = [NSMutableArray arrayWithCapacity:pts.count];
  for (NSValue *v in pts) {
    if (![v isKindOfClass:[NSValue class]]) continue;
    CGPoint p = [v CGPointValue];
    [ptsOut addObject:@{ @"x": @(p.x), @"y": @(p.y), @"pressure": @(1.0) }];
  }
  if (ptsOut.count == 0) {
    return nil;
  }
  return @{
    @"type": @"stroke",
    @"color": s[@"color"] ?: @"#000000",
    @"strokeWidth": s[@"width"] ?: @(2.0),
    @"alpha": @(255),
    @"points": ptsOut,
    @"tool": s[@"tool"] ?: @"pen"
  };
}

- (UIColor *)colorFromHex:(NSString *)hex {
  // 脏数据防御：导入的 JSON 里 color 可能是 null/数字/空串，
  // 直接 [hex hasPrefix:] 会因 unrecognized selector 崩溃，整页渲染中断。
  if (![hex isKindOfClass:[NSString class]] || hex.length == 0) {
    return [UIColor blackColor];
  }
  unsigned rgbValue = 0;
  NSScanner *scanner = [NSScanner scannerWithString:hex];
  if ([hex hasPrefix:@"#"]) [scanner setScanLocation:1];
  [scanner scanHexInt:&rgbValue];
  return [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16)/255.0
                         green:((rgbValue & 0xFF00) >> 8)/255.0
                          blue:(rgbValue & 0xFF)/255.0 alpha:1.0];
}

- (NSString *)hexFromColor:(UIColor *)color {
  // getRed:green:blue:alpha: 在色彩空间不支持时会返回 NO 并把参数留成未初始化值，
  // 不检查就会把随机内存写进 color 字段（导出后表现为「颜色随机」）。
  CGFloat r = 0, g = 0, b = 0, a = 1;
  if (!color || ![color getRed:&r green:&g blue:&b alpha:&a]) {
    return @"#000000";
  }
  return [NSString stringWithFormat:@"#%02X%02X%02X",
          (int)lround(r*255), (int)lround(g*255), (int)lround(b*255)];
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
  if (![self shouldDrawWithTouch:touch]) {
    return;
  }
  // 采集即换算到页面坐标：渲染侧统一用 worldToScreen 还原，
  // 两边都用同一模型，内容才不会在平移/缩放后错位。
  CGPoint location = [self screenToWorld:[touch locationInView:self]];
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
  if (![self shouldDrawWithTouch:touch]) {
    return;
  }

  NSArray *coalescedTouches = [event coalescedTouchesForTouch:touch];
  if (coalescedTouches.count == 0) {
    CGPoint location = [self screenToWorld:[touch locationInView:self]];
    [self continueStrokeToPoint:location];
    return;
  }

  for (UITouch *coalescedTouch in coalescedTouches) {
    CGPoint location = [self screenToWorld:[coalescedTouch locationInView:self]];
    [self continueStrokeToPoint:location];
  }
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesEnded:touches withEvent:event];
  if (self.suppressTouchStroke || ![self isDrawingToolActive]) {
    return;
  }
  UITouch *touch = [touches anyObject];
  if (touch && ![self shouldDrawWithTouch:touch]) {
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

// 说明：这里原有一份重复的 renderBackgroundWithEncoder:（Core Graphics 预渲染
// 到一张从未被使用的图，注释写着 TODO 未接 Metal）。它与 drawInMTKView 调用的
// 同名方法重复定义，属于既有编译错误；已删除，背景仍由前者驱动。

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

  // 橡皮擦半径：入参与笔迹点都已是页面坐标，因此半径也要折算到页面单位。
  // 不折算的话，放大后「屏幕上的橡皮擦」会变小（手指擦不到看到的墨迹）。
  CGFloat eraserRadius = (self.currentStrokeWidth * 3) / MAX(0.1, self.viewportScale);

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
      // 必须重建内容层：橡皮擦改的是数据，文本/图片层不会自己跟着变。
      [self rebuildStrokeLayers];
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

  // 入参是页面坐标（存库用）；输入框是 UI 控件，要换算成屏幕坐标才放得对。
  self.textInputPoint = point;
  CGPoint screenPoint = [self worldToScreen:point];

  CGFloat width = 200;
  CGFloat height = 100;
  CGRect textFrame = CGRectMake(screenPoint.x, screenPoint.y, width, height);

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
    // 走与 insertText:styleJson: 同一条落库路径：画布内输入的文字
    // 也必须带上样式与坐标，且能被导出/导入还原。
    NSDictionary *style = @{
      @"x": @(self.textInputPoint.x),
      @"y": @(self.textInputPoint.y),
      @"fontSize": @(self.textInputView.font.pointSize),
      @"color": [self hexFromColor:self.currentColor],
      @"alignment": @"left",
    };
    NSData *styleData = [NSJSONSerialization dataWithJSONObject:style options:0 error:nil];
    NSString *styleJson = styleData ? [[NSString alloc] initWithData:styleData encoding:NSUTF8StringEncoding] : nil;

    [self.textInputView removeFromSuperview];
    self.textInputView = nil;
    [self insertText:text styleJson:styleJson];
    return;
  }

  [self.textInputView removeFromSuperview];
  self.textInputView = nil;
}

// 套索选择工具
- (void)startLassoSelectionAtPoint:(CGPoint)point
{
  NSLog(@"[NativePagedNoteView] 开始套索选择");

  // lassoPath 保留页面坐标（endLassoSelection 要拿它做命中判定，
  // 而笔迹点也是页面坐标）；显示用的 layer 单独用屏幕坐标路径。
  self.lassoPath = [UIBezierPath bezierPath];
  [self.lassoPath moveToPoint:point];

  self.lassoLayer = [CAShapeLayer layer];
  self.lassoLayer.strokeColor = [UIColor blueColor].CGColor;
  self.lassoLayer.fillColor = [[UIColor blueColor] colorWithAlphaComponent:0.1].CGColor;
  self.lassoLayer.lineWidth = 2.0;
  self.lassoLayer.lineDashPattern = @[@5, @3];

  [self.layer addSublayer:self.lassoLayer];
  [self updateLassoLayerFromPagePath];
}

// CGPathApply 的回调是 C 函数指针，不能写 block；用一个上下文结构体
// 同时携带「视图（换算用）」与「输出路径」。
typedef struct {
  __unsafe_unretained NativePagedNoteView *view;
  __unsafe_unretained UIBezierPath *output;
} ZeroIslePathConvertContext;

/** 逐元素把页面坐标换算为屏幕坐标（为什么不用 CGAffineTransform：见下方说明）。 */
static void ZeroIsleConvertPagePathToScreen(void *info, const CGPathElement *element)
{
  ZeroIslePathConvertContext *ctx = (ZeroIslePathConvertContext *)info;
  NativePagedNoteView *view = ctx->view;
  UIBezierPath *out = ctx->output;
  if (!view || !out) {
    return;
  }

  const CGPoint *points = element->points;
  // 逐点调用 worldToScreen:，而不是整体 concat 一个 CGAffineTransform：
  // 视图的 viewport 目前只有平移+缩放，但换算逻辑集中在一处，
  // 以后若加入旋转/中心偏移，这里不需要跟着改第二份公式。
  switch (element->type) {
    case kCGPathElementMoveToPoint:
      [out moveToPoint:[view worldToScreen:points[0]]];
      break;
    case kCGPathElementAddLineToPoint:
      [out addLineToPoint:[view worldToScreen:points[0]]];
      break;
    case kCGPathElementAddQuadCurveToPoint:
      [out addQuadCurveToPoint:[view worldToScreen:points[1]]
                  controlPoint:[view worldToScreen:points[0]]];
      break;
    case kCGPathElementAddCurveToPoint:
      [out addCurveToPoint:[view worldToScreen:points[2]]
              controlPoint1:[view worldToScreen:points[0]]
              controlPoint2:[view worldToScreen:points[1]]];
      break;
    case kCGPathElementCloseSubpath:
      [out closePath];
      break;
  }
}

/**
 * 把页面坐标路径整体换算成屏幕坐标路径。
 *
 * 之所以不用 UIBezierPath 的 elementCount/elementAtIndex:：
 * 这些 API 在部分 SDK 上不可用（编译期直接报 no visible @interface），
 * CGPathApply 才是跨版本稳定的接口。
 */
- (UIBezierPath *)screenPathForPagePath:(UIBezierPath *)pagePath
{
  UIBezierPath *screenPath = [UIBezierPath bezierPath];
  ZeroIslePathConvertContext ctx = { self, screenPath };
  CGPathApply(pagePath.CGPath, &ctx, ZeroIsleConvertPagePathToScreen);
  return screenPath;
}

/** 把页面坐标的 lassoPath 换算成屏幕坐标后显示（layer 始终是屏幕空间）。 */
- (void)updateLassoLayerFromPagePath
{
  if (!self.lassoPath || !self.lassoLayer) {
    return;
  }
  self.lassoLayer.path = [self screenPathForPagePath:self.lassoPath].CGPath;
}

- (void)continueLassoSelectionToPoint:(CGPoint)point
{
  if (self.lassoPath) {
    [self.lassoPath addLineToPoint:point];
    [self updateLassoLayerFromPagePath];
  }
}

- (void)endLassoSelection
{
  if (!self.lassoPath) return;

  [self.lassoPath closePath];
  [self updateLassoLayerFromPagePath];

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
      // 上报**字符串 id**而不是数组下标：JS 的选中操作通道
      // (serializeStrokeIds) 会把数字过滤掉，上报下标等于选中操作全部空转。
      // 历史记录可能没有 id（旧数据），这里补一个并写回，保证后续可操作。
      NSString *strokeId = stroke[@"id"];
      if (![strokeId isKindOfClass:[NSString class]] || strokeId.length == 0) {
        strokeId = [[NSUUID UUID] UUIDString];
        // strokes[i] 通常是不可变 NSDictionary，不能直接 setValue:forKey:
        // （会抛异常），必须以可变副本替换回数组。
        NSMutableDictionary *mutableStroke = [stroke mutableCopy];
        mutableStroke[@"id"] = strokeId;
        strokes[i] = mutableStroke;
      }
      [selectedStrokes addObject:strokeId];
      NSLog(@"[NativePagedNoteView] 选中笔迹 %@", strokeId);
    }
  }

  NSLog(@"[NativePagedNoteView] 选中 %lu 个笔迹", (unsigned long)selectedStrokes.count);

  // 高亮显示选中的笔迹
  if (selectedStrokes.count > 0) {
    self.lassoLayer.strokeColor = [UIColor greenColor].CGColor;
    self.lassoLayer.fillColor = [[UIColor greenColor] colorWithAlphaComponent:0.1].CGColor;

    // 上报选中笔迹的索引，供 JS 侧工具栏使用（此前 iOS 不发这个事件）
    if (self.onStrokesSelected) {
      self.onStrokesSelected(@{
        @"strokeIds": [selectedStrokes copy],
        @"count": @(selectedStrokes.count)
      });
    }

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
  self.shapeEndPoint = point;

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
    // 预览层在屏幕空间：把页面坐标的起点/终点换算后再画。
    // 注意不要从 layer.path 反读终点（那是屏幕坐标，直接存会污染页面坐标系）。
    UIBezierPath *shapePath = [self createShapePathFrom:[self worldToScreen:self.shapeStartPoint]
                                                     to:[self worldToScreen:point]];
    self.shapePreviewLayer.path = shapePath.CGPath;
    self.shapeEndPoint = point;
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
      @"id": [[NSUUID UUID] UUIDString],
      @"type": @"shape",
      @"shape": self.currentShape,
      @"startPoint": NSStringFromCGPoint(self.shapeStartPoint),
      @"endPoint": NSStringFromCGPoint(self.shapeEndPoint),
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
  // 用当前形状名走统一实现，避免同一套图形算法存在两份（修改容易漏改一处）。
  return [self createShapePathFrom:start to:end shapeName:(self.currentShape ?: @"line")];
}

/**
 * 按显式形状名生成路径。
 *
 * 为什么要显式传入：重绘历史形状时不能依赖 self.currentShape——
 * 用户画完矩形后又切到了箭头工具，历史矩形会被重绘成箭头。
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

    // 更新激光笔路径：currentStroke 存页面坐标，而 laserLayer 是屏幕空间的
    // CALayer，必须逐点换算，否则平移/缩放后激光轨迹会与手指错位。
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

  self.toolConfigDictionary = config;
  NSLog(@"[NativePagedNoteView] 工具配置更新: %@", config);

  if (config[@"shape"]) {
    self.currentShape = config[@"shape"];
  }
  // 配置（透明度/笔型等）会影响既有笔迹观感，立即重绘
  [self updateAllowedTouchTypes];
  // 工具配置变化会改变 opacity/笔型，必须立刻重建内容层；
  // 只 setNeedsDisplay 的话 MTKView 的 draw 回调是异步的，短时间看不到变化。
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
}

/**
 * 设置视口（JS 协议命令 setViewport）。
 *
 * 此前分页视图的命令表里没有这个命令：JS 侧编排视口（书签跳转、缩放复位）
 * 时 setNativeProps 也可能走到这里，缺失就会静默无效。视图已有 viewportX/Y/scale
 * 状态，这里只需接收并重建内容层。
 */
- (void)setViewport:(NSDictionary *)viewport
{
  if (![viewport isKindOfClass:[NSDictionary class]]) {
    return;
  }
  if (viewport[@"x"]) self.viewportX = [viewport[@"x"] doubleValue];
  if (viewport[@"y"]) self.viewportY = [viewport[@"y"] doubleValue];
  if (viewport[@"scale"]) {
    self.viewportScale = MAX(kUnifiedMinScale, MIN(kUnifiedMaxScale, [viewport[@"scale"] doubleValue]));
  }
  // 视口变了，所有内容层都要按新变换重建（文本/图片/笔迹都以页面坐标存储）。
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
}

/** 复位视口（JS 协议命令 resetViewport）。 */
- (void)resetViewport
{
  self.viewportX = 0;
  self.viewportY = 0;
  self.viewportScale = 1.0;
  [self emitZoomChange];
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
}

/**
 * 用 JS 下发的套索路径更新选区（协议命令 lassoStart/lassoUpdate）。
 *
 * 入参是屏幕坐标（JS 侧手势采集），转成页面坐标存 lassoPath 供命中判定；
 * 显示层用换算后的屏幕坐标，与笔迹点保持同一坐标系。
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

  UIBezierPath *path = [UIBezierPath bezierPath];
  BOOL first = YES;
  for (NSDictionary *pt in pointArray) {
    if (![pt isKindOfClass:[NSDictionary class]]) continue;
    CGPoint screenPoint = CGPointMake([pt[@"x"] doubleValue], [pt[@"y"] doubleValue]);
    CGPoint pagePoint = [self screenToWorld:screenPoint];
    if (first) {
      [path moveToPoint:pagePoint];
      first = NO;
    } else {
      [path addLineToPoint:pagePoint];
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
  [self updateLassoLayerFromPagePath];
}

// MARK: - 选中笔迹操作（JS 协议命令 deleteSelectedStrokes / duplicateSelectedStrokes /
//         moveSelectedStrokes / clearStrokeSelection）
//
// 这四条是工具栏「选中的笔迹」操作通道。此前原生只上报选中结果、
// 没有任何操作入口（AllInOneToolbar 注释里也承认 bridge 没暴露派发器），
// 用户套索选中后无法删除/复制/移动。

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

/** 返回当前页中 id 命中给定集合的条目下标（倒序，便于安全删除）。 */
- (NSArray<NSNumber *> *)indicesOfStrokesWithIds:(NSArray<NSString *> *)strokeIds inPageStrokes:(NSArray *)strokes
{
  NSSet *wanted = [NSSet setWithArray:strokeIds];
  NSMutableArray<NSNumber *> *indices = [NSMutableArray array];
  for (NSInteger i = 0; i < (NSInteger)strokes.count; i++) {
    NSDictionary *stroke = strokes[i];
    if (![stroke isKindOfClass:[NSDictionary class]]) continue;
    NSString *sid = stroke[@"id"];
    if ([sid isKindOfClass:[NSString class]] && [wanted containsObject:sid]) {
      [indices addObject:@(i)];
    }
  }
  // 从后往前删/改，避免下标漂移
  return [[indices sortedArrayUsingSelector:@selector(compare:)] reverseObjectEnumerator].allObjects;
}

/** 删除选中的笔迹。 */
- (void)deleteSelectedStrokes:(NSString *)strokeIdsJson
{
  NSDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];
  NSArray<NSString *> *ids = [self strokeIdsFromJSON:strokeIdsJson];
  if (ids.count == 0 || strokes.count == 0) {
    return;
  }

  NSArray<NSNumber *> *indices = [self indicesOfStrokesWithIds:ids inPageStrokes:strokes];
  for (NSNumber *index in indices) {
    [strokes removeObjectAtIndex:[index unsignedIntegerValue]];
  }
  [self clearSelectionState];
  [self.redoStack removeAllObjects];
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
  [self emitHistoryStateChange];
  NSLog(@"[NativePagedNoteView] 删除选中笔迹 %lu 条", (unsigned long)indices.count);
}

/** 复制选中的笔迹（偏移 dx/dy，默认 16pt）。 */
- (void)duplicateSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy
{
  NSDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];
  NSArray<NSString *> *ids = [self strokeIdsFromJSON:strokeIdsJson];
  if (ids.count == 0 || strokes.count == 0) {
    return;
  }

  NSSet *wanted = [NSSet setWithArray:ids];
  NSMutableArray *copies = [NSMutableArray array];
  for (NSDictionary *stroke in [strokes copy]) {
    if (![stroke isKindOfClass:[NSDictionary class]]) continue;
    NSString *sid = stroke[@"id"];
    if (![sid isKindOfClass:[NSString class]] || ![wanted containsObject:sid]) continue;

    NSMutableDictionary *copy = [self strokeCopy:stroke offsetX:dx offsetY:dy];
    if (copy) {
      [copies addObject:copy];
    }
  }
  if (copies.count == 0) {
    return;
  }

  [strokes addObjectsFromArray:copies];
  [self.redoStack removeAllObjects];
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
  [self emitHistoryStateChange];
  NSLog(@"[NativePagedNoteView] 复制选中笔迹 %lu 条", (unsigned long)copies.count);
}

/** 移动选中的笔迹。 */
- (void)moveSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy
{
  NSDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];
  NSArray<NSString *> *ids = [self strokeIdsFromJSON:strokeIdsJson];
  if (ids.count == 0 || strokes.count == 0) {
    return;
  }

  NSSet *wanted = [NSSet setWithArray:ids];
  BOOL moved = NO;
  for (NSInteger i = 0; i < (NSInteger)strokes.count; i++) {
    NSDictionary *stroke = strokes[i];
    if (![stroke isKindOfClass:[NSDictionary class]]) continue;
    NSString *sid = stroke[@"id"];
    if (![sid isKindOfClass:[NSString class]] || ![wanted containsObject:sid]) continue;

    NSMutableDictionary *shifted = [self strokeCopy:stroke offsetX:dx offsetY:dy];
    if (shifted && [shifted[@"id"] isKindOfClass:[NSString class]]) {
      // 移动是原地替换（保留原 id），这样连续拖动仍作用在同一条上。
      shifted[@"id"] = sid;
      strokes[i] = shifted;
      moved = YES;
    }
  }
  if (!moved) {
    return;
  }

  [self.redoStack removeAllObjects];
  [self rebuildStrokeLayers];
  [self.metalView setNeedsDisplay];
  [self emitHistoryStateChange];
}

/** 清除选中态（JS 协议命令 clearStrokeSelection）。 */
- (void)clearStrokeSelection
{
  [self clearSelectionState];
  if (self.onStrokesSelected) {
    self.onStrokesSelected(@{ @"strokeIds": @[], @"count": @(0) });
  }
}

/** 清掉套索高亮与选中集合。 */
- (void)clearSelectionState
{
  [self.selectedStrokes removeAllObjects];
  [self.lassoLayer removeFromSuperlayer];
  self.lassoLayer = nil;
  self.lassoPath = nil;
}

/**
 * 复制/偏移一条记录。
 *
 * 为什么逐类型处理：points 是 NSValue 数组、文本/图片/形状是坐标字段，
 * 统一「改 position」只对文本有效，笔迹点不动就会「复制出一条完全重叠的线」。
 */
- (NSMutableDictionary *)strokeCopy:(NSDictionary *)stroke offsetX:(CGFloat)dx offsetY:(CGFloat)dy
{
  if (![stroke isKindOfClass:[NSDictionary class]]) {
    return nil;
  }
  NSMutableDictionary *copy = [stroke mutableCopy];
  copy[@"id"] = [[NSUUID UUID] UUIDString];

  NSArray *points = stroke[@"points"];
  if ([points isKindOfClass:[NSArray class]] && points.count > 0) {
    NSMutableArray *shiftedPoints = [NSMutableArray arrayWithCapacity:points.count];
    for (NSValue *value in points) {
      if (![value isKindOfClass:[NSValue class]]) continue;
      CGPoint p = [value CGPointValue];
      [shiftedPoints addObject:[NSValue valueWithCGPoint:CGPointMake(p.x + dx, p.y + dy)]];
    }
    copy[@"points"] = shiftedPoints;
  }

  // 文本/图片：position 是中心点（page 坐标），x/y 视类型分别是锚点/左上角
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
  // 形状用 startPoint/endPoint
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

/** 交互模式：ink 只画、gesture 只手势、mixed 二者并存。 */
- (void)setInteractionMode:(NSString *)mode
{
  if (!mode || mode.length == 0) {
    return;
  }
  NSMutableDictionary *next = [self.toolConfigDictionary mutableCopy] ?: [NSMutableDictionary dictionary];
  next[@"interactionMode"] = mode;
  self.toolConfigDictionary = next;
  NSLog(@"[NativePagedNoteView] 交互模式更新: %@", mode);
}

/** 通知 JS 撤销/重做是否可用（此前分页画布从不发这个事件）。 */
- (void)emitHistoryStateChange
{
  if (!self.onHistoryStateChange) {
    return;
  }
  BOOL canUndo = NO;
  if (self.currentPage >= 0 && self.currentPage < (NSInteger)self.pages.count) {
    NSArray *strokes = self.pages[self.currentPage][@"strokes"];
    canUndo = strokes.count > 0;
  }
  self.onHistoryStateChange(@{
    @"canUndo": @(canUndo),
    @"canRedo": @(self.redoStack.count > 0),
    @"page": @(self.currentPage)
  });
}


// MARK: - Handwriting Recognition Extension

@end

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
    // 主类只实现了 colorFromHex:；旧代码在这里调 colorFromHexString:，
    // 而该方法从未存在（既有编译错误），改为复用真实存在的方法。
    UIColor *color = [self colorFromHex:strokeDict[@"color"]];
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

// 头部漏了 @implementation（既有编译错误）：没有分类声明时，
// 下面这些方法属于「游离在实现之外」，编译器直接报 missing context。
@implementation NativePagedNoteView (TextRecognition)

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

@end
