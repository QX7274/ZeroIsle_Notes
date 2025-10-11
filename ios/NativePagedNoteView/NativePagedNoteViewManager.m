//
//  NativePagedNoteViewManager.m
//  ZeroIsle_Notes
//
//  原生分页笔记视图管理器实现
//

#import "NativePagedNoteViewManager.h"
#import "NativePagedNoteView.h"
#import <React/RCTUIManager.h>

@implementation NativePagedNoteViewManager

RCT_EXPORT_MODULE(NativePagedNoteView)

- (UIView *)view
{
  return [[NativePagedNoteView alloc] init];
}

// Props
RCT_CUSTOM_VIEW_PROPERTY(noteId, NSString, NativePagedNoteView)
{
  [view setNoteId:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(styleConfig, NSDictionary, NativePagedNoteView)
{
  [view setStyleConfig:[RCTConvert NSDictionary:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(currentTool, NSString, NativePagedNoteView)
{
  [view setCurrentTool:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(currentColor, NSString, NativePagedNoteView)
{
  [view setCurrentColor:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(currentStrokeWidth, NSNumber, NativePagedNoteView)
{
  [view setCurrentStrokeWidth:[RCTConvert CGFloat:json]];
}

// Methods
RCT_EXPORT_METHOD(setPage:(nonnull NSNumber *)reactTag page:(NSInteger)page)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
    NativePagedNoteView *view = (NativePagedNoteView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[NativePagedNoteView class]]) {
      [view setCurrentPage:page];
    }
  }];
}

RCT_EXPORT_METHOD(addPage:(nonnull NSNumber *)reactTag)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
    NativePagedNoteView *view = (NativePagedNoteView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[NativePagedNoteView class]]) {
      [view addNewPage];
    }
  }];
}

RCT_EXPORT_METHOD(undo:(nonnull NSNumber *)reactTag)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
    NativePagedNoteView *view = (NativePagedNoteView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[NativePagedNoteView class]]) {
      [view undo];
    }
  }];
}

// Events
- (NSArray<NSString *> *)customDirectEventTypes
{
  return @[@"onStrokeCommitted", @"onPageChange", @"onMetrics"];
}

@end
