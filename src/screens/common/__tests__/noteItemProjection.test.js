const {
  stripMarkdown,
  getItemPreviewText,
  itemHasContent,
  itemHasPages,
  itemHasStrokeData,
  getItemContentLikeText,
  resolveFullNote,
  resolveItemContent,
} = require('../noteItemProjection');

describe('noteItemProjection 列表投影兼容层', () => {
  test('stripMarkdown 剥离标记并压缩空白，非法入参返回空串', () => {
    expect(stripMarkdown('# 标题\n\n正文 **加粗** `code`')).toBe('标题 正文 加粗 code');
    expect(stripMarkdown(null)).toBe('');
    expect(stripMarkdown(123)).toBe('');
  });

  test('summary 形态：previewText 优先，且不读取 content', () => {
    // summary 一定携带 hasContent/hasPages/hasStrokeData（未知时为 null），因此不会回退读取大字段
    const item = { previewText: '摘要文本', hasContent: true, hasPages: null, hasStrokeData: null };
    Object.defineProperty(item, 'content', {
      get() { throw new Error('summary 形态不应读取 content'); },
    });
    expect(getItemPreviewText(item)).toBe('摘要文本');
    expect(itemHasContent(item)).toBe(true);
  });

  test('summary 形态：布尔标记优先，不读取 pages/strokeData', () => {
    const item = { hasContent: false, hasPages: true, hasStrokeData: true };
    Object.defineProperty(item, 'pages', { get() { throw new Error('不应读取 pages'); } });
    Object.defineProperty(item, 'strokeData', { get() { throw new Error('不应读取 strokeData'); } });
    expect(itemHasContent(item)).toBe(false);
    expect(itemHasPages(item)).toBe(true);
    expect(itemHasStrokeData(item)).toBe(true);
  });

  test('老形态：无 summary 字段时回退到 content/pages/strokeData（行为与改动前一致）', () => {
    const item = { content: '# 富文本', pages: [{ content: '' }], strokeData: null };
    expect(getItemPreviewText(item)).toBe('富文本');
    expect(itemHasContent(item)).toBe(true);
    expect(itemHasPages(item)).toBe(true);
    expect(itemHasStrokeData(item)).toBe(false);
  });

  test('空值安全：null/undefined/空对象都不抛错', () => {
    expect(getItemPreviewText(null)).toBe('');
    expect(itemHasContent(undefined)).toBe(false);
    expect(itemHasPages(null)).toBe(false);
    expect(itemHasStrokeData({})).toBe(false);
    expect(getItemContentLikeText(undefined)).toBe('');
  });

  test('getItemContentLikeText：老形态返回原 content，循环引用按空串，summary 回退 previewText', () => {
    expect(getItemContentLikeText({ content: '导入的word文件' })).toBe('导入的word文件');
    expect(getItemContentLikeText({ content: { reference: 'circular' } })).toBe('');
    expect(getItemContentLikeText({ previewText: '摘要' })).toBe('摘要');
  });
});

/**
 * 里程碑 5.1：列表项需要正文时的「按 id 延迟加载」契约。
 *
 * HomeScreen 依赖 React Native 运行时，直接渲染成本高且与本次改动无关；
 * 因此把延迟加载收敛到 noteItemProjection 的纯函数里，用注入的 getById 做确定性契约测试
 * （生产代码注入的正是 notesApi.getById，见 HomeScreen 的调用点）。
 */
describe('noteItemProjection 正文延迟加载契约', () => {
  test('summary 形态（无 content 字段）：先按 id 取回正文，不读取 item.content', async () => {
    const getById = jest.fn(async () => ({ success: true, data: { _id: 'n1', content: '完整正文' } }));
    const item = { _id: 'n1', title: '卡片', previewText: '摘要', hasContent: true };

    expect('content' in item).toBe(false);
    await expect(resolveItemContent(item, getById)).resolves.toBe('完整正文');
    expect(getById).toHaveBeenCalledTimes(1);
    expect(getById).toHaveBeenCalledWith('n1');
  });

  test('老形态（content 已存在）：保持 item.content || "" 语义，不触发 getById', async () => {
    const getById = jest.fn();

    await expect(resolveItemContent({ _id: 'n2', content: '本地正文' }, getById)).resolves.toBe('本地正文');
    await expect(resolveItemContent({ _id: 'n3', content: '' }, getById)).resolves.toBe('');
    await expect(resolveItemContent(null, getById)).resolves.toBe('');
    expect(getById).not.toHaveBeenCalled();
  });

  test('取数失败 / 返回空 / 缺少 id：回退空串，绝不抛错（导航不被阻断）', async () => {
    const failing = jest.fn(async () => {
      throw new Error('offline');
    });
    const empty = jest.fn(async () => ({ success: true, data: null }));

    await expect(resolveItemContent({ _id: 'n5' }, failing)).resolves.toBe('');
    await expect(resolveItemContent({ _id: 'n6' }, empty)).resolves.toBe('');
    await expect(resolveItemContent({ title: '无ID' }, failing)).resolves.toBe('');
    await expect(resolveItemContent({ _id: 'n7' })).resolves.toBe('');
  });

  test('resolveFullNote：取回完整笔记供 Redux/重命名使用，失败返回 null', async () => {
    const getById = jest.fn(async () => ({ success: true, data: { _id: 'n8', content: '正文', pages: '[1]' } }));

    await expect(resolveFullNote({ _id: 'n8' }, getById)).resolves.toEqual({
      _id: 'n8',
      content: '正文',
      pages: '[1]',
    });
    await expect(resolveFullNote({ _id: 'n9' }, async () => {
      throw new Error('boom');
    })).resolves.toBeNull();
    await expect(resolveFullNote({}, getById)).resolves.toBeNull();
    await expect(resolveFullNote(null, getById)).resolves.toBeNull();
  });

  test('summary 形态下所有卡片读取函数都只依赖 previewText / 布尔标记', () => {
    const item = {
      _id: 'n10',
      previewText: '摘要文本',
      hasContent: true,
      hasPages: false,
      hasStrokeData: false,
    };

    expect('content' in item).toBe(false);
    expect('pages' in item).toBe(false);
    expect('strokeData' in item).toBe(false);
    expect(getItemPreviewText(item)).toBe('摘要文本');
    expect(itemHasContent(item)).toBe(true);
    expect(itemHasPages(item)).toBe(false);
    expect(itemHasStrokeData(item)).toBe(false);
    expect(getItemContentLikeText(item)).toBe('摘要文本');
  });
});
