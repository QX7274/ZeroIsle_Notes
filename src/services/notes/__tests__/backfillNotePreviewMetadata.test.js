/**
 * 存量预览元数据回填（backfillNotePreviewMetadata）单测
 *
 * 覆盖：
 * 1. 纯逻辑：未打标判定（含坏 JSON / 脏键）与回填 metadata 生成；
 * 2. 只处理未打标条目、已打标跳过（幂等）；
 * 3. 单条失败不中断整体；
 * 4. 分批推进：10 万条 × 批 200 = 500 批，且每批 materialize 不超过批大小（内存有界）；
 * 5. realm 可注入；未注入时走 realmService.getRealm()；非法 realm 直接抛错。
 */

const { createCountingResults } = require('../../../models/__tests__/helpers/countingResults.cjs');

jest.mock('../../database/realmService', () => {
  const notes = [
    { _id: 'a', content: '甲', metadata: '{}' },
    { _id: 'b', content: '乙', metadata: JSON.stringify({ previewText: '摘要', contentLength: 2 }) },
  ];
  const collection = [...notes];
  collection.sorted = () => collection;
  const realm = {
    write: (callback) => callback(),
    objects: () => collection,
  };
  return {
    __esModule: true,
    default: {
      getRealm: jest.fn(async () => realm),
      __realm: realm,
    },
  };
});

const {
  DEFAULT_BACKFILL_BATCH_SIZE,
  isPreviewMetadataMissing,
  buildBackfillMetadata,
  backfillNotePreviewMetadata,
} = require('../backfillNotePreviewMetadata');

/**
 * 伪 Realm（注入用）：objects('Note') 返回按 _id 排序的普通数组，
 * 与真实 Realm 一样支持 length / slice / 迭代（materializePage 依赖这三个契约）。
 * @param {Array<Object>} notes
 * @returns {Object}
 */
const createFakeRealm = (notes) => {
  const rows = [...notes];
  const collection = [...rows];
  collection.sorted = (field) => [...rows].sort((left, right) => {
    const a = left[field];
    const b = right[field];
    if (a === b) { return 0; }
    return a > b ? 1 : -1;
  });
  return {
    rows,
    write: jest.fn((callback) => callback()),
    objects: jest.fn(() => collection),
  };
};

const taggedNote = (id, overrides = {}) => ({
  _id: id,
  content: '正文',
  metadata: JSON.stringify({ previewText: '摘要', contentLength: 2, keep: 1 }),
  ...overrides,
});

const untaggedNote = (id, content = '正文') => ({
  _id: id,
  content,
  metadata: JSON.stringify({ pdfPath: '/tmp/a.pdf' }),
});

describe('backfillNotePreviewMetadata 纯逻辑', () => {
  test('isPreviewMetadataMissing：只认 previewText + contentLength 同时存在', () => {
    expect(isPreviewMetadataMissing(null)).toBe(true);
    expect(isPreviewMetadataMissing('')).toBe(true);
    expect(isPreviewMetadataMissing('not-json')).toBe(true);
    expect(isPreviewMetadataMissing('[]')).toBe(true);
    expect(isPreviewMetadataMissing('{}')).toBe(true);
    expect(isPreviewMetadataMissing(JSON.stringify({ pdfPath: '/tmp/a.pdf' }))).toBe(true);
    // 缺一不可：只有 previewText 或只有 contentLength 都算未打标
    expect(isPreviewMetadataMissing(JSON.stringify({ previewText: '摘要' }))).toBe(true);
    expect(isPreviewMetadataMissing(JSON.stringify({ contentLength: 12 }))).toBe(true);
    // 脏键（非数字 contentLength）不算已打标
    expect(isPreviewMetadataMissing(JSON.stringify({ previewText: '摘要', contentLength: null }))).toBe(true);
    expect(isPreviewMetadataMissing(JSON.stringify({ previewText: '摘要', contentLength: 'abc' }))).toBe(true);
    // 已打标（允许空正文：contentLength 为 0）
    expect(isPreviewMetadataMissing(JSON.stringify({ previewText: '摘要', contentLength: 5 }))).toBe(false);
    expect(isPreviewMetadataMissing(JSON.stringify({ previewText: '', contentLength: 0 }))).toBe(false);
  });

  test('buildBackfillMetadata：保留既有键并写入预览元数据；已打标返回 null', () => {
    const note = untaggedNote('n1', '# 标题\n正文内容');
    const metadata = JSON.parse(buildBackfillMetadata(note));

    expect(metadata).toMatchObject({
      pdfPath: '/tmp/a.pdf',
      previewText: '标题 正文内容',
      contentLength: '# 标题\n正文内容'.length,
      hasContent: true,
      hasPages: false,
      hasStrokeData: false,
    });

    expect(buildBackfillMetadata(taggedNote('n2'))).toBeNull();
    expect(buildBackfillMetadata(null)).toBeNull();
    expect(buildBackfillMetadata({ _id: 'n3' })).not.toBeNull();
  });

  test('buildBackfillMetadata 识别 pages / strokeData 原值（不解析大字段）', () => {
    const metadata = JSON.parse(buildBackfillMetadata({
      _id: 'n4',
      content: '正文',
      pages: '[{"id":1}]',
      strokeData: '',
      metadata: '{}',
    }));

    expect(metadata.hasPages).toBe(true);
    expect(metadata.hasStrokeData).toBe(false);
  });
});

describe('backfillNotePreviewMetadata 回填流程', () => {
  test('只处理未打标条目，已打标跳过；再次执行是幂等的', async () => {
    const realm = createFakeRealm([
      untaggedNote('n2', '第二'),
      taggedNote('n1'),
      untaggedNote('n3', '第三'),
    ]);

    const stats = await backfillNotePreviewMetadata({ realm, batchSize: 2 });

    expect(stats).toEqual({ scanned: 3, updated: 2, failed: 0, batches: 2 });
    const n2 = JSON.parse(realm.rows.find((item) => item._id === 'n2').metadata);
    expect(n2).toMatchObject({ pdfPath: '/tmp/a.pdf', previewText: '第二', hasContent: true });
    const n1 = JSON.parse(realm.rows.find((item) => item._id === 'n1').metadata);
    expect(n1).toEqual({ previewText: '摘要', contentLength: 2, keep: 1 });

    // 幂等：第二次执行不再更新任何条目
    const second = await backfillNotePreviewMetadata({ realm, batchSize: 2 });
    expect(second).toEqual({ scanned: 3, updated: 0, failed: 0, batches: 2 });
  });

  test('单条失败只计数并告警，不中断整体', async () => {
    const bad = untaggedNote('bad', '坏数据');
    Object.defineProperty(bad, 'metadata', {
      configurable: true,
      enumerable: true,
      get: () => '{}',
      set: () => {
        throw new Error('realm 写入失败');
      },
    });
    const realm = createFakeRealm([bad, untaggedNote('ok', '好数据')]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const stats = await backfillNotePreviewMetadata({ realm, batchSize: 10 });

    expect(stats).toEqual({ scanned: 2, updated: 1, failed: 1, batches: 1 });
    expect(JSON.parse(realm.rows.find((item) => item._id === 'ok').metadata).previewText).toBe('好数据');
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  test('10 万条按批推进：500 批、每批 materialize 不超过批大小', async () => {
    const TOTAL = 100000;
    const BATCH = 200;
    const TAGGED_METADATA = JSON.stringify({ previewText: '摘要', contentLength: 2 });
    const pad = (value) => String(value).padStart(6, '0');
    const rows = Array.from({ length: TOTAL }, (_, index) => (
      index % 1000 === 0
        ? { _id: `note-${pad(index)}`, content: `正文-${index}`, metadata: '{}' }
        : { _id: `note-${pad(index)}`, content: '', metadata: TAGGED_METADATA }
    ));

    const collection = createCountingResults(rows);
    const realm = {
      write: (callback) => callback(),
      objects: () => collection,
    };

    const batchMaterialized = [];
    let lastMaterialized = 0;

    const stats = await backfillNotePreviewMetadata({
      realm,
      batchSize: BATCH,
      onProgress: () => {
        batchMaterialized.push(collection.stats.materialized - lastMaterialized);
        lastMaterialized = collection.stats.materialized;
      },
    });

    expect(stats).toEqual({ scanned: TOTAL, updated: 100, failed: 0, batches: TOTAL / BATCH });
    // 每批只物化批大小以内的条目 => 峰值内存有上界，任何一批都没有整表读取
    expect(batchMaterialized).toHaveLength(TOTAL / BATCH);
    expect(Math.max(...batchMaterialized)).toBeLessThanOrEqual(BATCH);
    expect(collection.stats.materialized).toBe(TOTAL);
    expect(collection.stats.sortedCalls).toBe(1);
  });

  test('realm 可注入：未注入时使用 realmService.getRealm()', async () => {
    const realmService = require('../../database/realmService').default;

    const stats = await backfillNotePreviewMetadata({ batchSize: 10 });

    expect(realmService.getRealm).toHaveBeenCalled();
    expect(stats).toEqual({ scanned: 2, updated: 1, failed: 0, batches: 1 });
    const noteA = realmService.__realm.objects('Note').find((item) => item._id === 'a');
    expect(JSON.parse(noteA.metadata).previewText).toBe('甲');
  });

  test('默认批大小导出，且非法 realm 显式抛错（不静默成功）', async () => {
    expect(DEFAULT_BACKFILL_BATCH_SIZE).toBe(200);
    await expect(backfillNotePreviewMetadata({ realm: {} })).rejects.toThrow();
    await expect(
      backfillNotePreviewMetadata({ realm: { objects: () => [] } }),
    ).rejects.toThrow();
  });
});
