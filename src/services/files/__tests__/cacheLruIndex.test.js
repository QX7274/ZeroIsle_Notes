const { upsert, touch, remove, totalSize, selectEvictions } = require('../cacheLruIndex');

const entry = (key, size, at) => ({ key, size, lastAccessedAt: at });

describe('cacheLruIndex', () => {
  describe('upsert / touch / remove / totalSize', () => {
    test('upsert 新增条目且不修改入参', () => {
      const entries = [entry('a', 10, 1)];
      const next = upsert(entries, entry('b', 20, 2));

      expect(next).toEqual([entry('a', 10, 1), entry('b', 20, 2)]);
      expect(entries).toEqual([entry('a', 10, 1)]);
    });

    test('upsert 覆盖同 key 条目，缺省时间时保留原访问时间', () => {
      const next = upsert([entry('a', 10, 1)], { key: 'a', size: 30 });

      expect(next).toEqual([entry('a', 30, 1)]);
    });

    test('upsert 带显式时间时更新访问时间', () => {
      const next = upsert([entry('a', 10, 1)], entry('a', 10, 99));

      expect(next).toEqual([entry('a', 10, 99)]);
    });

    test('touch 只更新目标 key 的访问时间', () => {
      const entries = [entry('a', 10, 1), entry('b', 20, 2)];
      const next = touch(entries, 'a', 123);

      expect(next).toEqual([entry('a', 10, 123), entry('b', 20, 2)]);
      expect(entries).toEqual([entry('a', 10, 1), entry('b', 20, 2)]);
    });

    test('remove 按 key 移除', () => {
      expect(remove([entry('a', 10, 1), entry('b', 20, 2)], 'a')).toEqual([entry('b', 20, 2)]);
    });

    test('totalSize 汇总大小并忽略非法值', () => {
      const entries = [entry('a', 10, 1), entry('b', -5, 2), entry('c', 'abc', 3), null];

      expect(totalSize(entries)).toBe(10);
    });

    test('同 key 重复时只按最后出现的条目计一次', () => {
      expect(totalSize([entry('a', 10, 1), entry('a', 999, 2)])).toBe(999);
    });
  });

  describe('selectEvictions', () => {
    const entries = [entry('old', 40, 100), entry('mid', 30, 200), entry('new', 30, 300)];

    test('未超配额时不淘汰', () => {
      expect(selectEvictions(entries, { maxBytes: 100, incomingBytes: 0 })).toEqual([]);
    });

    test('按最久未访问优先淘汰，直到满足配额', () => {
      // 当前 100 + 30 = 130 > 100，需释放 30，淘汰 old(40) 即可
      expect(selectEvictions(entries, { maxBytes: 100, incomingBytes: 30 })).toEqual(['old']);
    });

    test('需要释放更多时按顺序继续淘汰', () => {
      // 当前 100 + 100 = 200 > 100，需释放 100 -> old(40) + mid(30) + new(30)
      expect(selectEvictions(entries, { maxBytes: 100, incomingBytes: 100 })).toEqual([
        'old',
        'mid',
        'new',
      ]);
    });

    test('访问时间相同时按 key 升序，且与输入顺序无关', () => {
      const tied = [entry('b', 10, 5), entry('a', 10, 5), entry('c', 10, 5)];
      const shuffled = [entry('c', 10, 5), entry('b', 10, 5), entry('a', 10, 5)];

      expect(selectEvictions(tied, { maxBytes: 30, incomingBytes: 10 })).toEqual(['a']);
      expect(selectEvictions(shuffled, { maxBytes: 30, incomingBytes: 10 })).toEqual(['a']);
    });

    test('reserveBytes 预留余量会提前触发淘汰', () => {
      // 预算 = 100 - 20 = 80，当前 100 > 80，需释放 20 -> old(40)
      expect(selectEvictions(entries, { maxBytes: 100, reserveBytes: 20, incomingBytes: 0 })).toEqual([
        'old',
      ]);
    });

    test('不淘汰 protectedKeys（正在写入的项）', () => {
      const list = [entry('writing', 60, 1), entry('other', 40, 2)];

      // 预算 100，当前 100 + 20 = 120 -> 需释放 20；writing 受保护 -> 淘汰 other
      expect(
        selectEvictions(list, { maxBytes: 100, incomingBytes: 20, protectedKeys: ['writing'] }),
      ).toEqual(['other']);
    });

    test('可淘汰项全部受保护时返回空列表', () => {
      const list = [entry('a', 60, 1), entry('b', 60, 2)];

      expect(
        selectEvictions(list, { maxBytes: 100, incomingBytes: 20, protectedKeys: ['a', 'b'] }),
      ).toEqual([]);
    });

    test('incomingBytes 超过 maxBytes 时只淘汰到清空，不会到负数', () => {
      const list = [entry('a', 10, 1), entry('b', 20, 2)];
      const evictions = selectEvictions(list, { maxBytes: 25, incomingBytes: 1000 });

      expect(evictions).toEqual(['a', 'b']);
      const freed = list
        .filter((item) => evictions.includes(item.key))
        .reduce((sum, item) => sum + item.size, 0);
      expect(freed).toBeLessThanOrEqual(totalSize(list));
      expect(freed).toBeGreaterThanOrEqual(0);
    });

    test('maxBytes 非法或非正数时不淘汰', () => {
      expect(selectEvictions(entries, { incomingBytes: 10 })).toEqual([]);
      expect(selectEvictions(entries, { maxBytes: 0, incomingBytes: 10 })).toEqual([]);
      expect(selectEvictions(entries, { maxBytes: -1, incomingBytes: 10 })).toEqual([]);
    });

    test('负数与非法大小按 0 处理，不影响淘汰顺序', () => {
      const list = [entry('broken', -100, 1), entry('valid', Number.NaN, 2), entry('fresh', 10, 3)];

      expect(selectEvictions(list, { maxBytes: 10, incomingBytes: 0 })).toEqual([]);
    });
  });
});
