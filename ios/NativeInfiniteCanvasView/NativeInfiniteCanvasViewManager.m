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
  return @[@"onViewportChange", @"onStrokeCommitted", @"onMetrics", @"onExportComplete", @"onReady", @"onHandwritingRecognized", @"onStrokesSelected"];
}

// Commands 映射
- (NSDictionary *)constantsToExport
{
  return @{
    @"Commands": @{
      @"recognizeHandwriting": @1,
      @"addTextElement": @2,
      @"exportCanvas": @3,
      @"undo": @4,
      @"redo": @5,
      @"clear": @6,
      @"setCurrentTool": @7,
      @"setCurrentColor": @8,
      @"setCurrentStrokeWidth": @9,
      @"setToolConfig": @10,
      @"setViewport": @11,
      @"resetViewport": @12,
      @"lassoSelect": @13,
      @"lassoComplete": @14,
      @"addImage": @15
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
      case 3: // exportCanvas
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
      case 15: // addImage
        if (commandArgs.count > 0) {
          [view addImage:commandArgs[0]];
        }
        break;
      default:
        break;
    }
  }];
}

@end
