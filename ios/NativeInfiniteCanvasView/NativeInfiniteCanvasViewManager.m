//
//  NativeInfiniteCanvasViewManager.m
//  ZeroIsle_Notes
//

#import "NativeInfiniteCanvasViewManager.h"
#import "NativeInfiniteCanvasView.h"

@implementation NativeInfiniteCanvasViewManager

RCT_EXPORT_MODULE(NativeInfiniteCanvasView)

- (UIView *)view {
  return [[NativeInfiniteCanvasView alloc] init];
}

RCT_CUSTOM_VIEW_PROPERTY(canvasId, NSString, NativeInfiniteCanvasView) {
  [view setCanvasId:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(viewport, NSDictionary, NativeInfiniteCanvasView) {
  [view setViewport:[RCTConvert NSDictionary:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(styleConfig, NSDictionary, NativeInfiniteCanvasView) {
  [view setStyleConfig:[RCTConvert NSDictionary:json]];
}

- (NSArray<NSString *> *)customDirectEventTypes {
  return @[@"onViewportChange", @"onStrokeCommitted", @"onMetrics"];
}

@end
