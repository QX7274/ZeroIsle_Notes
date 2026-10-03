/**
 * useNativeToolbarBridge 手感链路测试（WS-A）
 *
 * 目标：锁定「手感面板 -> bridge -> 原生命令」这条链路的边界行为，
 * 与既有的 useNativeToolbarBridge.test.js 互补（后者覆盖命令分发与撤销重做）：
 *  - HAND_FEEL_FIELDS / buildHandFeelPayload 的严格归一化（越界、非数字、缺字段）；
 *  - buildHandFeelPayload 与 buildHandwritingToolConfig 的口径一致性；
 *  - pan 交互模式走 TOOL_TO_INTERACTION_MODE 推导成 gesture；
 *  - 手感载荷经由 setToolConfig 真正落到 setToolConfig 快照里。
 */

const { renderHook, act } = require('@testing-library/react-native');

const RN = require('react-native');

const COMMANDS = {
  NativePagedNoteView: {
    setCurrentTool: 8,
    setCurrentColor: 9,
    setCurrentStrokeWidth: 10,
    undo: 4,
    redo: 5,
    clear: 6,
    setPage: 7,
    insertText: 2,
    addImage: 18,
    setToolConfig: 15,
    setInteractionMode: 19,
  },
};

RN.UIManager = {
  dispatchViewManagerCommand: jest.fn(),
  getViewManagerConfig: jest.fn((name) => ({ Commands: COMMANDS[name] })),
};
RN.findNodeHandle = jest.fn(() => 42);

jest.mock('../../native/recognitionBridge', () => ({
  recognizeHandwriting: jest.fn(async () => '识别文本'),
}));

const {
  useNativeToolbarBridge,
  buildHandwritingToolConfig,
  buildHandFeelPayload,
  HAND_FEEL_FIELDS,
} = require('../useNativeToolbarBridge');

// 面板侧同一套口径（两边必须一致，本文件同时锁定这一点）
const handFeel = require('../../components/toolbar/handFeel');

const makeRef = () => ({ current: { __nativeTag: 42 } });

const dispatchedByName = () =>
  RN.UIManager.dispatchViewManagerCommand.mock.calls.map((call) => ({
    args: call[2],
    name: Object.entries(COMMANDS.NativePagedNoteView)
      .find(([, id]) => String(id) === String(call[1]))?.[0] ?? call[1],
  }));

const lastToolConfigSnapshot = () => {
  const call = dispatchedByName().filter((d) => d.name === 'setToolConfig').pop();
  return call ? JSON.parse(call.args[0]) : null;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('HAND_FEEL_FIELDS', () => {
  it('导出固定的手感字段白名单（面板与 bridge 共用一份）', () => {
    expect(HAND_FEEL_FIELDS).toEqual([
      'pressureSensitivity',
      'velocitySensitivity',
      'smoothing',
      'taperIn',
      'taperOut',
      'opacity',
      'strokeWidth',
    ]);
    expect(handFeel.HAND_FEEL_FIELDS).toEqual(HAND_FEEL_FIELDS);
  });

  it('与 PROFILE_DEFAULTS 口径一致（bridge 与面板不能各写一份默认值）', () => {
    expect(handFeel.HAND_FEEL_PROFILE_DEFAULTS).toEqual({
      fountain: { penProfile: 'fountain', pressureSensitivity: 0.9, velocitySensitivity: 0.45, taperIn: 0.28, taperOut: 0.22, smoothing: 0.72 },
      pencil: { penProfile: 'pencil', pressureSensitivity: 0.55, velocitySensitivity: 0.35, taperIn: 0.08, taperOut: 0.08, smoothing: 0.45 },
      brush: { penProfile: 'brush', pressureSensitivity: 1, velocitySensitivity: 0.7, taperIn: 0.32, taperOut: 0.26, smoothing: 0.82 },
      marker: { penProfile: 'marker', pressureSensitivity: 0.18, velocitySensitivity: 0.08, taperIn: 0, taperOut: 0, smoothing: 0.3 },
    });
  });
});

describe('buildHandFeelPayload 归一化', () => {
  it('只输出白名单字段，丢弃与手感无关的键', () => {
    const payload = buildHandFeelPayload(
      { tool: 'pen', penProfile: 'fountain', size: 4, opacity: 1, color: '#ff0000' },
      { smoothing: 0.5, color: '#00ff00', tool: 'brush', foo: 'bar' }
    );

    expect(Object.keys(payload).sort()).toEqual([...HAND_FEEL_FIELDS].sort());
    expect(payload.color).toBeUndefined();
    expect(payload.tool).toBeUndefined();
    expect(payload.foo).toBeUndefined();
  });

  it('比例字段越界一律 clamp 到 [0,1]', () => {
    const payload = buildHandFeelPayload(
      { tool: 'pen', penProfile: 'fountain' },
      {
        pressureSensitivity: 3,
        velocitySensitivity: -2,
        smoothing: 1.5,
        taperIn: -0.4,
        taperOut: 12,
        opacity: 99,
      }
    );

    expect(payload.pressureSensitivity).toBe(1);
    expect(payload.velocitySensitivity).toBe(0);
    expect(payload.smoothing).toBe(1);
    expect(payload.taperIn).toBe(0);
    expect(payload.taperOut).toBe(1);
    expect(payload.opacity).toBe(1);
  });

  it('strokeWidth 按 1~50 clamp 并取整，size 作为原生别名同样被接受', () => {
    expect(buildHandFeelPayload({ tool: 'pen' }, { strokeWidth: 0 }).strokeWidth).toBe(1);
    expect(buildHandFeelPayload({ tool: 'pen' }, { strokeWidth: 999 }).strokeWidth).toBe(50);
    expect(buildHandFeelPayload({ tool: 'pen' }, { strokeWidth: 12.6 }).strokeWidth).toBe(13);
    // size 是原生侧的字段名，面板复用同一入口时不应被白名单丢掉
    expect(buildHandFeelPayload({ tool: 'pen' }, { size: 7 }).strokeWidth).toBe(7);
  });

  it('非数字输入回退到当前配置（而不是把 NaN/字符串写进原生）', () => {
    const current = { tool: 'pen', penProfile: 'fountain', smoothing: 0.72, size: 5 };
    const payload = buildHandFeelPayload(current, {
      smoothing: 'very smooth',
      pressureSensitivity: NaN,
      opacity: null,
      strokeWidth: {},
    });

    expect(payload.smoothing).toBe(0.72);
    expect(payload.pressureSensitivity).toBe(0.9);
    expect(payload.opacity).toBe(1);
    expect(payload.strokeWidth).toBe(5);
    Object.values(payload).forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
    });
  });

  it('空字符串不会被当成 0（Number("") === 0 是经典陷阱）', () => {
    const payload = buildHandFeelPayload(
      { tool: 'pen', penProfile: 'fountain' },
      { smoothing: '' }
    );

    expect(payload.smoothing).toBe(0.72);
  });

  it('缺字段输入按当前笔型补齐，不产生 undefined', () => {
    const payload = buildHandFeelPayload({ tool: 'brush' }, {});
    const defaults = handFeel.getHandFeelDefaults('brush');

    expect(payload.pressureSensitivity).toBe(defaults.pressureSensitivity);
    expect(payload.velocitySensitivity).toBe(defaults.velocitySensitivity);
    expect(payload.taperIn).toBe(defaults.taperIn);
    expect(payload.strokeWidth).toBe(defaults.strokeWidth);
    Object.values(payload).forEach((value) => {
      expect(value).toBeDefined();
      expect(Number.isFinite(value)).toBe(true);
    });
  });

  it('荧光笔缺 opacity 时使用 0.4 半透明默认值', () => {
    const payload = buildHandFeelPayload({ tool: 'highlighter', penProfile: 'marker' }, {});
    expect(payload.opacity).toBe(0.4);
  });

  it('显式传入 penProfile 时透传（驱动 setToolConfig 重新推导笔型默认值）', () => {
    const payload = buildHandFeelPayload(
      { tool: 'pen', penProfile: 'fountain' },
      { penProfile: 'brush', smoothing: 0.9 }
    );

    expect(payload.penProfile).toBe('brush');
    // 非法笔型必须被丢弃，不能让原生收到不存在的笔型
    expect(buildHandFeelPayload({ tool: 'pen' }, { penProfile: 'nonexistent' }).penProfile).toBeUndefined();
  });

  it('载荷可以直接喂给 buildHandwritingToolConfig，且手感值原样保留', () => {
    const payload = buildHandFeelPayload(
      { tool: 'pen', penProfile: 'fountain', color: '#123456', size: 3 },
      { smoothing: 0.2, strokeWidth: 9 }
    );
    const merged = buildHandwritingToolConfig(payload, buildHandwritingToolConfig({ tool: 'pen', color: '#123456' }));

    expect(merged.smoothing).toBe(0.2);
    expect(merged.size).toBe(9);
    // 手感载荷不含 tool/color，因此不会把用户当前选择的工具与颜色覆盖掉
    expect(merged.color).toBe('#123456');
    expect(merged.tool).toBe('pen');
  });
});

describe('bridge 手感与手势链路', () => {
  it('pan 工具推导出 gesture 交互模式（手掌/平移按钮的真实效果）', () => {
    const ref = makeRef();
    const { result } = renderHook(() => useNativeToolbarBridge(ref, 'paged'));

    act(() => {
      result.current.setToolConfig({ tool: 'pan' });
    });

    const modes = dispatchedByName().filter((d) => d.name === 'setInteractionMode').map((d) => d.args[0]);
    expect(modes[modes.length - 1]).toBe('gesture');
  });

  it('手感载荷经 setToolConfig 后出现在原生配置快照里', () => {
    const ref = makeRef();
    const { result } = renderHook(
      (props) => useNativeToolbarBridge(ref, 'paged', props),
      { initialProps: { initialToolConfig: { tool: 'pen', penProfile: 'fountain', size: 2 } } }
    );

    act(() => {
      result.current.setToolConfig(
        buildHandFeelPayload({ tool: 'pen', penProfile: 'fountain', size: 2 }, {
          pressureSensitivity: 0.35,
          smoothing: 0.15,
          strokeWidth: 11,
          opacity: 0.6,
        })
      );
    });

    const snapshot = lastToolConfigSnapshot();
    expect(snapshot.pressureSensitivity).toBe(0.35);
    expect(snapshot.smoothing).toBe(0.15);
    expect(snapshot.opacity).toBe(0.6);
    // strokeWidth 必须落到原生的 size 字段上，否则画布粗细不会变
    expect(snapshot.size).toBe(11);
    expect(snapshot.tool).toBe('pen');
  });

  it('同一份 initialToolConfig 内容、不同对象引用，不会重复下发也不会无限更新', () => {
    const ref = makeRef();
    const warnSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // 关键：options 是每次渲染新建的字面量（调用方最常见的写法）。
    // 如果 initialToolConfig 的等价性按引用判断，这里会变成
    // "initialConfig 重算 -> 挂载 effect 重跑 -> setState -> 再渲染" 的死循环。
    const { rerender } = renderHook(() =>
      useNativeToolbarBridge(ref, 'paged', { initialToolConfig: { tool: 'pen', size: 2 } })
    );

    const firstRunCount = dispatchedByName().filter((d) => d.name === 'setToolConfig').length;

    rerender();
    rerender();

    // 内容没变就绝不能再下发一次配置
    const afterRerenderCount = dispatchedByName().filter((d) => d.name === 'setToolConfig').length;
    expect(afterRerenderCount).toBe(firstRunCount);

    // React 的死循环会以 "Maximum update depth exceeded" 抛错/告警形式暴露，这里直接拦掉
    const loopWarnings = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes('Maximum update depth')
    );
    expect(loopWarnings).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('initialToolConfig 在挂载后被改内容，不会重新下发初始配置（挂载语义只推一次）', () => {
    // 口径说明（刻意如此，不是漏测）：
    // initialToolConfig 的语义是"这个画布开局用什么配置"，由画布持有者在挂载时给定。
    // 四个真实调用点（SkiaPagedCanvas / FluidInfiniteCanvas / PDFViewerNative / MarkdownViewer）
    // 传的都是固定初值，运行期改手感一律走 setToolConfig，因此这里**故意**不跟随变化重放：
    // 一旦"内容变了就重放"，任何用内联 options/内联 initialToolConfig 的调用方
    // 都会重新踩回"重算 -> 重放 -> setState -> 再渲染"的自激循环（实测会刷出上千条
    // Maximum update depth 警告并把日志打爆）。
    const ref = makeRef();
    const { rerender } = renderHook(
      (props) => useNativeToolbarBridge(ref, 'paged', props),
      { initialProps: { initialToolConfig: { tool: 'pen', size: 2 } } }
    );

    const mountWidths = dispatchedByName().filter((d) => d.name === 'setCurrentStrokeWidth').map((d) => d.args[0]);
    expect(mountWidths).toEqual([2]);

    // 挂载后把初值改成 size 6：用户当前粗细必须保持不变，且不能再派发任何命令
    RN.UIManager.dispatchViewManagerCommand.mockClear();
    rerender({ initialToolConfig: { tool: 'pen', size: 6 } });

    expect(dispatchedByName()).toHaveLength(0);
    expect(lastToolConfigSnapshot()).toBeNull();
    expect(ref.current).toBeTruthy();
  });

  it('越界的手感值即使绕过面板直接调用 bridge 也会被归一化', () => {
    const ref = makeRef();
    const { result } = renderHook(() => useNativeToolbarBridge(ref, 'paged'));

    act(() => {
      result.current.setToolConfig(buildHandFeelPayload({ tool: 'pen' }, {
        pressureSensitivity: 50,
        smoothing: -3,
        opacity: 2,
      }));
    });

    const snapshot = lastToolConfigSnapshot();
    expect(snapshot.pressureSensitivity).toBe(1);
    expect(snapshot.smoothing).toBe(0);
    expect(snapshot.opacity).toBe(1);
  });
});
