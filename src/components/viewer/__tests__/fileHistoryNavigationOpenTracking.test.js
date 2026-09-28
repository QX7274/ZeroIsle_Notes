/**
 * WS-W 回归：文件历史直达入口记录「最近访问」。
 *
 * 背景：从文件历史列表点击条目会直接 navigation.navigate 到对应查看器，
 * 此前不写 last_opened_at，导致「最近访问」排序缺少这条路径的数据。
 *
 * 覆盖：
 * 1. 笔记类条目（noteId/noteType 存在）-> 写访问时间，且跳转参数不变；
 * 2. 纯文件条目（无 noteId/noteType）-> 不写（负向），跳转行为不变；
 * 3. 点击「当前文件」-> 早退：既不写也不跳转（既有行为不变）；
 * 4. onFileSelect 委托路径 -> 先记录访问时间再交给上层，行为不变。
 *
 * 单字段写入 / 守卫（temp_、空 id、Note 不存在）由 getNotes 的单测覆盖，
 * 这里用 spy 只验证入口接线与参数。
 */

const React = require('react');
const { render, fireEvent } = require('@testing-library/react-native');

const mockColors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  card: '#FFFFFF',
  text: '#111111',
  onSurface: '#111111',
  onSurfaceVariant: '#666666',
  primary: '#2196F3',
  primaryContainer: '#E3F2FD',
  onPrimaryContainer: '#0D47A1',
  outline: '#DDDDDD',
  border: '#DDDDDD',
  error: '#DC2626',
};

const mockUseTheme = () => ({ colors: mockColors, theme: { colors: mockColors }, isDarkMode: false });

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

const mockFileHistoryService = {
  getHistory: jest.fn(() => []),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  removeFile: jest.fn(),
  removeFileByNoteId: jest.fn(),
};

jest.mock('../../../services/fileHistoryService', () => ({
  __esModule: true,
  get default() {
    return mockFileHistoryService;
  },
}));

// 只把写入入口换成 spy，其余实现保持真实（避免影响同目录其它行为）
jest.mock('../../../services/offline/getNotes', () => {
  const actual = jest.requireActual('../../../services/offline/getNotes');
  return { ...actual, markNoteOpenedAt: jest.fn(() => Promise.resolve(true)) };
});

const FileHistoryNavigation = require('../FileHistoryNavigation').default;
const getNotesModule = require('../../../services/offline/getNotes');

/** 笔记类条目：addFile 对笔记条目写入 id = noteId、noteId = noteId */
const NOTE_ENTRY = {
  id: 'note-history-1',
  noteId: 'note-history-1',
  title: '历史笔记一',
  fileName: '历史笔记一',
  type: 'note',
  noteType: 'card',
};

const PAGED_ENTRY = {
  id: 'note-history-2',
  noteId: 'note-history-2',
  title: '历史分页',
  fileName: '历史分页',
  type: 'note',
  noteType: 'paged_note',
};

/** 纯文件条目：没有 noteId / noteType，id 是 addFile 生成的 ObjectId */
const FILE_ENTRY = {
  id: 'generated-object-id',
  title: 'raw.pdf',
  fileName: 'raw.pdf',
  type: 'pdf',
};

/** 当前打开的笔记：点击应早退 */
const CURRENT_ENTRY = {
  id: 'current-note',
  noteId: 'current-note',
  title: '当前笔记',
  fileName: '当前笔记',
  noteType: 'card',
};

const createNavigation = () => ({ navigate: jest.fn() });

const mount = (props = {}) => {
  const navigation = createNavigation();
  const utils = render(React.createElement(FileHistoryNavigation, {
    noteId: 'current-note',
    navigation,
    ...props,
  }));
  return { ...utils, navigation };
};

describe('FileHistoryNavigation 直达记录最近访问（WS-W）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileHistoryService.getHistory.mockReturnValue([
      NOTE_ENTRY,
      PAGED_ENTRY,
      FILE_ENTRY,
      CURRENT_ENTRY,
    ]);
    mockFileHistoryService.addListener.mockImplementation(() => {});
    mockFileHistoryService.removeListener.mockImplementation(() => {});
  });

  test('点击笔记类条目：写访问时间，且跳转参数不变（CardNote）', () => {
    const { getByText, navigation } = mount();

    fireEvent.press(getByText('历史笔记一'));

    expect(getNotesModule.markNoteOpenedAt).toHaveBeenCalledTimes(1);
    expect(getNotesModule.markNoteOpenedAt).toHaveBeenCalledWith('note-history-1');
    expect(navigation.navigate).toHaveBeenCalledWith(
      'CardNote',
      expect.objectContaining({ noteId: 'note-history-1', fromFileHistory: true }),
    );
  });

  test('点击分页笔记条目：写访问时间，且跳转参数不变（FluidPagedNote）', () => {
    const { getByText, navigation } = mount();

    fireEvent.press(getByText('历史分页'));

    expect(getNotesModule.markNoteOpenedAt).toHaveBeenCalledWith('note-history-2');
    expect(navigation.navigate).toHaveBeenCalledWith(
      'FluidPagedNote',
      expect.objectContaining({ noteId: 'note-history-2', fromFileHistory: true }),
    );
  });

  test('纯文件条目（无 noteId/noteType）：不写访问时间，但跳转行为不变', () => {
    const { getByText, navigation } = mount();

    fireEvent.press(getByText('raw.pdf'));

    expect(getNotesModule.markNoteOpenedAt).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith(
      'PDFViewer',
      expect.objectContaining({ noteId: 'generated-object-id', fromFileHistory: true }),
    );
  });

  test('点击当前文件：早退，既不写访问时间也不跳转（既有行为不变）', () => {
    const { getByText, navigation } = mount();

    fireEvent.press(getByText('当前笔记'));

    expect(getNotesModule.markNoteOpenedAt).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test('onFileSelect 委托路径：先记录访问时间，再交给上层处理', () => {
    const onFileSelect = jest.fn();
    const { getByText, navigation } = mount({ onFileSelect });

    fireEvent.press(getByText('历史分页'));

    expect(getNotesModule.markNoteOpenedAt).toHaveBeenCalledWith('note-history-2');
    expect(onFileSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'note-history-2' }));
    // 有 onFileSelect 时不由本组件导航（既有行为不变）
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
