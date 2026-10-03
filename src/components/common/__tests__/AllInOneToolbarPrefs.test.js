/**
 * AllInOneToolbarPrefs 纯逻辑单测
 *
 * 覆盖用户报障链路的三个真实问题：
 *  1) 脏数据（半个 JSON / 非法颜色 / 越界粗细）不得让工具栏崩溃，必须回落到默认值；
 *  2) 首次加载完成前绝不能落盘，否则 1 秒防抖会把刚读到的偏好写成默认值（缺陷 1）；
 *  3) 加载完成后用户已经动过的字段，不得被迟到的加载结果覆盖。
 */

const {
  DEFAULT_PREFERENCES,
  STORAGE_KEYS,
  addRecentColor,
  clampStrokeWidth,
  createPreferencesLoader,
  deriveTouchedFields,
  mergeLoadedPreferences,
  normalizeColor,
  pickRecentColors,
  sanitizeRecentColors,
  sanitizeToolbarPreferences,
  toSwatchList,
} = require('../AllInOneToolbarPrefs');

/** 假存储：记录每次 setItem，绝不碰磁盘。 */
const createFakeStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    store,
    setCalls: [],
    getItem: jest.fn(async (key) => (key in store ? store[key] : null)),
    setItem: jest.fn(async (key, value) => {
      store[key] = value;
      return undefined;
    }),
  };
};

describe('AllInOneToolbarPrefs / STORAGE_KEYS', () => {
  it('存储键与工具栏/取色器的既有常量同值', () => {
    // 若这里变了而 AllInOneToolbar 没变，偏好就会存到两个不同的 key 上，用户看到的永远是默认值。
    expect(STORAGE_KEYS).toEqual({
      TOOLBAR_PREFERENCES: '@zeroislenotes:toolbar_preferences',
      RECENT_COLORS: '@zeroislenotes:recent_colors',
      CURRENT_PRESET: '@zeroislenotes:current_preset',
      // ColorPicker 自己那条「最近使用」key：工具栏只读不写，用于合并展示。
      PICKER_RECENT_COLORS: '@zeroislenotes:picker_recent_colors',
    });
  });

  it('PICKER_RECENT_COLORS 必须与 ColorPicker 里的字面量一致（否则合并读不到任何东西）', () => {
    const fs = require('fs');
    const path = require('path');
    const pickerSource = fs.readFileSync(
      path.join(__dirname, '..', 'ColorPicker.js'),
      'utf8',
    );
    // 直接对源码做字面量断言：这条 key 分散在两个文件里，最容易悄悄漂移。
    expect(pickerSource).toContain(`RECENT_COLORS: '${STORAGE_KEYS.PICKER_RECENT_COLORS}'`);
  });
});

describe('AllInOneToolbarPrefs / sanitizeToolbarPreferences', () => {
  it('空值与脏数据一律回落默认值且不抛错', () => {
    const inputs = [null, undefined, '', 0, 42, 'not-json', '{"lastColor":', [], ['#fff'], true];

    inputs.forEach((input) => {
      expect(() => sanitizeToolbarPreferences(input)).not.toThrow();
      expect(sanitizeToolbarPreferences(input)).toEqual(DEFAULT_PREFERENCES);
    });
  });

  it('丢弃未知字段，只保留已知字段', () => {
    const result = sanitizeToolbarPreferences({
      lastColor: '#FF0000',
      lastStrokeWidth: 8,
      lastTool: 'pencil',
      showRuler: true,
      showGrid: true,
      evilField: () => { throw new Error('不该被调用'); },
      __proto__polluted: 'x',
    });

    expect(result).toEqual({
      lastColor: '#FF0000',
      lastStrokeWidth: 8,
      lastTool: 'pencil',
      showRuler: true,
      showGrid: true,
    });
    expect(result.evilField).toBeUndefined();
  });

  it('非法颜色 / 未知工具回落默认，合法 3 位缩写被展开成 6 位', () => {
    expect(sanitizeToolbarPreferences({ lastColor: 'red' }).lastColor).toBe(DEFAULT_PREFERENCES.lastColor);
    expect(sanitizeToolbarPreferences({ lastColor: '#GGG' }).lastColor).toBe(DEFAULT_PREFERENCES.lastColor);
    expect(sanitizeToolbarPreferences({ lastColor: '#f00' }).lastColor).toBe('#FF0000');
    expect(sanitizeToolbarPreferences({ lastTool: 'teleport' }).lastTool).toBe(DEFAULT_PREFERENCES.lastTool);
    // 'pan' 由 WS-A 引入，属于用户可主动选中的合法状态。
    expect(sanitizeToolbarPreferences({ lastTool: 'pan' }).lastTool).toBe('pan');
  });

  it('粗细被 clamp 进 [1,50]，NaN/字符串数字的处理稳定', () => {
    expect(sanitizeToolbarPreferences({ lastStrokeWidth: 0 }).lastStrokeWidth).toBe(1);
    expect(sanitizeToolbarPreferences({ lastStrokeWidth: 999 }).lastStrokeWidth).toBe(50);
    expect(sanitizeToolbarPreferences({ lastStrokeWidth: '12' }).lastStrokeWidth).toBe(12);
    expect(sanitizeToolbarPreferences({ lastStrokeWidth: Number.NaN }).lastStrokeWidth).toBe(DEFAULT_PREFERENCES.lastStrokeWidth);
    expect(sanitizeToolbarPreferences({ lastStrokeWidth: 'abc' }).lastStrokeWidth).toBe(DEFAULT_PREFERENCES.lastStrokeWidth);
    // 小数被四舍五入，避免出现 0 导致原生线宽为 0 不可见。
    expect(clampStrokeWidth(0.4)).toBe(1);
  });
});

describe('AllInOneToolbarPrefs / mergeLoadedPreferences', () => {
  it('空存储不覆盖默认值，也不把字段抹成 undefined', () => {
    expect(mergeLoadedPreferences({ ...DEFAULT_PREFERENCES }, null)).toEqual(DEFAULT_PREFERENCES);
    expect(mergeLoadedPreferences({ ...DEFAULT_PREFERENCES }, '{"broken":')).toEqual(DEFAULT_PREFERENCES);
  });

  it('只覆盖存储里确实存在且合法的字段', () => {
    const merged = mergeLoadedPreferences(
      { ...DEFAULT_PREFERENCES },
      { lastColor: '#123456', lastTool: 'highlighter' },
    );

    expect(merged.lastColor).toBe('#123456');
    expect(merged.lastTool).toBe('highlighter');
    expect(merged.lastStrokeWidth).toBe(DEFAULT_PREFERENCES.lastStrokeWidth);
    expect(merged.showGrid).toBe(false);
  });
});

describe('AllInOneToolbarPrefs / 最近颜色', () => {
  it('sanitizeRecentColors 兼容数组与 JSON 字符串，并去重限长', () => {
    expect(sanitizeRecentColors(['#FF0000', '#ff0000', 'oops', null, '#00FF00']))
      .toEqual(['#FF0000', '#00FF00']);
    expect(sanitizeRecentColors('["#ABC","#DDEEFF"]')).toEqual(['#AABBCC', '#DDEEFF']);
    expect(sanitizeRecentColors('not-json')).toEqual([]);
    // 15 个互不相同的合法 6 位色值，只应保留前 10 个。
    const many = Array.from({ length: 15 }, (_, i) => `#${(i * 0x111111).toString(16).padStart(6, '0')}`);
    expect(sanitizeRecentColors(many).length).toBe(10);
  });

  it('pickRecentColors 按 maxVisible 截取，非法 maxVisible 回落到全部', () => {
    const colors = ['#111111', '#222222', '#333333'];
    expect(pickRecentColors(colors, 2)).toEqual(['#111111', '#222222']);
    expect(pickRecentColors(colors, 0)).toEqual([]);
    expect(pickRecentColors(colors, 'bad')).toEqual(colors);
    expect(pickRecentColors(null, 3)).toEqual([]);
  });

  it('toSwatchList 过滤非法项并给出唯一 key', () => {
    expect(toSwatchList(['#fff', 'nope', '#FFF'])).toEqual([
      { color: '#FFFFFF', key: '#FFFFFF-0' },
      { color: '#FFFFFF', key: '#FFFFFF-2' },
    ]);
    expect(toSwatchList(undefined)).toEqual([]);
  });

  it('addRecentColor 置顶去重且限长', () => {
    expect(addRecentColor(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111']);
    expect(addRecentColor(['#111111'], 'garbage')).toEqual(['#111111']);
    expect(addRecentColor(Array.from({ length: 10 }, (_, i) => `#00000${i}`), '#ABCDEF').length).toBe(10);
    expect(normalizeColor('#abc')).toBe('#AABBCC');
  });
});

describe('AllInOneToolbarPrefs / createPreferencesLoader（缺陷 1 的回归）', () => {
  it('首次加载完成前 canPersist() 恒为 false', () => {
    const storage = createFakeStorage();
    const loader = createPreferencesLoader({ storage });

    expect(loader.canPersist()).toBe(false);
    expect(loader.isLoaded()).toBe(false);
    // 组件在挂载瞬间就会跑 1 秒防抖保存；此时落盘等于把默认值写回磁盘。
    expect(loader.canPersist()).toBe(false);
  });

  it('load() 完成后 canPersist() 才为 true，并把读到的值作为 applied 结果返回', async () => {
    const storage = createFakeStorage({
      [STORAGE_KEYS.TOOLBAR_PREFERENCES]: JSON.stringify({
        lastColor: '#FF00FF',
        lastStrokeWidth: 9,
        lastTool: 'brush',
        showGrid: true,
      }),
      [STORAGE_KEYS.RECENT_COLORS]: JSON.stringify(['#FF00FF', '#00FF00']),
      [STORAGE_KEYS.CURRENT_PRESET]: 'presentation',
    });

    const loader = createPreferencesLoader({ storage });
    const result = await loader.load();

    expect(loader.canPersist()).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.preferences).toEqual({
      lastColor: '#FF00FF',
      lastStrokeWidth: 9,
      lastTool: 'brush',
      showRuler: false,
      showGrid: true,
    });
    expect(result.recentColors).toEqual(['#FF00FF', '#00FF00']);
    expect(result.currentPreset).toBe('presentation');
    expect(typeof result.loadedAt).toBe('number');
    // 4 = toolbar_preferences + recent_colors + current_preset + picker_recent_colors
    // （集成期新增最后一条：把 ColorPicker 的「最近使用」一并读进来，否则两边不联动）
    expect(storage.getItem).toHaveBeenCalledTimes(4);
  });

  it('并发调用 load() 只读一次磁盘（避免挂载期多次抖动）', async () => {
    const storage = createFakeStorage();
    const loader = createPreferencesLoader({ storage });

    await Promise.all([loader.load(), loader.load(), loader.load()]);
    expect(storage.getItem).toHaveBeenCalledTimes(4);
  });

  it('加载完成后再次 load() 直接复用快照，不再读盘', async () => {
    const storage = createFakeStorage();
    const loader = createPreferencesLoader({ storage });

    await loader.load();
    const again = await loader.load();
    expect(again.applied).toBe(false);
    expect(storage.getItem).toHaveBeenCalledTimes(4);
  });

  it('存储抛错时退化为默认值并置位 loaded，保证本次会话仍能保存（且不抛错）', async () => {
    const storage = {
      getItem: jest.fn(async () => { throw new Error('disk exploded'); }),
      setItem: jest.fn(),
    };
    const loader = createPreferencesLoader({ storage });

    // 每个 key 的读取失败都在 loader 内部被吞掉：一次坏读不该让整个工具栏崩，
    // 也不该让本次会话永远不落盘（loaded 必须置位）。
    const result = await loader.load();
    expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(result.recentColors).toEqual([]);
    expect(result.error).toBeNull();
    expect(loader.canPersist()).toBe(true);
  });

  it('没有任何 storage 时退化为默认值而不是崩溃', async () => {
    const loader = createPreferencesLoader({});
    const result = await loader.load();

    expect(result.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(loader.canPersist()).toBe(true);
  });

  it('markUserTouched 后，迟到的加载结果不得覆盖用户已改的字段', () => {
    const loader = createPreferencesLoader({});
    loader.markUserTouched('lastColor');

    const merged = loader.mergeIfNotTouched(
      { lastColor: '#AAAAAA', lastStrokeWidth: 7 },
      { lastColor: '#BBBBBB', lastStrokeWidth: 2 },
    );

    expect(merged.lastColor).toBe('#BBBBBB');
    expect(merged.lastStrokeWidth).toBe(7);
    expect(loader.isTouched('lastColor')).toBe(true);
    expect(loader.isTouched('lastStrokeWidth')).toBe(false);
    // 未知字段名不允许污染 touched 集合。
    loader.markUserTouched('notAField');
    expect(loader.isTouched('notAField')).toBe(false);
  });

  it('deriveTouchedFields 从当前值反推用户已动过的字段', () => {
    expect(deriveTouchedFields({
      lastColor: '#FF0000',
      lastStrokeWidth: 2,
      lastTool: 'pen',
      showRuler: false,
      showGrid: true,
    })).toEqual(['lastColor', 'showGrid']);

    expect(deriveTouchedFields({})).toEqual([]);
    expect(deriveTouchedFields(null)).toEqual([]);
  });
});
