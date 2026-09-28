/**
 * 「可达笔记编辑链路」锚点回归测试（GAP-MOBILE-001 续）
 *
 * 背景：src/navigation/MainNavigator.js 未被 App 渲染，故 NoteEditorScreen 链路在运行时不可达；
 * 真正可达的「创建/打开笔记」链路为：
 *   首页 FAB → 新建内容弹窗 → NoteStyleModal → CardNoteScreen（卡片笔记）
 *                                          └→ SkiaPagedCanvasScreenNative（分页笔记 / 路由 FluidPagedNote）
 *
 * 目的：为上述两个可达屏幕登记稳定 testID 锚点，供 uiautomator 自动化验收与回归使用。
 *
 * 约定：
 * - 断言只依赖锚点命名，不依赖任何中文文案（文案仅用于驱动既有 Alert 分支，不作为断言依据）。
 * - 重依赖（工具栏、历史导航、分页控件、Realm、原生桥）做最小 mock，
 *   仅为隔离被测锚点，不改变被测源码的任何行为/样式/布局逻辑。
 */

const React = require('react');
const {
  render,
  fireEvent,
  act,
  waitFor,
} = require('@testing-library/react-native');

// ---------------------------------------------------------------------------
// react-native 测试环境补齐
//
// src/tests/jestSetup.js 里的 react-native mock 是精简版，缺少本链路用到的
// KeyboardAvoidingView / Keyboard / Alert / PermissionsAndroid / AppState /
// UIManager / findNodeHandle。这里按需补齐（只影响测试环境，不改被测源码）。
// ---------------------------------------------------------------------------
const RN = require('react-native');
RN.KeyboardAvoidingView = RN.View;
RN.Keyboard = { addListener: jest.fn(() => ({ remove: jest.fn() })), dismiss: jest.fn() };
RN.Alert = { alert: jest.fn() };
RN.PermissionsAndroid = { request: jest.fn(async () => true) };
RN.AppState = { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) };
RN.UIManager = { dispatchViewManagerCommand: jest.fn() };
RN.findNodeHandle = jest.fn(() => 1);

const alertMock = RN.Alert.alert;

// ---------------------------------------------------------------------------
// 主题
// ---------------------------------------------------------------------------
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
  text: '#111111',
  onSurface: '#111111',
  onSurfaceVariant: '#666666',
  outline: '#DDDDDD',
  border: '#DDDDDD',
};

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { colors: mockColors },
    colors: mockColors,
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

// ---------------------------------------------------------------------------
// redux / realm / 服务 / 原生桥：最小 mock
// ---------------------------------------------------------------------------
jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
  useSelector: (selector) => selector({ auth: { user: null }, notes: { entities: {} } }),
}));

const createFakeRealm = () => ({
  objectForPrimaryKey: jest.fn(() => null),
  objects: jest.fn(() => ({ filtered: jest.fn(() => []) })),
  create: jest.fn((type, data) => ({ ...data })),
  write: jest.fn((fn) => fn()),
  addListener: jest.fn(),
  removeListener: jest.fn(),
});

const mockRealmService = {
  getRealm: jest.fn(async () => createFakeRealm()),
};

jest.mock('../../../services/database/realmService', () => ({
  __esModule: true,
  get default() {
    return mockRealmService;
  },
}));

const mockNativeAudioService = {
  addListener: jest.fn(),
  removeListener: jest.fn(),
  destroy: jest.fn(),
  startSpeechToText: jest.fn(async () => {}),
  stopSpeechToText: jest.fn(async () => {}),
  playAudio: jest.fn(async () => {}),
};

jest.mock('../../../services/audio/nativeAudioService', () => ({
  __esModule: true,
  get default() {
    return mockNativeAudioService;
  },
}));

jest.mock('../../../services/networkErrorService', () => ({
  __esModule: true,
  default: { isNetworkError: jest.fn(() => false), handleApiError: jest.fn() },
}));

jest.mock('../../../services/fileHistoryService', () => ({
  __esModule: true,
  default: { addFile: jest.fn() },
}));

jest.mock('../../../native/permanentStorageBridge', () => ({
  __esModule: true,
  default: { createNote: jest.fn(async () => {}), updateNote: jest.fn(async () => {}) },
}));

jest.mock('../../../native/recognitionBridge', () => ({
  recognizeTextInRegion: jest.fn(async () => ''),
}));

jest.mock('../../../services/data/noteDataHash', () => ({
  generateNoteDataHash: jest.fn(() => 'mock-hash'),
}));

jest.mock('../../../services/memory/MemoryMonitor', () => ({
  __esModule: true,
  default: {
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    addCleanupCallback: jest.fn(),
  },
}));

// 原生工具栏桥接：返回最小 toolbarProps（锚点不落在其中）
jest.mock('../../../hooks/useNativeToolbarBridge', () => ({
  __esModule: true,
  useNativeToolbarBridge: () => ({
    requestRecognition: jest.fn(async () => ''),
    scheduleRecognition: jest.fn(),
    currentTool: 'pen',
    currentColor: '#000000',
    currentStrokeWidth: 2,
  }),
}));

// ---------------------------------------------------------------------------
// 禁改的公共组件 / 重依赖组件：占位即可（锚点不落在其中）
// ---------------------------------------------------------------------------
jest.mock('../../../components/common', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  const Stub = (props) => ReactMock.createElement(View, props, props.children);
  return { Card: Stub, XiaohongshuCard: Stub, DouyinCard: Stub, ZhihuCard: Stub };
});

jest.mock('../../../components/common/AllInOneToolbar', () => () => null);
jest.mock('../../../components/viewer/FileHistoryNavigation', () => () => null);
jest.mock('../../../components/viewer/PageControl', () => () => null);
jest.mock('../../../components/common/ZoomIndicator', () => () => null);
jest.mock('../../../components/common/LoadingIndicator', () => () => null);

const CardNoteScreen = require('../CardNoteScreen').default;
const SkiaPagedCanvasScreenNative = require('../SkiaPagedCanvasScreenNative').default;
const BackButton = require('../../../components/viewer/BackButton').default;
const SaveButton = require('../../../components/common/SaveButton').default;

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
const createNavigation = () => ({
  addListener: jest.fn(() => jest.fn()),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
  navigate: jest.fn(),
  setParams: jest.fn(),
});

const renderCardNote = (params = {}) => {
  const navigation = createNavigation();
  const route = { params: { title: '锚点卡片笔记', content: '', ...params } };
  const utils = render(React.createElement(CardNoteScreen, { route, navigation }));
  return { ...utils, navigation };
};

const renderPagedCanvas = (params = {}) => {
  const navigation = createNavigation();
  const route = { params: { title: '锚点分页笔记', noteStyle: 'lined', ...params } };
  const utils = render(
    React.createElement(SkiaPagedCanvasScreenNative, { route, navigation }),
  );
  return { ...utils, navigation };
};

describe('CardNoteScreen 锚点（可达链路）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealmService.getRealm.mockImplementation(async () => createFakeRealm());
    mockNativeAudioService.addListener.mockImplementation(() => {});
    mockNativeAudioService.removeListener.mockImplementation(() => {});
    mockNativeAudioService.destroy.mockImplementation(() => {});
    mockNativeAudioService.startSpeechToText.mockImplementation(async () => {});
    mockNativeAudioService.stopSpeechToText.mockImplementation(async () => {});
  });

  it('提供页面根锚点与初始状态锚点', () => {
    const { getByTestId } = renderCardNote();

    expect(getByTestId('screen.cardNote')).toBeTruthy();
    expect(getByTestId('state.cardNote.state.idle')).toBeTruthy();
    expect(getByTestId('state.cardNote.cardStyle.default')).toBeTruthy();
    expect(getByTestId('state.cardNote.stylePicker.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.cardNote.audio.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.cardNote.voicePaused.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.cardNote.noteCreated.none')).toBeTruthy();
  });

  it('提供标题/正文输入锚点，且锚点可命中真实 TextInput（行为不变）', () => {
    const { getByTestId } = renderCardNote();

    const titleInput = getByTestId('input.cardNote.title');
    const contentInput = getByTestId('input.cardNote.content');

    expect(titleInput.props.value).toBe('锚点卡片笔记');

    fireEvent.changeText(titleInput, '改后的标题');
    fireEvent.changeText(contentInput, '改后的正文');

    expect(getByTestId('input.cardNote.title').props.value).toBe('改后的标题');
    expect(getByTestId('input.cardNote.content').props.value).toBe('改后的正文');
  });

  it('提供返回/保存操作锚点，宿主 View 内仍是既有 BackButton / SaveButton', () => {
    const { getByTestId } = renderCardNote();

    const backHost = getByTestId('action.cardNote.back');
    const saveHost = getByTestId('action.cardNote.save');

    expect(backHost).toBeTruthy();
    expect(saveHost).toBeTruthy();

    // 宿主 View 只是锚点载体：内部仍是禁改公共组件里的真实控件
    expect(backHost.findAllByType(BackButton)).toHaveLength(1);
    expect(saveHost.findAllByType(SaveButton)).toHaveLength(1);
  });

  it('提供工具栏锚点；样式选择弹窗锚点随点击翻转（行为不变）', () => {
    const { getByTestId, queryByTestId } = renderCardNote();

    expect(getByTestId('action.cardNote.tool.style')).toBeTruthy();
    expect(queryByTestId('modal.cardNote.stylePicker')).toBeNull();

    fireEvent.press(getByTestId('action.cardNote.tool.style'));

    expect(getByTestId('overlay.cardNote.stylePicker')).toBeTruthy();
    expect(getByTestId('modal.cardNote.stylePicker')).toBeTruthy();
    expect(getByTestId('state.cardNote.stylePicker.visibility.visible')).toBeTruthy();

    ['default', 'xiaohongshu', 'douyin', 'zhihu'].forEach((styleId) => {
      expect(getByTestId(`option.cardNote.style.${styleId}`)).toBeTruthy();
    });

    // 选择小红书样式：既有 handler 语义不变（setCardStyle + 关闭弹窗）
    fireEvent.press(getByTestId('option.cardNote.style.xiaohongshu'));

    expect(getByTestId('state.cardNote.cardStyle.xiaohongshu')).toBeTruthy();
    expect(getByTestId('state.cardNote.stylePicker.visibility.hidden')).toBeTruthy();
    expect(queryByTestId('modal.cardNote.stylePicker')).toBeNull();

    // 小红书样式下出现「图片」工具锚点
    expect(getByTestId('action.cardNote.tool.image')).toBeTruthy();

    // 抖音样式下出现「封面」工具锚点
    fireEvent.press(getByTestId('action.cardNote.tool.style'));
    fireEvent.press(getByTestId('option.cardNote.style.douyin'));

    expect(getByTestId('state.cardNote.cardStyle.douyin')).toBeTruthy();
    expect(getByTestId('action.cardNote.tool.cover')).toBeTruthy();
  });

  it('样式弹窗关闭锚点可驱动，关闭后可见性锚点回落 hidden', () => {
    const { getByTestId, queryByTestId } = renderCardNote();

    fireEvent.press(getByTestId('action.cardNote.tool.style'));
    expect(getByTestId('state.cardNote.stylePicker.visibility.visible')).toBeTruthy();

    fireEvent.press(getByTestId('action.cardNote.stylePicker.close'));

    expect(getByTestId('state.cardNote.stylePicker.visibility.hidden')).toBeTruthy();
    expect(queryByTestId('modal.cardNote.stylePicker')).toBeNull();
    // 关闭不改变已选样式（行为不变）
    expect(getByTestId('state.cardNote.cardStyle.default')).toBeTruthy();
  });

  it('语音链路锚点：进入识别态后可命中语音操作锚点并驱动状态锚点', async () => {
    jest.useFakeTimers();
    try {
      const { getByTestId } = renderCardNote();

      expect(getByTestId('state.cardNote.state.idle')).toBeTruthy();

      // 既有语音按钮 → 既有 Alert 菜单（handleVoiceAction 内有 100ms 延迟）
      fireEvent.press(getByTestId('action.cardNote.voice.toggle'));
      act(() => {
        jest.advanceTimersByTime(200);
      });

      const voiceMenu = alertMock.mock.calls[alertMock.mock.calls.length - 1][2];
      const speechButton = voiceMenu.find((item) => item.text === '语音转文字');

      await act(async () => {
        await speechButton.onPress();
      });

      // 识别态：状态锚点与语音操作锚点同时出现
      expect(getByTestId('state.cardNote.state.listening')).toBeTruthy();
      expect(getByTestId('action.cardNote.voice.close')).toBeTruthy();
      expect(getByTestId('action.cardNote.voice.pauseToggle')).toBeTruthy();
      expect(getByTestId('action.cardNote.voice.stop')).toBeTruthy();

      // 暂停/继续：既有 handler 语义不变
      fireEvent.press(getByTestId('action.cardNote.voice.pauseToggle'));
      expect(getByTestId('state.cardNote.voicePaused.visibility.visible')).toBeTruthy();

      fireEvent.press(getByTestId('action.cardNote.voice.pauseToggle'));
      expect(getByTestId('state.cardNote.voicePaused.visibility.hidden')).toBeTruthy();

      // 停止识别：回到 idle
      await act(async () => {
        fireEvent.press(getByTestId('action.cardNote.voice.stop'));
      });

      expect(getByTestId('state.cardNote.state.idle')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('SkiaPagedCanvasScreenNative 锚点（可达链路）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealmService.getRealm.mockImplementation(async () => createFakeRealm());
  });

  it('提供页面根锚点、初始状态锚点与返回/保存操作锚点', () => {
    const { getByTestId } = renderPagedCanvas();

    expect(getByTestId('screen.pagedCanvas')).toBeTruthy();

    expect(getByTestId('state.pagedCanvas.loading.visibility.visible')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.error.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.dirty.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.regionSelect.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.zoomIndicator.visibility.hidden')).toBeTruthy();
    // 原生 onReady 之前 currentPage 保持初始值 0（如实反映既有状态，不发明状态）
    expect(getByTestId('state.pagedCanvas.page.current.0')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.page.total.1')).toBeTruthy();

    const backHost = getByTestId('action.pagedCanvas.back');
    const saveHost = getByTestId('action.pagedCanvas.save');

    expect(backHost.findAllByType(BackButton)).toHaveLength(1);
    expect(saveHost.findAllByType(SaveButton)).toHaveLength(1);
  });

  it('原生回调驱动状态锚点：加载完成 / 页码 / 未保存标记（handler 逻辑不变）', async () => {
    const { getByTestId, UNSAFE_getByType } = renderPagedCanvas();
    const nativeView = UNSAFE_getByType('NativePagedNoteView');

    await act(async () => {
      nativeView.props.onReady({ nativeEvent: { totalPages: 3, currentPage: 1 } });
    });

    expect(getByTestId('state.pagedCanvas.loading.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.page.total.3')).toBeTruthy();
    // currentPage 由原生 0-based 转 UI 1-based（行为不变）
    expect(getByTestId('state.pagedCanvas.page.current.2')).toBeTruthy();

    fireEvent(nativeView, 'pageAdded', { nativeEvent: { totalPages: 4 } });

    expect(getByTestId('state.pagedCanvas.page.total.4')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.dirty.visibility.visible')).toBeTruthy();

    fireEvent(nativeView, 'pageChange', { nativeEvent: { page: 2 } });

    expect(getByTestId('state.pagedCanvas.page.current.3')).toBeTruthy();
  });

  it('原生错误回调驱动错误状态锚点，页面根锚点仍在', () => {
    const { getByTestId, UNSAFE_getByType } = renderPagedCanvas();
    const nativeView = UNSAFE_getByType('NativePagedNoteView');

    fireEvent(nativeView, 'error', { nativeEvent: { message: '原生组件异常' } });

    expect(getByTestId('state.pagedCanvas.error.visibility.visible')).toBeTruthy();
    expect(getByTestId('state.pagedCanvas.loading.visibility.hidden')).toBeTruthy();
    expect(getByTestId('screen.pagedCanvas')).toBeTruthy();
  });
});

describe('直写入口预览打标（RISK-LIST-UNTAGGED-001）', () => {
  it('SkiaPagedCanvasScreenNative 新建分页笔记的落库 payload 已带预览元数据', async () => {
    const realm = createFakeRealm();
    mockRealmService.getRealm.mockImplementation(async () => realm);

    renderPagedCanvas({
      noteId: 'paged-preview-note-1',
      createNew: true,
      title: '分页预览标题',
    });

    await waitFor(() => {
      expect(realm.create.mock.calls.some(([schema]) => schema === 'Note')).toBe(true);
    });

    const [, payload] = realm.create.mock.calls.find(([schema]) => schema === 'Note');
    expect(JSON.parse(payload.metadata)).toMatchObject({
      previewText: '',
      contentLength: 0,
      hasContent: false,
    });
  });

  it('CardNoteScreen 保存卡片笔记的落库 payload 已带预览元数据', async () => {
    const realm = createFakeRealm();
    mockRealmService.getRealm.mockImplementation(async () => realm);

    const { UNSAFE_getByType } = renderCardNote({
      noteId: 'card-preview-note-1',
      title: '卡片预览标题',
      content: '# 卡片正文',
    });

    await act(async () => {
      await UNSAFE_getByType(SaveButton).props.onSave();
    });

    const [, payload] = realm.create.mock.calls.find(([schema]) => schema === 'Note');
    expect(JSON.parse(payload.metadata)).toMatchObject({
      previewText: '卡片正文',
      hasContent: true,
    });
  });
});
