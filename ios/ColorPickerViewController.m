//
//  ColorPickerViewController.m
//  ZeroIsle_Notes
//
//  颜色拾取器视图控制器实现
//

#import "ColorPickerViewController.h"

// 放大镜视图的尺寸
static const CGFloat kMagnifierSize = 120.0;
static const CGFloat kMagnificationScale = 3.0;

@interface ColorPickerViewController ()

@property (nonatomic, strong) UIImage *screenshot;
@property (nonatomic, strong) UIImageView *screenshotImageView;
@property (nonatomic, strong) UIView *magnifierView;
@property (nonatomic, strong) UIImageView *magnifierImageView;
@property (nonatomic, strong) UIView *crosshairView;
@property (nonatomic, strong) UIView *colorPreviewView;
@property (nonatomic, strong) UILabel *colorLabel;
@property (nonatomic, strong) UIButton *confirmButton;
@property (nonatomic, strong) UIButton *cancelButton;
@property (nonatomic, assign) CGPoint currentTouchPoint;
@property (nonatomic, strong) UIColor *selectedColor;

@end

@implementation ColorPickerViewController

- (instancetype)initWithScreenshot:(UIImage *)screenshot {
  self = [super init];
  if (self) {
    _screenshot = screenshot;
  }
  return self;
}

- (void)viewDidLoad {
  [super viewDidLoad];
  
  self.view.backgroundColor = [UIColor blackColor];
  
  [self setupScreenshotView];
  [self setupMagnifierView];
  [self setupButtons];
  [self setupInstructions];
}

#pragma mark - UI 设置

- (void)setupScreenshotView {
  // 创建截图视图
  self.screenshotImageView = [[UIImageView alloc] initWithFrame:self.view.bounds];
  self.screenshotImageView.image = self.screenshot;
  self.screenshotImageView.contentMode = UIViewContentModeScaleAspectFit;
  self.screenshotImageView.userInteractionEnabled = YES;
  [self.view addSubview:self.screenshotImageView];
  
  // 添加触摸手势
  UIPanGestureRecognizer *panGesture = [[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(handlePan:)];
  [self.screenshotImageView addGestureRecognizer:panGesture];
  
  UITapGestureRecognizer *tapGesture = [[UITapGestureRecognizer alloc] initWithTarget:self action:@selector(handleTap:)];
  [self.screenshotImageView addGestureRecognizer:tapGesture];
}

- (void)setupMagnifierView {
  // 创建放大镜容器
  self.magnifierView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, kMagnifierSize, kMagnifierSize)];
  self.magnifierView.layer.cornerRadius = kMagnifierSize / 2;
  self.magnifierView.layer.borderWidth = 3.0;
  self.magnifierView.layer.borderColor = [UIColor whiteColor].CGColor;
  self.magnifierView.clipsToBounds = YES;
  self.magnifierView.hidden = YES;
  [self.view addSubview:self.magnifierView];
  
  // 创建放大镜图像视图
  self.magnifierImageView = [[UIImageView alloc] initWithFrame:self.magnifierView.bounds];
  self.magnifierImageView.contentMode = UIViewContentModeCenter;
  [self.magnifierView addSubview:self.magnifierImageView];
  
  // 创建十字准星
  self.crosshairView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, kMagnifierSize, kMagnifierSize)];
  self.crosshairView.backgroundColor = [UIColor clearColor];
  self.crosshairView.userInteractionEnabled = NO;
  [self.magnifierView addSubview:self.crosshairView];
  
  // 绘制十字线
  CAShapeLayer *crosshairLayer = [CAShapeLayer layer];
  UIBezierPath *path = [UIBezierPath bezierPath];
  
  // 垂直线
  [path moveToPoint:CGPointMake(kMagnifierSize / 2, 0)];
  [path addLineToPoint:CGPointMake(kMagnifierSize / 2, kMagnifierSize)];
  
  // 水平线
  [path moveToPoint:CGPointMake(0, kMagnifierSize / 2)];
  [path addLineToPoint:CGPointMake(kMagnifierSize, kMagnifierSize / 2)];
  
  crosshairLayer.path = path.CGPath;
  crosshairLayer.strokeColor = [UIColor redColor].CGColor;
  crosshairLayer.lineWidth = 1.0;
  
  [self.crosshairView.layer addSublayer:crosshairLayer];
  
  // 创建颜色预览视图
  CGFloat previewSize = 40;
  self.colorPreviewView = [[UIView alloc] initWithFrame:CGRectMake((kMagnifierSize - previewSize) / 2,
                                                                     kMagnifierSize + 10,
                                                                     previewSize,
                                                                     previewSize)];
  self.colorPreviewView.layer.cornerRadius = previewSize / 2;
  self.colorPreviewView.layer.borderWidth = 2.0;
  self.colorPreviewView.layer.borderColor = [UIColor whiteColor].CGColor;
  [self.magnifierView addSubview:self.colorPreviewView];
  
  // 创建颜色值标签
  self.colorLabel = [[UILabel alloc] initWithFrame:CGRectMake(0, kMagnifierSize + 55, kMagnifierSize, 30)];
  self.colorLabel.textAlignment = NSTextAlignmentCenter;
  self.colorLabel.font = [UIFont boldSystemFontOfSize:14];
  self.colorLabel.textColor = [UIColor whiteColor];
  self.colorLabel.backgroundColor = [[UIColor blackColor] colorWithAlphaComponent:0.7];
  self.colorLabel.layer.cornerRadius = 5;
  self.colorLabel.clipsToBounds = YES;
  [self.magnifierView addSubview:self.colorLabel];
}

- (void)setupButtons {
  // 确认按钮
  self.confirmButton = [UIButton buttonWithType:UIButtonTypeSystem];
  [self.confirmButton setTitle:@"确认" forState:UIControlStateNormal];
  [self.confirmButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  self.confirmButton.backgroundColor = [UIColor colorWithRed:0.0 green:0.478 blue:1.0 alpha:1.0];
  self.confirmButton.layer.cornerRadius = 8;
  self.confirmButton.titleLabel.font = [UIFont boldSystemFontOfSize:16];
  [self.confirmButton addTarget:self action:@selector(confirmButtonTapped) forControlEvents:UIControlEventTouchUpInside];
  self.confirmButton.hidden = YES;
  [self.view addSubview:self.confirmButton];
  
  // 取消按钮
  self.cancelButton = [UIButton buttonWithType:UIButtonTypeSystem];
  [self.cancelButton setTitle:@"取消" forState:UIControlStateNormal];
  [self.cancelButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  self.cancelButton.backgroundColor = [[UIColor whiteColor] colorWithAlphaComponent:0.3];
  self.cancelButton.layer.cornerRadius = 8;
  self.cancelButton.titleLabel.font = [UIFont boldSystemFontOfSize:16];
  [self.cancelButton addTarget:self action:@selector(cancelButtonTapped) forControlEvents:UIControlEventTouchUpInside];
  [self.view addSubview:self.cancelButton];
  
  // 布局按钮
  CGFloat buttonWidth = 100;
  CGFloat buttonHeight = 44;
  CGFloat bottomMargin = 50;
  CGFloat spacing = 20;
  
  self.confirmButton.frame = CGRectMake(self.view.bounds.size.width - buttonWidth - spacing,
                                        self.view.bounds.size.height - buttonHeight - bottomMargin,
                                        buttonWidth,
                                        buttonHeight);
  
  self.cancelButton.frame = CGRectMake(spacing,
                                       self.view.bounds.size.height - buttonHeight - bottomMargin,
                                       buttonWidth,
                                       buttonHeight);
}

- (void)setupInstructions {
  // 创建说明文字
  UILabel *instructionLabel = [[UILabel alloc] initWithFrame:CGRectMake(0, 60, self.view.bounds.size.width, 60)];
  instructionLabel.text = @"触摸屏幕选择颜色\n使用放大镜精确定位";
  instructionLabel.numberOfLines = 2;
  instructionLabel.textAlignment = NSTextAlignmentCenter;
  instructionLabel.font = [UIFont systemFontOfSize:16];
  instructionLabel.textColor = [UIColor whiteColor];
  instructionLabel.backgroundColor = [[UIColor blackColor] colorWithAlphaComponent:0.5];
  [self.view addSubview:instructionLabel];
}

#pragma mark - 手势处理

- (void)handlePan:(UIPanGestureRecognizer *)gesture {
  CGPoint location = [gesture locationInView:self.screenshotImageView];
  
  if (gesture.state == UIGestureRecognizerStateBegan) {
    self.magnifierView.hidden = NO;
    self.confirmButton.hidden = NO;
  }
  
  if (gesture.state == UIGestureRecognizerStateChanged || gesture.state == UIGestureRecognizerStateBegan) {
    [self updateMagnifierAtPoint:location];
  }
}

- (void)handleTap:(UITapGestureRecognizer *)gesture {
  CGPoint location = [gesture locationInView:self.screenshotImageView];
  [self updateMagnifierAtPoint:location];
  self.magnifierView.hidden = NO;
  self.confirmButton.hidden = NO;
}

- (void)updateMagnifierAtPoint:(CGPoint)point {
  self.currentTouchPoint = point;
  
  // 更新放大镜位置（在触摸点上方）
  CGFloat offsetY = kMagnifierSize + 40;
  CGPoint magnifierCenter = CGPointMake(point.x, point.y - offsetY);
  
  // 确保放大镜不超出屏幕边界
  magnifierCenter.x = MAX(kMagnifierSize / 2 + 10, MIN(magnifierCenter.x, self.view.bounds.size.width - kMagnifierSize / 2 - 10));
  magnifierCenter.y = MAX(kMagnifierSize / 2 + 80, magnifierCenter.y);
  
  self.magnifierView.center = magnifierCenter;
  
  // 更新放大镜内容
  [self updateMagnifierContent];
}

- (void)updateMagnifierContent {
  // 获取触摸点周围的图像区域
  CGFloat scale = self.screenshot.scale;
  CGSize magnifiedSize = CGSizeMake(kMagnifierSize / kMagnificationScale, kMagnifierSize / kMagnificationScale);
  
  CGPoint imagePoint = [self convertPointToImageCoordinates:self.currentTouchPoint];
  
  CGRect cropRect = CGRectMake((imagePoint.x - magnifiedSize.width / 2) * scale,
                               (imagePoint.y - magnifiedSize.height / 2) * scale,
                               magnifiedSize.width * scale,
                               magnifiedSize.height * scale);
  
  // 裁剪并放大图像
  CGImageRef imageRef = CGImageCreateWithImageInRect(self.screenshot.CGImage, cropRect);
  if (imageRef) {
    UIImage *croppedImage = [UIImage imageWithCGImage:imageRef scale:1.0 orientation:UIImageOrientationUp];
    CGImageRelease(imageRef);
    
    self.magnifierImageView.image = croppedImage;
  }
  
  // 获取中心点的颜色
  UIColor *color = [self getColorAtPoint:imagePoint];
  self.selectedColor = color;
  
  // 更新颜色预览和标签
  self.colorPreviewView.backgroundColor = color;
  self.colorLabel.text = [self hexStringFromColor:color];
}

#pragma mark - 辅助方法

- (CGPoint)convertPointToImageCoordinates:(CGPoint)point {
  // 将视图坐标转换为图像坐标
  CGSize imageSize = self.screenshot.size;
  CGSize viewSize = self.screenshotImageView.bounds.size;
  
  CGFloat scaleX = imageSize.width / viewSize.width;
  CGFloat scaleY = imageSize.height / viewSize.height;
  
  return CGPointMake(point.x * scaleX, point.y * scaleY);
}

- (UIColor *)getColorAtPoint:(CGPoint)point {
  // 从图像中获取指定点的颜色
  CGImageRef imageRef = self.screenshot.CGImage;
  NSUInteger width = CGImageGetWidth(imageRef);
  NSUInteger height = CGImageGetHeight(imageRef);
  
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  unsigned char *rawData = (unsigned char *)calloc(height * width * 4, sizeof(unsigned char));
  NSUInteger bytesPerPixel = 4;
  NSUInteger bytesPerRow = bytesPerPixel * width;
  NSUInteger bitsPerComponent = 8;
  
  CGContextRef context = CGBitmapContextCreate(rawData, width, height,
                                               bitsPerComponent, bytesPerRow, colorSpace,
                                               kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
  CGColorSpaceRelease(colorSpace);
  
  CGContextDrawImage(context, CGRectMake(0, 0, width, height), imageRef);
  CGContextRelease(context);
  
  NSUInteger x = (NSUInteger)point.x;
  NSUInteger y = (NSUInteger)point.y;
  
  // 边界检查
  if (x >= width) x = width - 1;
  if (y >= height) y = height - 1;
  
  NSUInteger byteIndex = (bytesPerRow * y) + x * bytesPerPixel;
  
  CGFloat red   = (rawData[byteIndex]     / 255.0);
  CGFloat green = (rawData[byteIndex + 1] / 255.0);
  CGFloat blue  = (rawData[byteIndex + 2] / 255.0);
  CGFloat alpha = (rawData[byteIndex + 3] / 255.0);
  
  free(rawData);
  
  return [UIColor colorWithRed:red green:green blue:blue alpha:alpha];
}

- (NSString *)hexStringFromColor:(UIColor *)color {
  const CGFloat *components = CGColorGetComponents(color.CGColor);
  
  CGFloat r = components[0];
  CGFloat g = components[1];
  CGFloat b = components[2];
  
  return [NSString stringWithFormat:@"#%02lX%02lX%02lX",
          lroundf(r * 255),
          lroundf(g * 255),
          lroundf(b * 255)];
}

#pragma mark - 按钮操作

- (void)confirmButtonTapped {
  if (self.onColorPicked && self.selectedColor) {
    NSString *hexColor = [self hexStringFromColor:self.selectedColor];
    self.onColorPicked(hexColor);
  }
  [self dismissViewControllerAnimated:YES completion:nil];
}

- (void)cancelButtonTapped {
  if (self.onCancel) {
    self.onCancel();
  }
  [self dismissViewControllerAnimated:YES completion:nil];
}

@end

