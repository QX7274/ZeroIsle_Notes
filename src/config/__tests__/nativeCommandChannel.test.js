/**
 * iOS/Android 命令通道可达性回归测试（P0）。
 *
 * 背景：这是一处**由真机日志才暴露**的严重缺陷 ——
 * JS 侧把 Commands 里的数字 ID 用 toString() 下发，而：
 *   - iOS：RCTUIManager 收字符串后走 moduleData.methodsByName["0"]，
 *     iOS 的 Commands 是 RN 扫描 RCT_EXPORT_METHOD 生成的（键是方法名），
 *     于是必然 nil，控制台打 `No command found with name "0"`，命令 100% 丢弃。
 *   - Android：ViewManager.receiveCommand(View, String, args) 默认只转给 delegate，
 *     本项目没有 delegate，字符串命令同样被静默丢弃。
 * 实测（iPad 模拟器）：修复前分页只有 6 条命令可达、无限只有 4 条；修复后均为 26 条。
 *
 * 本测试把两侧的实现约束钉死，防止再次回归成「看起来接线齐全、实际发不出去」。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BRIDGE = 'src/hooks/useNativeToolbarBridge.js';

describe('命令下发形态：必须下发命令名，而不是数字 ID', () => {
  const src = readSrc(BRIDGE);

  it('不存在把命令号 toString() 后下发的写法（这正是 iOS 报 No command found 的原因）', () => {
    // 只看代码行，跳过注释：注释里会引用这个历史写法作说明。
    const codeLines = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    expect(codeLines.join('\n')).not.toMatch(/commandId\.toString\(\)/);
  });

  it('解析器返回的是命令名（getCommandName），并直接下发该名字', () => {
    expect(src).toContain('const getCommandName');
    expect(src).toMatch(/dispatchViewManagerCommand\(nodeHandle,\s*resolvedName,/);
  });
});

describe('iOS：每个协议命令都必须有对应的 RCT_EXPORT_METHOD', () => {
  // RN 的 RCTComponentData.commandsForViewMangerClass 只扫描 RCT_EXPORT_METHOD，
  // constantsToExport 里手写的 Commands 会被忽略。缺一个方法 = 该命令永久不可达。
  const CASES = [
    {
      label: '分页笔记',
      manager: 'ios/NativePagedNoteView/NativePagedNoteViewManager.m',
      required: ['setToolConfig', 'setTool', 'setColor', 'setStrokeWidth', 'undo', 'redo',
        'clear', 'addText', 'addImage', 'deleteSelectedStrokes', 'duplicateSelectedStrokes',
        'moveSelectedStrokes', 'clearStrokeSelection', 'lassoStart', 'lassoUpdate',
        'lassoComplete', 'setViewport', 'resetViewport', 'exportAnnotations',
        'importAnnotations', 'setInteractionMode', 'setPage', 'addPage'],
    },
    {
      label: '无限画布',
      manager: 'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasViewManager.m',
      required: ['setToolConfig', 'setTool', 'setColor', 'setStrokeWidth', 'undo', 'redo',
        'clear', 'addText', 'addImage', 'deleteSelectedStrokes', 'lassoComplete',
        'setViewport', 'resetViewport', 'exportAnnotations', 'importAnnotations',
        'setInteractionMode', 'setPage', 'addPage'],
    },
  ];

  it.each(CASES)('$label 的 Manager 导出了全部必需命令', ({ manager, required }) => {
    const src = readSrc(manager);
    const exported = new Set(
      [...src.matchAll(/RCT_EXPORT_METHOD\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1])
    );
    const missing = required.filter((name) => !exported.has(name));
    expect(missing).toEqual([]);
  });

  it.each(CASES)('$label 不再声明 iOS 不存在的 receiveCommand: 协议', ({ manager }) => {
    const src = readSrc(manager);
    // receiveCommand: 是 Android 的协议；iOS 上永远不会被调用。
    expect(src).not.toContain('- (void)receiveCommand:(nonnull NSNumber *)reactTag');
    expect(src).toContain('handleCommand:');
  });
});

describe('Android：ViewManager 必须重写 receiveCommand(View, String, args)', () => {
  // 没有这个重写，RN 只会把字符串命令交给 delegate；本项目没有 delegate，命令被静默丢弃。
  const MANAGERS = [
    'android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteViewManager.java',
    'android/app/src/main/java/com/zeroisle_notes/nativeinfinite/NativeInfiniteCanvasViewManager.java',
    'android/app/src/main/java/com/zeroisle_notes/nativepdf/NativePDFViewManager.java',
  ];

  it.each(MANAGERS)('%s 重写了字符串版 receiveCommand', (manager) => {
    const src = readSrc(manager);
    expect(src).toMatch(/public void receiveCommand\(@NonNull \w+ root, @Nullable String commandName, @Nullable ReadableArray args\)/);
    expect(src).toContain('getCommandsMap()');
  });
});

describe('iOS：toolConfig 属性不得与命令 setToolConfig: 同名', () => {
  // @property NSDictionary *toolConfig 会自动合成 setToolConfig: setter，
  // 与接收命令的 -setToolConfig:(NSString *) 冲突：
  // 真机表现为 "-[__NSDictionaryI dataUsingEncoding:]: unrecognized selector" 崩溃。
  const VIEWS = [
    'ios/NativePagedNoteView/NativePagedNoteView.m',
    'ios/NativeInfiniteCanvasView/NativeInfiniteCanvasView.m',
  ];

  it.each(VIEWS)('%s 使用 toolConfigDictionary 命名', (view) => {
    const src = readSrc(view);
    expect(src).toContain('toolConfigDictionary');
    expect(src).not.toMatch(/@property[^;]*\*toolConfig;/);
  });
});