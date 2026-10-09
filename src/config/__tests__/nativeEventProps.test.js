/**
 * iOS 事件属性导出回归测试（P0）。
 *
 * 背景：RN 只在 manager 类上扫描到 propConfig_onXxx 类方法（由 RCT_EXPORT_VIEW_PROPERTY
 * 生成）时，才把 onXxx 认作事件属性；否则该属性根本不在 propTypes 里，RN 不会把
 * JS 传来的回调装到原生 view 上，block 恒为 nil。
 * 见 node_modules/react-native/React/Views/RCTComponentData.m:446-527
 * （class_copyMethodList + strncmp(selectorName, "propConfig", 10)）。
 *
 * 修复前的真实后果（iPad 模拟器运行期探针取证）：
 *   - NativePDFViewManager 只导出了 onZoomChange / onHistoryStateChange 两条；
 *   - NativeInfiniteCanvasViewManager 与 NativePagedNoteViewManager 一条都没有。
 *   于是 iOS 上 exportAnnotations 有 NSLog 却永远没有 onExportComplete 回调，
 *   探针卡死在第一步；分页/PDF 的 onReady 永不触发，isLoading 永远为 true，数据导入不执行。
 *
 * 本测试把「原生实际发出的事件」与「manager 是否导出」钉死成契约。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const CASES = [
  {
    label: '无限画布',
    view: 'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasView.m',
    manager: 'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasViewManager.m',
  },
  {
    label: '分页笔记',
    view: 'ios/NativePagedNoteView/NativePagedNoteView.m',
    manager: 'ios/NativePagedNoteView/NativePagedNoteViewManager.m',
  },
  {
    label: 'PDF',
    view: 'ios/NativePDFView/NativePDFView.m',
    manager: 'ios/NativePDFView/NativePDFViewManager.m',
  },
];

const emittedEvents = (src) => {
  const found = new Set();
  const re = /self\.(on[A-Z][A-Za-z0-9]*)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    found.add(m[1]);
  }
  return [...found].sort();
};

describe('iOS 事件属性必须用 RCT_EXPORT_VIEW_PROPERTY 导出', () => {
  for (const c of CASES) {
    describe(c.label, () => {
      const viewSrc = readSrc(c.view);
      const managerSrc = readSrc(c.manager);
      const events = emittedEvents(viewSrc);

      it('原生视图确实在发事件（前置断言，防止正则失配导致空跑）', () => {
        expect(events.length).toBeGreaterThan(0);
      });

      it('每个 self.onXxx 都有对应的 RCT_EXPORT_VIEW_PROPERTY(onXxx, RCTDirectEventBlock)', () => {
        const missing = events.filter(
          (name) => !managerSrc.includes('RCT_EXPORT_VIEW_PROPERTY(' + name + ', RCTDirectEventBlock)'),
        );
        expect(missing).toEqual([]);
      });

      it('不重复导出同一个事件属性', () => {
        const names = [...managerSrc.matchAll(/RCT_EXPORT_VIEW_PROPERTY\((on[A-Za-z0-9]+),/g)].map((m) => m[1]);
        const dup = names.filter((n, i) => names.indexOf(n) !== i);
        expect(dup).toEqual([]);
      });
    });
  }

  it('PDF 的 onHistoryStateChange 保持 RCTDirectEventBlock（头文件类型一致）', () => {
    const header = readSrc('ios/NativePDFView/NativePDFView.h');
    expect(header).toContain('RCTDirectEventBlock onHistoryStateChange;');
  });

  it('manager 不得只依赖 customDirectEventTypes（RN 核心已不读取该接口）', () => {
    for (const c of CASES) {
      const managerSrc = readSrc(c.manager);
      expect(managerSrc).toContain('RCT_EXPORT_VIEW_PROPERTY(on');
    }
  });
});
