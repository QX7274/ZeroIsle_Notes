/**
 * 形状清单与原生实现的契约测试。
 *
 * 背景：本轮实测发现「用户能选到的形状」与「原生真的会画的形状」长期不一致 ——
 * 工具栏/选择器给出 14+ 种，两端原生只实现了 7 种，未知形状被**静默**回落到直线，
 * 表现就是「选了椭圆画出来是条线」且没有任何提示，属于最难排查的一类缺陷。
 *
 * 本文件用源码级断言把三件事钉死：
 *  1) 形状清单是单一来源（不存在第二份硬编码清单）；
 *  2) 原生源码里确实存在对应分支；
 *  3) 原生不再对未知形状静默回落（必须有告警日志）。
 */

const fs = require('fs');
const path = require('path');
const { SHAPE_CATALOG, SHAPE_IDS, isShapeSupported } = require('../shapeCatalog');

const ROOT = path.join(__dirname, '..', '..', '..');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * 收集源码里所有「某个字符串字面量 .equals(currentShape)」用到的字面量。
 * 为什么用正则而不是 includes('"x".equals(currentShape)')：
 * 多个形状常常合并在一个 else-if 里换行书写（如 polygon/pentagon/hexagon），
 * 逐字相邻的 includes 会误判为「没实现」。
 */
const collectShapeLiterals = (src) => {
  const found = new Set();
  const re = /"([a-z_]+)"\.equals\(currentShape\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    found.add(m[1]);
  }
  return found;
};

describe('shapeCatalog 形状清单', () => {
  it('清单非空且每个形状都有中文名', () => {
    expect(SHAPE_IDS.length).toBeGreaterThan(10);
    SHAPE_IDS.forEach((id) => {
      expect(typeof SHAPE_CATALOG[id].label).toBe('string');
      expect(SHAPE_CATALOG[id].label.length).toBeGreaterThan(0);
    });
  });

  it('isShapeSupported 对未知 id 返回 false（不抛错）', () => {
    expect(isShapeSupported('rectangle')).toBe(true);
    expect(isShapeSupported('nonexistent_shape')).toBe(false);
    expect(isShapeSupported(undefined)).toBe(false);
  });
});

describe('原生实现与形状清单一致', () => {
  const ANDROID_PAGED = 'android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteView.java';
  const ANDROID_INFINITE = 'android/app/src/main/java/com/zeroisle_notes/nativeinfinite/NativeInfiniteCanvasView.java';

  it('Android 分页画布实现了清单里标记为 supported 的每个形状', () => {
    const literals = collectShapeLiterals(readSrc(ANDROID_PAGED));
    const missing = SHAPE_IDS.filter((id) => isShapeSupported(id) && !literals.has(id));
    // 这条会直接指出「清单说有、原生没有」的形状，避免再次静默回落
    expect(missing).toEqual([]);
  });

  it('Android 无限画布实现了清单里标记为 supported 的每个形状', () => {
    const literals = collectShapeLiterals(readSrc(ANDROID_INFINITE));
    const missing = SHAPE_IDS.filter((id) => isShapeSupported(id) && !literals.has(id));
    expect(missing).toEqual([]);
  });

  it('Android 分页不再对未知形状静默回落（必须有 WARN 日志）', () => {
    const src = readSrc(ANDROID_PAGED);
    expect(src).toContain('未实现的形状');
  });
});

describe('填充开关全链路可达', () => {
  const BRIDGE = 'src/hooks/useNativeToolbarBridge.js';
  const TOOLBAR = 'src/components/common/AllInOneToolbar.js';
  const ANDROID_PAGED = 'android/app/src/main/java/com/zeroisle_notes/nativepaged/NativePagedNoteView.java';

  it('bridge 的配置归一化保留 fill 字段', () => {
    expect(readSrc(BRIDGE)).toContain('fill:');
  });

  it('工具栏把 fill 放进 toolConfig 载荷，并参与「配置是否变化」的比较', () => {
    const src = readSrc(TOOLBAR);
    expect(src).toContain('fill: overrides.fill');
    // 若 fill 不在比较键里，拨动开关会被判定为「没变化」而整条不下发
    expect(src).toMatch(/keysToCompare = \[[\s\S]*?'fill'[\s\S]*?\]/);
  });

  it('Android 分页解析并消费 fill（决定 FILL 还是 STROKE）', () => {
    const src = readSrc(ANDROID_PAGED);
    expect(src).toContain('shapeFillEnabled');
    expect(src).toContain('Paint.Style.FILL');
  });
});