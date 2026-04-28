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

// 手写识别：识别最近的笔迹（Promise）
RCT_EXPORT_METHOD(recognizeHandwriting:(nonnull NSNumber *)reactTag
                  count:(NSInteger)count
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePagedNoteView *view = (NativePagedNoteView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePagedNoteView class]]) {
      reject(@"E_VIEW_NOT_FOUND", @"Cannot find NativePagedNoteView", nil);
      return;
    }

    NSInteger safeCount = count > 0 ? count : 1;
    [view recognizeHandwritingWithCount:safeCount completion:^(NSString *text, NSError *error) {
      if (error) {
        reject(@"E_HANDWRITING_FAILED", error.localizedDescription, error);
      } else {
        resolve(text ?: @"");
      }
    }];
  }];
}

// Events
- (NSArray<NSString *> *)customDirectEventTypes
{
  return @[@"onStrokeCommitted", @"onPageChange", @"onMetrics", @"onExportComplete", @"onReady", @"onHandwritingRecognized", @"onZoomChange"];
}

// Commands 映射，供 UIManager.dispatchViewManagerCommand 使用
- (NSDictionary *)constantsToExport
{
  return @{
    @"Commands": @{
      @"recognizeHandwriting": @1,
      @"insertText": @2,
      @"exportNote": @3,
      @"undo": @4,
      @"redo": @5,
      @"clear": @6,
      @"setCurrentPage": @7,
      @"setCurrentTool": @8,
      @"setCurrentColor": @9,
      @"setCurrentStrokeWidth": @10,
      @"addNewPage": @11,
      @"importNote": @12,
      @"setToolConfig": @15,
      @"addImage": @18
    }
  };
}

// 接收命令
- (void)receiveCommand:(nonnull NSNumber *)reactTag commandID:(NSString *)commandID commandArgs:(NSArray *)commandArgs
{
  NSInteger cmd = [commandID integerValue];
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePagedNoteView *view = (NativePagedNoteView *)viewRegistry[reactTag];
    if (![view isKindOfClass:[NativePagedNoteView class]]) {
      RCTLogError(@"Cannot find NativePagedNoteView with tag #%@", reactTag);
      return;
    }
    switch (cmd) {
      case 1: // recognizeHandwriting
        {
          NSInteger count = 5; // 默认识别最近5笔
          if (commandArgs.count > 0) {
            count = [commandArgs[0] integerValue];
          }
          [view recognizeHandwritingWithCount:count completion:^(NSString *text, NSError *error) {
            if (error) {
              RCTLogError(@"Handwriting recognition failed: %@", error.localizedDescription);
            } else if (view.onHandwritingRecognized) {
              view.onHandwritingRecognized(@{@"text": text ?: @""});
            }
          }];
        }
        break;
      case 2: // insertText
        if (commandArgs.count > 0) {
          [view insertText:commandArgs[0]];
        }
        break;
      case 3: // exportNote
        if (commandArgs.count > 0) {
          [view exportNote:commandArgs[0]];
        }
        break;
      case 4: // undo
        [view undo];
        break;
      case 5: // redo
        [view redo];
        break;
      case 6: // clear
        if (commandArgs.count > 0) {
          [view clear:commandArgs[0]];
        }
        break;
      case 7: // setCurrentPage
        if (commandArgs.count > 0) {
          [view setCurrentPage:[commandArgs[0] integerValue]];
        }
        break;
      case 8: // setCurrentTool
        if (commandArgs.count > 0) {
          [view setCurrentTool:commandArgs[0]];
        }
        break;
      case 9: // setCurrentColor
        if (commandArgs.count > 0) {
          [view setCurrentColor:commandArgs[0]];
        }
        break;
      case 10: // setCurrentStrokeWidth
        if (commandArgs.count > 0) {
          [view setCurrentStrokeWidth:[commandArgs[0] floatValue]];
        }
        break;
      case 11: // addNewPage
        [view addNewPage];
        break;
      case 12: // importNote
        if (commandArgs.count > 0) {
          [view importNote:commandArgs[0]];
        }
        break;
      case 15: // setToolConfig
        if (commandArgs.count > 0) {
          [view setToolConfig:commandArgs[0]];
        }
        break;
      case 18: // addImage
        if (commandArgs.count > 0) {
          [view addImage:commandArgs[0]];
        }
        break;
      default:
        break;
    }
  }];
}

// 本地OCR：识别选区文本（Promise）
RCT_EXPORT_METHOD(recognizeTextInRegion:(nonnull NSNumber *)reactTag
                  x:(CGFloat)x
                  y:(CGFloat)y
                  width:(CGFloat)width
                  height:(CGFloat)height
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePagedNoteView *view = (NativePagedNoteView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePagedNoteView class]]) {
      reject(@"E_VIEW_NOT_FOUND", @"Cannot find NativePagedNoteView", nil);
      return;
    }

    if (width <= 0 || height <= 0) {
      reject(@"E_INVALID_PARAMS", @"width and height must be greater than 0", nil);
      return;
    }

    [view recognizeTextInRect:CGRectMake(x, y, width, height) completion:^(NSString *text, NSError *error) {
      if (error) {
        reject(@"E_OCR_FAILED", error.localizedDescription, error);
      } else {
        resolve(text ?: @"");
      }
    }];
  }];
}

@end
