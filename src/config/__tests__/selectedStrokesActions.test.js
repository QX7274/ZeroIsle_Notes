/**
 * 「选中笔迹的操作」全链路契约测试。
 *
 * 背景：原生一直会上报 onStrokesSelected（含 strokeIds），但这条回路长期是断的 ——
 * 工具栏侧没有可用的命令通道，只能把「删除/复制」显示成「暂不支持」。
 * 本测试把整条链路钉死：工具栏操作条 → 屏幕层 handler → bridge 派发器 → 协议命令名 → 原生命令表。
 * 任何一环断开都会被立刻发现，而不是等用户点了没反应。
 */

const fs = require('fs');
const path = require('path');
const { getSurfaceCommandNames } = require('../nativeCommandMap');

const ROOT = path.join(__dirname, '..', '..', '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const OPERATIONS = [
  'deleteSelectedStrokes',
  'duplicateSelectedStrokes',
  'moveSelectedStrokes',
  'clearStrokeSelection',
];

describe('选中笔迹操作：协议层', () => {
  it.each(OPERATIONS)('paged 表面能解析到命令名 %s', (op) => {
    const names = getSurfaceCommandNames('paged', op);
    expect(names).toContain(op);
  });
});

describe('选中笔迹操作：Android 原生命令表已登记', () => {
  const MANAGER = 'android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteViewManager.java';

  it.each(OPERATIONS)('命令表包含该命令', (op) => {
    expect(readSrc(MANAGER)).toContain('"' + op + '"');
  });

  it('每条命令都有对应的 case 分支（登记了却不处理也是死接线）', () => {
    const src = readSrc(MANAGER);
    // 命令号 20~23 分别对应四个操作
    expect(src).toMatch(/case 20:/);
    expect(src).toMatch(/case 21:/);
    expect(src).toMatch(/case 22:/);
    expect(src).toMatch(/case 23:/);
  });

  it('原生确实实现了这些方法（不是空壳）', () => {
    const view = readSrc('android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteView.java');
    expect(view).toContain('public void deleteSelectedStrokes(');
    expect(view).toContain('public void duplicateSelectedStrokes(');
    expect(view).toContain('public void moveSelectedStrokes(');
    expect(view).toContain('public void clearStrokeSelection(');
  });
});

describe('选中笔迹操作：JS 侧接线完整', () => {
  const HANDLERS = [
    'onDeleteSelectedStrokes',
    'onDuplicateSelectedStrokes',
    'onMoveSelectedStrokes',
    'onClearStrokeSelection',
  ];

  it.each(HANDLERS)('bridge 暴露派发器 %s', (name) => {
    expect(readSrc('src/hooks/useNativeToolbarBridge.js')).toContain(name + ':');
  });

  it('bridge 把 strokeIds 序列化成 JSON 字符串（而非依赖原生读数组）', () => {
    const src = readSrc('src/hooks/useNativeToolbarBridge.js');
    expect(src).toContain('serializeStrokeIds');
    expect(src).toContain('JSON.stringify(strokeIds');
  });

  it('分页屏幕把 onSelectedStrokesAction 接上真实派发器（而不是留空降级）', () => {
    const src = readSrc('src/screens/note/SkiaPagedCanvasScreenNative.js');
    expect(src).toContain('onSelectedStrokesAction');
    expect(src).toContain('onDeleteSelectedStrokes?.(ids)');
    expect(src).toContain('onClearStrokeSelection?.()');
  });

  it('工具栏操作条的三个动作 id 与屏幕层处理分支一一对应', () => {
    const toolbar = readSrc('src/components/common/AllInOneToolbar.js');
    const screen = readSrc('src/screens/note/SkiaPagedCanvasScreenNative.js');
    ['delete', 'duplicate', 'done'].forEach((id) => {
      expect(toolbar).toContain("id: '" + id + "'");
      expect(screen).toContain("actionId === '" + id + "'");
    });
  });
});