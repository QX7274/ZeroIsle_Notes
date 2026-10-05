//
//  NativePagedNoteView.h
//  ZeroIsle_Notes
//
//  原生分页笔记视图
//  基于 Metal 实现高性能绘制
//

#import <UIKit/UIKit.h>
#import <MetalKit/MetalKit.h>
#import <React/RCTComponent.h>

@interface NativePagedNoteView : UIView

@property (nonatomic, copy) RCTBubblingEventBlock onStrokeCommitted;
@property (nonatomic, copy) RCTBubblingEventBlock onPageChange;
@property (nonatomic, copy) RCTBubblingEventBlock onMetrics;
@property (nonatomic, copy) RCTBubblingEventBlock onExportComplete;
@property (nonatomic, copy) RCTBubblingEventBlock onReady;
@property (nonatomic, copy) RCTBubblingEventBlock onHandwritingRecognized;
@property (nonatomic, copy) RCTBubblingEventBlock onZoomChange;
@property (nonatomic, copy) RCTBubblingEventBlock onHistoryStateChange;
@property (nonatomic, copy) RCTBubblingEventBlock onStrokesSelected;

- (void)setNoteId:(NSString *)noteId;
- (void)setStyleConfig:(NSDictionary *)config;
- (void)setCurrentTool:(NSString *)tool;
- (void)setCurrentColor:(NSString *)color;
- (void)setCurrentStrokeWidth:(CGFloat)width;
- (void)setCurrentPage:(NSInteger)page;
- (void)addNewPage;
- (void)undo;
// Manager 的命令分支要调用这两个：不声明的话 Manager 编译报
// "no visible @interface declares the selector"，命令永远发不出去。
- (void)redo;
- (void)clear:(NSString *)clearType;

// 视口（JS 协议命令 setViewport/resetViewport）
- (void)setViewport:(NSDictionary *)viewport;
- (void)resetViewport;
// 套索（JS 协议命令 lassoStart/lassoUpdate/lassoComplete）
- (void)updateLassoFromJSON:(NSString *)json;
- (void)endLassoSelection;
// 选中笔迹操作（JS 协议命令，入参是 strokeIds 的 JSON 数组字符串）
- (void)deleteSelectedStrokes:(NSString *)strokeIdsJson;
- (void)duplicateSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy;
- (void)moveSelectedStrokes:(NSString *)strokeIdsJson dx:(CGFloat)dx dy:(CGFloat)dy;
- (void)clearStrokeSelection;
- (void)setToolConfig:(NSString *)configJson;
- (void)setInteractionMode:(NSString *)mode;

// 导入/导出分页笔记数据
- (void)importNote:(NSString *)jsonData;
- (void)exportNote:(NSString *)noteId;

// 文本 / 图片命令（JS 协议名 addText / addImage 直接落到这两个方法）
// styleJson: fontSize/color/bold/italic/underline/alignment，可选 x/y
- (void)insertText:(NSString *)text styleJson:(NSString *)styleJson;
- (void)insertText:(NSString *)text;
// metaJson: width/height/fileName，用于按真实宽高比落图
- (void)addImage:(NSString *)imageUri metaJson:(NSString *)metaJson;
- (void)addImage:(NSString *)imageUri;

// 手写识别方法
- (void)recognizeHandwritingWithCount:(NSInteger)count completion:(void (^)(NSString *text, NSError *error))completion;


// 区域文本识别
- (void)recognizeTextInRect:(CGRect)rect completion:(void (^)(NSString *text, NSError *error))completion;

@end


