//
//  NativeInfiniteCanvasView.h
//  ZeroIsle_Notes
//
//  原生无限画布视图
//  世界坐标系统 + Metal Transform
//

#import <UIKit/UIKit.h>
#import <MetalKit/MetalKit.h>
#import <React/RCTComponent.h>

@interface NativeInfiniteCanvasView : UIView

@property (nonatomic, copy) RCTBubblingEventBlock onViewportChange;
@property (nonatomic, copy) RCTBubblingEventBlock onStrokeCommitted;
@property (nonatomic, copy) RCTBubblingEventBlock onMetrics;

- (void)setCanvasId:(NSString *)canvasId;
- (void)setViewport:(NSDictionary *)viewport;
- (void)setStyleConfig:(NSDictionary *)config;

@end



