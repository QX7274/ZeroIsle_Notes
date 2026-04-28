//
//  ScreenUtils.m
//  ZeroIsle_Notes
//
//  屏幕工具模块实现，提供屏幕截图和颜色拾取等功能
//

#import "ScreenUtils.h"
#import <React/RCTLog.h>
#import <UIKit/UIKit.h>
#import "ColorPickerViewController.h"

@implementation ScreenUtils

RCT_EXPORT_MODULE();

// 导出 pickColor 方法，返回一个 Promise
RCT_EXPORT_METHOD(pickColor:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      // 1. 获取当前屏幕截图
      UIImage *screenshot = [self captureScreen];
      
      if (!screenshot) {
        reject(@"SCREENSHOT_FAILED", @"无法捕获屏幕截图", nil);
        return;
      }
      
      // 2. 获取当前的根视图控制器
      UIViewController *rootViewController = [self getRootViewController];
      
      if (!rootViewController) {
        reject(@"NO_ROOT_VC", @"无法获取根视图控制器", nil);
        return;
      }
      
      // 3. 创建并显示颜色拾取器视图控制器
      ColorPickerViewController *colorPickerVC = [[ColorPickerViewController alloc] initWithScreenshot:screenshot];
      
      // 设置完成回调
      colorPickerVC.onColorPicked = ^(NSString *hexColor) {
        resolve(hexColor);
      };
      
      // 设置取消回调
      colorPickerVC.onCancel = ^{
        reject(@"USER_CANCELLED", @"用户取消了颜色拾取", nil);
      };
      
      // 以模态方式呈现
      colorPickerVC.modalPresentationStyle = UIModalPresentationFullScreen;
      [rootViewController presentViewController:colorPickerVC animated:YES completion:nil];
      
    } @catch (NSException *exception) {
      reject(@"UNEXPECTED_ERROR", exception.reason, nil);
    }
  });
}

#pragma mark - 私有方法

// 捕获当前屏幕
- (UIImage *)captureScreen {
  UIWindow *keyWindow = nil;
  
  // iOS 13+ 使用 UIWindowScene
  if (@available(iOS 13.0, *)) {
    for (UIWindowScene *windowScene in [UIApplication sharedApplication].connectedScenes) {
      if (windowScene.activationState == UISceneActivationStateForegroundActive) {
        for (UIWindow *window in windowScene.windows) {
          if (window.isKeyWindow) {
            keyWindow = window;
            break;
          }
        }
        if (keyWindow) break;
      }
    }
  } else {
    // iOS 13 以下
    keyWindow = [UIApplication sharedApplication].keyWindow;
  }
  
  if (!keyWindow) {
    RCTLogError(@"无法获取 keyWindow");
    return nil;
  }
  
  CGRect bounds = keyWindow.bounds;
  UIGraphicsBeginImageContextWithOptions(bounds.size, NO, [UIScreen mainScreen].scale);
  
  [keyWindow drawViewHierarchyInRect:bounds afterScreenUpdates:YES];
  
  UIImage *screenshot = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  
  return screenshot;
}

// 获取根视图控制器
- (UIViewController *)getRootViewController {
  UIWindow *keyWindow = nil;
  
  // iOS 13+ 使用 UIWindowScene
  if (@available(iOS 13.0, *)) {
    for (UIWindowScene *windowScene in [UIApplication sharedApplication].connectedScenes) {
      if (windowScene.activationState == UISceneActivationStateForegroundActive) {
        for (UIWindow *window in windowScene.windows) {
          if (window.isKeyWindow) {
            keyWindow = window;
            break;
          }
        }
        if (keyWindow) break;
      }
    }
  } else {
    // iOS 13 以下
    keyWindow = [UIApplication sharedApplication].keyWindow;
  }
  
  return keyWindow.rootViewController;
}

@end

