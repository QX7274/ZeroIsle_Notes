/**
 * 里程碑 5.1 列表数据流契约（写入侧打标 -> 轻量 summary -> NoteItem 兼容层 -> 正文延迟加载）
 *
 * 为什么不直接渲染 HomeScreen：HomeScreen 依赖 React Native 运行时与大量原生模块，
 * 渲染测试成本高、且与本次「数据源切换」改动无关（改动点已在 HomeScreen.hooks.test.js 的
 * ESLint 校验与下面的数据流契约中覆盖）。因此这里对数据流做确定性断言：
 *
 * 1. summary 只含白名单小标量 + metadata 派生标记，绝不含 content/pages/strokeData；
 * 2. 投影过程与 NoteItem 读取过程都不会触发大字段 getter（getter 一旦被访问就计数并抛错）；
 * 3. 需要正文的路径通过注入的 getById 按 id 延迟加载（生产代码注入的正是 notesApi.getById，
 *    见 HomeScreen 的 resolveItemContent(item, notesApi.getById) 调用点）。
 */

const {
  NOTE_SUMMARY_FIELDS,
  toNoteSummary,
  materializeNoteSummaries,
} = require('../../../models/utils/noteProjection');
const {
  buildNotePreview,
  mergePreviewMetadata,
} = require('../../../models/utils/notePreview');
const {
  getItemPreviewText,
  itemHasContent,
  itemHasPages,
  itemHasStrokeData,
  getItemContentLikeText,
  isUntaggedSummary,
  resolveItemContent,
} = require('../noteItemProjection');

/** 列表侧绝不允许读取的大字段 */
const BIG_FIELDS = ['content', 'pages', 'strokeData'];

/**
 * 构造「大字段一旦被读取就计数并抛错」的列表行。
 * @param {{content: number, pages: number, strokeData: number}} counter
 * @param {Object} [overrides]
 * @returns {Object}
 */
const createStrictRow = (counter, overrides = {}) => {
  const row = {
    _id: 'note-1',
    title: '标题',
    type: 'card',
    tags: [],
    file_uri: null,
    file_name: 'note.md',
    file_type: 'markdown',
    file_size: 128,
    created_at: new Date(1700000000000),
    updated_at: new Date(1700000000000),
    metadata: '{}',
    ...overrides,
  };

  BIG_FIELDS.forEach((field) => {
    Object.defineProperty(row, field, {
      enumerable: true,
      configurable: true,
      get() {
        counter[field] += 1;
        throw new Error(`列表侧不得读取 ${field}`);
      },
    });
  });

  return row;
};

const emptyCounter = () => ({ content: 0, pages: 0, strokeData: 0 });

describe('里程碑 5.1 列表数据流契约', () => {
  test('写入侧打标 -> 轻量 summary：白名单覆盖卡片字段，且不含大字段', () => {
    const counter = emptyCounter();
    const metadata = mergePreviewMetadata(
      '{"keep":1}',
      buildNotePreview({ content: '# 标题\n正文', pages: '[{"id":1}]', strokeData: '' }),
    );
    const summary = toNoteSummary(createStrictRow(counter, { metadata }));

    expect(summary.previewText).toBe('标题 正文');
    expect(summary.hasContent).toBe(true);
    expect(summary.hasPages).toBe(true);
    expect(summary.hasStrokeData).toBe(false);
    expect(summary.file_name).toBe('note.md');
    expect(summary.file_size).toBe(128);

    BIG_FIELDS.forEach((field) => {
      expect(Object.prototype.hasOwnProperty.call(summary, field)).toBe(false);
    });
    expect(Object.keys(summary).sort()).toEqual(
      [
        ...NOTE_SUMMARY_FIELDS,
        'hasContent',
        'contentLength',
        'previewText',
        'hasPages',
        'hasStrokeData',
      ].sort(),
    );
    expect(counter).toEqual(emptyCounter());
  });

  test('materializeNoteSummaries 批量投影同样不读取大字段', () => {
    const counter = emptyCounter();
    const rows = Array.from({ length: 50 }, (_, index) =>
      createStrictRow(counter, {
        _id: `note-${index}`,
        metadata: JSON.stringify({
          previewText: `摘要-${index}`,
          hasContent: true,
          hasPages: false,
          hasStrokeData: false,
        }),
      }),
    );

    const page = materializeNoteSummaries(rows, { skip: 40, limit: 10 });

    expect(page).toHaveLength(10);
    expect(page[0]._id).toBe('note-40');
    expect(page[9]._id).toBe('note-49');
    expect(counter).toEqual(emptyCounter());
  });

  test('NoteItem 兼容层只使用 summary 的轻量字段（summary 无 content/pages/strokeData 键）', () => {
    const counter = emptyCounter();
    const metadata = mergePreviewMetadata(
      '{}',
      buildNotePreview({ content: '预览文字', pages: null, strokeData: null }),
    );
    const summary = toNoteSummary(createStrictRow(counter, { metadata }));

    BIG_FIELDS.forEach((field) => {
      expect(field in summary).toBe(false);
    });
    expect(getItemPreviewText(summary)).toBe('预览文字');
    expect(itemHasContent(summary)).toBe(true);
    expect(itemHasPages(summary)).toBe(false);
    expect(itemHasStrokeData(summary)).toBe(false);
    expect(getItemContentLikeText(summary)).toBe('预览文字');
    expect(counter).toEqual(emptyCounter());
  });

  test('需要正文的路径按 id 延迟加载（注入 notesApi.getById 契约）', async () => {
    const counter = emptyCounter();
    const metadata = mergePreviewMetadata(
      '{}',
      buildNotePreview({ content: '预览文字', pages: null, strokeData: null }),
    );
    const summary = toNoteSummary(createStrictRow(counter, { metadata }));

    const getById = jest.fn(async () => ({
      success: true,
      data: { _id: 'note-1', content: '完整正文' },
    }));

    await expect(resolveItemContent(summary, getById)).resolves.toBe('完整正文');
    expect(getById).toHaveBeenCalledWith('note-1');
    // 延迟加载发生在详情/导出路径，列表投影与渲染期间的大字段访问次数仍为 0
    expect(counter).toEqual(emptyCounter());
  });

  test('未打标保护：存量笔记/importNote 导入的 summary 能被识别（避免首页摘要整体消失）', () => {
    const counter = emptyCounter();

    // 打标过的 summary：写入侧 buildNotePreview + mergePreviewMetadata
    const tagged = toNoteSummary(createStrictRow(counter, {
      metadata: mergePreviewMetadata(
        '{}',
        buildNotePreview({ content: '正文', pages: null, strokeData: null }),
      ),
    }));
    expect(isUntaggedSummary(tagged)).toBe(false);

    // 未打标（存量笔记 / notesApi.importNote）：metadata 只有业务字段，没有预览元数据
    const untagged = toNoteSummary(createStrictRow(counter, {
      metadata: JSON.stringify({ pdfPath: '/tmp/a.pdf', pageCount: 3 }),
    }));
    expect(untagged.previewText).toBeNull();
    expect(untagged.hasContent).toBeNull();
    expect(isUntaggedSummary(untagged)).toBe(true);

    // 完整笔记对象（老形态）不算「未打标 summary」
    expect(isUntaggedSummary({ content: '正文' })).toBe(false);
    expect(isUntaggedSummary(null)).toBe(false);
    expect(counter).toEqual(emptyCounter());
  });
});
