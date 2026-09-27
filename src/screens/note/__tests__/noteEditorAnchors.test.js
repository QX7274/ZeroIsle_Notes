/**
 * 笔记编辑器链路锚点回归测试（GAP-MOBILE-001）
 *
 * 目的：为 uiautomator 自动化验收与回归提供稳定 testID 锚点，
 * 覆盖「笔记编辑器页面」(NoteEditorScreen) 与「选择笔记样式」弹窗 (NoteStyleModal)。
 *
 * 约定：
 * - 断言只依赖锚点命名，不依赖任何中文文案，避免文案调整导致用例失效。
 * - 重依赖（Markdown 编辑器、版本抽屉、差异视图等）做最小 mock，
 *   它们不承载本次登记的锚点，mock 只为隔离被测锚点。
 */

const React = require('react');
const {
  render,
  waitFor,
  fireEvent,
  act,
} = require('@testing-library/react-native');

const mockTheme = {
  colors: {
    background: '#FFFFFF',
    card: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#111111',
    textSecondary: '#666666',
    textLight: '#999999',
    primary: '#2563EB',
    success: '#4CAF50',
    warning: '#FF9500',
    border: '#DDDDDD',
  },
  dimensions: {
    FONT_SIZE: { XSMALL: 10, SMALL: 12, MEDIUM: 16, LARGE: 18, XLARGE: 22 },
    LINE_HEIGHT: { MEDIUM: 24 },
    SPACING: { XSMALL: 2, SMALL: 4, MEDIUM: 8, LARGE: 16 },
    BORDER_RADIUS: { SMALL: 4, MEDIUM: 8 },
  },
};

const mockUseTheme = () => ({
  theme: mockTheme,
  colors: mockTheme.colors,
  dimensions: mockTheme.dimensions,
  isDarkMode: false,
  themeType: 'light',
});

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

// react-native-svg：样式弹窗预览图，只做占位渲染
jest.mock('react-native-svg', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const makeStub = () => {
    const Stub = ({ children, ...props }) => ReactMock.createElement(View, props, children);
    return Stub;
  };
  const Svg = makeStub();
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Rect: makeStub(),
    Line: makeStub(),
    Circle: makeStub(),
  };
});

// 说明：本仓库 node_modules 中未安装 @realm/react（仅 NoteEditorScreen 用到 Realm.BSON.UUID），
// 因此使用 virtual mock，避免为了跑锚点用例而改动依赖或源码。
jest.mock('@realm/react', () => ({
  Realm: {
    BSON: {
      UUID: class UUIDMock {
        toHexString() {
          return 'mock-uuid-hex';
        }
      },
    },
  },
}), { virtual: true });

jest.mock('../../../services/database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn(),
    // markdownBlockUtils.generateBlockId 会用到，保存链路依赖它
    createObjectId: jest.fn(() => 'abcdef0123456789abcdef01'),
  },
}));

jest.mock('../../../services/api/noteVersionApi', () => ({
  compareVersions: jest.fn(async () => ({ title_diff: [], content_diff: [] })),
  restoreVersion: jest.fn(async () => ({})),
}));

// Markdown 编辑器集成体：锚点不在其中，仅需占位以免拉起重型依赖
jest.mock('../../../components/common', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    MarkdownEditorIntegration: () => ReactMock.createElement(View, null),
  };
});

jest.mock('../../../components/common/BlockReferenceModal', () => () => null);
jest.mock('../components/VersionHistoryDrawer', () => () => null);
jest.mock('../components/DiffView', () => () => null);

const realmService = require('../../../services/database/realmService').default;
const NoteEditorScreen = require('../NoteEditorScreen').default;
const NoteStyleModal = require('../../../components/note/NoteStyleModal').default;
const { noteStyles } = require('../../../components/note/NoteStyleModal');

const NOTE_ID = 'note-anchor-1';

const createNoteRecord = () => ({
  _id: NOTE_ID,
  title: '锚点测试笔记',
  content: '第一行内容\n第二行内容 ^blockanchor1',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
});

const createFakeRealm = (noteRecord) => ({
  objectForPrimaryKey: jest.fn(() => noteRecord),
  objects: jest.fn(() => ({ filtered: jest.fn(() => []) })),
  write: jest.fn((fn) => fn()),
});

// 从 navigation.setOptions 的调用中取出 headerRight 渲染函数
const getHeaderRight = (navigation) => {
  const calls = navigation.setOptions.mock.calls.slice().reverse();
  const found = calls.find(
    ([options]) => options && typeof options.headerRight === 'function',
  );
  expect(found).toBeTruthy();
  return found[0].headerRight;
};

describe('NoteEditorScreen 锚点', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    realmService.getRealm.mockResolvedValue(createFakeRealm(createNoteRecord()));
  });

  const mountEditor = () => {
    const navigation = { setOptions: jest.fn(), push: jest.fn() };
    const route = { params: { noteId: NOTE_ID } };
    const utils = render(
      React.createElement(NoteEditorScreen, { route, navigation }),
    );
    return { ...utils, navigation };
  };

  // 顶栏由 navigation.setOptions 注入，单独渲染以校验锚点
  const mountHeader = (navigation) => render(
    React.createElement(React.Fragment, null, getHeaderRight(navigation)()),
  );

  it('加载中提供页面根锚点与 loading 状态锚点', () => {
    // 让笔记读取一直挂起，稳定停留在加载态
    realmService.getRealm.mockImplementation(() => new Promise(() => {}));
    const { getByTestId } = mountEditor();

    expect(getByTestId('screen.noteEditor')).toBeTruthy();
    expect(getByTestId('state.noteEditor.state.loading')).toBeTruthy();
  });

  it('加载完成后提供页面根锚点、状态锚点与编辑器输入区锚点', async () => {
    const { getByTestId } = mountEditor();

    await waitFor(() => {
      expect(getByTestId('state.noteEditor.state.idle')).toBeTruthy();
    });

    expect(getByTestId('screen.noteEditor')).toBeTruthy();
    expect(getByTestId('input.noteEditor.content')).toBeTruthy();
    expect(getByTestId('state.noteEditor.dirty.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.noteEditor.history.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.noteEditor.diff.visibility.hidden')).toBeTruthy();
  });

  it('顶栏提供保存操作锚点与工具栏历史锚点', async () => {
    const { navigation, getByTestId } = mountEditor();

    await waitFor(() => {
      expect(navigation.setOptions).toHaveBeenCalled();
    });

    const header = mountHeader(navigation);

    expect(header.getByTestId('action.noteEditor.save')).toBeTruthy();
    expect(header.getByTestId('action.noteEditor.tool.history')).toBeTruthy();

    // 历史锚点可驱动：点击后版本历史抽屉可见性锚点翻转
    fireEvent.press(header.getByTestId('action.noteEditor.tool.history'));

    await waitFor(() => {
      expect(getByTestId('state.noteEditor.history.visibility.visible')).toBeTruthy();
    });
  });

  it('版本差异弹窗提供弹窗根锚点与关闭操作锚点', async () => {
    const { getByTestId } = mountEditor();

    await waitFor(() => {
      expect(getByTestId('state.noteEditor.state.idle')).toBeTruthy();
    });

    expect(getByTestId('modal.noteEditor.diff')).toBeTruthy();
    expect(getByTestId('action.noteEditor.diff.close')).toBeTruthy();

    // 关闭锚点可驱动：点击后差异弹窗可见性锚点保持 hidden
    fireEvent.press(getByTestId('action.noteEditor.diff.close'));

    await waitFor(() => {
      expect(getByTestId('state.noteEditor.diff.visibility.hidden')).toBeTruthy();
    });
  });

  it('保存进行中状态锚点切换为 saving', async () => {
    const { navigation, getByTestId } = mountEditor();

    await waitFor(() => {
      expect(getByTestId('state.noteEditor.state.idle')).toBeTruthy();
    });

    const header = mountHeader(navigation);

    // 让保存阶段的 realm 读取一直挂起，稳定停留在保存中
    realmService.getRealm.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      fireEvent.press(header.getByTestId('action.noteEditor.save'));
    });

    expect(getByTestId('state.noteEditor.state.saving')).toBeTruthy();
  });

  it('保存完成后状态锚点切换为 saved', async () => {
    // handleSave 成功后会挂一个 2 秒的提示定时器，用假定时器避免测试进程遗留 open handle
    jest.useFakeTimers();
    try {
      const { navigation, getByTestId } = mountEditor();

      await waitFor(() => {
        expect(getByTestId('state.noteEditor.state.idle')).toBeTruthy();
      });

      const header = mountHeader(navigation);

      await act(async () => {
        fireEvent.press(header.getByTestId('action.noteEditor.save'));
      });

      await waitFor(() => {
        expect(getByTestId('state.noteEditor.state.saved')).toBeTruthy();
      });

      expect(getByTestId('state.noteEditor.dirty.visibility.hidden')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('NoteStyleModal 锚点', () => {
  const mountModal = (props = {}) => render(
    React.createElement(NoteStyleModal, {
      visible: true,
      onClose: jest.fn(),
      onSelect: jest.fn(),
      ...props,
    }),
  );

  it('提供弹窗根锚点与关闭/创建操作锚点', () => {
    const { getByTestId } = mountModal();

    expect(getByTestId('modal.noteStyle')).toBeTruthy();
    expect(getByTestId('action.noteStyle.close')).toBeTruthy();
    expect(getByTestId('action.noteStyle.create')).toBeTruthy();
  });

  it('为每个内置样式提供 option.noteStyle.<styleId> 锚点', () => {
    const { getByTestId } = mountModal();

    noteStyles.forEach((style) => {
      expect(getByTestId(`option.noteStyle.${style.id}`)).toBeTruthy();
    });

    ['blank', 'lined', 'grid', 'dotted'].forEach((styleId) => {
      expect(getByTestId(`option.noteStyle.${styleId}`)).toBeTruthy();
    });
  });

  it('提供样式名称输入锚点', () => {
    const { getByTestId } = mountModal();

    expect(getByTestId('input.noteStyle.name')).toBeTruthy();
  });

  it('选择样式并填写名称后创建，仍以所选样式 id 与名称回调（行为不变）', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = mountModal({ onSelect, onClose });

    fireEvent.press(getByTestId('option.noteStyle.grid'));
    fireEvent.changeText(getByTestId('input.noteStyle.name'), '我的方格本');
    fireEvent.press(getByTestId('action.noteStyle.create'));

    expect(onSelect).toHaveBeenCalledWith('grid', '我的方格本');
    expect(onClose).toHaveBeenCalled();
  });

  it('关闭按钮仍然只触发 onClose（行为不变）', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = mountModal({ onSelect, onClose });

    fireEvent.press(getByTestId('action.noteStyle.close'));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
