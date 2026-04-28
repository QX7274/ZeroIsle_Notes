//
//  ColorPickerViewController.h
//  ZeroIsle_Notes
//
//  颜色拾取器视图控制器，用于从屏幕截图中选择颜色
//

#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface ColorPickerViewController : UIViewController

// 初始化方法，传入屏幕截图
- (instancetype)initWithScreenshot:(UIImage *)screenshot;

// 颜色选择完成的回调
@property (nonatomic, copy) void (^onColorPicked)(NSString *hexColor);

// 取消选择的回调
@property (nonatomic, copy) void (^onCancel)(void);

@end

NS_ASSUME_NONNULL_END

