/**
 * AllInOneToolbar 工具栏接线回归（本轮手写/工具栏优化）
 *
 * 背景：工具栏里有一批按钮此前只改本地 state、从不下发原生，
 * 用户点了没反应（标尺/网格），或原生根本没有对应命令（防误触/手指书写）。
 * 本文件锁定「按钮点击 -> onToolConfigChange 载荷」这条链路，
 * 确保这些开关真的会被送到原生画布。
 */

const React = require('react');
const { render, fireEvent, act } = require('@testing-library/react-native');

const RN = require('react-native');
RN.Vibration = { vibrate: jest.fn(), cancel: jest.fn() };
RN.Alert = { alert: jest.fn() };
RN.AsyncStorage = RN.AsyncStorage || {};

const mockColors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  surface: '#FFFFFF',
  primary: '#2563EB',
  primaryContainer: '#DBEAFE',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#1E3A8A',
  secondary: '#7C3AED',
  error: '#DC2626',
  onError: '#FFFFFF',
  disabled: '#9CA3AF',
  textDisabled: '#9CA3AF',
  text: '#111111',
  onSurface: '#111111',
  onSurfaceVariant: '#666666',
  outline: '#DDDDDD',
  border: '#DDDDDD',
};

// Typography 的 Heading 会读 theme.typography.HEADING.H1..H6，
// 旧的 mock 只给了 colors，导致整个工具栏渲染时在 Typography 里抛 TypeError
// （测试从来没能真正渲染过这个组件）。这里补齐 typography 的最小结构。
const mockTypography = {
  HEADING: {
    H1: { fontSize: 32, fontWeight: '700' },
    H2: { fontSize: 28, fontWeight: '700' },
    H3: { fontSize: 24, fontWeight: '600' },
    H4: { fontSize: 20, fontWeight: '600' },
    H5: { fontSize: 18, fontWeight: '600' },
    H6: { fontSize: 16, fontWeight: '600' },
  },
  BODY: {},
  CAPTION: {},
};

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: mockColors,
    theme: { colors: mockColors, typography: mockTypography },
    dimensions: {
      FONT_SIZE: { XSMALL: 10, SMALL: 12, MEDIUM: 16, LARGE: 18, XLARGE: 22 },
      LINE_HEIGHT: { MEDIUM: 24 },
      SPACING: { XSMALL: 2, SMALL: 4, MEDIUM: 8, LARGE: 16 },
      BORDER_RADIUS: { SMALL: 4, MEDIUM: 8 },
    },
    isDarkMode: false,
    themeType: 'light',
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(async () => ''),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(async () => ({ assets: [] })),
}));

jest.mock('../../../services/notes/noteAIService', () => ({
  noteAIService: {
    processTextStream: jest.fn(() => ({
      onMessage: () => ({ onComplete: () => ({ onError: () => ({ start: () => {} }) }) }),
    })),
  },
}));

jest.mock('../../../services/ai/chatHistoryService', () => ({
  chatHistoryService: { getHistory: jest.fn(async () => []), addHistory: jest.fn() },
}));

jest.mock('../../../services/notes/bookmarkService', () => ({
  bookmarkService: {
    getBookmarks: jest.fn(async () => []),
    addBookmark: jest.fn(async () => {}),
    removeBookmark: jest.fn(async () => {}),
  },
}));

const AllInOneToolbar = require('../AllInOneToolbar').default;

const renderToolbar = (props = {}) => {
  const onToolConfigChange = jest.fn();
  const utils = render(
    React.createElement(AllInOneToolbar, {
      mode: 'paged',
      onToolConfigChange,
      onToolChange: jest.fn(),
      canUndo: true,
      canRedo: false,
      currentToolConfig: {
        tool: 'pen',
        color: '#000000',
        size: 2,
        penProfile: 'fountain',
        palmRejectionEnabled: true,
        fingerMode: 'gesture_only',
      },
      ...props,
    }),
  );
  return { ...utils, onToolConfigChange };
};

/** 取最后一次 onToolConfigChange 的载荷。 */
const lastPayload = (mockFn) => {
  const calls = mockFn.mock.calls;
  return calls.length ? calls[calls.length - 1][0] : null;
};

describe('AllInOneToolbar 工具栏接线', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('渲染出防误触/手指书写/标尺/网格按钮', () => {
    const { getByLabelText } = renderToolbar();
    expect(getByLabelText('防误触')).toBeTruthy();
    expect(getByLabelText('手指书写')).toBeTruthy();
    expect(getByLabelText('标尺')).toBeTruthy();
    expect(getByLabelText('网格')).toBeTruthy();
  });

  it('点击「标尺」把 showRuler 下发到原生', () => {
    const { getByLabelText, onToolConfigChange } = renderToolbar();

    act(() => {
      fireEvent.press(getByLabelText('标尺'));
    });

    const payload = lastPayload(onToolConfigChange);
    expect(payload).not.toBeNull();
    expect(payload.showRuler).toBe(true);
  });

  it('点击「网格」把 showGrid 下发到原生', () => {
    const { getByLabelText, onToolConfigChange } = renderToolbar();

    act(() => {
      fireEvent.press(getByLabelText('网格'));
    });

    const payload = lastPayload(onToolConfigChange);
    expect(payload.showGrid).toBe(true);
  });

  it('点击「防误触」把 palmRejectionEnabled 下发到原生', () => {
    const { getByLabelText, onToolConfigChange } = renderToolbar();

    act(() => {
      fireEvent.press(getByLabelText('防误触'));
    });

    const payload = lastPayload(onToolConfigChange);
    expect(payload.palmRejectionEnabled).toBe(false);
  });

  it('开启防误触时「手指书写」不可用；关闭后点击可切换为 draw', () => {
    const { getByLabelText, onToolConfigChange, rerender } = renderToolbar();

    // 防误触开启：手指书写按钮 disabled
    const disabledButton = getByLabelText('手指书写');
    expect(disabledButton.props.accessibilityState?.disabled).toBe(true);

    // 关闭防误触
    act(() => {
      fireEvent.press(getByLabelText('防误触'));
    });
    expect(lastPayload(onToolConfigChange).palmRejectionEnabled).toBe(false);

    // 用新的 currentToolConfig 重新渲染，模拟父组件回传
    rerender(
      React.createElement(AllInOneToolbar, {
        mode: 'paged',
        onToolConfigChange,
        onToolChange: jest.fn(),
        canUndo: true,
        canRedo: false,
        currentToolConfig: {
          tool: 'pen',
          color: '#000000',
          size: 2,
          penProfile: 'fountain',
          palmRejectionEnabled: false,
          fingerMode: 'gesture_only',
        },
      }),
    );

    act(() => {
      fireEvent.press(getByLabelText('手指书写'));
    });

    expect(lastPayload(onToolConfigChange).fingerMode).toBe('draw');
  });

  // ===== 以下为「Lead 集成接线」的回归锁（此前只有临时探针验证过，无正式测试） =====

  it('点击「手掌/平移工具」把 pan 工具下发到原生（不是只改本地 state）', () => {
    const { getByLabelText, onToolConfigChange } = renderToolbar();

    act(() => {
      fireEvent.press(getByLabelText('手掌/平移工具'));
    });

    const payload = lastPayload(onToolConfigChange);
    expect(payload).not.toBeNull();
    expect(payload.tool).toBe('pan');
    expect(payload.type).toBe('pan');
  });

  it('点击「手感」打开手感面板', () => {
    const { getByLabelText, getByTestId } = renderToolbar();

    // 注意：React Native 的 Modal 在测试渲染器里仍会渲染 children，
    // 因此不能用「子节点是否存在」判断开合，必须读 Modal 自己的 visible。
    const modal = getByTestId('hand-feel-modal');
    expect(modal.props.visible).toBe(false);

    act(() => {
      fireEvent.press(getByLabelText('手感'));
    });

    expect(getByTestId('hand-feel-modal').props.visible).toBe(true);
    // 面板必须真的带上可调参数（压感等滑块），而不是只有一个空壳
    expect(getByTestId('hand-feel-slider-pressureSensitivity')).toBeTruthy();
  });

  it('工具栏容器与工具组带稳定 testID（宽屏布局改版的回归锚点）', () => {
    const { getByTestId } = renderToolbar();
    expect(getByTestId('toolbar.allInOne')).toBeTruthy();
    expect(getByTestId('all-in-one-toolbar-group-drawing')).toBeTruthy();
  });

  it('形状入口消歧：两个入口的 accessibilityLabel 互不重复', () => {
    // 修复前两个入口都叫「形状工具」，读屏用户无法区分，UI 测试也会同时命中两个节点。
    // 这条断言把消歧结果钉住：各自恰好 1 个，且不相等。
    const { queryAllByLabelText } = renderToolbar();
    expect(queryAllByLabelText('更多形状')).toHaveLength(1);
    expect(queryAllByLabelText('形状工具')).toHaveLength(1);
  });

  it('工具栏工具按钮统一走 ToolbarPressable（compact 下有效触达 >= 44）', () => {
    // 修复前只有标尺/网格/防误触/手指书写四处有 hitSlop，其余 24 个工具按钮仍是
    // TouchableOpacity（compact 下仅 36 触达，未达 44）。
    // 现在工具栏内的工具按钮统一由 ToolbarPressable 渲染，未显式传 hitSlop 时按断点补足。
    // 注意：这里只针对「工具栏容器内」的按钮；弹窗（AI 结果/手感面板等）里的按钮
    // 有自己的尺寸约束（它们自带 minHeight/minWidth 44），不属于本约束范围。
    const { getByTestId } = renderToolbar();

    // 只在「9 个工具组」范围内统计，且只看原生节点。
    // 原因（WS-B 探针实测）：toolbar.allInOne 容器内同时挂着 Modal（手感面板/AI 面板），
    // 且 findAll 会把 ToolbarPressable 这个复合组件实例本身也当成 button 收进来 ——
    // 复合节点不持有 hitSlop（hitSlop 是它往下传给原生 Pressable 的），
    // 用它统计会把 24 个真实按钮全部误判为「缺 hitSlop」。
    const GROUPS = ['bookmarks', 'preset', 'history', 'drawing', 'erase', 'style', 'assist', 'ai', 'page'];
    const isHostButton = (n) => typeof n.type === 'string' && n.props && n.props.accessibilityRole === 'button';
    let toolButtons = [];
    let legacy = [];
    GROUPS.forEach((g) => {
      const group = getByTestId(`all-in-one-toolbar-group-${g}`);
      toolButtons = toolButtons.concat(group.findAll(isHostButton));
      legacy = legacy.concat(group.findAll((n) => n.type === 'TouchableOpacity'));
    });

    expect(toolButtons.length).toBe(28); // 9 组共 28 个工具按钮
    // 每个工具按钮都必须显式带上 hitSlop（由 ToolbarPressable 统一补足 44 触达）
    expect(toolButtons.filter((b) => !b.props.hitSlop)).toHaveLength(0);
    // 工具组内不应再残留 TouchableOpacity（已全部换成 ToolbarPressable）
    expect(legacy).toHaveLength(0);
  });

  it('内容溢出时显示「右侧还有内容」提示（不因屏幕宽而消失）', () => {
    // 测试环境的 Dimensions.get('window') 是 375 宽（见 jestSetup），
    // 远小于 9 组 28 个按钮所需宽度，因此必然溢出、必须给出提示。
    // 这条断言的价值：曾经这里叠加了「宽度 < 1200 才提示」的条件，
    // 导致平板上（恰是最需要提示的设备）提示消失，属真机实测发现的回归。
    const { getByTestId } = renderToolbar();
    expect(getByTestId('toolbar.overflowHint')).toBeTruthy();
  });
});
