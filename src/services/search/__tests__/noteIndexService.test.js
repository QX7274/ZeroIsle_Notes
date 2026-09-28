/**
 * 里程碑 5.1：笔记搜索增量索引（noteIndexService）
 *
 * 覆盖三点：
 * 1. upsert：字段映射与全量重建 / enhancedNoteService 一致（entity_type='note'、正文截断、标题切词）；
 * 2. remove：删除笔记时软删索引，找不到索引时安全返回 false；
 * 3. 失败降级：Safe 版本只告警不抛错，绝不阻断笔记保存。
 */

jest.mock('../../../models/SearchIndex', () => ({
  __esModule: true,
  default: {
    createOrUpdate: jest.fn(),
  },
}));

const SearchIndex = require('../../../models/SearchIndex').default;
const {
  upsertNoteIndex,
  removeNoteIndex,
  upsertNoteIndexSafe,
  removeNoteIndexSafe,
} = require('../noteIndexService');

const NOTE_ID = 'note-1';
const baseNote = {
  _id: NOTE_ID,
  title: '标题 关键词',
  content: '正文内容',
  tags: ['标签A'],
  user_id: 'user-1',
  category_id: 'cat-1',
  is_deleted: false,
};

/**
 * 伪 Realm：只实现 noteIndexService 用到的 objects/write + filtered 主键查询。
 * @param {{rows?: Array<Object>}} [options]
 * @returns {Object}
 */
const createRealm = (options = {}) => {
  const rows = options.rows || [];
  return {
    rows,
    objects: jest.fn(() => ({
      filtered: jest.fn(() => rows),
    })),
    write: jest.fn((callback) => callback()),
  };
};

describe('noteIndexService 笔记增量索引', () => {
  beforeEach(() => {
    SearchIndex.createOrUpdate.mockReset();
  });

  it('upsertNoteIndex 按重建索引的字段映射调用 SearchIndex.createOrUpdate', () => {
    const realm = createRealm();
    SearchIndex.createOrUpdate.mockReturnValue({ is_deleted: false });

    upsertNoteIndex(realm, baseNote);

    expect(SearchIndex.createOrUpdate).toHaveBeenCalledTimes(1);
    const [calledRealm, data] = SearchIndex.createOrUpdate.mock.calls[0];
    expect(calledRealm).toBe(realm);
    expect(data).toMatchObject({
      entity_id: NOTE_ID,
      entity_type: 'note',
      user_id: 'user-1',
      title: '标题 关键词',
      content: '正文内容',
      tags: ['标签A'],
      category: 'cat-1',
      relevance_score: 1.0,
      language: 'zh-CN',
    });
    expect(data.keywords).toEqual(['标题', '关键词']);
  });

  it('缺少 _id/id 时抛错，user_id 缺失时回退到 local_user', () => {
    expect(() => upsertNoteIndex(createRealm(), { title: '无ID' })).toThrow();

    const realm = createRealm();
    SearchIndex.createOrUpdate.mockReturnValue({ is_deleted: false });
    upsertNoteIndex(realm, { id: 'note-2', title: '标题', content: '' });

    expect(SearchIndex.createOrUpdate.mock.calls[0][1]).toMatchObject({
      entity_id: 'note-2',
      user_id: 'local_user',
    });
  });

  it('Realm List 形态的 tags（数组以外）也能正确入索引', () => {
    const realm = createRealm();
    SearchIndex.createOrUpdate.mockReturnValue({ is_deleted: false });

    upsertNoteIndex(realm, { ...baseNote, tags: { length: 2, 0: '标签A', 1: '标签B' } });

    expect(SearchIndex.createOrUpdate.mock.calls[0][1].tags).toEqual(['标签A', '标签B']);
  });

  it('正文超长时截断后再入索引', () => {
    const realm = createRealm();
    SearchIndex.createOrUpdate.mockReturnValue({ is_deleted: false });

    upsertNoteIndex(realm, { _id: 'note-3', title: '长文', content: 'x'.repeat(5000) });

    expect(SearchIndex.createOrUpdate.mock.calls[0][1].content).toHaveLength(4000);
  });

  it('重新索引会重置软删标记，保证更新后的笔记可被搜到', () => {
    const realm = createRealm();
    const index = { is_deleted: true, updated_at: null };
    SearchIndex.createOrUpdate.mockReturnValue(index);

    upsertNoteIndex(realm, baseNote);

    expect(index.is_deleted).toBe(false);
    expect(realm.write).toHaveBeenCalled();

    const deletedIndex = { is_deleted: false };
    SearchIndex.createOrUpdate.mockReturnValue(deletedIndex);
    upsertNoteIndex(createRealm(), { ...baseNote, is_deleted: true });

    expect(deletedIndex.is_deleted).toBe(true);
  });

  it('removeNoteIndex 找到索引时软删除并返回 true，未找到返回 false', () => {
    const softDelete = jest.fn();
    const realm = createRealm({ rows: [{ _id: 'idx-1', softDelete }] });

    expect(removeNoteIndex(realm, NOTE_ID)).toBe(true);
    expect(softDelete).toHaveBeenCalledWith(realm);
    expect(removeNoteIndex(realm, '')).toBe(false);
    expect(removeNoteIndex(realm, null)).toBe(false);

    const emptyRealm = createRealm();
    expect(removeNoteIndex(emptyRealm, NOTE_ID)).toBe(false);
  });

  it('索引写入失败不阻断保存：Safe 版本捕获异常并告警', () => {
    const realm = createRealm();
    SearchIndex.createOrUpdate.mockImplementation(() => {
      throw new Error('索引写入失败');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(upsertNoteIndexSafe(realm, baseNote)).toBeNull();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it('非法入参在 Safe 版本中同样只告警', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(upsertNoteIndexSafe(createRealm(), { title: '无ID' })).toBeNull();
    expect(removeNoteIndexSafe(createRealm(), null)).toBe(false);
    expect(removeNoteIndexSafe(null, NOTE_ID)).toBe(false);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
