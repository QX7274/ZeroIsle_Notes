/**
 * RISK-UI-REMINDER-001 回归：提醒创建页底部「取消/创建」操作栏。
 *
 * 历史根因（可复核）：
 * - 9b0114f 之前，AddReminderScreen 的 <ScrollView> 只有 contentContainerStyle、**没有 style flex 约束**，
 *   Android 上 ScrollView 会按内容高度撑开，把同级的操作栏顶出可视区；
 * - 同期操作栏还没有 testID（cb4eade 才补 state.reminder.actionBar / action.reminder.cancel|create），
 *   所以历史四次 XML dump 按锚点查找必然「未命中」。
 *
 * 本用例锁死这两条防线：CTA 锚点存在 + 操作栏是滚动区的同级普通流兄弟 + 滚动区 flex 约束不丢，
 * 并断言底部留白/安全区来自 insets 计算而不是写死的操作栏高度。
 */

const React = require('react');
const { render } = require('@testing-library/react-native');

// jestSetup 的 react-native mock 没有这几个宿主组件，这里补桩（只补宿主组件，不碰业务逻辑）
const mockRN = require('react-native');
mockRN.KeyboardAvoidingView = 'KeyboardAvoidingView';
mockRN.Keyboard = { dismiss: jest.fn() };
mockRN.ToastAndroid = { show: jest.fn() };

const mockInsets = { top: 24, bottom: 34, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  const RNMock = require('react-native');
  const SafeAreaView = (props) => ReactMock.createElement(
    RNMock.View,
    { ...props, testID: props.testID || 'mock.safeAreaView' },
    props.children,
  );
  return {
    SafeAreaView,
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => mockInsets,
  };
});

const mockColors = new Proxy({}, {
  get: (_target, key) => (typeof key === 'string' ? '#336699' : undefined),
});
const mockTheme = { colors: mockColors, isDarkMode: false };

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, colors: mockColors, isDarkMode: false }),
}));

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn((action) => action),
  useSelector: (selector) => selector({}),
}));

jest.mock('../../../services/api/reminderApi', () => ({
  __esModule: true,
  default: { createReminder: jest.fn(async () => ({ data: { id: 'r-1' } })) },
}));

jest.mock('../../../services/network/networkService', () => ({
  isNetworkConnected: jest.fn(async () => true),
}));

jest.mock('../../../services/reminder/reminderNotificationService', () => ({
  __esModule: true,
  default: {
    requestPermissions: jest.fn(async () => true),
    buildOfflineReminderPayload: jest.fn((reminder) => ({ ...reminder, id: 'offline-1' })),
    saveOfflineReminder: jest.fn(async (reminder) => ({ ...reminder, id: 'offline-1' })),
    scheduleReminderNotification: jest.fn(async () => 'notification-1'),
  },
}));

jest.mock('../../../redux/slices/reminderSlice', () => ({
  addLocalReminder: jest.fn((payload) => ({ type: 'reminder/addLocalReminder', payload })),
  refreshUnsyncedCount: jest.fn(() => ({ type: 'reminder/refreshUnsyncedCount' })),
}));

jest.mock('../../../config', () => ({
  DEV_MODE_CONFIG: { FEATURES: { SKIP_LOGIN_SCREEN: false } },
}));

jest.mock('../../../components/common/SafeDateTimePicker', () => () => null);

jest.mock('../../../components/common/ScreenHeaderBackButton', () => {
  const ReactMock = require('react');
  const RNMock = require('react-native');
  return (props) => ReactMock.createElement(RNMock.View, props);
});

const AddReminderScreen = require('../AddReminderScreen').default;
const { REMINDER_SCROLL_LAYOUT } = require('../reminderLayout');

/**
 * 深度遍历渲染树，按 host 类型查找节点
 * @param {Object} node
 * @param {string} type
 * @returns {Object|null}
 */
const findByType = (node, type) => {
  if (!node || typeof node !== 'object') {
    return null;
  }
  if (node.type === type) {
    return node;
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (let i = 0; i < children.length; i += 1) {
    const found = findByType(children[i], type);
    if (found) {
      return found;
    }
  }
  return null;
};

const createNavigation = () => ({
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
});

const renderScreen = () => render(
  React.createElement(AddReminderScreen, {
    route: { params: {} },
    navigation: createNavigation(),
  }),
);

describe('RISK-UI-REMINDER-001 提醒创建页底部操作栏', () => {
  beforeEach(() => {
    mockInsets.top = 24;
    mockInsets.bottom = 34;
  });

  test('提供可被 XML dump 命中的 CTA 锚点（操作栏 / 取消 / 创建）', () => {
    const { getByTestId } = renderScreen();

    expect(getByTestId('screen.reminder')).toBeTruthy();
    expect(getByTestId('state.reminder.actionBar')).toBeTruthy();
    expect(getByTestId('action.reminder.cancel')).toBeTruthy();
    expect(getByTestId('action.reminder.create')).toBeTruthy();
  });

  test('操作栏与滚动区同处一个 flex 列，且排在滚动区之后（不会被顶出屏幕）', () => {
    const { toJSON } = renderScreen();
    const tree = toJSON();

    const flexColumn = findByType(tree, 'KeyboardAvoidingView');
    expect(flexColumn).not.toBeNull();

    const children = (flexColumn.children || []).filter(Boolean);
    // 含滚动区的那个子树（= 表单内容区）
    const contentIndex = children.findIndex((child) => findByType(child, 'ScrollView'));
    const actionBarIndex = children.findIndex(
      (child) => child.props && child.props.testID === 'state.reminder.actionBar',
    );

    expect(contentIndex).toBeGreaterThanOrEqual(0);
    expect(actionBarIndex).toBeGreaterThan(contentIndex);
  });

  test('滚动区保留 flex 约束（历史根因回归防护：ScrollView 必须有 style）', () => {
    const { toJSON } = renderScreen();
    const scrollNode = findByType(toJSON(), 'ScrollView');

    expect(scrollNode).not.toBeNull();
    expect(scrollNode.props.style).toBe(REMINDER_SCROLL_LAYOUT);
    expect(scrollNode.props.style).toMatchObject({
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minHeight: 0,
    });
  });

  test('底部留白来自安全区计算（不再写死 96/128 这类操作栏高度）', () => {
    let utils = renderScreen();
    let scrollNode = findByType(utils.toJSON(), 'ScrollView');
    let actionBar = utils.getByTestId('state.reminder.actionBar');

    // insets.bottom = 34：滚动区底留白 = max(24, 34) = 34，操作栏底部内边距 = max(16, 34) = 34
    expect(scrollNode.props.contentContainerStyle[1].paddingBottom).toBe(34);
    expect(actionBar.props.style[actionBar.props.style.length - 1].paddingBottom).toBe(34);
    // 旧的硬编码预留（96 + 32 = 128）必须消失
    expect(scrollNode.props.contentContainerStyle[1].paddingBottom).not.toBe(128);

    utils.unmount();

    // insets.bottom = 0（例如三键导航的非 edge-to-edge 窗口）：回落到最小留白
    mockInsets.bottom = 0;
    utils = renderScreen();
    scrollNode = findByType(utils.toJSON(), 'ScrollView');
    actionBar = utils.getByTestId('state.reminder.actionBar');

    expect(scrollNode.props.contentContainerStyle[1].paddingBottom).toBe(24);
    expect(actionBar.props.style[actionBar.props.style.length - 1].paddingBottom).toBe(16);
  });

  test('底部安全区只在操作栏应用一次（SafeAreaView 不再叠加 bottom）', () => {
    const { getByTestId } = renderScreen();

    expect(getByTestId('screen.reminder').props.edges).toEqual(['top', 'left', 'right']);
  });

  test('操作栏保持固定高度语义：不被压缩、带层级（平板/大屏都可见）', () => {
    const { getByTestId } = renderScreen();
    const actionBar = getByTestId('state.reminder.actionBar');

    expect(actionBar.props.style[0]).toMatchObject({
      position: 'relative',
      flexGrow: 0,
      flexShrink: 0,
      zIndex: 10,
      elevation: 8,
    });
  });
});
