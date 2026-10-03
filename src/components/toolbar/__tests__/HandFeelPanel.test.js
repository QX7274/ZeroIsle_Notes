/**
 * HandFeelPanel 行为测试（WS-A 手感与手势）
 *
 * 覆盖三件事：
 * 1) 渲染与内容：当前笔型、实时笔迹预览（SVG Path 的 strokeWidth/opacity）随状态变化；
 * 2) 下发协议：滑块/预设/重置都必须通过 onChange 下发"完整 7 项 + 已归一化"的载荷；
 * 3) 性能约束：拖动节流 ≤ 60ms 一次，且抬手时必须补发最终值（不允许丢帧）。
 */

const React = require('react');
const { render, fireEvent, act } = require('@testing-library/react-native');

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

// Typography 会读 theme.typography.HEADING.H1..H6，颜色 mock 不足以让它渲染
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

const HandFeelPanel = require('../HandFeelPanel').default;
const { normalizeHandFeelState, getHandFeelDefaults } = require('../handFeel');

const BASE_CONFIG = {
  tool: 'pen',
  penProfile: 'fountain',
  size: 2,
  opacity: 1,
  pressureSensitivity: 0.9,
  velocitySensitivity: 0.45,
  smoothing: 0.72,
  taperIn: 0.28,
  taperOut: 0.22,
};

const renderPanel = (props = {}) => {
  const onChange = jest.fn();
  const panelRef = React.createRef();
  const utils = render(
    React.createElement(HandFeelPanel, {
      ref: panelRef,
      toolConfig: BASE_CONFIG,
      onChange,
      ...props,
    }),
  );

  return { ...utils, onChange, panelRef };
};

/** 取最后一次 onChange 载荷 */
const lastPayload = (mockFn) => {
  const calls = mockFn.mock.calls;
  return calls.length ? calls[calls.length - 1][0] : null;
};

describe('HandFeelPanel 渲染与内容', () => {
  it('打开后显示当前笔型与实时笔迹预览', () => {
    const { getByText, getByTestId } = renderPanel({ visible: true });

    expect(getByText('当前笔型：钢笔')).toBeTruthy();
    expect(getByTestId('hand-feel-panel')).toBeTruthy();
    expect(getByTestId('hand-feel-preview')).toBeTruthy();
  });

  it('通过 ref.open() 可以打开，ref.close() 可以关闭（工具栏不新增 state）', () => {
    const { getByTestId, panelRef } = renderPanel();

    expect(getByTestId('hand-feel-modal').props.visible).toBe(false);

    act(() => {
      panelRef.current.open();
    });
    expect(getByTestId('hand-feel-modal').props.visible).toBe(true);

    act(() => {
      panelRef.current.close();
    });
    expect(getByTestId('hand-feel-modal').props.visible).toBe(false);
  });

  it('预览笔迹的粗细与不透明度跟随当前配置', () => {
    const { UNSAFE_getAllByType } = renderPanel({
      visible: true,
      toolConfig: { ...BASE_CONFIG, size: 18, opacity: 0.4 },
    });

    const SvgPath = require('react-native-svg').Path;
    const paths = UNSAFE_getAllByType(SvgPath);
    // 预览只用一条 Path，属性直接决定"所见即所得"
    expect(paths[0].props.strokeWidth).toBe(18);
    expect(paths[0].props.strokeOpacity).toBe(0.4);
  });

  it('切换笔型后标题与重置文案跟随笔型变化', () => {
    const { getByText, rerender } = renderPanel({ visible: true });

    expect(getByText('当前笔型：钢笔')).toBeTruthy();

    rerender(
      React.createElement(HandFeelPanel, {
        visible: true,
        toolConfig: { ...BASE_CONFIG, tool: 'highlighter', penProfile: 'marker' },
        onChange: jest.fn(),
      }),
    );

    expect(getByText('当前笔型：马克笔')).toBeTruthy();
    expect(getByText('重置为默认（马克笔）')).toBeTruthy();
  });
});

describe('HandFeelPanel 下发协议', () => {
  it('拖动某项滑块下发完整 7 项载荷，未改动项保持当前值', () => {
    const { getByTestId, onChange } = renderPanel({ visible: true });

    act(() => {
      fireEvent(getByTestId('hand-feel-slider-smoothing'), 'valueChange', 0.25);
    });

    const payload = lastPayload(onChange);
    expect(Object.keys(payload).sort()).toEqual([
      'opacity',
      'pressureSensitivity',
      'smoothing',
      'strokeWidth',
      'taperIn',
      'taperOut',
      'velocitySensitivity',
    ]);
    expect(payload.smoothing).toBe(0.25);
    expect(payload.pressureSensitivity).toBe(0.9);
    expect(payload.strokeWidth).toBe(2);
  });

  it('滑块越界值在下发前被 clamp（压感不会 >1，粗细不会 <1）', () => {
    // 固定时间轴：否则两次拖动可能落在 60ms 节流窗口内，第二次会被吃掉
    // （节流本身的行为由「拖动节流」用例专门覆盖）。
    jest.spyOn(Date, 'now').mockReturnValue(0);
    const { getByTestId, onChange } = renderPanel({ visible: true });

    act(() => {
      fireEvent(getByTestId('hand-feel-slider-pressureSensitivity'), 'valueChange', 4.2);
    });
    // 两次拖动之间推进 100ms，避开 60ms 节流窗口，确保第二次也能下发
    Date.now.mockReturnValue(100);
    act(() => {
      fireEvent(getByTestId('hand-feel-slider-strokeWidth'), 'valueChange', -10);
    });

    const payload = lastPayload(onChange);
    expect(payload.pressureSensitivity).toBe(1);
    // -10 必须落到范围下界 1，而不是回退成打开时的旧值 2
    expect(payload.strokeWidth).toBe(1);
    Date.now.mockRestore();
  });

  it('点击「绘画」预设一次性下发全部手感字段', () => {
    const { getByTestId, onChange } = renderPanel({ visible: true });

    act(() => {
      fireEvent.press(getByTestId('hand-feel-preset-drawing'));
    });

    const payload = lastPayload(onChange);
    // 预设必须整体下发：只改一半会让"绘画"手感四不像
    expect(payload).toEqual({
      pressureSensitivity: 1,
      velocitySensitivity: 0.7,
      smoothing: 0.82,
      taperIn: 0.32,
      taperOut: 0.26,
      opacity: 1,
      strokeWidth: 12,
    });
  });

  it('「标注」预设保留荧光笔式的半透明', () => {
    const { getByTestId, onChange } = renderPanel({ visible: true });

    act(() => {
      fireEvent.press(getByTestId('hand-feel-preset-annotating'));
    });

    expect(lastPayload(onChange).opacity).toBe(0.4);
  });

  it('「重置为默认」按当前笔型恢复 PROFILE_DEFAULTS 口径', () => {
    const { getByTestId, onChange } = renderPanel({
      visible: true,
      toolConfig: { ...BASE_CONFIG, tool: 'brush', penProfile: 'brush' },
    });

    act(() => {
      fireEvent.press(getByTestId('hand-feel-reset'));
    });

    const defaults = getHandFeelDefaults('brush');
    const payload = lastPayload(onChange);
    expect(payload.pressureSensitivity).toBe(defaults.pressureSensitivity);
    expect(payload.velocitySensitivity).toBe(defaults.velocitySensitivity);
    expect(payload.smoothing).toBe(defaults.smoothing);
    expect(payload.taperIn).toBe(defaults.taperIn);
    expect(payload.taperOut).toBe(defaults.taperOut);
  });

  it('像素级越界的配置在打开时被归一化，滑块不会拿到 undefined', () => {
    const { getByTestId } = renderPanel({
      visible: true,
      toolConfig: { tool: 'pen', smoothing: 9, size: 9999 },
    });

    const normalized = normalizeHandFeelState({ tool: 'pen', smoothing: 9, size: 9999 });
    expect(normalized.smoothing).toBe(1);
    expect(normalized.strokeWidth).toBe(50);
    // 渲染不报错即说明所有滑块都拿到了数字
    expect(getByTestId('hand-feel-slider-strokeWidth')).toBeTruthy();
  });
});

describe('HandFeelPanel 拖动节流', () => {
  const { SLIDER_THROTTLE_MS } = require('../HandFeelPanel');

  beforeEach(() => {
    // 固定时间轴：节流逻辑依赖 Date.now，不打桩就无法确定性断言
    jest.spyOn(Date, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    Date.now.mockRestore();
  });

  it('节流常量为 60ms（父组件每次都序列化全量配置，频率不能再高）', () => {
    expect(SLIDER_THROTTLE_MS).toBe(60);
  });

  it('60ms 节流窗口内的中间值被吃掉，抬手补发最终值', () => {
    const { getByTestId, onChange } = renderPanel({ visible: true });
    const slider = getByTestId('hand-feel-slider-opacity');

    // 拖动 1：时刻 0，节流窗口内没有先前的下发，放行
    act(() => {
      fireEvent(slider, 'valueChange', 0.8);
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    // 拖动 2：距上次 100ms > 60ms，同样放行
    Date.now.mockReturnValue(100);
    act(() => {
      fireEvent(slider, 'valueChange', 0.7);
    });
    expect(onChange).toHaveBeenCalledTimes(2);

    // 拖动 3：距上次仅 30ms < 60ms，属于窗口内的中间值，必须被节流吃掉
    Date.now.mockReturnValue(130);
    act(() => {
      fireEvent(slider, 'valueChange', 0.6);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    // 被吃掉的只是"下发"，面板本地状态仍要即时更新（滑块不能卡住）
    expect(getByTestId('hand-feel-preview-value').props.children.join('')).toContain('60%');

    // 抬手：无论节流窗口是否结束都要补发最终值，否则松手后原生还是旧值
    act(() => {
      fireEvent(slider, 'slidingComplete', 0.6);
    });
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(lastPayload(onChange).opacity).toBe(0.6);
  });

  it('超过 60ms 的拖动正常放行', () => {
    const { getByTestId, onChange } = renderPanel({ visible: true });
    const slider = getByTestId('hand-feel-slider-smoothing');

    act(() => {
      fireEvent(slider, 'valueChange', 0.3);
    });
    Date.now.mockReturnValue(120);

    act(() => {
      fireEvent(slider, 'valueChange', 0.4);
    });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(lastPayload(onChange).smoothing).toBe(0.4);
  });
});
