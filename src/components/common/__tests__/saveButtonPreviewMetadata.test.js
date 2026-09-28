/**
 * 直写入口回归（RISK-LIST-UNTAGGED-001）：
 * SaveButton 的 SaveUtils 文档保存路径此前未写预览元数据，列表会回退全量渲染。
 * 本用例断言落库 payload 的 metadata 已经带上 previewText / hasContent。
 */

const { SaveUtils } = require('../SaveButton');

const createFakeRealm = () => ({
  write: jest.fn((fn) => fn()),
  create: jest.fn((type, data) => ({ ...data })),
  objectForPrimaryKey: jest.fn(() => null),
  canUseRealmForWrites: () => true,
  getRealm: jest.fn(async () => fakeRealmRef.current),
});

const fakeRealmRef = { current: null };

describe('SaveButton SaveUtils 落库打标', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fakeRealmRef.current = createFakeRealm();
  });

  it('saveMarkdownContent 的 metadata 含 previewText / hasContent', async () => {
    const realm = fakeRealmRef.current;

    await SaveUtils.saveMarkdownContent('note-md-1', '# 标题\n正文内容', realm);

    const noteCalls = realm.create.mock.calls.filter(([schema]) => schema === 'Note');
    expect(noteCalls).toHaveLength(1);

    const payload = noteCalls[0][1];
    expect(payload._id).toBe('note-md-1');
    expect(JSON.parse(payload.metadata)).toMatchObject({
      previewText: '标题 正文内容',
      contentLength: '# 标题\n正文内容'.length,
      hasContent: true,
    });
  });

  it('saveWordDocument 的 metadata 含 previewText', async () => {
    const realm = fakeRealmRef.current;

    await SaveUtils.saveWordDocument('note-doc-1', '## 文档正文', realm);

    const [schema, payload] = realm.create.mock.calls.find(([name]) => name === 'Note');
    expect(schema).toBe('Note');
    expect(JSON.parse(payload.metadata)).toMatchObject({ previewText: '文档正文', hasContent: true });
  });

  it('savePDFAnnotations 无正文时仍写入 contentLength=0 / hasContent=false', async () => {
    const realm = fakeRealmRef.current;

    await SaveUtils.savePDFAnnotations('note-pdf-1', [{ page: 0 }], realm);

    const [, payload] = realm.create.mock.calls.find(([name]) => name === 'Note');
    expect(JSON.parse(payload.metadata)).toMatchObject({
      previewText: '',
      contentLength: 0,
      hasContent: false,
    });
  });

  it('savePPTAnnotations 的 metadata 含 previewText 键（无正文时为 0）', async () => {
    const realm = fakeRealmRef.current;

    await SaveUtils.savePPTAnnotations('note-ppt-1', [], realm);

    const [, payload] = realm.create.mock.calls.find(([name]) => name === 'Note');
    expect(JSON.parse(payload.metadata)).toHaveProperty('previewText', '');
  });
});

/**
 * WS-Q 回归：更新路径守卫。
 * 缺陷背景：更新路径用 Object.assign(note, patch)，patch.metadata 常为默认 '{}'，
 * 会把创建时打好的 previewText/hasContent/... 整块覆盖，列表因此判为「未打标」。
 */
describe('SaveButton SaveUtils 更新路径守卫（WS-Q）', () => {
  /**
   * 伪 realmService：既作为 service（canUseRealmForWrites/getRealm），
   * 也作为 realm（write/objectForPrimaryKey 命中已存在笔记，走更新分支）
   * @param {Object|null} note
   * @returns {Object}
   */
  const createUpdateRealmService = (note) => {
    const service = {
      write: jest.fn((callback) => callback()),
      objectForPrimaryKey: jest.fn(() => note),
    };
    service.canUseRealmForWrites = () => true;
    service.getRealm = jest.fn(async () => service);
    return service;
  };

  it('saveNoteContent 保存新正文后 previewText 刷新，既有自定义键保留', async () => {
    const note = {
      _id: 'note-update-1',
      title: '标题',
      content: '旧正文',
      metadata: JSON.stringify({
        previewText: '旧正文',
        contentLength: 3,
        hasContent: true,
        customKey: 'keep',
      }),
    };
    const service = createUpdateRealmService(note);

    await expect(
      SaveUtils.saveNoteContent('note-update-1', '# 新正文', 'markdown', service),
    ).resolves.toBe(true);

    const metadata = JSON.parse(note.metadata);
    expect(metadata.previewText).toBe('新正文');
    expect(metadata.customKey).toBe('keep');
    expect(metadata.hasContent).toBe(true);
    expect(note.content).toBe('# 新正文');
  });

  it('patch 不含 metadata 时也不得把既有 previewText 抹掉', async () => {
    const note = {
      _id: 'note-update-2',
      content: '正文',
      metadata: JSON.stringify({ previewText: '正文', contentLength: 2, hasContent: true }),
    };

    await SaveUtils.saveNoteContent('note-update-2', '正文', 'markdown', createUpdateRealmService(note));

    expect(JSON.parse(note.metadata).previewText).toBe('正文');
  });
});
