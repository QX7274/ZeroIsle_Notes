//
//  NativePagedNoteView.m
//  ZeroIsle_Notes
//
//  原生分页笔记视图实现
//  Metal 渲染 + 压感支持
//

#import "NativePagedNoteView.h"

@interface NativePagedNoteView () <MTKViewDelegate>

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

- (void)setupGestures
{
  UIPanGestureRecognizer *pan = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
  [self addGestureRecognizer:pan];
}

// Gesture Handling
- (void)handlePan:(UIPanGestureRecognizer *)gesture
{
  CGPoint location = [gesture locationInView:self];
  
  switch (gesture.state) {
    case UIGestureRecognizerStateBegan:
      [self startStrokeAtPoint:location];
      break;
    case UIGestureRecognizerStateChanged:
      [self continueStrokeToPoint:location];
      break;
    case UIGestureRecognizerStateEnded:
    case UIGestureRecognizerStateCancelled:
      [self endStroke];
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
  // TODO: Metal 横线渲染
}

- (void)renderGridWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  // TODO: Metal 网格渲染
}

- (void)renderDotsWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  // TODO: Metal 点阵渲染
}

- (void)renderStrokesWithEncoder:(id<MTLRenderCommandEncoder>)encoder
{
  // TODO: Metal 笔迹渲染
}

// Public Methods
- (void)setNoteId:(NSString *)noteId { _noteId = noteId; }
- (void)setStyleConfig:(NSDictionary *)config { _styleConfig = config; [self.metalView setNeedsDisplay]; }
- (void)setCurrentTool:(NSString *)tool { _currentTool = tool; }
- (void)setCurrentColor:(NSString *)color { _currentColor = [self colorFromHex:color]; }
- (void)setCurrentStrokeWidth:(CGFloat)width { _currentStrokeWidth = width; }
- (void)setCurrentPage:(NSInteger)page { _currentPage = page; [self.metalView setNeedsDisplay]; }
- (void)addNewPage { [self.pages addObject:@{@"strokes": [NSMutableArray array]}]; }
- (void)undo {
  NSMutableDictionary *page = self.pages[self.currentPage];
  NSMutableArray *strokes = page[@"strokes"];
  if (strokes.count > 0) {
    [strokes removeLastObject];
    [self.metalView setNeedsDisplay];
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

@end

// Enhanced Touch Handling with Pressure
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  UITouch *touch = [touches anyObject];
  CGPoint location = [touch locationInView:self];
  CGFloat pressure = touch.force / touch.maximumPossibleForce;
  if (pressure == 0 || isnan(pressure)) pressure = 1.0;
  
  [self startStrokeAtPoint:location];
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  UITouch *touch = [touches anyObject];
  
  // 使用 coalesced touches 获取所有中间点
  NSArray *coalescedTouches = [event coalescedTouchesForTouch:touch];
  for (UITouch *coalescedTouch in coalescedTouches) {
    CGPoint location = [coalescedTouch locationInView:self];
    CGFloat pressure = coalescedTouch.force / coalescedTouch.maximumPossibleForce;
    if (pressure == 0 || isnan(pressure)) pressure = 1.0;
    
    [self continueStrokeToPoint:location];
  }
  
  // 使用 predicted touches 提前绘制预测点
  NSArray *predictedTouches = [event predictedTouchesForTouch:touch];
  if (predictedTouches.count > 0) {
    // TODO: 可选预测点优化
  }
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [self endStroke];
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
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
