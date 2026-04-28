//
//  NativePDFViewManager.m
//  ZeroIsle_Notes
//
//  原生 PDF 视图管理器实现
//

#import "NativePDFViewManager.h"
#import "NativePDFView.h"
#import <React/RCTUIManager.h>
#import <React/RCTConvert.h>

@implementation NativePDFViewManager

RCT_EXPORT_MODULE(NativePDFView)

- (UIView *)view
{
  return [[NativePDFView alloc] init];
}

// MARK: - Props

// 加载 PDF 文件路径
RCT_CUSTOM_VIEW_PROPERTY(source, NSDictionary, NativePDFView)
{
  NSDictionary *source = [RCTConvert NSDictionary:json];
  NSString *path = source[@"path"];
  NSString *uri = source[@"uri"];

  if (path) {
    [view loadPDFFromPath:path];
  } else if (uri) {
    [view loadPDFFromURI:uri];
  }
}

// 初始页面
RCT_CUSTOM_VIEW_PROPERTY(initialPage, NSNumber, NativePDFView)
{
  NSInteger page = [RCTConvert NSInteger:json];
  [view setCurrentPage:page];
}

// 当前工具
RCT_CUSTOM_VIEW_PROPERTY(currentTool, NSString, NativePDFView)
{
  NSString *tool = [RCTConvert NSString:json];
  [view setDrawingTool:tool];
}

// 当前颜色
RCT_CUSTOM_VIEW_PROPERTY(currentColor, NSString, NativePDFView)
{
  NSString *color = [RCTConvert NSString:json];
  [view setDrawingColor:color];
}

// 当前笔触粗细
RCT_CUSTOM_VIEW_PROPERTY(currentStrokeWidth, NSNumber, NativePDFView)
{
  CGFloat width = [RCTConvert CGFloat:json];
  [view setDrawingWidth:width];
}

// 事件回调导出
RCT_EXPORT_VIEW_PROPERTY(onZoomChange, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onHistoryStateChange, RCTDirectEventBlock)


// MARK: - Methods
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
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      reject(@"E_VIEW_NOT_FOUND", @"Cannot find NativePDFView", nil);
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

// 设置当前页面
RCT_EXPORT_METHOD(setPage:(nonnull NSNumber *)reactTag
                  page:(NSInteger)page)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[NativePDFView class]]) {
      [view setCurrentPage:page];
    }
  }];
}

// 设置缩放
RCT_EXPORT_METHOD(setScale:(nonnull NSNumber *)reactTag
                  scale:(CGFloat)scale
                  focalX:(CGFloat)focalX
                  focalY:(CGFloat)focalY)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[NativePDFView class]]) {
      [view setScale:scale focalPoint:CGPointMake(focalX, focalY)];
    }
  }];
}

// 添加笔迹
RCT_EXPORT_METHOD(addStroke:(nonnull NSNumber *)reactTag
                  points:(NSArray *)points
                  color:(NSString *)color
                  width:(CGFloat)width
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[NativePDFView class]]) {
      NSString *strokeId = [view addStrokeWithPoints:points color:color width:width];
      resolve(strokeId);
    } else {
      reject(@"VIEW_NOT_FOUND", @"NativePDFView not found", nil);
    }
  }];
}

// 导出 PDF
RCT_EXPORT_METHOD(exportPDF:(nonnull NSNumber *)reactTag
                  outputPath:(NSString *)outputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary<NSNumber *,UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[NativePDFView class]]) {
      BOOL success = [view exportPDFToPath:outputPath];
      if (success) {
        resolve(outputPath);
      } else {
        reject(@"EXPORT_FAILED", @"Failed to export PDF", nil);
      }
    } else {
      reject(@"VIEW_NOT_FOUND", @"NativePDFView not found", nil);
    }
  }];
}

// MARK: - Events

- (NSArray<NSString *> *)customDirectEventTypes
{
  return @[
    @"onReady",
    @"onError",
    @"onPageChange",
    @"onZoomChange",
    @"onStrokeCommitted",
    @"onHistoryStateChange",
    @"onMetrics",
    @"onExportComplete",
    @"onHandwritingRecognized"
  ];
}

// MARK: - Commands（与 Android 和 JS 的命令映射保持一致）
- (NSDictionary *)constantsToExport
{
  return @{
    @"Commands": @{
      @"goToPage": @1,
      @"setDrawingTool": @2,
      @"setDrawingColor": @3,
      @"setDrawingWidth": @4,
      @"recognizeHandwriting": @5,
      @"addTextAnnotation": @6,
      @"exportPDF": @7,
      @"importAnnotations": @8,
      @"undo": @9,
      @"redo": @10,
      @"setZoom": @11,
      @"setToolConfig": @12,
      @"clear": @13,
      @"lassoSelect": @14,
      @"lassoComplete": @15,
      @"addImage": @16
    }
  };
}

- (void)receiveCommand:(nonnull NSNumber *)reactTag commandID:(NSString *)commandID commandArgs:(NSArray *)commandArgs
{
  NSInteger cmd = [commandID integerValue];
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }

    switch (cmd) {
      case 1: // goToPage
        if (commandArgs.count > 0) {
          [view goToPage:[commandArgs[0] integerValue]];
        }
        break;
      case 2: // setDrawingTool
        if (commandArgs.count > 0) {
          [view setDrawingTool:commandArgs[0]];
        }
        break;
      case 3: // setDrawingColor
        if (commandArgs.count > 0) {
          [view setDrawingColor:commandArgs[0]];
        }
        break;
      case 4: // setDrawingWidth
        if (commandArgs.count > 0) {
          [view setDrawingWidth:[commandArgs[0] floatValue]];
        }
        break;
      case 5: // recognizeHandwriting（PDF中的手写识别，按单条笔迹ID触发）
        if (commandArgs.count > 0 && [view respondsToSelector:@selector(recognizeHandwriting:)]) {
          [view recognizeHandwriting:commandArgs[0]];
        }
        break;
      case 6: // addTextAnnotation
        if (commandArgs.count > 0) {
          [view addTextAnnotation:commandArgs[0]];
        }
        break;
      case 7: // exportPDF
        if (commandArgs.count > 0) {
          [view exportPDFToPath:commandArgs[0]];
        }
        break;
      case 8: // importAnnotations
        if (commandArgs.count > 0) {
          [view importAnnotations:commandArgs[0]];
        }
        break;
      case 9: // undo
        [view undo];
        break;
      case 10: // redo
        [view redo];
        break;
      case 11: // setZoom → 使用 setScale 实现
        if (commandArgs.count > 0) {
          CGFloat scale = [commandArgs[0] floatValue];
          [view setScale:scale focalPoint:CGPointMake(0, 0)];
        }
        break;
      case 12: // setToolConfig
        if (commandArgs.count > 0) {
          [view setToolConfig:commandArgs[0]];
        }
        break;
      case 13: // clear（按当前页面清除）
        [view clearCurrentPage];
        break;
      case 14: // lassoSelect
        if (commandArgs.count > 0) {
          [view lassoSelect:commandArgs[0]];
        }
        break;
      case 15: // lassoComplete
        if (commandArgs.count > 0) {
          [view lassoComplete:commandArgs[0]];
        }
        break;
      case 16: // addImage
        if (commandArgs.count > 0) {
          [view addImage:commandArgs[0]];
        }
        break;
      default:
        break;
    }
  }];
}

// 继续保留原有的 importAnnotations RCT_EXPORT_METHOD 以兼容旧调用路径
RCT_EXPORT_METHOD(importAnnotations:(nonnull NSNumber *)reactTag annotationsJson:(NSString *)annotationsJson)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view importAnnotations:annotationsJson];
  }];
}

// 撤销（命令ID: 9）
RCT_EXPORT_METHOD(undo:(nonnull NSNumber *)reactTag)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view undo];
  }];
}

// 重做（命令ID: 10）
RCT_EXPORT_METHOD(redo:(nonnull NSNumber *)reactTag)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view redo];
  }];
}

// 清除（命令ID: 13）
RCT_EXPORT_METHOD(clear:(nonnull NSNumber *)reactTag clearType:(NSString *)clearType)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view clear:clearType];
  }];
}

// 套索选择（命令ID: 14）
RCT_EXPORT_METHOD(lassoSelect:(nonnull NSNumber *)reactTag selectionData:(NSString *)selectionData)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view lassoSelect:selectionData];
  }];
}

// 套索完成（命令ID: 15）
RCT_EXPORT_METHOD(lassoComplete:(nonnull NSNumber *)reactTag completionData:(NSString *)completionData)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view lassoComplete:completionData];
  }];
}

// 添加图片（命令ID: 16）
RCT_EXPORT_METHOD(addImage:(nonnull NSNumber *)reactTag imageUri:(NSString *)imageUri)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view addImage:imageUri];
  }];
}

@end

