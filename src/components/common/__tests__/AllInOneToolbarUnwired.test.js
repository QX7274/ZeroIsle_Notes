/**
 * AllInOneToolbar「未接通收口」回归测试（WS-C）
 *
 * 这些用例锁定的是 Lead 逐行核实过的真实缺陷，而不是实现细节：
 *  缺陷 3 —— 先开网格再切工具，下发给原生的 showGrid 必须仍为 true。
 *            【口径澄清 · 2026-10-03 集成期】WS-C 用「删掉 WS-A 补偿 effect 的副本」做对照探针，
 *            实测该用例在移除补偿 effect 后**依然通过**：它钉住的是「最终载荷正确」这个不变式，
 *            并不是补偿 effect 本身。补偿 effect 确实在工作（通知数 2→3），但目前没有
 *            「只有它才能变绿」的公开行为（所有 showGrid/showRuler 入口都主动 notify）。
 *            因此本用例的命名与断言只声明不变式，不夸大其覆盖范围。
 *  缺陷 4 —— 形状有两个入口、accessibilityLabel 同名，读屏用户无法区分；
 *  缺陷 1 —— loadPreferences 与 1 秒防抖保存之间的竞态，会把读回的偏好写成默认值；
 *  缺陷 2 —— 最近颜色只写不读，工具栏上完全不可见；
 *  缺陷 5 —— 不允许存在「不是 disabled、又没有回调、也不是纯展示」的静默死按钮。
 */

const React = require('react');
const { render, fireEvent, act } = require('@testing-library/react-native');

// AsyncStorage 必须被 mock：单测不允许真的读写磁盘。
// jest.mock 的工厂函数禁止引用外部变量，所以这里先建 mock、再用 require 取回同一个实例。
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const asyncStorageMock = require('@react-native-async-storage/async-storage');


const RN = require('react-native');
RN.Vibration = { vibrate: jest.fn(), cancel: jest.fn() };
RN.Alert = { alert: jest.fn() };

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
const { STORAGE_KEYS } = require('../AllInOneToolbarPrefs');

const PREFS_KEY = STORAGE_KEYS.TOOLBAR_PREFERENCES;
const RECENT_KEY = STORAGE_KEYS.RECENT_COLORS;

/** 让所有已排队微任务（AsyncStorage 假实现是 async）跑完。 */
const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderToolbar = (props = {}) => {
  const onToolConfigChange = jest.fn();
  const utils = render(
    React.createElement(AllInOneToolbar, {
      mode: 'canvas',
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

/** 取最后一次写入「工具栏偏好」的载荷（外层 1 秒防抖 + WS-C 补写都会写这个 key）。 */
const lastPersistedPrefs = () => {
  const calls = asyncStorageMock.setItem.mock.calls.filter((call) => call[0] === PREFS_KEY);
  if (!calls.length) {
    return null;
  }
  try {
    return JSON.parse(calls[calls.length - 1][1]);
  } catch (error) {
    return null;
  }
};

/**
 * 递归收集渲染树里真正的「按钮」节点。
 *
 * 判据必须是「无障碍角色是 button」或「宿主类型是 TouchableOpacity」。
 * 不能把 accessibilityLabel 当判据：Container 类节点
 * （例如操作条自身带 accessibilityRole="toolbar" + label）会因此被误收，
 * 而它们本来就不该有 onPress / accessibilityState，断言会得到 undefined。
 */
const collectButtonNodes = (node, acc = []) => {
  if (!node || typeof node !== 'object') {
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectButtonNodes(child, acc));
    return acc;
  }

  const props = node.props || {};
  const isButton = props.accessibilityRole === 'button' || node.type === 'TouchableOpacity';
  if (isButton) {
    acc.push(node);
  }

  collectButtonNodes(node.children, acc);
  return acc;
};

describe('AllInOneToolbar 未接通收口（WS-C）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asyncStorageMock.getItem.mockImplementation(async () => null);
    asyncStorageMock.setItem.mockImplementation(async () => undefined);
  });

  describe('缺陷 3：覆盖层状态不得被工具切换冲掉', () => {
    it('先打开网格、再切到铅笔，下发给原生的 showGrid 仍为 true', () => {
      const { getByLabelText, onToolConfigChange } = renderToolbar();

      act(() => {
        fireEvent.press(getByLabelText('网格'));
      });
      expect(lastPayload(onToolConfigChange).showGrid).toBe(true);

      act(() => {
        fireEvent.press(getByLabelText('铅笔工具'));
      });

      const payload = lastPayload(onToolConfigChange);
      // 旧实现里工具变化 effect 的依赖数组没有 showGrid，
      // 这里必须仍然带着 showGrid=true，否则原生网格会随切换工具一起消失。
      expect(payload.showGrid).toBe(true);
      expect(payload.tool).toBe('pencil');
    });

    it('先打开标尺、再切到刷子，下发给原生的 showRuler 仍为 true', () => {
      const { getByLabelText, onToolConfigChange } = renderToolbar();

      act(() => {
        fireEvent.press(getByLabelText('标尺'));
      });
      act(() => {
        fireEvent.press(getByLabelText('刷子工具'));
      });

      expect(lastPayload(onToolConfigChange).showRuler).toBe(true);
    });
  });

  describe('缺陷 4：形状的两个入口必须可区分', () => {
    it('所有形状入口的 accessibilityLabel 互不重复', () => {
      // 用 queryAll（允许多个匹配）而不是 getBy：getBy 在重复标签时会直接抛错，
      // 那样断言只会表现为「测试崩了」，看不出重复了几处。
      const { queryAllByLabelText } = renderToolbar();

      const labels = queryAllByLabelText(/形状/)
        .map((node) => node.props.accessibilityLabel)
        .filter(Boolean);

      expect(labels.length).toBeGreaterThan(1);
      expect(new Set(labels).size).toBe(labels.length);
      // 同名标签最多只能出现一次，读屏用户才有可区分的信息。
      const duplicated = labels.filter((label, index) => labels.indexOf(label) !== index);
      expect(duplicated).toEqual([]);
    });
  });

  describe('缺陷 1：加载到的偏好不得被 1 秒防抖写回默认值', () => {
    // 这两个用例都要真等 1 秒以上的防抖周期，再加上整棵工具栏的渲染开销，
    // 默认 5s 超时在跑全量套件时会被挤爆，故显式放宽。
    const DEBOUNCE_PLUS = 1400;

    it('挂载后应用磁盘里的 lastColor，并且落盘内容最终仍是该颜色', async () => {
      asyncStorageMock.getItem.mockImplementation(async (key) => {
        if (key === PREFS_KEY) {
          return JSON.stringify({
            lastColor: '#FF00FF',
            lastStrokeWidth: 9,
            lastTool: 'pen',
            showRuler: false,
            showGrid: false,
          });
        }
        return null;
      });

      const { getByLabelText, onToolConfigChange } = renderToolbar();
      await flushMicrotasks();

      // 磁盘里的颜色必须真的被应用（点击标尺会让工具栏用当前 activeColor 组一次载荷）。
      act(() => {
        fireEvent.press(getByLabelText('标尺'));
      });
      expect(lastPayload(onToolConfigChange).color).toBe('#FF00FF');

      // 再等满一个防抖周期：旧实现会在这一刻把默认的 #000000 写回磁盘。
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_PLUS));
      });

      const persisted = lastPersistedPrefs();
      expect(persisted).not.toBeNull();
      expect(persisted.lastColor).toBe('#FF00FF');
      expect(persisted.lastStrokeWidth).toBe(9);
    }, 20000);

    it('磁盘比 1 秒防抖更慢时，加载完成后仍会把磁盘里的偏好补写回去（最终值必须是用户偏好）', async () => {
      // 这是缺陷 1 最恶劣的形态：读写竞态。让 getItem 比 1 秒防抖更慢，
      // 防抖一定先跑一次（写的是尚未回填的默认值），随后加载结果必须把真实偏好补回来。
      // 只断言「最终落盘值」而不是「从未写过默认值」，因为后者需要改 savePreferences
      // 本身（在 WS-C 标记区之外），而用户能感知的契约就是「下次启动读到的是自己的颜色」。
      asyncStorageMock.getItem.mockImplementation(async (key) => {
        if (key !== PREFS_KEY) {
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_PLUS + 600));
        return JSON.stringify({
          lastColor: '#123456',
          lastStrokeWidth: 7,
          lastTool: 'pen',
          showRuler: false,
          showGrid: false,
        });
      });

      renderToolbar();

      // 等到「防抖已跑过、加载也已完成」之后再看磁盘的最终值。
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_PLUS + 900));
      });

      const persisted = lastPersistedPrefs();
      expect(persisted).not.toBeNull();
      expect(persisted.lastColor).toBe('#123456');
      expect(persisted.lastStrokeWidth).toBe(7);
    }, 20000);

    it('偏好加载器自身：加载完成前 canPersist() 为 false（组件的落盘闸门）', () => {
      // 组件侧靠 preferencesLoaderRef.current.canPersist() 决定是否允许落盘，
      // 这里直接对闸门本身下断言，避免「组件恰好没写」这种巧合式通过。
      const {
        createPreferencesLoader,
      } = require('../AllInOneToolbarPrefs');

      const loader = createPreferencesLoader({ storage: asyncStorageMock });
      expect(loader.canPersist()).toBe(false);
    });
  });

  describe('缺陷 2：最近颜色必须在工具栏上可见', () => {
    it('磁盘里有最近颜色时渲染出 toolbar.recentColors 容器', async () => {
      asyncStorageMock.getItem.mockImplementation(async (key) => {
        if (key === RECENT_KEY) {
          return JSON.stringify(['#FF0000', '#00FF00']);
        }
        return null;
      });

      const { getByTestId } = renderToolbar();
      await flushMicrotasks();

      expect(getByTestId('toolbar.recentColors')).toBeTruthy();
    });

    it('最近颜色为空时不渲染空容器（避免留一条空条）', async () => {
      const { queryByTestId } = renderToolbar();
      await flushMicrotasks();

      expect(queryByTestId('toolbar.recentColors')).toBeNull();
    });
  });

  describe('缺陷 5：不允许存在静默死按钮', () => {
    it('画布模式下每个按钮要么有回调、要么显式 disabled、要么是纯展示', () => {
      const utils = renderToolbar();
      const nodes = collectButtonNodes(utils.toJSON());

      expect(nodes.length).toBeGreaterThan(10);

      const dead = nodes.filter((node) => {
        const props = node.props || {};
        const hasCallback = typeof props.onPress === 'function'
          || typeof props.onLongPress === 'function';
        const explicitlyDisabled = props.disabled === true
          || props.accessibilityState?.disabled === true;
        // 纯展示节点：没有 press 语义（例如 Modal 的容器 View 上挂了 label）。
        const isDisplayOnly = props.accessibilityRole !== 'button'
          && node.type !== 'TouchableOpacity';

        return !hasCallback && !explicitlyDisabled && !isDisplayOnly;
      });

      expect(dead.map((node) => node.props?.accessibilityLabel || node.type)).toEqual([]);
    });

    it('套索工具本身仍可点击（未被误降级）', () => {
      const { getByLabelText, onToolConfigChange } = renderToolbar();

      act(() => {
        fireEvent.press(getByLabelText('套索工具'));
      });

      const payload = lastPayload(onToolConfigChange);
      expect(payload.tool).toBe('lasso');
      expect(payload.mode).toBe('select');
    });

    it('套索选中笔迹的操作条在未注入命令通道时必须 disabled 且说明原因', () => {
      const { queryByTestId } = renderToolbar({ selectedStrokeIds: ['s1', 's2'] });

      const bar = queryByTestId('toolbar.selectedStrokesBar');
      if (!bar) {
        // 操作条由 Lead 集成到主 return（见 WS-C 完成说明的接线位置）。
        // 未集成时这条断言会显式失败，避免「测试通过但其实没接线」的假绿。
        throw new Error(
          'toolbar.selectedStrokesBar 未渲染：请确认主 return 里已挂 renderSelectedStrokesBar(selectedStrokeIds, onSelectedStrokesAction)',
        );
      }

      const actionNodes = collectButtonNodes(bar);
      // 3 个动作按钮 + 恰好 1 个容器被排除：容器带 accessibilityRole="toolbar"，
      // 不是按钮，这里用数量把「helper 不再误收容器」钉死。
      expect(bar.props.accessibilityRole).toBe('toolbar');
      const labels = actionNodes.map((node) => node.props.accessibilityLabel).filter(Boolean);
      expect(labels).toEqual(expect.arrayContaining(['删除选中笔迹', '复制选中笔迹', '完成选择']));
      expect(actionNodes.filter((n) => n.props.accessibilityRole === 'button').length).toBe(3);
      // 收集到的每个节点都必须真的是按钮（不允许把容器塞进来）。
      actionNodes.forEach((node) => expect(node.props.accessibilityRole).toBe('button'));

      actionNodes.forEach((node) => {
        expect(node.props.accessibilityState?.disabled).toBe(true);
        expect(node.props.disabled).toBe(true);
        expect(typeof node.props.onPress).toBe('undefined');
        expect(node.props.accessibilityHint).toMatch(/暂不支持/);
      });
    });

    it('注入 onSelectedStrokesAction 后操作条按钮启用并回传选中的笔迹 id', () => {
      const onSelectedStrokesAction = jest.fn();
      const { queryByTestId } = renderToolbar({
        selectedStrokeIds: ['s1', 's2'],
        onSelectedStrokesAction,
      });

      const bar = queryByTestId('toolbar.selectedStrokesBar');
      if (!bar) {
        throw new Error('toolbar.selectedStrokesBar 未渲染：主 return 尚未挂 renderSelectedStrokesBar');
      }

      const deleteButton = collectButtonNodes(bar)
        .find((node) => node.props.accessibilityLabel === '删除选中笔迹');
      // 必须是真正的按钮节点，而不是被误收进来的容器（容器没有 onPress）。
      expect(deleteButton.props.accessibilityRole).toBe('button');
      expect(deleteButton.props.accessibilityState?.disabled).toBe(false);
      expect(deleteButton.props.disabled).toBe(false);
      expect(typeof deleteButton.props.onPress).toBe('function');
      // 启用态下不应再提示「暂不支持」。
      expect(deleteButton.props.accessibilityHint || '').not.toMatch(/暂不支持/);

      act(() => {
        deleteButton.props.onPress();
      });
      expect(onSelectedStrokesAction).toHaveBeenCalledWith('delete', ['s1', 's2']);
    });
  });
});
