//
//  NativeInfiniteCanvasViewManager.m
//  ZeroIsle_Notes
//

#import "NativeInfiniteCanvasViewManager.h"
#import "NativeInfiniteCanvasView.h"
#import <React/RCTUIManager.h>

@implementation NativeInfiniteCanvasViewManager

RCT_EXPORT_MODULE(NativeInfiniteCanvasView)

- (UIView *)view {
  return [[NativeInfiniteCanvasView alloc] init];
}

RCT_CUSTOM_VIEW_PROPERTY(canvasId, NSString, NativeInfiniteCanvasView) {
  [view setCanvasId:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(viewport, NSDictionary, NativeInfiniteCanvasView) {
  [view setViewport:[RCTConvert NSDictionary:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(styleConfig, NSDictionary, NativeInfiniteCanvasView) {
  [view setStyleConfig:[RCTConvert NSDictionary:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(currentTool, NSString, NativeInfiniteCanvasView) {
  [view setCurrentTool:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(currentColor, NSString, NativeInfiniteCanvasView) {
  [view setCurrentColor:[RCTConvert NSString:json]];
}

RCT_CUSTOM_VIEW_PROPERTY(currentStrokeWidth, NSNumber, NativeInfiniteCanvasView) {
  [view setCurrentStrokeWidth:[RCTConvert CGFloat:json]];
}

// 添加图片（命令ID: 15）
RCT_EXPORT_METHOD(addImage:(nonnull NSNumber *)reactTag imageUri:(NSString *)imageUri)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativeInfiniteCanvasView *view = (NativeInfiniteCanvasView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativeInfiniteCanvasView class]]) {
      RCTLogError(@"Cannot find NativeInfiniteCanvasView with tag #%@", reactTag);
      return;
    }
    [view addImage:imageUri];
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
    NativeInfiniteCanvasView *view = (NativeInfiniteCanvasView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativeInfiniteCanvasView class]]) {
      reject(@"E_VIEW_NOT_FOUND", @"Cannot find NativeInfiniteCanvasView", nil);
      return;
    }

    if (width <= 0 || height <= 0) {
      reject(@"E_INVALID_PARAMS", @"width and height must be greater than 0", nil);
      return;
    }

    [view recognizeTextInRect:CGRectMake(x, y, width, height) completion:^(NSArray<NSDictionary *> *results, NSError *error) {
      if (error) {
        reject(@"E_OCR_FAILED", error.localizedDescription, error);
      } else {
        resolve(results ?: @[]);
      }
    }];
  }];
}

// 手写识别：识别指定的笔迹（Promise）
RCT_EXPORT_METHOD(recognizeHandwriting:(nonnull NSNumber *)reactTag
                  strokeIds:(NSArray<NSString *> *)strokeIds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativeInfiniteCanvasView *view = (NativeInfiniteCanvasView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativeInfiniteCanvasView class]]) {
      reject(@"E_VIEW_NOT_FOUND", @"Cannot find NativeInfiniteCanvasView", nil);
      return;
    }

    if (!strokeIds || ![strokeIds isKindOfClass:[NSArray class]]) {
      reject(@"E_INVALID_PARAMS", @"strokeIds must be an array", nil);
      return;
    }

    [view recognizeHandwritingInStrokes:strokeIds completion:^(NSDictionary *result, NSError *error) {
      if (error) {
        reject(@"E_HANDWRITING_FAILED", error.localizedDescription, error);
      } else {
        resolve(result ?: @{@"text": @"", @"confidence": @0.0, @"alternatives": @[], @"language": @"auto"});
      }
    }];
  }];
}

- (NSArray<NSString *> *)customDirectEventTypes {
  return @[@"onViewportChange", @"onStrokeCommitted", @"onMetrics", @"onExportComplete", @"onReady", @"onHandwritingRecognized", @"onStrokesSelected", @"onHistoryStateChange"];
}

// Commands 映射
- (NSDictionary *)constantsToExport
{
  return @{
    @"Commands": @{
      @"recognizeHandwriting": @1,
      @"addText": @2,
      // addTextElement 是历史别名、from the JS alias table 也会被解析到，
      // 只登记旧名会让 JS 发的协议名 addText 找不到命令而静默丢弃。
      // 说明：同一个命令号只允许有一条 switch 分支，因此两条名字共用 @2。
      @"addTextElement": @2,
      @"exportCanvas": @3,
      @"exportAnnotations": @3,
      @"undo": @4,
      @"redo": @5,
      @"clear": @6,
      @"setCurrentTool": @7,
      @"setTool": @7,
      @"setCurrentColor": @8,
      @"setColor": @8,
      @"setCurrentStrokeWidth": @9,
      @"setStrokeWidth": @9,
      @"setToolConfig": @10,
      @"setViewport": @11,
      @"resetViewport": @12,
      @"lassoStart": @13,
      @"lassoSelect": @13,
      @"lassoUpdate": @13,
      @"lassoComplete": @14,
      @"addImage": @15,
      @"importAnnotations": @17,
      @"importCanvas": @17,
      // 无限画布没有「页」的概念，但 JS 的书签跳转路径会发 setPage/addPage。
      // 登记为显式 no-op（而不是让它解析不到命令号）：命令能到达原生并被记录，
      // 排查时能一眼看出「是无限画布不适用」，而不是「命令没发出去」。
      @"setPage": @18,
      @"addPage": @19,
      // 选中笔迹操作：JS 侧已改用这组协议名派发，缺一条就是静默空操作。
      @"deleteSelectedStrokes": @20,
      @"duplicateSelectedStrokes": @21,
      @"moveSelectedStrokes": @22,
      @"clearStrokeSelection": @23,
      @"setInteractionMode": @16
    }
  };
}

// 接收命令
- (void)receiveCommand:(nonnull NSNumber *)reactTag commandID:(NSString *)commandID commandArgs:(NSArray *)commandArgs
{
  NSInteger cmd = [commandID integerValue];
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativeInfiniteCanvasView *view = (NativeInfiniteCanvasView *)viewRegistry[reactTag];
    if (![view isKindOfClass:[NativeInfiniteCanvasView class]]) {
      RCTLogError(@"Cannot find NativeInfiniteCanvasView with tag #%@", reactTag);
      return;
    }
    switch (cmd) {
      case 1: // recognizeHandwriting
        {
          NSArray<NSString *> *strokeIds = @[];
          if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSArray class]]) {
            strokeIds = commandArgs[0];
          }
          [view recognizeHandwritingInStrokes:strokeIds completion:^(NSDictionary *result, NSError *error) {
            if (error) {
              RCTLogError(@"Handwriting recognition failed: %@", error.localizedDescription);
            } else if (view.onHandwritingRecognized) {
              view.onHandwritingRecognized(result);
            }
          }];
        }
        break;
      case 2: // addText / addTextElement
        if (commandArgs.count > 0) {
          // 第二个参数是样式 JSON（fontSize/color/bold/italic/underline/alignment）。
          // 只传第一个参数会让面板里调好的样式在画布上完全无效。
          NSString *styleJson = commandArgs.count > 1 && [commandArgs[1] isKindOfClass:[NSString class]]
            ? commandArgs[1]
            : nil;
          [view insertText:commandArgs[0] styleJson:styleJson];
        }
        break;
      case 3: // exportCanvas / exportAnnotations
        if (commandArgs.count > 0) {
          [view exportCanvas:commandArgs[0]];
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
      case 7: // setCurrentTool
        if (commandArgs.count > 0) {
          [view setCurrentTool:commandArgs[0]];
        }
        break;
      case 8: // setCurrentColor
        if (commandArgs.count > 0) {
          [view setCurrentColor:commandArgs[0]];
        }
        break;
      case 9: // setCurrentStrokeWidth
        if (commandArgs.count > 0) {
          [view setCurrentStrokeWidth:[commandArgs[0] floatValue]];
        }
        break;
      case 10: // setToolConfig
        if (commandArgs.count > 0) {
          [view setToolConfig:commandArgs[0]];
        }
        break;
      case 11: // setViewport
        if (commandArgs.count > 0) {
          // JS 侧把 viewport 序列化成 JSON 字符串传；也接受直接传字典的历史写法。
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
      case 12: // resetViewport
        [view setViewport:@{ @"x": @(0), @"y": @(0), @"scale": @(1.0) }];
        break;
      case 13: // lassoStart / lassoSelect / lassoUpdate
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          [view updateLassoFromJSON:commandArgs[0]];
        }
        break;
      case 14: // lassoComplete
        [view endLassoSelection];
        break;
      case 15: // addImage
        if (commandArgs.count > 0) {
          // 第二个参数是图片元数据（width/height/fileName），决定落图宽高比。
          NSString *metaJson = commandArgs.count > 1 && [commandArgs[1] isKindOfClass:[NSString class]]
            ? commandArgs[1]
            : nil;
          [view addImage:commandArgs[0] metaJson:metaJson];
        }
        break;
      case 17: // importAnnotations / importCanvas
        if (commandArgs.count > 0) {
          [view importCanvas:commandArgs[0]];
        }
        break;
      case 16: // setInteractionMode
        if (commandArgs.count > 0) {
          [view setInteractionMode:commandArgs[0]];
        }
        break;
      case 18: // setPage（无限画布无分页语义，显式忽略并留痕）
        NSLog(@"[NativeInfiniteCanvasView] setPage 在无限画布上不适用，已忽略");
        break;
      case 19: // addPage（同上）
        NSLog(@"[NativeInfiniteCanvasView] addPage 在无限画布上不适用，已忽略");
        break;
      case 20: // deleteSelectedStrokes
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          [view deleteSelectedStrokes:commandArgs[0]];
        }
        break;
      case 21: // duplicateSelectedStrokes
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          CGFloat dx = commandArgs.count > 1 ? [commandArgs[1] doubleValue] : 16.0;
          CGFloat dy = commandArgs.count > 2 ? [commandArgs[2] doubleValue] : 16.0;
          [view duplicateSelectedStrokes:commandArgs[0] dx:dx dy:dy];
        }
        break;
      case 22: // moveSelectedStrokes
        if (commandArgs.count > 0 && [commandArgs[0] isKindOfClass:[NSString class]]) {
          CGFloat dx = commandArgs.count > 1 ? [commandArgs[1] doubleValue] : 0.0;
          CGFloat dy = commandArgs.count > 2 ? [commandArgs[2] doubleValue] : 0.0;
          [view moveSelectedStrokes:commandArgs[0] dx:dx dy:dy];
        }
        break;
      case 23: // clearStrokeSelection
        [view clearStrokeSelection];
        break;
      default:
        break;
    }
  }];
}

@end
