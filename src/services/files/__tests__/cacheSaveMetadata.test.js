const { buildCacheSaveMetadata } = require('../cacheSaveMetadata');

describe('cacheSaveMetadata 可选完整性字段接线', () => {
  test('文件记录带 sha256 时归一化后传入', () => {
    const metadata = buildCacheSaveMetadata(
      { sha256: '  ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789  ' },
      { size: 1024 }
    );

    expect(metadata.sha256).toBe('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
    expect(metadata.size).toBe(1024);
  });

  test('文件记录带 size 时作为 expectedSize 传入', () => {
    const metadata = buildCacheSaveMetadata({ size: 2048 }, { size: 2048 });

    expect(metadata.expectedSize).toBe(2048);
    expect(metadata.size).toBe(2048);
  });

  test('显式 expectedSize 优先于 size', () => {
    const metadata = buildCacheSaveMetadata({ expectedSize: 10, size: 20 }, { size: 20 });

    expect(metadata.expectedSize).toBe(10);
  });

  test('记录缺少校验字段时只传本地 size，保持可选校验语义', () => {
    const metadata = buildCacheSaveMetadata({ title: '报告.pdf', uri: 'https://example.test/r.pdf' }, { size: 12 });

    expect(metadata).toEqual({ size: 12 });
    expect('sha256' in metadata).toBe(false);
    expect('expectedSize' in metadata).toBe(false);
  });

  test('记录为空或缺失时不抛错', () => {
    expect(buildCacheSaveMetadata(undefined, { size: 0 })).toEqual({ size: 0 });
    expect(buildCacheSaveMetadata(null)).toEqual({});
    expect(() => buildCacheSaveMetadata()).not.toThrow();
  });

  test('非法 sha256 不传入', () => {
    expect(buildCacheSaveMetadata({ sha256: 'abc' }).sha256).toBeUndefined();
    expect(buildCacheSaveMetadata({ sha256: 'z'.repeat(64) }).sha256).toBeUndefined();
    expect(buildCacheSaveMetadata({ sha256: 12345 }).sha256).toBeUndefined();
  });

  test('非法大小（0/负数/非数字）不传入', () => {
    expect(buildCacheSaveMetadata({ size: 0 }).expectedSize).toBeUndefined();
    expect(buildCacheSaveMetadata({ size: -5 }).expectedSize).toBeUndefined();
    expect(buildCacheSaveMetadata({ size: 'not-a-number' }).expectedSize).toBeUndefined();
  });

  test('本地 size 非法时不写入 size 字段', () => {
    expect(buildCacheSaveMetadata({}, { size: undefined })).toEqual({});
    expect(buildCacheSaveMetadata({}, { size: NaN })).toEqual({});
  });
});
