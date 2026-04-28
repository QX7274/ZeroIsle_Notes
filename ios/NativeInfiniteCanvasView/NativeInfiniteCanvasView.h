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
@property (nonatomic, copy) RCTBubblingEventBlock onHandwritingRecognized;

- (void)setCanvasId:(NSString *)canvasId;
- (void)setViewport:(NSDictionary *)viewport;
@property (nonatomic, copy) RCTBubblingEventBlock onStrokesSelected;
- (void)setStyleConfig:(NSDictionary *)config;
- (void)setCurrentTool:(NSString *)tool;
- (void)setCurrentColor:(NSString *)color;
- (void)setCurrentStrokeWidth:(CGFloat)width;
- (void)setToolConfig:(NSString *)configJson;

// 手写识别方法
- (void)recognizeHandwritingInStrokes:(NSArray<NSString *> *)strokeIds completion:(void (^)(NSDictionary *result, NSError *error))completion;

// 区域文本识别（OCR）
- (void)recognizeTextInRect:(CGRect)rect completion:(void (^)(NSArray<NSDictionary *> *results, NSError *error))completion;

@end



