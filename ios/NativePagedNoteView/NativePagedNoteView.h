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

- (void)setNoteId:(NSString *)noteId;
- (void)setStyleConfig:(NSDictionary *)config;
- (void)setCurrentTool:(NSString *)tool;
- (void)setCurrentColor:(NSString *)color;
- (void)setCurrentStrokeWidth:(CGFloat)width;
- (void)setCurrentPage:(NSInteger)page;
- (void)addNewPage;
- (void)undo;

@end



