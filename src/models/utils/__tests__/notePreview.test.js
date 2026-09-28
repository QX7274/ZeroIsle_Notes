/**
 * 里程碑 5.1 续：列表预览元数据（notePreview）
 *
 * 覆盖四个关注点：
 * 1. markdown 剥离：标题/列表/引用/强调/行内代码标记与多余空白；
 * 2. 截断到上限（默认 80 字）且 contentLength 反映真实正文长度；
 * 3. 非法入参（null/undefined/非字符串）安全返回，绝不抛错；
 * 4. mergePreviewMetadata 对已有 metadata 增量合并，坏 JSON 降级为 {}。
 *
 * 这里只断言纯函数行为：不涉及 Realm，也不读取任何大字段。
 */

const {
  DEFAULT_PREVIEW_LENGTH,
  buildNotePreview,
  mergePreviewMetadata,
  withPreviewMetadata,
  assignNoteWithPreviewMetadata,
} = require('../notePreview');

describe('buildNotePreview 预览元数据', () => {
  it('剥离 markdown 标记并折叠多余空白', () => {
    const preview = buildNotePreview({
      content: '# 标题\n\n- 列表项\n> 引用\n**加粗** _斜体_ ~~删除~~ `代码`\n- [ ] 待办',
    });

    expect(preview.previewText).toBe('标题 列表项 引用 加粗 斜体 删除 代码 待办');
  });

  it('保留链接与图片的可见文字，去掉地址', () => {
    const preview = buildNotePreview({
      content: '[链接](https://a.com) 与 ![图](img.png)',
    });

    expect(preview.previewText).toBe('链接 与 图');
  });

  it('截断到上限（默认 80 字），contentLength 仍是完整正文长度', () => {
    const preview = buildNotePreview({ content: 'a'.repeat(200) });

    expect(preview.previewText).toHaveLength(DEFAULT_PREVIEW_LENGTH);
    expect(DEFAULT_PREVIEW_LENGTH).toBe(80);
    expect(preview.contentLength).toBe(200);
    expect(preview.hasContent).toBe(true);
  });

  it('contentLength / hasContent 反映正文字符数', () => {
    expect(buildNotePreview({ content: '中文abc' })).toMatchObject({
      contentLength: 5,
      hasContent: true,
    });
    expect(buildNotePreview({ content: '' })).toMatchObject({
      contentLength: 0,
      hasContent: false,
    });
  });

  it('hasPages / hasStrokeData 只根据调用方传入的原值判定，不解析大字段内容', () => {
    expect(buildNotePreview({
      content: '',
      pages: '[{"id":1}]',
      strokeData: '{"strokes":[1]}',
    })).toMatchObject({ hasPages: true, hasStrokeData: true });

    expect(buildNotePreview({
      content: '',
      pages: [{ id: 1 }],
      strokeData: '[]',
    })).toMatchObject({ hasPages: true, hasStrokeData: false });

    // 空数组 / 空对象 JSON 视为「无内容」，但只做字符串判定，不做 JSON.parse
    expect(buildNotePreview({ content: '', pages: '[]', strokeData: '{}' })).toMatchObject({
      hasPages: false,
      hasStrokeData: false,
    });
    expect(buildNotePreview({ content: '', pages: null, strokeData: undefined })).toMatchObject({
      hasPages: false,
      hasStrokeData: false,
    });
  });

  it('非法入参安全返回默认值，不抛错', () => {
    const defaults = {
      previewText: '',
      contentLength: 0,
      hasContent: false,
      hasPages: false,
      hasStrokeData: false,
    };

    expect(buildNotePreview()).toEqual(defaults);
    expect(buildNotePreview(null)).toEqual(defaults);
    expect(buildNotePreview(undefined)).toEqual(defaults);
    expect(buildNotePreview('纯字符串入参')).toEqual(defaults);
    expect(buildNotePreview({ content: null, pages: 0, strokeData: false })).toEqual(defaults);
    expect(buildNotePreview({ content: 123 })).toMatchObject({ previewText: '', contentLength: 0 });
  });

  it('同一入参多次调用结果完全一致（纯函数、确定性）', () => {
    const input = { content: '## 标题内容', pages: '[]', strokeData: '[]' };

    expect(buildNotePreview(input)).toEqual(buildNotePreview(input));
  });

  it('不修改传入对象', () => {
    const input = { content: '正文', pages: '[]', strokeData: '' };
    const snapshot = JSON.stringify(input);

    buildNotePreview(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('mergePreviewMetadata metadata 合并', () => {
  const preview = {
    previewText: '预览',
    contentLength: 2,
    hasContent: true,
    hasPages: false,
    hasStrokeData: false,
  };

  it('保留既有 metadata 键并写入预览字段，返回 JSON 字符串', () => {
    const merged = mergePreviewMetadata('{"pdfPath":"/tmp/a.pdf","pageCount":3}', preview);

    expect(typeof merged).toBe('string');
    expect(JSON.parse(merged)).toEqual({
      pdfPath: '/tmp/a.pdf',
      pageCount: 3,
      ...preview,
    });
  });

  it('坏 JSON / 空串 / null / 数组 metadata 安全降级为 {}', () => {
    expect(JSON.parse(mergePreviewMetadata('not-json', preview))).toEqual(preview);
    expect(JSON.parse(mergePreviewMetadata('', preview))).toEqual(preview);
    expect(JSON.parse(mergePreviewMetadata(null, preview))).toEqual(preview);
    expect(JSON.parse(mergePreviewMetadata('[]', preview))).toEqual(preview);
    expect(JSON.parse(mergePreviewMetadata('"text"', preview))).toEqual(preview);
  });

  it('接受对象形态的 metadata 且不修改入参', () => {
    const metadata = { keep: 1 };
    const merged = JSON.parse(mergePreviewMetadata(metadata, preview));

    expect(merged).toEqual({ keep: 1, ...preview });
    expect(metadata).toEqual({ keep: 1 });
  });

  it('preview 缺失或含 undefined 时不覆盖既有键', () => {
    expect(JSON.parse(mergePreviewMetadata('{"previewText":"旧"}', null))).toEqual({
      previewText: '旧',
    });
    expect(JSON.parse(mergePreviewMetadata('{"previewText":"旧"}', undefined))).toEqual({
      previewText: '旧',
    });
    expect(JSON.parse(mergePreviewMetadata('{"previewText":"旧"}', { previewText: undefined }))).toEqual({
      previewText: '旧',
    });
  });

  it('可重复合并：写入侧先打标、后续保存再刷新 previewText', () => {
    const first = mergePreviewMetadata('{"keep":1}', buildNotePreview({ content: '第一版' }));
    const second = mergePreviewMetadata(first, buildNotePreview({ content: '第二版' }));

    expect(JSON.parse(second)).toMatchObject({ keep: 1, previewText: '第二版' });
  });
});

describe('withPreviewMetadata 写入侧统一入口', () => {
  it('把预览字段增量合并进 metadata，并保留调用方既有键', () => {
    const payload = withPreviewMetadata({
      _id: 'note-1',
      content: '# 标题\n正文',
      metadata: '{"pdfPath":"/tmp/a.pdf","pageCount":3}',
    });

    expect(payload._id).toBe('note-1');
    expect(JSON.parse(payload.metadata)).toEqual({
      pdfPath: '/tmp/a.pdf',
      pageCount: 3,
      ...buildNotePreview({ content: '# 标题\n正文' }),
    });
  });

  it('metadata 为坏 JSON / 对象 / 空值时安全降级', () => {
    expect(
      JSON.parse(withPreviewMetadata({ content: '正文', metadata: 'not-json' }).metadata),
    ).toMatchObject({ previewText: '正文', hasContent: true });

    expect(
      JSON.parse(withPreviewMetadata({ content: '正文', metadata: { keep: 1 } }).metadata),
    ).toEqual({ keep: 1, ...buildNotePreview({ content: '正文' }) });

    expect(
      JSON.parse(withPreviewMetadata({ content: '', metadata: undefined }).metadata),
    ).toMatchObject({ contentLength: 0, hasContent: false });
  });

  it('content 为空时仍写入 previewText="" / contentLength=0 / hasContent=false', () => {
    const metadata = JSON.parse(withPreviewMetadata({ content: '', metadata: '{}' }).metadata);

    expect(metadata).toMatchObject({
      previewText: '',
      contentLength: 0,
      hasContent: false,
      hasPages: false,
      hasStrokeData: false,
    });
  });

  it('payload 顶层已有的 previewText 不被覆盖（只刷新 metadata 内的预览字段）', () => {
    const payload = withPreviewMetadata({ content: '正文', previewText: '调用方手写' });

    expect(payload.previewText).toBe('调用方手写');
    expect(JSON.parse(payload.metadata).previewText).toBe('正文');
  });

  it('pages / strokeData 反映到 hasPages / hasStrokeData', () => {
    const metadata = JSON.parse(
      withPreviewMetadata({ content: '', pages: '[{"id":1}]', strokeData: '[]' }).metadata,
    );

    expect(metadata).toMatchObject({ hasPages: true, hasStrokeData: false });
  });

  it('返回新对象且不修改入参', () => {
    const input = { content: '正文', metadata: '{"keep":1}' };
    const snapshot = JSON.stringify(input);
    const payload = withPreviewMetadata(input);

    expect(payload).not.toBe(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

/**
 * 更新路径守卫（WS-Q / 设备复验缺陷）：Object.assign 会把 metadata 整块覆盖成 '{}'，
 * 这里断言 assignNoteWithPreviewMetadata 采用增量合并 + 预览刷新。
 */
describe('assignNoteWithPreviewMetadata 更新路径守卫', () => {
  const createTaggedTarget = (extra = {}) => ({
    _id: 'note-1',
    title: '原标题',
    content: '旧正文',
    metadata: JSON.stringify({
      previewText: '旧正文',
      contentLength: 3,
      hasContent: true,
      hasPages: false,
      hasStrokeData: false,
      customKey: 'keep-me',
      ...extra,
    }),
  });

  it('patch.metadata 为 "{}" 时：既有 previewText 与自定义键保留，预览按新正文刷新', () => {
    const target = createTaggedTarget();

    assignNoteWithPreviewMetadata(target, { content: '更新后的正文', metadata: '{}' });

    const metadata = JSON.parse(target.metadata);
    expect(metadata.previewText).toBe('更新后的正文');
    expect(metadata.contentLength).toBe('更新后的正文'.length);
    expect(metadata.hasContent).toBe(true);
    expect(metadata.customKey).toBe('keep-me');
  });

  it('patch 未提供 metadata 时同样保留既有 metadata（缺陷的核心场景）', () => {
    const target = createTaggedTarget();

    assignNoteWithPreviewMetadata(target, { title: '新标题' });

    const metadata = JSON.parse(target.metadata);
    expect(metadata.previewText).toBe('旧正文');
    expect(metadata.customKey).toBe('keep-me');
    expect(target.title).toBe('新标题');
  });

  it('patch.metadata 为坏 JSON / null / 数组字面量等非法值时都不破坏既有 metadata', () => {
    ['not-json', null, undefined, '[]', '"text"'].forEach((badMetadata) => {
      const target = createTaggedTarget();

      assignNoteWithPreviewMetadata(target, { metadata: badMetadata });

      const metadata = JSON.parse(target.metadata);
      expect(metadata.customKey).toBe('keep-me');
      expect(metadata.previewText).toBe('旧正文');
    });
  });

  it('patch.metadata 的新键增量合并（保留既有键）', () => {
    const target = createTaggedTarget();

    assignNoteWithPreviewMetadata(target, { metadata: JSON.stringify({ localCachedPath: '/tmp/md' }) });

    const metadata = JSON.parse(target.metadata);
    expect(metadata.localCachedPath).toBe('/tmp/md');
    expect(metadata.customKey).toBe('keep-me');
    expect(metadata.previewText).toBe('旧正文');
  });

  it('其它字段保持 Object.assign 语义（含 undefined），并返回 target 本身', () => {
    const target = createTaggedTarget();

    const returned = assignNoteWithPreviewMetadata(target, {
      title: '新标题',
      is_deleted: true,
      color: undefined,
    });

    expect(returned).toBe(target);
    expect(target.title).toBe('新标题');
    expect(target.is_deleted).toBe(true);
    expect(target.color).toBeUndefined();
  });

  it('pages / strokeData 变化后 hasPages / hasStrokeData 同步刷新', () => {
    const target = createTaggedTarget();

    assignNoteWithPreviewMetadata(target, { pages: '[{"id":1}]', strokeData: '' });

    expect(JSON.parse(target.metadata)).toMatchObject({ hasPages: true, hasStrokeData: false });
  });

  it('target 非法时原样返回，不抛错', () => {
    expect(assignNoteWithPreviewMetadata(null, { title: 'x' })).toBeNull();
    expect(assignNoteWithPreviewMetadata(undefined, { title: 'x' })).toBeUndefined();
    expect(assignNoteWithPreviewMetadata('text', { title: 'x' })).toBe('text');
  });
});
