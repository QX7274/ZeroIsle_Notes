/**
 * 社区链路锚点回归测试（GAP-MOBILE-001 / GAP-UI-COMMUNITY-001 / ACC-COM-001）
 *
 * 目的：为 uiautomator 自动化取证提供稳定 testID 锚点回归，
 * 覆盖「社区主页」(CommunityScreen)、「社区搜索页」(CommunitySearchScreen)、
 * 「帖子详情页」(PostDetailScreen)、「创建帖子页」(CreatePostScreen)
 * 以及社区搜索入口「统一搜索栏」(UnifiedSearchBar, searchScope=community)。
 *
 * 约定：
 * - 断言只依赖锚点命名，不依赖中文文案，避免文案调整导致用例失效。
 * - 仅在测试内补齐 jestSetup 整体 mock 掉的 react-native 宿主组件
 *   （KeyboardAvoidingView / FlatList 等），不触碰任何业务逻辑。
 * - 重依赖（网络、Realm、Redux store、导航、社区搜索组件）做最小 mock，
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
// react-native 宿主组件补桩（与 searchAnchors.test.js 同一手法，仅补齐缺失宿主）
// ---------------------------------------------------------------------------
const mockRN = require('react-native');

mockRN.KeyboardAvoidingView = 'KeyboardAvoidingView';
mockRN.Keyboard = { dismiss: jest.fn() };
mockRN.BackHandler = {
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
};
mockRN.Alert = { alert: jest.fn() };
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

  const emptyRow = rows.length === 0 ? toElement(ListEmptyComponent, 'empty') : null;

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
  getParent: jest.fn(() => undefined),
};

const mockDispatch = jest.fn((action) => {
  const result = Promise.resolve(action);
  result.unwrap = () => Promise.resolve(action && action.payload !== undefined ? action.payload : action);
  return result;
});

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector) => selector(mockReduxState),
}));

jest.mock('@react-navigation/native', () => {
  const ReactMock = require('react');
  return {
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback) => ReactMock.useEffect(callback, []),
  };
});

jest.mock('react-native-paper', () => ({
  Portal: ({ children }) => children,
}));

jest.mock('../../../components/common', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  const stub = (props) => ReactMock.createElement(RN.View, props, props.children);
  return { Card: stub, Button: stub, Skeleton: stub, EmptyState: stub };
});

jest.mock('../../../components/common/ToastHelper', () => ({
  showToast: { error: jest.fn(), success: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

jest.mock('../../../components/common/Typography', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  const Text = (props) => ReactMock.createElement(RN.Text, props, props.children);
  return { Text, Heading: Text, default: Text };
});

jest.mock('../../../components/common/AdvancedMarkdownPreview', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  return (props) => ReactMock.createElement(RN.View, props);
});

jest.mock('../../../utils/haptics', () => ({
  lightFeedback: jest.fn(),
  mediumFeedback: jest.fn(),
  heavyFeedback: jest.fn(),
  successFeedback: jest.fn(),
  errorFeedback: jest.fn(),
}));

jest.mock('react-native-document-picker', () => ({
  __esModule: true,
  default: { pick: jest.fn(async () => []), types: { allFiles: '*/*' } },
}));

jest.mock('../../../services/network/networkService', () => ({
  __esModule: true,
  default: {
    checkConnection: jest.fn(async () => true),
    isConnected: jest.fn(async () => true),
  },
}));

jest.mock('../../../services/networkErrorService', () => ({
  __esModule: true,
  default: {
    isNetworkError: jest.fn(() => false),
    handleApiError: jest.fn(),
    showNetworkError: jest.fn(),
  },
}));

jest.mock('../../../services/database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn(async () => ({
      objects: jest.fn(() => ({ filtered: jest.fn(() => []), sorted: jest.fn(() => []), toJSON: () => [] })),
      objectForPrimaryKey: jest.fn(() => null),
      write: jest.fn((fn) => fn()),
    })),
  },
}));

jest.mock('../../../services/auth/devSessionRestore', () => ({
  __esModule: true,
  default: jest.fn(async () => null),
}));

jest.mock('../../../redux/slices/communitySlice', () => ({
  fetchPosts: jest.fn((payload) => ({ type: 'community/fetchPosts', payload })),
  fetchPostDetail: jest.fn((payload) => ({ type: 'community/fetchPostDetail', payload })),
  fetchComments: jest.fn((payload) => ({ type: 'community/fetchComments', payload })),
  createPost: jest.fn((payload) => ({ type: 'community/createPost', payload })),
  likePost: jest.fn((payload) => ({ type: 'community/likePost', payload })),
  toggleBookmark: jest.fn((payload) => ({ type: 'community/toggleBookmark', payload })),
  postComment: jest.fn((payload) => ({ type: 'community/postComment', payload })),
  toggleUserFollow: jest.fn((payload) => ({ type: 'community/toggleUserFollow', payload })),
  toggleCommentLike: jest.fn((payload) => ({ type: 'community/toggleCommentLike', payload })),
}));

jest.mock('../../../redux/slices/notesSlice', () => ({
  fetchCategories: jest.fn((payload) => ({ type: 'notes/fetchCategories', payload })),
}));

jest.mock('../../../redux/slices/tagsSlice', () => ({
  fetchTags: jest.fn((payload) => ({ type: 'tags/fetchTags', payload })),
  selectAllTags: (state) => state.tags.allTags,
}));

jest.mock('../../../redux/slices/authSlice', () => ({
  setAuthRefreshToken: jest.fn((payload) => ({ type: 'auth/setAuthRefreshToken', payload })),
  setAuthToken: jest.fn((payload) => ({ type: 'auth/setAuthToken', payload })),
  setIsAuthenticated: jest.fn((payload) => ({ type: 'auth/setIsAuthenticated', payload })),
  setUserInfo: jest.fn((payload) => ({ type: 'auth/setUserInfo', payload })),
}));

jest.mock('../../../redux/slices/searchSlice', () => ({
  search: jest.fn((payload) => ({ type: 'search/search', payload })),
  clearSearchResults: jest.fn(() => ({ type: 'search/clearSearchResults' })),
  addToSearchHistory: jest.fn((payload) => ({ type: 'search/addToSearchHistory', payload })),
  fetchSearchHistory: jest.fn((payload) => ({ type: 'search/fetchSearchHistory', payload })),
  clearSearchHistoryAsync: jest.fn(() => ({ type: 'search/clearSearchHistoryAsync' })),
  selectSearchResults: (state) => state.search.results,
  selectIsLoading: (state) => state.search.isLoading,
  selectError: (state) => state.search.error,
  selectSearchHistory: (state) => state.search.history,
  selectSearchMode: (state) => state.search.mode,
}));

// 社区页只关心搜索组件是否被挂载，锚点回归由 searchAnchors.test.js 覆盖，
// 因此这里对搜索组件做占位替身，隔离重型依赖。
jest.mock('../../../components/search', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  const UnifiedSearchBar = (props) => ReactMock.createElement(RN.View, { testID: `stub.searchBar.${props.searchScope}` });
  const SearchResults = () => ReactMock.createElement(RN.View, { testID: 'stub.searchResults' });
  const SearchHistory = () => ReactMock.createElement(RN.View, { testID: 'stub.searchHistory' });
  const MultiModalSearch = () => ReactMock.createElement(RN.View, { testID: 'stub.multiModalSearch' });
  return {
    UnifiedSearchBar,
    SearchResults,
    SearchHistory,
    MultiModalSearch,
    SearchSuggestions: MultiModalSearch,
    default: { UnifiedSearchBar, SearchResults, SearchHistory },
  };
});

jest.mock('../../../components/search/MultiModalSearch', () => {
  const ReactMock = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: (props) => ReactMock.createElement(RN.View, { testID: 'stub.multiModalSearch', ...props }),
  };
});

let mockReduxState = {};

const resetReduxState = () => {
  mockReduxState = {
    auth: { isAuthenticated: true, user: { id: '1', nickname: '测试用户' } },
    tags: { allTags: [] },
    notes: { categories: [] },
    search: {
      results: [],
      isLoading: false,
      error: null,
      history: [],
      mode: 'text',
    },
    community: {
      posts: [
        {
          id: 'post-1',
          title: '示例帖子标题',
          preview: '示例帖子摘要',
          author: '示例作者',
          authorAvatar: '',
          timestamp: '2026-01-01T00:00:00.000Z',
          likes: 3,
          comments: 2,
          downloads: 1,
          tags: ['学习'],
          category: 'learning',
        },
      ],
      currentPost: {
        id: 'post-1',
        title: '示例帖子标题',
        content: '示例帖子正文',
        author: '示例作者',
        authorId: 'user-1',
        comments: 2,
        likes: 3,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      comments: [
        {
          id: 'comment-1',
          content: '示例评论',
          author: '评论者',
          created_at: '2026-01-01T01:00:00.000Z',
          like_count: 0,
          is_liked: false,
          replies: [],
        },
      ],
      commentsPagination: { page: 1, totalPages: 1, totalItems: 1 },
      isLoading: false,
      error: null,
      likedPosts: {},
      bookmarkedPosts: {},
      likedComments: {},
      followedUsers: {},
      pagination: { page: 1, totalPages: 1, totalItems: 1 },
    },
  };
};

resetReduxState();

// 被测组件（require 必须晚于上面的 mock 变量初始化）
const CommunityScreen = require('../CommunityScreen').default;
const CommunitySearchScreen = require('../CommunitySearchScreen').default;
const PostDetailScreen = require('../PostDetailScreen').default;
const CreatePostScreen = require('../CreatePostScreen').default;
const UnifiedSearchBar = require('../../../components/search/UnifiedSearchBar').default;

beforeEach(() => {
  jest.clearAllMocks();
  resetReduxState();
});

describe('CommunityScreen 锚点', () => {
  const mount = () => render(
    React.createElement(CommunityScreen, { navigation: mockNavigation, route: { params: {} } }),
  );

  it('提供页面根锚点与帖子列表锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('screen.community')).toBeTruthy();
    expect(getByTestId('state.community.pageState.ready')).toBeTruthy();
    expect(getByTestId('state.community.posts.count.1')).toBeTruthy();
    expect(getByTestId('list.community.posts')).toBeTruthy();
    expect(getByTestId('item.community.post.post-1')).toBeTruthy();
  });

  it('提供点赞/收藏/发布/刷新等关键操作锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('action.community.like.post-1')).toBeTruthy();
    expect(getByTestId('action.community.bookmark.post-1')).toBeTruthy();
    expect(getByTestId('action.community.createPost')).toBeTruthy();
    expect(getByTestId('action.community.refresh')).toBeTruthy();
    expect(getByTestId('action.community.notifications')).toBeTruthy();
    expect(getByTestId('action.community.activity')).toBeTruthy();
  });

  it('提供分类筛选锚点与状态锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('filter.community.all')).toBeTruthy();
    expect(getByTestId('filter.community.learning')).toBeTruthy();
    expect(getByTestId('state.community.activeCategory.all')).toBeTruthy();
    expect(getByTestId('state.community.posts.count.1')).toBeTruthy();
    expect(getByTestId('state.community.actionSource.visibility.hidden')).toBeTruthy();
  });

  it('搜索入口仍然挂载社区作用域的搜索栏（行为不变）', () => {
    const { getByTestId } = mount();

    expect(getByTestId('stub.searchBar.community')).toBeTruthy();
  });

  it('点击点赞锚点仍然派发原有 action（行为不变）', async () => {
    const { getByTestId } = mount();

    // 首屏请求期间交互按钮处于忙碌禁用态，等待请求释放后再点击
    await waitFor(() => {
      expect(getByTestId('state.community.busy.visibility.hidden')).toBeTruthy();
    });

    fireEvent.press(getByTestId('action.community.like.post-1'));

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'community/likePost' }));
  });
});

describe('CommunitySearchScreen 锚点', () => {
  const mount = (params = {}) => render(
    React.createElement(CommunitySearchScreen, { navigation: mockNavigation, route: { params } }),
  );

  it('提供页面根锚点、返回锚点与搜索栏挂载点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('screen.community.search')).toBeTruthy();
    expect(getByTestId('action.community.search.back')).toBeTruthy();
    expect(getByTestId('panel.community.search.header')).toBeTruthy();
    expect(getByTestId('panel.community.search.input')).toBeTruthy();
    expect(getByTestId('stub.searchBar.community')).toBeTruthy();
  });

  it('提供页面状态锚点（是否搜索过/历史/加载/错误/结果数）', () => {
    const { getByTestId } = mount();

    expect(getByTestId('state.community.search.performed.false')).toBeTruthy();
    expect(getByTestId('state.community.search.history.visibility.visible')).toBeTruthy();
    expect(getByTestId('state.community.search.loading.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.community.search.error.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.community.search.results.count.0')).toBeTruthy();
    expect(getByTestId('state.community.search.results.visibility.hidden')).toBeTruthy();
    expect(getByTestId('state.community.search.helper.visibility.visible')).toBeTruthy();
  });

  it('未搜索时展示历史面板，已搜索时展示结果面板', () => {
    const idle = mount();
    expect(idle.getByTestId('panel.community.search.helper')).toBeTruthy();
    expect(idle.getByTestId('panel.community.search.history')).toBeTruthy();
    idle.unmount();

    const searched = mount({ query: '示例', searchPerformed: true, results: [] });
    expect(searched.getByTestId('state.community.search.performed.true')).toBeTruthy();
    expect(searched.getByTestId('panel.community.search.results')).toBeTruthy();
    expect(searched.getByTestId('stub.searchResults')).toBeTruthy();
  });

  it('按帖子/用户/标签分别暴露结果计数锚点', () => {
    const { getByTestId } = mount({
      query: '示例',
      results: [
        { id: 'post-1', type: 'post', title: '示例帖子' },
        { id: 'user-1', type: 'user', nickname: '示例用户' },
      ],
    });

    expect(getByTestId('state.community.search.results.count.2')).toBeTruthy();
    expect(getByTestId('state.community.search.results.posts.count.1')).toBeTruthy();
    expect(getByTestId('state.community.search.results.users.count.1')).toBeTruthy();
    expect(getByTestId('state.community.search.results.tags.count.0')).toBeTruthy();
  });

  it('返回锚点仍然只触发 navigation.goBack（行为不变）', () => {
    const { getByTestId } = mount();

    fireEvent.press(getByTestId('action.community.search.back'));

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});

describe('社区搜索入口 UnifiedSearchBar（searchScope=community）', () => {
  it('提供入口操作锚点与 community 作用域状态锚点', () => {
    const { getByTestId } = render(
      React.createElement(UnifiedSearchBar, {
        searchScope: 'community',
        resultScreenName: 'CommunitySearch',
        disableAutoNavigate: true,
        onSearch: jest.fn(),
        onCancel: jest.fn(),
      }),
    );

    expect(getByTestId('action.search.bar.open')).toBeTruthy();
    expect(getByTestId('state.search.bar.scope.community')).toBeTruthy();
    expect(getByTestId('state.search.bar.modal.visibility.hidden')).toBeTruthy();
  });

  it('点击后展开多模态搜索弹层（行为不变）', () => {
    const { getByTestId } = render(
      React.createElement(UnifiedSearchBar, {
        searchScope: 'community',
        onSearch: jest.fn(),
        onCancel: jest.fn(),
      }),
    );

    fireEvent.press(getByTestId('action.search.bar.open'));

    expect(getByTestId('state.search.bar.modal.visibility.visible')).toBeTruthy();
    expect(getByTestId('stub.multiModalSearch')).toBeTruthy();
  });
});

describe('PostDetailScreen 锚点', () => {
  const mount = () => render(
    React.createElement(PostDetailScreen, {
      navigation: mockNavigation,
      route: { params: { postId: 'post-1' } },
    }),
  );

  it('提供页面根锚点与返回/点赞/收藏/分享/关注锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('screen.community.postDetail')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.back')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.like')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.bookmark')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.share')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.follow')).toBeTruthy();
  });

  it('提供评论输入与提交锚点（键盘输入区）', () => {
    const { getByTestId } = mount();

    expect(getByTestId('panel.community.postDetail.commentInput')).toBeTruthy();
    expect(getByTestId('input.community.postDetail.comment')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.submitComment')).toBeTruthy();
    expect(getByTestId('state.community.postDetail.commentText.empty.true')).toBeTruthy();
  });

  it('输入评论后草稿状态锚点跟随变化（行为不变）', () => {
    const { getByTestId } = mount();

    fireEvent.changeText(getByTestId('input.community.postDetail.comment'), '锚点评论');

    expect(getByTestId('state.community.postDetail.commentText.empty.false')).toBeTruthy();
    expect(getByTestId('state.community.postDetail.commentDraft.length.4')).toBeTruthy();
  });

  it('点击评论回复后展示回复横幅锚点与回复状态锚点', async () => {
    const { getByTestId } = mount();

    expect(getByTestId('state.community.postDetail.replying.false')).toBeTruthy();
    expect(getByTestId('state.community.postDetail.replyBanner.visibility.hidden')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('action.community.postDetail.commentReply.comment-1'));
    });

    await waitFor(() => {
      expect(getByTestId('state.community.postDetail.replying.true')).toBeTruthy();
    });

    expect(getByTestId('panel.community.postDetail.replyBanner')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.cancelReply')).toBeTruthy();

    fireEvent.press(getByTestId('action.community.postDetail.cancelReply'));
    expect(getByTestId('state.community.postDetail.replying.false')).toBeTruthy();
  });

  it('提供帖子与评论项锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('item.community.postDetail.comment.comment-1')).toBeTruthy();
    expect(getByTestId('action.community.postDetail.commentLike.comment-1')).toBeTruthy();
    expect(getByTestId('state.community.postDetail.comments.count.1')).toBeTruthy();
  });
});

describe('CreatePostScreen 锚点', () => {
  const mount = () => render(
    React.createElement(CreatePostScreen, { navigation: mockNavigation, route: { params: {} } }),
  );

  it('提供页面根锚点与创建帖子输入锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('screen.community.createPost')).toBeTruthy();
    expect(getByTestId('input.community.createPost.title')).toBeTruthy();
    expect(getByTestId('input.community.createPost.content')).toBeTruthy();
    expect(getByTestId('action.community.publishPost')).toBeTruthy();
    expect(getByTestId('action.community.backFromCreatePost')).toBeTruthy();
  });

  it('提供分类/标签/附件/可见性等操作锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('action.community.openCategoryPicker')).toBeTruthy();
    expect(getByTestId('action.community.openTagPicker')).toBeTruthy();
    expect(getByTestId('action.community.selectCoverImage')).toBeTruthy();
    expect(getByTestId('action.community.selectAttachments')).toBeTruthy();
    expect(getByTestId('action.community.togglePublic')).toBeTruthy();
    expect(getByTestId('action.community.toggleComments')).toBeTruthy();
  });

  it('提供创建帖子状态锚点与弹窗锚点', () => {
    const { getByTestId } = mount();

    expect(getByTestId('state.community.createPost.dialog.visibility.hidden')).toBeTruthy();
    expect(getByTestId('modal.community.createPost.dialog')).toBeTruthy();
    expect(getByTestId('action.community.createPost.dialog.primary')).toBeTruthy();
    expect(getByTestId('state.community.createPost.title.empty.true')).toBeTruthy();
    expect(getByTestId('state.community.createPost.content.empty.true')).toBeTruthy();
  });

  it('标签选择弹层提供关闭锚点', () => {
    const { getByTestId } = mount();

    fireEvent.press(getByTestId('action.community.openTagPicker'));

    expect(getByTestId('state.community.createPost.tagPicker.visibility.visible')).toBeTruthy();
    expect(getByTestId('panel.community.tagPicker')).toBeTruthy();
    expect(getByTestId('action.community.closeTagPicker')).toBeTruthy();

    fireEvent.press(getByTestId('action.community.closeTagPicker'));

    expect(getByTestId('state.community.createPost.tagPicker.visibility.hidden')).toBeTruthy();
  });

  it('分类选择弹层提供关闭锚点', () => {
    const { getByTestId } = mount();

    fireEvent.press(getByTestId('action.community.openCategoryPicker'));

    expect(getByTestId('state.community.createPost.categoryPicker.visibility.visible')).toBeTruthy();
    expect(getByTestId('panel.community.categoryPicker')).toBeTruthy();
    expect(getByTestId('action.community.closeCategoryPicker')).toBeTruthy();
  });

  it('标题为空时发布仍然弹出原有提示弹窗（行为不变）', async () => {
    const { getByTestId } = mount();

    await act(async () => {
      fireEvent.press(getByTestId('action.community.publishPost'));
    });

    expect(getByTestId('state.community.createPost.dialog.visibility.visible')).toBeTruthy();

    fireEvent.press(getByTestId('action.community.createPost.dialog.primary'));

    expect(getByTestId('state.community.createPost.dialog.visibility.hidden')).toBeTruthy();
  });
});
