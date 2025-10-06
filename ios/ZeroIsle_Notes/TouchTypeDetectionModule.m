//
//  TouchTypeDetectionModule.m
//  ZeroIsle_Notes
//
//  Created by ZeroIsle_Notes on 2024/01/01.
//  Copyright © 2024 ZeroIsle_Notes. All rights reserved.
//

#import "TouchTypeDetectionModule.h"
#import <React/RCTLog.h>

// 触摸类型常量
NSString *const TOUCH_TYPE_FINGER = @"finger";
NSString *const TOUCH_TYPE_STYLUS = @"stylus";
NSString *const TOUCH_TYPE_UNKNOWN = @"unknown";

// 事件名称
NSString *const EVENT_TOUCH_TYPE_DETECTED = @"TouchTypeDetected";

@interface TouchTypeDetectionModule()
@property (nonatomic, assign) BOOL isListening;
@end

@implementation TouchTypeDetectionModule

RCT_EXPORT_MODULE(TouchTypeDetection);

#pragma mark - RCTEventEmitter

- (NSArray<NSString *> *)supportedEvents {
    return @[EVENT_TOUCH_TYPE_DETECTED];
}

- (NSDictionary *)constantsToExport {
    return @{
        @"TOUCH_TYPE_FINGER": TOUCH_TYPE_FINGER,
        @"TOUCH_TYPE_STYLUS": TOUCH_TYPE_STYLUS,
        @"TOUCH_TYPE_UNKNOWN": TOUCH_TYPE_UNKNOWN,
        @"EVENT_TOUCH_TYPE_DETECTED": EVENT_TOUCH_TYPE_DETECTED
    };
}

#pragma mark - React Methods

/**
 * 开始监听触摸类型
 */
RCT_EXPORT_METHOD(startListening:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        self.isListening = YES;
        RCTLogInfo(@"开始监听触摸类型");
        resolve(@YES);
    } @catch (NSException *exception) {
        RCTLogError(@"启动触摸监听失败: %@", exception.reason);
        reject(@"START_LISTENING_ERROR", exception.reason, nil);
    }
}

/**
 * 停止监听触摸类型
 */
RCT_EXPORT_METHOD(stopListening:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        self.isListening = NO;
        RCTLogInfo(@"停止监听触摸类型");
        resolve(@YES);
    } @catch (NSException *exception) {
        RCTLogError(@"停止触摸监听失败: %@", exception.reason);
        reject(@"STOP_LISTENING_ERROR", exception.reason, nil);
    }
}

/**
 * 检测触摸事件类型
 */
RCT_EXPORT_METHOD(detectTouchType:(double)x
                  y:(double)y
                  force:(double)force
                  radius:(double)radius
                  touchType:(NSInteger)touchType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSString *detectedType = [self determineTouchType:touchType force:force radius:radius];
        
        NSDictionary *result = @{
            @"touchType": detectedType,
            @"x": @(x),
            @"y": @(y),
            @"force": @(force),
            @"radius": @(radius),
            @"originalTouchType": @(touchType),
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
        };
        
        resolve(result);
        
        // 如果正在监听，发送事件
        if (self.isListening) {
            [self sendEventWithName:EVENT_TOUCH_TYPE_DETECTED body:result];
        }
        
    } @catch (NSException *exception) {
        RCTLogError(@"检测触摸类型失败: %@", exception.reason);
        reject(@"DETECT_TOUCH_TYPE_ERROR", exception.reason, nil);
    }
}

/**
 * 批量检测多个触摸点
 */
RCT_EXPORT_METHOD(detectMultiTouchTypes:(NSArray *)touchPoints
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSMutableArray *results = [NSMutableArray array];
        
        for (NSInteger i = 0; i < touchPoints.count; i++) {
            NSDictionary *touchPoint = touchPoints[i];
            if ([touchPoint isKindOfClass:[NSDictionary class]]) {
                double x = [touchPoint[@"x"] doubleValue];
                double y = [touchPoint[@"y"] doubleValue];
                double force = [touchPoint[@"force"] doubleValue];
                double radius = [touchPoint[@"radius"] doubleValue];
                NSInteger touchType = [touchPoint[@"touchType"] integerValue];
                
                NSString *detectedType = [self determineTouchType:touchType force:force radius:radius];
                
                NSDictionary *result = @{
                    @"touchType": detectedType,
                    @"x": @(x),
                    @"y": @(y),
                    @"force": @(force),
                    @"radius": @(radius),
                    @"originalTouchType": @(touchType),
                    @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                    @"pointerId": @(i)
                };
                
                [results addObject:result];
            }
        }
        
        resolve(results);
        
    } @catch (NSException *exception) {
        RCTLogError(@"批量检测触摸类型失败: %@", exception.reason);
        reject(@"DETECT_MULTI_TOUCH_ERROR", exception.reason, nil);
    }
}

/**
 * 获取设备支持的触摸类型
 */
RCT_EXPORT_METHOD(getSupportedTouchTypes:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    @try {
        NSArray *supportedTypes = @[TOUCH_TYPE_FINGER, TOUCH_TYPE_STYLUS];
        BOOL hasApplePencil = [TouchTypeDetectionModule supportsApplePencil];
        
        NSDictionary *result = @{
            @"supportedTypes": supportedTypes,
            @"hasStylus": @(hasApplePencil),
            @"hasForce": @YES, // iOS设备支持3D Touch/Force Touch
            @"hasRadius": @YES
        };
        
        resolve(result);
        
    } @catch (NSException *exception) {
        RCTLogError(@"获取支持的触摸类型失败: %@", exception.reason);
        reject(@"GET_SUPPORTED_TYPES_ERROR", exception.reason, nil);
    }
}

#pragma mark - Private Methods

/**
 * 根据触摸类型、力度和半径判断触摸类型 - 改进版本
 */
- (NSString *)determineTouchType:(NSInteger)touchType force:(double)force radius:(double)radius {
    RCTLogInfo(@"检测触摸类型: touchType=%ld, force=%f, radius=%f", (long)touchType, force, radius);
    
    // 基于iOS UITouch.TouchType判断
    if (@available(iOS 9.1, *)) {
        switch (touchType) {
            case 2: // UITouchTypeStylus (Apple Pencil)
                RCTLogInfo(@"检测到Apple Pencil (UITouchTypeStylus)");
                return TOUCH_TYPE_STYLUS;
            case 0: // UITouchTypeDirect (手指)
                RCTLogInfo(@"检测到直接触摸 (UITouchTypeDirect)");
                return TOUCH_TYPE_FINGER;
            case 1: // UITouchTypeIndirect (间接触摸)
                RCTLogInfo(@"检测到间接触摸 (UITouchTypeIndirect)");
                return TOUCH_TYPE_FINGER;
            default:
                // 如果类型未知，尝试通过力度和半径判断
                NSString *detectedType = [self determineTouchTypeByForceAndRadius:force radius:radius];
                RCTLogInfo(@"通过力度/半径检测: %@", detectedType);
                return detectedType;
        }
    } else {
        // iOS 9.1以下版本，通过力度和半径判断
        NSString *detectedType = [self determineTouchTypeByForceAndRadius:force radius:radius];
        RCTLogInfo(@"iOS 9.1以下版本检测: %@", detectedType);
        return detectedType;
    }
}

/**
 * 通过力度和半径判断触摸类型 - 改进版本
 */
- (NSString *)determineTouchTypeByForceAndRadius:(double)force radius:(double)radius {
    RCTLogInfo(@"力度/半径检测: force=%f, radius=%f", force, radius);
    
    // Apple Pencil通常有更精确的力度控制和更小的接触半径
    // 调整阈值以提高检测准确性
    if (force > 0.05 && radius < 12.0) {
        RCTLogInfo(@"判断为Apple Pencil: 力度=%f, 半径=%f", force, radius);
        return TOUCH_TYPE_STYLUS;
    } else if (radius > 10.0 || force < 0.1) {
        RCTLogInfo(@"判断为手指: 力度=%f, 半径=%f", force, radius);
        return TOUCH_TYPE_FINGER;
    } else {
        RCTLogInfo(@"无法确定类型: 力度=%f, 半径=%f", force, radius);
        return TOUCH_TYPE_UNKNOWN;
    }
}

#pragma mark - Static Methods

/**
 * 从UITouch对象检测触摸类型
 */
+ (NSString *)detectTouchTypeFromUITouch:(UITouch *)touch {
    if (@available(iOS 9.1, *)) {
        switch (touch.type) {
            case UITouchTypeStylus:
                return TOUCH_TYPE_STYLUS;
            case UITouchTypeDirect:
            case UITouchTypeIndirect:
                return TOUCH_TYPE_FINGER;
            default:
                // 通过力度和半径判断
                if (touch.force > 0.1 && touch.majorRadius < 10.0) {
                    return TOUCH_TYPE_STYLUS;
                } else if (touch.majorRadius > 15.0) {
                    return TOUCH_TYPE_FINGER;
                } else {
                    return TOUCH_TYPE_UNKNOWN;
                }
        }
    } else {
        // iOS 9.1以下版本，通过力度和半径判断
        if (touch.force > 0.1 && touch.majorRadius < 10.0) {
            return TOUCH_TYPE_STYLUS;
        } else if (touch.majorRadius > 15.0) {
            return TOUCH_TYPE_FINGER;
        } else {
            return TOUCH_TYPE_UNKNOWN;
        }
    }
}

/**
 * 创建触摸数据字典
 */
+ (NSDictionary *)createTouchDataFromUITouch:(UITouch *)touch inView:(UIView *)view {
    CGPoint location = [touch locationInView:view];
    NSString *touchType = [self detectTouchTypeFromUITouch:touch];
    
    NSMutableDictionary *touchData = [NSMutableDictionary dictionary];
    touchData[@"touchType"] = touchType;
    touchData[@"x"] = @(location.x);
    touchData[@"y"] = @(location.y);
    touchData[@"force"] = @(touch.force);
    touchData[@"majorRadius"] = @(touch.majorRadius);
    touchData[@"timestamp"] = @([touch.timestamp] * 1000);
    
    if (@available(iOS 9.1, *)) {
        touchData[@"originalTouchType"] = @(touch.type);
    }
    
    return [touchData copy];
}

/**
 * 检查设备是否支持Apple Pencil
 */
+ (BOOL)supportsApplePencil {
    // 检查设备是否支持Apple Pencil
    // 这里可以根据设备型号进行更精确的判断
    if (@available(iOS 9.1, *)) {
        return YES; // iOS 9.1+支持Apple Pencil检测
    }
    return NO;
}

/**
 * 获取触摸的详细信息
 */
+ (NSDictionary *)getTouchDetails:(UITouch *)touch {
    NSMutableDictionary *details = [NSMutableDictionary dictionary];
    
    details[@"force"] = @(touch.force);
    details[@"maximumPossibleForce"] = @(touch.maximumPossibleForce);
    details[@"majorRadius"] = @(touch.majorRadius);
    details[@"majorRadiusTolerance"] = @(touch.majorRadiusTolerance);
    details[@"timestamp"] = @(touch.timestamp);
    details[@"tapCount"] = @(touch.tapCount);
    details[@"phase"] = @(touch.phase);
    
    if (@available(iOS 9.1, *)) {
        details[@"type"] = @(touch.type);
    }
    
    if (@available(iOS 8.0, *)) {
        details[@"altitudeAngle"] = @(touch.altitudeAngle);
        details[@"azimuthAngle"] = @([touch azimuthAngleInView:touch.view]);
    }
    
    return [details copy];
}

/**
 * 处理触摸事件并自动发送检测结果
 */
+ (void)handleTouchEvent:(UITouch *)touch inView:(UIView *)view withContext:(ReactApplicationContext *)context {
    NSString *touchType = [self detectTouchTypeFromUITouch:touch];
    CGPoint location = [touch locationInView:view];
    
    NSDictionary *touchData = @{
        @"touchType": touchType,
        @"x": @(location.x),
        @"y": @(location.y),
        @"force": @(touch.force),
        @"majorRadius": @(touch.majorRadius),
        @"timestamp": @([touch.timestamp] * 1000)
    };
    
    RCTLogInfo(@"发送触摸检测结果: %@", touchType);
    
    // 发送事件到JavaScript层
    if (context.hasActiveCatalystInstance) {
        [context.deviceEventEmitter sendEventWithName:EVENT_TOUCH_TYPE_DETECTED body:touchData];
    }
}

@end
