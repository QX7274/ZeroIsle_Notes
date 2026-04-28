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

@end

