/**
 * ViewerLayout 工具栏 mode 传递回归（只读断言，不改动被测组件）
 *
 * 背景：ViewerLayout 把 mode 拆成了两个来源 —— 显式 toolbarMode prop
 * 与 toolbarProps.mode。二者并存时若有歧义，PDF / 分页 / Markdown 查看器
 * 会出现「工具栏显示了错误的工具组」这类难查的问题。
 * 本文件锁定第 74~81 行的优先级：toolbarProps.mode || toolbarMode || 'canvas'。
 */

const React = require('react');
const { render } = require('@testing-library/react-native');

// ViewerLayout 只做布局转发，真正的工具栏被替换成探针组件，
// 这样断言的是「mode 到底传了什么」，而不是工具栏内部的可见性逻辑。
let lastToolbarProps = null;
jest.mock('../../common/AllInOneToolbar', () => {
  return {
    __esModule: true,
    default: (props) => {
      lastToolbarProps = props;
      return null;
    },
  };
});

jest.mock('../FileHistoryNavigation', () => ({
  __esModule: true,
  default: () => null,
}));

const ViewerLayout = require('../ViewerLayout').default;

const baseProps = {
  colors: { background: '#FFFFFF', surface: '#FFFFFF', text: '#111111' },
  children: null,
};

const renderLayout = (props = {}) => render(
  React.createElement(ViewerLayout, { ...baseProps, ...props }),
);

describe('ViewerLayout 工具栏 mode 传递', () => {
  beforeEach(() => {
    lastToolbarProps = null;
  });

  it('未传 mode 时回落 canvas', () => {
    renderLayout();
    expect(lastToolbarProps).not.toBeNull();
    expect(lastToolbarProps.mode).toBe('canvas');
  });

  it('只有 toolbarProps.mode 时使用它', () => {
    renderLayout({ toolbarProps: { mode: 'pdf' } });
    expect(lastToolbarProps.mode).toBe('pdf');
  });

  it('只有 toolbarMode 时使用它', () => {
    renderLayout({ toolbarMode: 'paged' });
    expect(lastToolbarProps.mode).toBe('paged');
  });

  it('两者同时存在时 toolbarProps.mode 优先（先展开者被后者覆盖）', () => {
    renderLayout({ toolbarMode: 'paged', toolbarProps: { mode: 'markdown' } });
    expect(lastToolbarProps.mode).toBe('markdown');
  });

  // 下面两条原先锁定的是「缺陷现状」：早先 ViewerLayout 把 mode 表达式写在
  // {...toolbarProps} 之前，于是 toolbarProps 里只要「存在 mode 键」，哪怕值是 '' 或 null，
  // 也会覆盖整条回退链，调用点漏传/传空时工具栏会静默按 canvas 渲染。
  // Lead 已把展开顺序改为「先 {...toolbarProps}、后显式 mode」，这里同步翻正为期望行为。
  it('toolbarProps.mode 为空字符串时回退到 toolbarMode', () => {
    renderLayout({ toolbarMode: 'file-viewer', toolbarProps: { mode: '' } });
    expect(lastToolbarProps.mode).toBe('file-viewer');
  });

  it('toolbarProps.mode 为 null 时回退到 toolbarMode', () => {
    renderLayout({ toolbarMode: 'paged', toolbarProps: { mode: null } });
    expect(lastToolbarProps.mode).toBe('paged');
  });

  it('toolbarProps.mode 与 toolbarMode 都缺失时回退到 canvas', () => {
    renderLayout({ toolbarProps: {} });
    expect(lastToolbarProps.mode).toBe('canvas');
  });

  it('toolbarProps 不含 mode 键时表达式中的回落在场（toolbarProps.mode === undefined）', () => {
    renderLayout({ toolbarMode: 'paged', toolbarProps: {} });
    expect(lastToolbarProps.mode).toBe('paged');
  });

  it('toolbarProps 其它字段被原样透传（展开顺序不破坏 props）', () => {
    const onToolConfigChange = jest.fn();
    renderLayout({ toolbarProps: { mode: 'canvas', onToolConfigChange, canUndo: true } });
    expect(lastToolbarProps.onToolConfigChange).toBe(onToolConfigChange);
    expect(lastToolbarProps.canUndo).toBe(true);
  });

  it('showExternalToolbar=false 时不渲染工具栏', () => {
    renderLayout({ showExternalToolbar: false });
    expect(lastToolbarProps).toBeNull();
  });
});
