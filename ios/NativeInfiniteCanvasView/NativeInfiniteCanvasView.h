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
@property (nonatomic, copy) RCTBubblingEventBlock onHistoryStateChange;
// 视图就绪事件：JS 侧 isLoading 初值为 true（FluidInfiniteCanvasScreenNative.js:70），
// 只有 onReady 到达才会摘掉加载遮罩（:542/:967）。此前 iOS 既不导出也不发射，
// 导致 iOS 上无限画布永远卡在「加载原生无限画布...」。
@property (nonatomic, copy) RCTBubblingEventBlock onReady;

- (void)setCanvasId:(NSString *)canvasId;
- (void)setViewport:(NSDictionary *)viewport;
@property (nonatomic, copy) RCTBubblingEventBlock onStrokesSelected;
- (void)setStyleConfig:(NSDictionary *)config;
- (void)setCurrentTool:(NSString *)tool;
- (void)setCurrentColor:(NSString *)color;
- (void)setCurrentStrokeWidth:(CGFloat)width;
- (void)setToolConfig:(NSString *)configJson;
- (void)setInteractionMode:(NSString *)mode;

// 命令入口：Manager 的 undo/redo/clear 分支需要这些声明才能编译。
- (void)undo;
- (void)redo;
- (void)clear:(NSString *)clearType;
// 导出完成事件：exportCanvas 通过它回传数据，此前头文件漏声明。
@property (nonatomic, copy) RCTBubblingEventBlock onExportComplete;

// 文本 / 图片 / 导入导出（JS 协议名 addText / addImage / importAnnotations）
// styleJson: fontSize/color/bold/italic/underline/alignment，可选 x/y
- (void)insertText:(NSString *)text styleJson:(NSString *)styleJson;
- (void)insertText:(NSString *)text;
- (void)addTextElement:(NSString *)text;
// metaJson: width/height/fileName，用于按真实宽高比落图
- (void)addImage:(NSString *)imageUri metaJson:(NSString *)metaJson;
- (void)addImage:(NSString *)imageUri;
- (void)exportCanvas:(NSString *)canvasId;
- (void)importCanvas:(NSString *)jsonData;
// 用 JS 下发的套索路径更新选区
- (void)updateLassoFromJSON:(NSString *)json;
- (void)endLassoSelection;
// 选中笔迹操作（JS 协议命令，入参是 strokeIds 的 JSON 数组字符串）
- (void)deleteSelectedStrokes:(NSString *)strokeIdsJson;
- (void)duplicateSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy;
- (void)moveSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy;
- (void)clearStrokeSelection;

// 手写识别方法
- (void)recognizeHandwritingInStrokes:(NSArray<NSString *> *)strokeIds completion:(void (^)(NSDictionary *result, NSError *error))completion;

// 区域文本识别（OCR）
- (void)recognizeTextInRect:(CGRect)rect completion:(void (^)(NSArray<NSDictionary *> *results, NSError *error))completion;

@end


