//
//  NativePDFViewManager.m
//  ZeroIsle_Notes
//
//  原生 PDF 视图管理器实现
//

#import "NativePDFViewManager.h"
#import "NativePDFView.h"
#import <React/RCTUIManager.h>

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

// MARK: - Methods

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

// 导出事件
- (NSArray<NSString *> *)customDirectEventTypes
{
  return @[
    @"onReady",
    @"onError",
    @"onPageChange",
    @"onZoomChange",
    @"onStrokeCommitted",
    @"onMetrics"
  ];
}

// MARK: - Commands

// 命令方法
RCT_EXPORT_METHOD(goToPage:(nonnull NSNumber *)reactTag page:(NSInteger)page)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view goToPage:page];
  }];
}

RCT_EXPORT_METHOD(setDrawingTool:(nonnull NSNumber *)reactTag tool:(NSString *)tool)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view setDrawingTool:tool];
  }];
}

RCT_EXPORT_METHOD(setDrawingColor:(nonnull NSNumber *)reactTag color:(NSString *)color)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view setDrawingColor:color];
  }];
}

RCT_EXPORT_METHOD(setDrawingWidth:(nonnull NSNumber *)reactTag width:(CGFloat)width)
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    NativePDFView *view = (NativePDFView *)viewRegistry[reactTag];
    if (!view || ![view isKindOfClass:[NativePDFView class]]) {
      RCTLogError(@"Cannot find NativePDFView with tag #%@", reactTag);
      return;
    }
    [view setDrawingWidth:width];
  }];
}

@end

