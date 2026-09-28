/**
 * 搜索链路锚点回归测试（GAP-MOBILE-001 / ACC-SEARCH-001）
 *
 * 目的：为 uiautomator 自动化取证提供稳定 testID 锚点回归，
 * 覆盖「搜索页面」(SearchScreen)、「搜索结果页面」(SearchResultsScreen)、
 * 「统一搜索栏」(UnifiedSearchBar)、「多模态搜索弹层」(MultiModalSearch)、
 * 「搜索历史」(SearchHistory)、「搜索建议」(SearchSuggestions)、
 * 「搜索结果组件」(SearchResults) 与「搜索过滤」(SearchFilters)。
 *
 * 约定：
 * - 断言只依赖锚点命名，不依赖中文文案，避免文案调整导致用例失效。
 * - 仅在测试内补齐 jestSetup 整体 mock 掉的 react-native 宿主组件
 *   （KeyboardAvoidingView / BackHandler / Keyboard / PermissionsAndroid / Alert
 *   以及可遍历 renderItem 的 FlatList），不触碰任何业务逻辑。
 * - 重依赖（音频、图片选择、AsyncStorage、Redux store）做最小 mock，
 *   它们不承载本次登记的锚点，mock 只为隔离被测锚点。
 */

const React = require('react');
const {
  render,
  fireEvent,
  waitFor,
  act,
} = require('@testing-library/react-native');

// ---------------------------------------------------------------------------
// react-native 宿主组件补桩：全局 jestSetup 已把 react-native 整体替换为字符串组件，
// 这里仅补齐被测页面用到、但全局桩缺失的宿主组件与可遍历列表实现。
// ---------------------------------------------------------------------------
const mockRN = require('react-native');

mockRN.KeyboardAvoidingView = 'KeyboardAvoidingView';
mockRN.Keyboard = { dismiss: jest.fn() };
mockRN.BackHandler = {
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
};
mockRN.Alert = { alert: jest.fn() };
mockRN.PermissionsAndroid = {
  PERMISSIONS: { CAMERA: 'android.permission.CAMERA' },
  RESULTS: { GRANTED: 'granted' },
  request: jest.fn(async () => 'granted'),
};

// 让 FlatList 真正遍历 renderItem / ListEmptyComponent，以便断言列表项与空态锚点。
mockRN.FlatList = ({
  data = [],
  renderItem,
  keyExtractor,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  refreshControl,
  ...rest
}) => {
  const toElement = (candidate, key) => {
    if (!candidate) {
      return null;
    }
    if (React.isValidElement(candidate)) {
      return React.cloneElement(candidate, { key });
    }
    return React.createElement(candidate, { key });
  };

  const rows = (data || []).map((item, index) => {
    const key = keyExtractor ? String(keyExtractor(item, index)) : `row-${index}`;
    return React.createElement(
      React.Fragment,
      { key },
      renderItem({ item, index, separators: {} }),
    );
  });

  const emptyRow = rows.length === 0
    ? toElement(ListEmptyComponent, 'empty')
    : null;

  return React.createElement(
    mockRN.View,
    rest,
    [toElement(ListHeaderComponent, 'header'), ...rows, emptyRow, toElement(ListFooterComponent, 'footer')]
      .filter(Boolean),
  );
};

// ---------------------------------------------------------------------------
// 最小依赖 mock
// ---------------------------------------------------------------------------
const mockTheme = {
  colors: {
    background: '#FFFFFF',
    card: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#111111',
    textSecondary: '#666666',
    textHint: '#999999',
    primary: '#2196F3',
    primaryLight: '#E3F2FD',
    border: '#DDDDDD',
    error: '#DC2626',
    errorLight: '#FEE2E2',
    onPrimary: '#FFFFFF',
    success: '#16A34A',
    warning: '#D97706',
    disabled: '#CBD5E1',
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

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  push: jest.fn(),
  setOptions: jest.fn(),
};

const mockDispatch = jest.fn((action) => Promise.resolve(action));

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('react-native-paper', () => ({
  Portal: ({ children }) => children,
}));

jest.mock('../../../navigation/navigationRef', () => ({
  getCurrentRouteName: () => 'SearchAnchorTest',
  navigationRef: { isReady: () => false },
}));

jest.mock('../../../utils/hooks/useOrientation', () => ({
  __esModule: true,
  default: () => ({ isPortrait: true, isLandscape: false, orientation: 'portrait' }),
}));

jest.mock('../../../native/debugLog', () => ({
  __esModule: true,
  default: jest.fn(),
  reportDebugLogBridgeState: jest.fn(),
}));

jest.mock('../../../services/audio/nativeAudioService', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeListener: jest.fn(),
    destroy: jest.fn(),
    startSpeechToText: jest.fn(async () => ({})),
    stopSpeechToText: jest.fn(async () => ({})),
    playRecording: jest.fn(async () => ({})),
    stopPlaying: jest.fn(async () => ({})),
  },
}));

jest.mock('../../../services/networkErrorService', () => ({
  __esModule: true,
  default: { showNetworkError: jest.fn() },
}));

const mockAsyncHistory = [
  { query: '历史关键词一', mode: 'text', timestamp: '2026-01-01T00:00:00.000Z' },
  { query: '历史关键词二', mode: 'voice', timestamp: '2026-01-02T00:00:00.000Z' },
];

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => JSON.stringify(mockAsyncHistory)),
    setItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => null),
  },
}));

jest.mock('../../../components/common/Typography', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  const Text = (props) => ReactMock.createElement(RN.Text, props, props.children);
  return { Text, Heading: Text, default: Text };
});

jest.mock('../../../components/common', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  const Card = (props) => ReactMock.createElement(RN.View, props, props.children);
  return { Card, Button: Card, Skeleton: Card, EmptyState: Card };
});

jest.mock('../../../components/common/AdvancedMarkdownPreview', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  return (props) => ReactMock.createElement(RN.View, props);
});

const mockLocalSearch = Object.assign(
  jest.fn((payload) => ({
    type: 'search/localSearch/fulfilled',
    payload: { results: [{ id: 'note-1', type: 'note', title: '示例笔记' }], hasResults: true, ...payload },
  })),
  { fulfilled: { match: (action) => action && action.type === 'search/localSearch/fulfilled' } },
);

let mockReduxState = {
  search: {
    results: [{ id: 'note-1', type: 'note', title: '示例笔记' }],
    isLoading: false,
    error: null,
    history: [...mockAsyncHistory],
    suggestions: [],
    isFetchingSuggestions: false,
    suggestionsError: null,
    mode: 'text',
  },
};

const resetReduxState = () => {
  mockReduxState = {
    search: {
      results: [{ id: 'note-1', type: 'note', title: '示例笔记' }],
      isLoading: false,
      error: null,
      history: [...mockAsyncHistory],
      suggestions: [],
      isFetchingSuggestions: false,
      suggestionsError: null,
      mode: 'text',
    },
  };
};

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) => selector(mockReduxState),
}));

// WS-U：「最近访问」记录 —— 只把 markNoteOpenedAt 换成 spy，其余实现保持真实，
// 避免影响同文件其它用例（它们不依赖这个函数）。
jest.mock('../../../services/offline/getNotes', () => {
  const actual = jest.requireActual('../../../services/offline/getNotes');
  return { ...actual, markNoteOpenedAt: jest.fn(() => Promise.resolve(true)) };
});

jest.mock('../../../redux/slices/searchSlice', () => ({
  localSearch: mockLocalSearch,
  search: jest.fn((payload) => ({ type: 'search/search', payload })),
  setSearchMode: jest.fn((mode) => ({ type: 'search/setSearchMode', payload: mode })),
  clearSearchResults: jest.fn(() => ({ type: 'search/clearSearchResults' })),
  addToSearchHistory: jest.fn((payload) => ({ type: 'search/addToSearchHistory', payload })),
  fetchSearchHistory: jest.fn((payload) => ({ type: 'search/fetchSearchHistory', payload })),
  clearSearchHistoryAsync: jest.fn(() => ({ type: 'search/clearSearchHistoryAsync' })),
  fetchSearchSuggestions: jest.fn((payload) => ({ type: 'search/fetchSearchSuggestions', payload })),
  clearSuggestions: jest.fn(() => ({ type: 'search/clearSuggestions' })),
  selectSearchResults: (state) => state.search.results,
  selectIsLoading: (state) => state.search.isLoading,
  selectError: (state) => state.search.error,
  selectSearchHistory: (state) => state.search.history,
  selectSuggestions: (state) => state.search.suggestions,
  selectIsFetchingSuggestions: (state) => state.search.isFetchingSuggestions,
  selectSuggestionsError: (state) => state.search.suggestionsError,
  selectSearchMode: (state) => state.search.mode,
}));

// 被测组件（require 必须晚于上面的 mock 变量初始化）
const SearchScreen = require('../SearchScreen').default;
const SearchResultsScreen = require('../SearchResultsScreen').default;
const UnifiedSearchBar = require('../../../components/search/UnifiedSearchBar').default;
const MultiModalSearch = require('../../../components/search/MultiModalSearch').default;
const SearchHistory = require('../../../components/search/SearchHistory').default;
const SearchSuggestions = require('../../../components/search/SearchSuggestions').default;
const SearchResults = require('../../../components/search/SearchResults').default;
const SearchFilters = require('../../../components/search/SearchFilters').default;

const searchSlice = require('../../../redux/slices/searchSlice');

beforeEach(() => {
  jest.clearAllMocks();
  resetReduxState();
});

describe('SearchScreen 锚点', () => {
  const mount = (params = {}) => render(
    React.createElement(SearchScreen, { navigation: mockNavigation, route: { params } }),
  );

  it('提供页面根锚点与搜索状态锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('screen.search')).toBeTruthy();
    expect(getByTestId('state.search.performed.false')).toBeTruthy();
    expect(getByTestId('state.search.history.visibility.visible')).toBeTruthy();
    expect(getByTestId('state.search.results.count.1')).toBeTruthy();
    expect(getByTestId('state.search.loading.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.search.error.visibility.hidden')).toBeTruthy();
  });

  it('带初始关键词进入时历史隐藏（行为不变）', () => {
    const { getByTestId, queryByTestId } = mount({ query: '笔记' });

    expect(getByTestId('state.search.history.visibility.hidden')).toBeTruthy();
    expect(queryByTestId('panel.search.history')).toBeNull();
  });

  it('帮助按钮与帮助弹窗锚点可命中，点击后弹窗状态切换', () => {
    const { getByTestId } = mount();

    expect(getByTestId('state.search.helpModal.visibility.hidden')).toBeTruthy();
    expect(getByTestId('action.search.openHelp')).toBeTruthy();
    expect(getByTestId('modal.search.help')).toBeTruthy();

    fireEvent.press(getByTestId('action.search.openHelp'));

    expect(getByTestId('state.search.helpModal.visibility.visible')).toBeTruthy();

    fireEvent.press(getByTestId('action.search.help.close'));

    expect(getByTestId('state.search.helpModal.visibility.hidden')).toBeTruthy();
  });

  it('历史面板锚点由 SearchHistory 组件承载', () => {
    const { getByTestId } = mount();

    expect(getByTestId('panel.search.history')).toBeTruthy();
    expect(getByTestId('action.search.history.clear')).toBeTruthy();
    expect(getByTestId('item.searchHistory.0')).toBeTruthy();
  });
});

describe('SearchResultsScreen 锚点', () => {
  const results = [
    { id: 'note-1', type: 'note', title: '示例笔记' },
    { id: 'tag-2', type: 'tag', title: '示例标签' },
  ];

  const mount = (params = {}) => render(
    React.createElement(SearchResultsScreen, { navigation: mockNavigation, route: { params } }),
  );

  it('提供页面根锚点、返回锚点与结果列表锚点', () => {
    const { getByTestId } = mount({ results, query: '示例' });

    expect(getByTestId('screen.searchResults')).toBeTruthy();
    expect(getByTestId('action.searchResults.back')).toBeTruthy();
    expect(getByTestId('list.searchResults.results')).toBeTruthy();
    expect(getByTestId('item.searchResult.note-1')).toBeTruthy();
    expect(getByTestId('item.searchResult.tag-2')).toBeTruthy();
    expect(getByTestId('panel.searchResults.stats')).toBeTruthy();
  });

  it('提供页面状态与结果计数锚点', () => {
    const { getByTestId } = mount({ results, query: '示例' });

    expect(getByTestId('state.searchResults.state.ready')).toBeTruthy();
    expect(getByTestId('state.searchResults.results.count.2')).toBeTruthy();
    expect(getByTestId('state.searchResults.results.total.2')).toBeTruthy();
    expect(getByTestId('state.searchResults.history.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.searchResults.filters.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.searchResults.filters.modified.false')).toBeTruthy();
  });

  it('无结果时提供空态锚点', () => {
    const { getByTestId } = mount({ results: [], query: '不存在的关键词' });

    expect(getByTestId('state.searchResults.state.empty')).toBeTruthy();
    expect(getByTestId('state.searchResults.empty')).toBeTruthy();
    expect(getByTestId('state.searchResults.results.count.0')).toBeTruthy();
  });

  it('打开结果时记录最近访问（WS-U）：笔记类写 last_opened_at，tag 不写', () => {
    const getNotesModule = require('../../../services/offline/getNotes');
    const { getByTestId } = mount({ results, query: '示例' });

    fireEvent.press(getByTestId('item.searchResult.note-1'));
    expect(getNotesModule.markNoteOpenedAt).toHaveBeenCalledWith('note-1');
    expect(mockNavigation.navigate).toHaveBeenCalled();

    fireEvent.press(getByTestId('item.searchResult.tag-2'));
    expect(getNotesModule.markNoteOpenedAt).not.toHaveBeenCalledWith('tag-2');
    expect(getNotesModule.markNoteOpenedAt).toHaveBeenCalledTimes(1);
  });

  it('历史与过滤开关提供操作锚点，点击后可见性状态切换', () => {
    const { getByTestId } = mount({ results, query: '示例' });

    expect(getByTestId('action.searchResults.toggleHistory')).toBeTruthy();
    expect(getByTestId('action.searchResults.toggleFilters')).toBeTruthy();

    fireEvent.press(getByTestId('action.searchResults.toggleHistory'));
    expect(getByTestId('state.searchResults.history.visibility.visible')).toBeTruthy();
    expect(getByTestId('panel.search.history')).toBeTruthy();

    fireEvent.press(getByTestId('action.searchResults.toggleFilters'));
    expect(getByTestId('state.searchResults.filters.visibility.visible')).toBeTruthy();
    expect(getByTestId('panel.search.filters')).toBeTruthy();
  });

  it('返回锚点仍然只触发 navigation.goBack（行为不变）', () => {
    const { getByTestId } = mount({ results, query: '示例' });

    fireEvent.press(getByTestId('action.searchResults.back'));

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});

describe('UnifiedSearchBar 锚点', () => {
  it('提供搜索栏入口锚点与作用域状态锚点', () => {
    const { getByTestId } = render(
      React.createElement(UnifiedSearchBar, { searchScope: 'home', onSearch: jest.fn() }),
    );

    expect(getByTestId('action.search.bar.open')).toBeTruthy();
    expect(getByTestId('state.search.bar.scope.home')).toBeTruthy();
    expect(getByTestId('state.search.bar.modal.visibility.hidden')).toBeTruthy();
  });

  it('不同作用域暴露可预测的 scope 锚点', () => {
    const { getByTestId } = render(
      React.createElement(UnifiedSearchBar, { searchScope: 'community', onSearch: jest.fn() }),
    );

    expect(getByTestId('state.search.bar.scope.community')).toBeTruthy();
  });

  it('点击搜索栏后展开多模态搜索弹层（行为不变）', () => {
    const { getByTestId } = render(
      React.createElement(UnifiedSearchBar, { searchScope: 'home', onSearch: jest.fn() }),
    );

    fireEvent.press(getByTestId('action.search.bar.open'));

    expect(getByTestId('state.search.bar.modal.visibility.visible')).toBeTruthy();
    expect(getByTestId('screen.search.modal')).toBeTruthy();
  });
});

describe('MultiModalSearch 锚点', () => {
  const mount = (props = {}) => render(
    React.createElement(MultiModalSearch, {
      navigation: mockNavigation,
      onSearch: jest.fn(),
      onCancel: jest.fn(),
      searchScope: 'home',
      initialQuery: '',
      ...props,
    }),
  );

  it('文本模式提供弹层根锚点、输入锚点与提交锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('screen.search.modal')).toBeTruthy();
    expect(getByTestId('action.search.modal.back')).toBeTruthy();
    expect(getByTestId('input.search.modal.query')).toBeTruthy();
    expect(getByTestId('action.search.modal.submit')).toBeTruthy();
    expect(getByTestId('filter.search.modal.mode.text')).toBeTruthy();
    expect(getByTestId('filter.search.modal.mode.voice')).toBeTruthy();
    expect(getByTestId('filter.search.modal.mode.image')).toBeTruthy();
  });

  it('提供弹层状态锚点（作用域/模式/查询/历史/错误）', () => {
    const { getByTestId } = mount({ searchScope: 'category' });

    expect(getByTestId('state.search.modal.scope.category')).toBeTruthy();
    expect(getByTestId('state.search.modal.mode.text')).toBeTruthy();
    expect(getByTestId('state.search.modal.query.empty.true')).toBeTruthy();
    expect(getByTestId('state.search.modal.error.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.search.modal.loading.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.search.modal.image.selected.false')).toBeTruthy();
    expect(getByTestId('state.search.modal.voice.listening.false')).toBeTruthy();
  });

  it('空查询提交仍走原有错误分支，并暴露错误态锚点', () => {
    const onSearch = jest.fn();
    const { getByTestId } = mount({ onSearch });

    fireEvent.press(getByTestId('action.search.modal.submit'));

    expect(getByTestId('state.search.modal.error.visibility.visible')).toBeTruthy();
    expect(getByTestId('state.search.modal.error')).toBeTruthy();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('输入关键词后提交仍然按原有回调签名回调（行为不变）', async () => {
    const onSearch = jest.fn();
    const { getByTestId } = mount({ onSearch });

    fireEvent.changeText(getByTestId('input.search.modal.query'), '锚点');

    expect(getByTestId('state.search.modal.query.empty.false')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('action.search.modal.submit'));
    });

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalled();
    });

    expect(onSearch.mock.calls[0][1]).toBe('锚点');
    expect(searchSlice.addToSearchHistory).toHaveBeenCalled();
  });

  it('语音模式提供录制/播放/提交锚点', async () => {
    mockReduxState.search.mode = 'voice';
    const { getByTestId, unmount } = mount();

    expect(getByTestId('state.search.modal.mode.voice')).toBeTruthy();
    expect(getByTestId('panel.search.modal.voiceSearch')).toBeTruthy();
    expect(getByTestId('action.search.modal.voice.toggle')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('action.search.modal.voice.toggle'));
    });

    await waitFor(() => {
      expect(getByTestId('state.search.modal.voice.listening.true')).toBeTruthy();
    });

    // 关闭录音计时器，保持测试环境干净
    await act(async () => {
      fireEvent.press(getByTestId('action.search.modal.voice.toggle'));
    });

    unmount();
  });

  it('图片模式提供拍照/相册/清除/提交锚点', () => {
    mockReduxState.search.mode = 'image';
    const { getByTestId } = mount();

    expect(getByTestId('state.search.modal.mode.image')).toBeTruthy();
    expect(getByTestId('panel.search.modal.imageSearch')).toBeTruthy();
    expect(getByTestId('panel.search.modal.imageSource')).toBeTruthy();
    expect(getByTestId('action.search.modal.image.camera')).toBeTruthy();
    expect(getByTestId('action.search.modal.image.gallery')).toBeTruthy();
  });

  it('历史与建议面板提供锚点，快速历史项带可预测下标', async () => {
    const { getByTestId } = mount();

    await waitFor(() => {
      expect(getByTestId('item.searchHistory.quick.0')).toBeTruthy();
    });

    expect(getByTestId('item.searchHistory.quick.1')).toBeTruthy();
    expect(getByTestId('panel.search.modal.quickHistory')).toBeTruthy();
    expect(getByTestId('panel.search.modal.history')).toBeTruthy();
    expect(getByTestId('state.search.modal.history.count.2')).toBeTruthy();
  });
});

describe('SearchHistory 锚点', () => {
  it('有历史时提供面板根、清除操作与历史项锚点', () => {
    const { getByTestId } = render(
      React.createElement(SearchHistory, { onHistoryItemPress: jest.fn(), visible: true }),
    );

    expect(getByTestId('panel.search.history')).toBeTruthy();
    expect(getByTestId('list.searchHistory')).toBeTruthy();
    expect(getByTestId('action.search.history.clear')).toBeTruthy();
    expect(getByTestId('item.searchHistory.0')).toBeTruthy();
    expect(getByTestId('item.searchHistory.1')).toBeTruthy();
  });

  it('点击历史项仍然回调原始对象（行为不变）', () => {
    const onHistoryItemPress = jest.fn();
    const { getByTestId } = render(
      React.createElement(SearchHistory, { onHistoryItemPress, visible: true }),
    );

    fireEvent.press(getByTestId('item.searchHistory.1'));

    expect(onHistoryItemPress).toHaveBeenCalledWith(mockAsyncHistory[1]);
  });

  it('点击清除仍然弹确认框（行为不变）', () => {
    const { getByTestId } = render(
      React.createElement(SearchHistory, { onHistoryItemPress: jest.fn(), visible: true }),
    );

    fireEvent.press(getByTestId('action.search.history.clear'));

    expect(mockRN.Alert.alert).toHaveBeenCalled();
  });

  it('无历史时提供空态锚点', () => {
    mockReduxState.search.history = [];
    const { getByTestId } = render(
      React.createElement(SearchHistory, { onHistoryItemPress: jest.fn(), visible: true }),
    );

    expect(getByTestId('state.search.history.empty')).toBeTruthy();
  });
});

describe('SearchSuggestions 锚点', () => {
  it('有建议时提供面板与建议项锚点', () => {
    mockReduxState.search.suggestions = [{ text: '建议一' }, { text: '建议二' }];

    const { getByTestId } = render(
      React.createElement(SearchSuggestions, {
        query: '锚点',
        onSuggestionPress: jest.fn(),
        visible: true,
      }),
    );

    expect(getByTestId('panel.search.suggestions')).toBeTruthy();
    expect(getByTestId('list.searchSuggestions')).toBeTruthy();
    expect(getByTestId('item.searchSuggestion.0')).toBeTruthy();
    expect(getByTestId('item.searchSuggestion.1')).toBeTruthy();
  });

  it('加载与错误状态提供状态锚点', () => {
    mockReduxState.search.isFetchingSuggestions = true;

    const loading = render(
      React.createElement(SearchSuggestions, { query: '锚点', visible: true }),
    );

    expect(loading.getByTestId('state.search.suggestions.loading')).toBeTruthy();
    loading.unmount();

    mockReduxState.search.isFetchingSuggestions = false;
    mockReduxState.search.suggestionsError = '建议加载失败';

    const failed = render(
      React.createElement(SearchSuggestions, { query: '锚点', visible: true }),
    );

    expect(failed.getByTestId('state.search.suggestions.error')).toBeTruthy();
  });
});

describe('SearchResults 组件锚点', () => {
  const results = [
    { id: 'note-1', type: 'note', title: '示例笔记' },
    { id: 'user-1', type: 'user', nickname: '示例用户' },
  ];

  it('提供面板根锚点、类型筛选锚点与结果项锚点', () => {
    const { getByTestId } = render(
      React.createElement(SearchResults, {
        results,
        isLoading: false,
        error: null,
        onResultPress: jest.fn(),
        navigation: mockNavigation,
      }),
    );

    expect(getByTestId('panel.search.results')).toBeTruthy();
    expect(getByTestId('list.search.results')).toBeTruthy();
    expect(getByTestId('panel.search.results.filters')).toBeTruthy();
    expect(getByTestId('filter.search.results.all')).toBeTruthy();
    expect(getByTestId('filter.search.results.note')).toBeTruthy();
    expect(getByTestId('filter.search.results.user')).toBeTruthy();
    expect(getByTestId('item.searchResult.note.note-1')).toBeTruthy();
    expect(getByTestId('item.searchResult.user.user-1')).toBeTruthy();
    expect(getByTestId('state.search.results.count.2')).toBeTruthy();
    expect(getByTestId('state.search.results.filter.all')).toBeTruthy();
  });

  it('类型筛选仍然只影响展示过滤（行为不变）', () => {
    const { getByTestId, queryByTestId } = render(
      React.createElement(SearchResults, {
        results,
        isLoading: false,
        error: null,
        onResultPress: jest.fn(),
        navigation: mockNavigation,
      }),
    );

    fireEvent.press(getByTestId('filter.search.results.note'));

    expect(getByTestId('state.search.results.filter.note')).toBeTruthy();
    expect(getByTestId('state.search.results.count.1')).toBeTruthy();
    expect(queryByTestId('item.searchResult.user.user-1')).toBeNull();
  });

  it('加载、错误与空态提供状态锚点', () => {
    const loading = render(
      React.createElement(SearchResults, { results: [], isLoading: true, error: null }),
    );
    expect(loading.getByTestId('state.search.results.loading')).toBeTruthy();
    loading.unmount();

    const failed = render(
      React.createElement(SearchResults, { results: [], isLoading: false, error: '搜索失败' }),
    );
    expect(failed.getByTestId('state.search.results.error')).toBeTruthy();
    failed.unmount();

    const empty = render(
      React.createElement(SearchResults, { results: [], isLoading: false, error: null }),
    );
    expect(empty.getByTestId('state.search.results.empty')).toBeTruthy();
  });
});

describe('SearchFilters 锚点', () => {
  it('提供面板根锚点与各筛选项锚点', () => {
    const { getByTestId } = render(
      React.createElement(SearchFilters, { onApplyFilters: jest.fn(), initialFilters: {} }),
    );

    expect(getByTestId('panel.search.filters')).toBeTruthy();
    expect(getByTestId('filter.search.filters.contentType')).toBeTruthy();
    expect(getByTestId('filter.search.filters.tags')).toBeTruthy();
    expect(getByTestId('filter.search.filters.dateFrom')).toBeTruthy();
    expect(getByTestId('filter.search.filters.dateTo')).toBeTruthy();
    expect(getByTestId('filter.search.filters.sortBy')).toBeTruthy();
    expect(getByTestId('action.search.filters.reset')).toBeTruthy();
    expect(getByTestId('action.search.filters.apply')).toBeTruthy();
    expect(getByTestId('state.search.filters.contentType.all')).toBeTruthy();
    expect(getByTestId('state.search.filters.sortBy.relevance')).toBeTruthy();
  });

  it('弹窗与选项提供 modal./option. 锚点', () => {
    const { getByTestId } = render(
      React.createElement(SearchFilters, { onApplyFilters: jest.fn(), initialFilters: {} }),
    );

    expect(getByTestId('modal.search.filters.tags')).toBeTruthy();
    expect(getByTestId('modal.search.filters.type')).toBeTruthy();
    expect(getByTestId('modal.search.filters.sort')).toBeTruthy();
    expect(getByTestId('action.search.filters.tags.close')).toBeTruthy();
    expect(getByTestId('action.search.filters.tags.clear')).toBeTruthy();
    expect(getByTestId('action.search.filters.tags.confirm')).toBeTruthy();
    expect(getByTestId('action.search.filters.type.close')).toBeTruthy();
    expect(getByTestId('action.search.filters.sort.close')).toBeTruthy();
    expect(getByTestId('option.search.filters.type.note')).toBeTruthy();
    expect(getByTestId('option.search.filters.sort.date_desc')).toBeTruthy();
    expect(getByTestId('option.search.filters.tag.1')).toBeTruthy();
  });

  it('选择内容类型后状态锚点跟随变化，应用过滤器仍然回调（行为不变）', () => {
    const onApplyFilters = jest.fn();
    const { getByTestId } = render(
      React.createElement(SearchFilters, { onApplyFilters, initialFilters: {} }),
    );

    fireEvent.press(getByTestId('filter.search.filters.contentType'));
    expect(getByTestId('state.search.filters.typeModal.visibility.visible')).toBeTruthy();

    fireEvent.press(getByTestId('option.search.filters.type.note'));

    expect(getByTestId('state.search.filters.contentType.note')).toBeTruthy();
    expect(getByTestId('state.search.filters.typeModal.visibility.hidden')).toBeTruthy();

    fireEvent.press(getByTestId('action.search.filters.apply'));

    expect(onApplyFilters).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'note' }));
  });

  it('标签筛选与重置仍然按原有逻辑工作（行为不变）', () => {
    const { getByTestId } = render(
      React.createElement(SearchFilters, { onApplyFilters: jest.fn(), initialFilters: {} }),
    );

    fireEvent.press(getByTestId('filter.search.filters.tags'));
    expect(getByTestId('state.search.filters.tagsModal.visibility.visible')).toBeTruthy();

    fireEvent.press(getByTestId('option.search.filters.tag.1'));
    expect(getByTestId('state.search.filters.tags.count.1')).toBeTruthy();

    fireEvent.press(getByTestId('action.search.filters.tags.clear'));
    expect(getByTestId('state.search.filters.tags.count.0')).toBeTruthy();

    fireEvent.press(getByTestId('action.search.filters.reset'));
    expect(getByTestId('state.search.filters.contentType.all')).toBeTruthy();
  });
});
