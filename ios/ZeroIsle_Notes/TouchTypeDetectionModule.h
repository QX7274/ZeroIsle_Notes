//
//  TouchTypeDetectionModule.h
//  ZeroIsle_Notes
//
//  Created by ZeroIsle_Notes on 2024/01/01.
//  Copyright © 2024 ZeroIsle_Notes. All rights reserved.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * 触摸类型检测模块
 * 用于识别手指触摸和Apple Pencil触摸
 */
@interface TouchTypeDetectionModule : RCTEventEmitter <RCTBridgeModule>

// 触摸类型常量
extern NSString *const TOUCH_TYPE_FINGER;
extern NSString *const TOUCH_TYPE_STYLUS;
extern NSString *const TOUCH_TYPE_UNKNOWN;

// 事件名称
extern NSString *const EVENT_TOUCH_TYPE_DETECTED;

/**
 * 从UITouch对象检测触摸类型
 * @param touch UITouch对象
 * @return 触摸类型字符串
 */
+ (NSString *)detectTouchTypeFromUITouch:(UITouch *)touch;

/**
 * 创建触摸数据字典
 * @param touch UITouch对象
 * @param view 触摸所在的视图
 * @return 包含触摸信息的字典
 */
+ (NSDictionary *)createTouchDataFromUITouch:(UITouch *)touch inView:(UIView *)view;

/**
 * 检查设备是否支持Apple Pencil
 * @return 是否支持Apple Pencil
 */
+ (BOOL)supportsApplePencil;

/**
 * 获取触摸的详细信息
 * @param touch UITouch对象
 * @return 包含详细信息的字典
 */
+ (NSDictionary *)getTouchDetails:(UITouch *)touch;

@end

NS_ASSUME_NONNULL_END
