/**
 * 形状清单（单一来源）。
 *
 * 为什么要单独抽一个文件：
 * 此前工具栏（AllInOneToolbar 的 SHAPES 常量）与 ShapeToolSelector 各写一份形状 id，
 * 而两端原生又各自实现了一份 if-else 分支，三处清单互不相同：
 * 用户在面板里能选到的形状，原生可能根本不认识，于是被静默回落到直线。
 *
 * 这里给出唯一权威清单，并标注每个形状在「分页 / 无限 / PDF」三类表面上的原生支持情况；
 * 测试会断言原生源码里的分支覆盖了此清单，从机制上防止再次漂移。
 */

/** 形状 id → 元信息。supported 表示原生已实现的分支（与原生源码保持同步）。 */
const SHAPE_CATALOG = Object.freeze({
  line: { label: '直线', supported: true },
  arrow: { label: '箭头', supported: true },
  double_arrow: { label: '双向箭头', supported: true },
  rectangle: { label: '矩形', supported: true },
  rounded_rect: { label: '圆角矩形', supported: true },
  circle: { label: '圆形', supported: true },
  ellipse: { label: '椭圆', supported: true },
  triangle: { label: '三角形', supported: true },
  diamond: { label: '菱形', supported: true },
  parallelogram: { label: '平行四边形', supported: true },
  pentagon: { label: '五边形', supported: true },
  hexagon: { label: '六边形', supported: true },
  polygon: { label: '多边形', supported: true },
  star: { label: '五角星', supported: true },
  heart: { label: '心形', supported: true },
  arc: { label: '弧形', supported: true },
  curve: { label: '曲线', supported: true },
});

/** 全部形状 id（顺序即 UI 展示顺序）。 */
const SHAPE_IDS = Object.freeze(Object.keys(SHAPE_CATALOG));

/** 原生是否已实现该形状。未实现时应显式告警，而不是静默回落。 */
const isShapeSupported = (shapeId) => !!SHAPE_CATALOG[shapeId]?.supported;

/** 形状在原生不支持时的兜底 id（原生会画成直线，但会打 WARN 日志）。 */
const FALLBACK_SHAPE_ID = 'line';

module.exports = {
  SHAPE_CATALOG,
  SHAPE_IDS,
  FALLBACK_SHAPE_ID,
  isShapeSupported,
};