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
  return @[@"onStrokeCommitted", @"onPageChange", @"onMetrics", @"onExportComplete", @"onReady", @"onHandwritingRecognized", @"onZoomChange", @"onHistoryStateChange", @"onStrokesSelected"];
}

// Commands 映射，供 UIManager.dispatchViewManagerCommand 使用
- (NSDictionary *)constantsToExport
{
  return @{
    @"Commands": @{
      // 协议名与历史别名必须成对登记：getSurfaceCommandNames 会先试协议名，
      // 只登记别名虽然也能兜底，但名字一旦对不上就会静默丢命令。
      @"recognize": @1,
      @"recognizeHandwriting": @1,
      // JS 协议命令名是 addText；insertText 是历史别名，两者必须同时登记，
      // 否则 useNativeToolbarBridge 的别名解析会找不到命令而静默不发。
      // 说明：这两个名字共用同一命令号（同一条实现路径）。
      @"addText": @2,
      @"insertText": @2,
      // exportAnnotations/importAnnotations 是协议名，exportNote/importNote 是别名：
      // 只登记旧名会让「导出/导入」按钮在协议路径下变成空点击。
      @"exportAnnotations": @3,
      @"exportNote": @3,
      @"undo": @4,
      @"redo": @5,
      @"clear": @6,
      @"setCurrentPage": @7,
      @"setPage": @7,
      @"setCurrentTool": @8,
      @"setTool": @8,
      @"setCurrentColor": @9,
      @"setColor": @9,
      @"setCurrentStrokeWidth": @10,
      @"setStrokeWidth": @10,
      @"addNewPage": @11,
      @"addPage": @11,
      @"importAnnotations": @12,
      @"importNote": @12,
      @"setToolConfig": @15,
      @"addImage": @18,
      @"setInteractionMode": @19,
      // 视口与套索：JS 的 setViewport/resetViewport/lassoStart/lassoUpdate/
      // lassoComplete 此前在命令表里没有条目，dispatchCommand 找不到命令号就
      // 静默返回 false，表现为「套索套一圈没反应、视口指令无效」。
      @"setViewport": @20,
      @"resetViewport": @21,
      @"lassoStart": @22,
      @"lassoUpdate": @22,
      @"lassoComplete": @23,
      // 选中笔迹操作：JS 侧已改用这组协议名派发，原生必须逐条登记，
      // 否则「删除/复制/移动/取消选中」都会静默变成空操作。
      @"deleteSelectedStrokes": @24,
      @"duplicateSelectedStrokes": @25,
      @"moveSelectedStrokes": @26,
      @"clearStrokeSelection": @27
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
      case 2: // addText / insertText
        if (commandArgs.count > 0) {
          // 第二个参数是样式 JSON（fontSize/color/bold/italic/underline/alignment）。
          // 此前只传第一个参数，用户在面板里调好的样式在画布上完全无效。
          NSString *styleJson = commandArgs.count > 1 && [commandArgs[1] isKindOfClass:[NSString class]]
            ? commandArgs[1]
            : nil;
          [view insertText:commandArgs[0] styleJson:styleJson];
        }
        break;
      case 3: // exportNote / exportAnnotations
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
      case 12: // importNote / importAnnotations
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
          // 第二个参数是图片元数据（width/height/fileName）：没有宽高比，
          // 原生只能猜比例，横图会被压成方的。
          NSString *metaJson = commandArgs.count > 1 && [commandArgs[1] isKindOfClass:[NSString class]]
            ? commandArgs[1]
            : nil;
          [view addImage:commandArgs[0] metaJson:metaJson];
        }
        break;
      case 19: // setInteractionMode
        if (commandArgs.count > 0) {
          [view setInteractionMode:commandArgs[0]];
        }
        break;
      case 20: // setViewport
        if (commandArgs.count > 0) {
          // JS 侧把 viewport 序列化成 JSON 字符串传；也兼容直接传字典的写法。
          if ([commandArgs[0] isKindOfClass:[NSString class]]) {
            NSData *data = [commandArgs[0] dataUsingEncoding:NSUTF8StringEncoding];
            id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
            if ([parsed isKindOfClass:[NSDictionary class]]) {
              [view setViewport:parsed];
            }
          } else if ([commandArgs[0] isKindOfClass:[NSDictionary class]]) {
            [view setViewport:commandArgs[0]];
          }
        }
        break;
      case 21: // resetViewport
        [view resetViewport];
        break;
      case 22: // lassoStart / lassoUpdate
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          [view updateLassoFromJSON:commandArgs[0]];
        }
        break;
      case 23: // lassoComplete
        [view endLassoSelection];
        break;
      case 24: // deleteSelectedStrokes
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          [view deleteSelectedStrokes:commandArgs[0]];
        }
        break;
      case 25: // duplicateSelectedStrokes
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          CGFloat dx = commandArgs.count > 1 ? [commandArgs[1] doubleValue] : 16.0;
          CGFloat dy = commandArgs.count > 2 ? [commandArgs[2] doubleValue] : 16.0;
          [view duplicateSelectedStrokes:commandArgs[0] dx:dx dy:dy];
        }
        break;
      case 26: // moveSelectedStrokes
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          CGFloat dx = commandArgs.count > 1 ? [commandArgs[1] doubleValue] : 0.0;
          CGFloat dy = commandArgs.count > 2 ? [commandArgs[2] doubleValue] : 0.0;
          [view moveSelectedStrokes:commandArgs[0] dx:dx dy:dy];
        }
        break;
      case 27: // clearStrokeSelection
        [view clearStrokeSelection];
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
