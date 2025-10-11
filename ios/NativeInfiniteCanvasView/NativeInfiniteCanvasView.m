//
//  NativeInfiniteCanvasView.m
//  ZeroIsle_Notes
//
//  无限画布实现 - 世界坐标系统
//

#import "NativeInfiniteCanvasView.h"

#define WORLD_SIZE 100000.0

@interface NativeInfiniteCanvasView () <MTKViewDelegate>

@property (nonatomic, strong) MTKView *metalView;
@property (nonatomic, strong) id<MTLDevice> device;
@property (nonatomic, strong) id<MTLCommandQueue> commandQueue;
@property (nonatomic, strong) NSMutableArray *strokes;
@property (nonatomic, assign) CGFloat viewportX;
@property (nonatomic, assign) CGFloat viewportY;
@property (nonatomic, assign) CGFloat viewportScale;
@property (nonatomic, strong) NSMutableArray *currentStroke;

@end

@implementation NativeInfiniteCanvasView

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    [self setupMetal];
    _strokes = [NSMutableArray array];
    _viewportX = 0;
    _viewportY = 0;
    _viewportScale = 1.0;
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

- (void)setupGestures {
  UIPinchGestureRecognizer *pinch = [[UIPinchGestureRecognizer alloc] initWithTarget:self action:@selector(handlePinch:)];
  UIPanGestureRecognizer *pan = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
  [self addGestureRecognizer:pinch];
  [self addGestureRecognizer:pan];
}

- (void)handlePinch:(UIPinchGestureRecognizer *)gesture {
  if (gesture.state == UIGestureRecognizerStateChanged) {
    self.viewportScale *= gesture.scale;
    self.viewportScale = MAX(0.1, MIN(10.0, self.viewportScale));
    gesture.scale = 1.0;
    [self.metalView setNeedsDisplay];
  }
}

- (void)handlePan:(UIPanGestureRecognizer *)gesture {
  CGPoint translation = [gesture translationInView:self];
  self.viewportX -= translation.x / self.viewportScale;
  self.viewportY -= translation.y / self.viewportScale;
  [gesture setTranslation:CGPointZero inView:self];
  [self.metalView setNeedsDisplay];
}

- (void)drawInMTKView:(MTKView *)view {
  id<MTLCommandBuffer> commandBuffer = [self.commandQueue commandBuffer];
  MTLRenderPassDescriptor *renderPassDescriptor = view.currentRenderPassDescriptor;
  
  if (renderPassDescriptor) {
    id<MTLRenderCommandEncoder> encoder = [commandBuffer renderCommandEncoderWithDescriptor:renderPassDescriptor];
    // TODO: Metal 渲染笔迹和背景
    [encoder endEncoding];
    [commandBuffer presentDrawable:view.currentDrawable];
    [commandBuffer commit];
  }
}

- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {}

- (void)setCanvasId:(NSString *)canvasId {}
- (void)setViewport:(NSDictionary *)viewport {
  if (viewport[@"x"]) self.viewportX = [viewport[@"x"] doubleValue];
  if (viewport[@"y"]) self.viewportY = [viewport[@"y"] doubleValue];
  if (viewport[@"scale"]) self.viewportScale = [viewport[@"scale"] doubleValue];
  [self.metalView setNeedsDisplay];
}
- (void)setStyleConfig:(NSDictionary *)config {}

@end

// Touch Handling for Drawing
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  UITouch *touch = [touches anyObject];
  CGPoint screenPoint = [touch locationInView:self];
  CGPoint worldPoint = [self screenToWorld:screenPoint];
  
  self.currentStroke = [NSMutableArray arrayWithObject:[NSValue valueWithCGPoint:worldPoint]];
  [self.metalView setNeedsDisplay];
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  if (!self.currentStroke) return;
  
  UITouch *touch = [touches anyObject];
  CGPoint screenPoint = [touch locationInView:self];
  CGPoint worldPoint = [self screenToWorld:screenPoint];
  
  [self.currentStroke addObject:[NSValue valueWithCGPoint:worldPoint]];
  [self.metalView setNeedsDisplay];
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  if (self.currentStroke && self.currentStroke.count > 1) {
    [self.strokes addObject:[self.currentStroke copy]];
    
    if (self.onStrokeCommitted) {
      self.onStrokeCommitted(@{@"strokeId": [[NSUUID UUID] UUIDString]});
    }
  }
  
  self.currentStroke = nil;
  [self.metalView setNeedsDisplay];
}

- (CGPoint)screenToWorld:(CGPoint)screenPoint {
  CGFloat offsetX = screenPoint.x - CGRectGetWidth(self.bounds) / 2.0;
  CGFloat offsetY = screenPoint.y - CGRectGetHeight(self.bounds) / 2.0;
  
  CGFloat worldX = offsetX / self.viewportScale + self.viewportX;
  CGFloat worldY = offsetY / self.viewportScale + self.viewportY;
  
  return CGPointMake(worldX, worldY);
}

- (void)renderGridBackground:(id<MTLRenderCommandEncoder>)encoder {
  // 计算可见区域（世界坐标）
  CGFloat halfWidth = CGRectGetWidth(self.bounds) / 2.0 / self.viewportScale;
  CGFloat halfHeight = CGRectGetHeight(self.bounds) / 2.0 / self.viewportScale;
  
  CGFloat visibleLeft = self.viewportX - halfWidth;
  CGFloat visibleRight = self.viewportX + halfWidth;
  CGFloat visibleTop = self.viewportY - halfHeight;
  CGFloat visibleBottom = self.viewportY + halfHeight;
  
  CGFloat gridSize = 50.0;
  
  // TODO: Metal 渲染网格线
  // 仅渲染可见区域内的网格线
}

- (CGPoint)worldToScreen:(CGPoint)worldPoint {
  CGFloat offsetX = (worldPoint.x - self.viewportX) * self.viewportScale;
  CGFloat offsetY = (worldPoint.y - self.viewportY) * self.viewportScale;
  
  CGFloat screenX = CGRectGetWidth(self.bounds) / 2.0 + offsetX;
  CGFloat screenY = CGRectGetHeight(self.bounds) / 2.0 + offsetY;
  
  return CGPointMake(screenX, screenY);
}

@end
