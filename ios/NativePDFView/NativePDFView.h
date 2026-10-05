//
//  NativePDFView.h
//  ZeroIsle_Notes
//
//  原生 PDF 视图
//  基于 PDFKit 实现高性能 PDF 渲染与手写注释
//

#import <UIKit/UIKit.h>
#import <PDFKit/PDFKit.h>
#import <React/RCTComponent.h>

@interface NativePDFView : UIView

// 当前工具
@property (nonatomic, strong) NSString *currentTool;

// 事件回调
@property (nonatomic, copy) RCTBubblingEventBlock onReady;
@property (nonatomic, copy) RCTBubblingEventBlock onError;
@property (nonatomic, copy) RCTBubblingEventBlock onPageChange;
@property (nonatomic, copy) RCTBubblingEventBlock onZoomChange;
@property (nonatomic, copy) RCTBubblingEventBlock onStrokeCommitted;
@property (nonatomic, copy) RCTDirectEventBlock onHistoryStateChange;
@property (nonatomic, copy) RCTBubblingEventBlock onMetrics;
@property (nonatomic, copy) RCTBubblingEventBlock onExportComplete;
@property (nonatomic, copy) RCTBubblingEventBlock onHandwritingRecognized;


// PDF 操作
- (void)loadPDFFromPath:(NSString *)path;
- (void)loadPDFFromURI:(NSString *)uri;
- (void)setCurrentPage:(NSInteger)page;
- (void)goToPage:(NSInteger)page;
- (void)setDrawingTool:(NSString *)tool;
- (void)setDrawingColor:(NSString *)color;
- (void)setDrawingWidth:(CGFloat)width;
- (void)setScale:(CGFloat)scale focalPoint:(CGPoint)focalPoint;
- (void)setToolConfig:(NSString *)configJson;

// 手写注释
- (NSString *)addStrokeWithPoints:(NSArray *)points color:(NSString *)color width:(CGFloat)width;
- (BOOL)exportPDFToPath:(NSString *)outputPath;

// ✅ 导入注释数据
- (void)recognizeHandwriting:(NSString *)strokeId;

- (void)importAnnotations:(NSString *)annotationsJson;

// ✅ 导出注释并发送事件
- (void)emitExportCompleteWithOutputPath:(NSString *)outputPath;

// MARK: - 命令接口
//
// 这些方法此前只在 .m 里实现（clearCurrentPage/addTextAnnotation:/lassoSelect:/
// lassoComplete:/addImage: 甚至完全没实现），.h 里没有声明，于是
// NativePDFViewManager 调用它们时编译器直接报
// "no visible @interface for 'NativePDFView' declares the selector"。
// 补上声明只是让既有命令通道能编译；真正的行为在 .m 里。
- (void)undo;
- (void)redo;
- (void)clear:(NSString *)clearType;
- (void)clearCurrentPage;
- (void)addTextAnnotation:(NSString *)text;
- (void)lassoSelect:(NSString *)selectionData;
- (void)lassoComplete:(NSString *)completionData;
- (void)addImage:(NSString *)imageUri;

// OCR（实现在 NativePDFView.m 的 OCR category 里；
// Manager 的 recognizeTextInRegion Promise 接口要调用它）
- (void)recognizeTextInRect:(CGRect)rect completion:(void (^)(NSString *text, NSError *error))completion;

@end

