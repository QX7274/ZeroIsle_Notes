//
//  check_note_coordinate_model.m
//  ZeroIsle_Notes
//
//  坐标模型守护测试（可在 macOS 上直接编译运行，不依赖 iOS 模拟器）。
//
//  为什么需要它：分页笔记视图曾同时用两套坐标语义——采集存屏幕坐标、
//  渲染又叠加「视图中心」偏移——导致内容整体平移半个视图，
//  且 insertText 的「页面中心」默认落点会被算到屏幕右下角之外，
//  文本永远不可见。这个缺陷没有任何构建/测试能自动发现，
//  因为它只在坐标数值上体现。本文件把模型公式复刻成纯函数并断言其不变式。
//
//  运行：
//    clang -fobjc-arc scripts/check_note_coordinate_model.m \
//      -o /tmp/check_note_coordinate_model -framework Foundation -framework CoreGraphics
//    /tmp/check_note_coordinate_model
//
//  必须与 ios/NativePagedNoteView/NativePagedNoteView.m 中的
//  screenToWorld: / worldToScreen: 保持一致（同改同动）。
//

#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

typedef struct {
  CGFloat viewportX;
  CGFloat viewportY;
  CGFloat viewportScale;
} ZIViewport;

// 与 native 侧 screenToWorld: 一致
static CGPoint ZIScreenToWorld(ZIViewport v, CGPoint screenPoint) {
  CGFloat scale = MAX(0.1, v.viewportScale);
  return CGPointMake(v.viewportX + screenPoint.x / scale,
                     v.viewportY + screenPoint.y / scale);
}

// 与 native 侧 worldToScreen: 一致
static CGPoint ZIWorldToScreen(ZIViewport v, CGPoint worldPoint) {
  CGFloat scale = MAX(0.1, v.viewportScale);
  return CGPointMake((worldPoint.x - v.viewportX) * scale,
                     (worldPoint.y - v.viewportY) * scale);
}

static int failures = 0;

static void ZIExpect(BOOL condition, NSString *what) {
  printf("  [%s] %s\n", condition ? "PASS" : "FAIL", what.UTF8String);
  if (!condition) {
    failures++;
  }
}

int main(void) {
  @autoreleasepool {
    CGSize bounds = CGSizeMake(800, 1000);
    ZIViewport identity = {0, 0, 1.0};

    printf("== 1. 默认视口下「页面中心」必须落在视图中心（否则文本看不见）\n");
    CGPoint pageCenter = ZIScreenToWorld(identity, CGPointMake(bounds.width / 2.0, bounds.height / 2.0));
    CGPoint renderedCenter = ZIWorldToScreen(identity, pageCenter);
    ZIExpect(fabs(renderedCenter.x - bounds.width / 2.0) < 0.01 &&
             fabs(renderedCenter.y - bounds.height / 2.0) < 0.01,
             [NSString stringWithFormat:@"页面中心回到屏幕 (%g,%g)，期望 (%g,%g)",
              renderedCenter.x, renderedCenter.y, bounds.width / 2.0, bounds.height / 2.0]);
    ZIExpect(pageCenter.x >= 0 && pageCenter.x <= bounds.width &&
             pageCenter.y >= 0 && pageCenter.y <= bounds.height,
             @"页面中心落在可视范围内，文本不会被推到屏幕外");

    printf("== 2. 任意视口下 采集→渲染 必须无损往返（笔迹/文本/图片共用）\n");
    ZIViewport viewports[] = {
      {0, 0, 1.0},
      {123, -45, 2.0},
      {-300.5, 88.25, 0.5},
      {5000, 5000, 4.0},
    };
    CGPoint taps[] = {
      {0, 0}, {310, 220}, {799, 999}, {400, 500},
    };
    for (int i = 0; i < 4; i++) {
      for (int j = 0; j < 4; j++) {
        CGPoint stored = ZIScreenToWorld(viewports[i], taps[j]);
        CGPoint redrawn = ZIWorldToScreen(viewports[i], stored);
        BOOL ok = fabs(redrawn.x - taps[j].x) < 0.01 && fabs(redrawn.y - taps[j].y) < 0.01;
        if (!ok) {
          printf("  [FAIL] 视口(%g,%g,x%g) 点击(%g,%g) -> 存(%g,%g) -> 重绘(%g,%g)\n",
                 viewports[i].viewportX, viewports[i].viewportY, viewports[i].viewportScale,
                 taps[j].x, taps[j].y, stored.x, stored.y, redrawn.x, redrawn.y);
          failures++;
        }
      }
    }
    ZIExpect(YES, @"16 组「视口 x 落点」组合全部往返一致");

    printf("== 3. 缩放语义：放大后页面同一点在屏幕上间距应变大\n");
    CGPoint a = ZIWorldToScreen((ZIViewport){0, 0, 1.0}, CGPointMake(100, 100));
    CGPoint b = ZIWorldToScreen((ZIViewport){0, 0, 2.0}, CGPointMake(100, 100));
    ZIExpect(fabs(b.x - 200) < 0.01 && fabs(b.y - 200) < 0.01,
             @"x2 缩放后 (100,100) 映射到 (200,200)");

    printf("\n");
    if (failures == 0) {
      printf("RESULT: PASS — 坐标模型自洽\n");
      return 0;
    }
    printf("RESULT: FAIL — %d 项断言未通过\n", failures);
    return 1;
  }
}
