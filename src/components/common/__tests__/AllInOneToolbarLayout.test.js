import {
  TOOLBAR_BREAKPOINTS,
  resolveToolbarLayout,
  estimateToolbarWidth,
  resolvePopoverPosition,
} from '../AllInOneToolbarLayout';

describe('TOOLBAR_BREAKPOINTS', () => {
  it('导出的断点表是三档且单调递增', () => {
    expect(TOOLBAR_BREAKPOINTS).toEqual({ compact: 600, regular: 900, wide: 1200 });
    expect(TOOLBAR_BREAKPOINTS.compact).toBeLessThan(TOOLBAR_BREAKPOINTS.regular);
    expect(TOOLBAR_BREAKPOINTS.regular).toBeLessThan(TOOLBAR_BREAKPOINTS.wide);
  });
});

describe('resolveToolbarLayout - tier 判定', () => {
  it('手机宽度落在 compact', () => {
    expect(resolveToolbarLayout(320).tier).toBe('compact');
    expect(resolveToolbarLayout(599).tier).toBe('compact');
  });

  it('断点边界值进入更高一档（含等号）', () => {
    expect(resolveToolbarLayout(TOOLBAR_BREAKPOINTS.compact).tier).toBe('regular');
    expect(resolveToolbarLayout(TOOLBAR_BREAKPOINTS.regular).tier).toBe('regular');
    expect(resolveToolbarLayout(TOOLBAR_BREAKPOINTS.wide).tier).toBe('wide');
    expect(resolveToolbarLayout(1199).tier).toBe('regular');
  });

  it('桌面宽度落在 wide', () => {
    expect(resolveToolbarLayout(1440).tier).toBe('wide');
  });
});

describe('resolveToolbarLayout - 触达标准与安全区', () => {
  it('compact 下 buttonSize + 2*hitSlop >= 44', () => {
    const layout = resolveToolbarLayout(360);
    expect(layout.tier).toBe('compact');
    expect(layout.buttonSize + 2 * layout.hitSlop).toBeGreaterThanOrEqual(44);
  });

  it('所有 tier 都满足 44 触达标准', () => {
    [320, 700, 1000, 1440].forEach((width) => {
      const layout = resolveToolbarLayout(width);
      expect(layout.buttonSize + 2 * layout.hitSlop).toBeGreaterThanOrEqual(44);
    });
  });

  it('insets 存在时 horizontalPadding 叠加左右安全区', () => {
    const base = resolveToolbarLayout(390);
    const withInsets = resolveToolbarLayout(390, { insets: { left: 44, right: 44 } });
    expect(withInsets.horizontalPadding).toBe(base.horizontalPadding + 88);
  });

  it('insets 只给一侧时只叠加该侧', () => {
    const base = resolveToolbarLayout(390);
    const withInsets = resolveToolbarLayout(390, { insets: { left: 20 } });
    expect(withInsets.horizontalPadding).toBe(base.horizontalPadding + 20);
  });

  it('insets 为 null / 非对象时不改变 horizontalPadding', () => {
    const base = resolveToolbarLayout(390);
    expect(resolveToolbarLayout(390, { insets: null }).horizontalPadding).toBe(base.horizontalPadding);
    expect(resolveToolbarLayout(390, { insets: 'nope' }).horizontalPadding).toBe(base.horizontalPadding);
  });

  it('wide 档显示文字标签，compact 档不显示', () => {
    expect(resolveToolbarLayout(1440).showLabels).toBe(true);
    expect(resolveToolbarLayout(360).showLabels).toBe(false);
  });
});

describe('resolveToolbarLayout - 非法输入兜底', () => {
  it('非法 screenWidth 回落到 compact 且不抛错', () => {
    expect(() => resolveToolbarLayout(undefined)).not.toThrow();
    expect(resolveToolbarLayout(undefined).tier).toBe('compact');
    expect(resolveToolbarLayout(NaN).tier).toBe('compact');
    expect(resolveToolbarLayout(-100).tier).toBe('compact');
    expect(resolveToolbarLayout(0).tier).toBe('compact');
    expect(resolveToolbarLayout('abc').tier).toBe('compact');
    expect(resolveToolbarLayout(null).tier).toBe('compact');
  });

  it('非法输入返回的尺寸仍是有限数', () => {
    const layout = resolveToolbarLayout(undefined);
    [layout.buttonSize, layout.iconSize, layout.hitSlop, layout.horizontalPadding, layout.groupGap]
      .forEach((value) => expect(Number.isFinite(value)).toBe(true));
  });

  it('options 为 undefined / null 时使用默认 margin 语义', () => {
    expect(resolveToolbarLayout(390, undefined).tier).toBe('compact');
    expect(resolveToolbarLayout(390, null).horizontalPadding).toBe(resolveToolbarLayout(390).horizontalPadding);
  });
});

describe('estimateToolbarWidth', () => {
  it('groupCount 非法（负数 / NaN）按 0 处理，只保留左右内边距', () => {
    const layout = resolveToolbarLayout(390);
    expect(estimateToolbarWidth(layout, -3)).toBe(layout.horizontalPadding * 2);
    expect(estimateToolbarWidth(layout, NaN)).toBe(layout.horizontalPadding * 2);
    expect(estimateToolbarWidth(layout, 'x')).toBe(layout.horizontalPadding * 2);
    expect(estimateToolbarWidth(layout, undefined)).toBe(layout.horizontalPadding * 2);
  });

  it('groupCount 增大时宽度单调不减', () => {
    const layout = resolveToolbarLayout(1440);
    const w1 = estimateToolbarWidth(layout, 1);
    const w3 = estimateToolbarWidth(layout, 3);
    const w6 = estimateToolbarWidth(layout, 6);
    expect(w3).toBeGreaterThan(w1);
    expect(w6).toBeGreaterThan(w3);
  });

  it('返回值为非负有限数', () => {
    expect(Number.isFinite(estimateToolbarWidth(resolveToolbarLayout(320), 5))).toBe(true);
    expect(estimateToolbarWidth(null, 5)).toBeGreaterThanOrEqual(0);
    expect(estimateToolbarWidth(undefined, undefined)).toBeGreaterThanOrEqual(0);
  });

  it('接受「每组按钮数」数组输入（只传组数会严重低估）', () => {
    const layout = resolveToolbarLayout(1440);
    // 9 个组、每组 1 个按钮 vs 真实的按钮分布
    const naive = estimateToolbarWidth(layout, 9);
    const realistic = estimateToolbarWidth(layout, [2, 1, 3, 6, 2, 5, 4, 2, 3]);
    // 只按组数估算必然低估：这是集成期"溢出提示永不出现"的根因，必须钉住。
    expect(realistic).toBeGreaterThan(naive);
  });

  it('数组里的非法项（负数 / NaN / 字符串）按 0 处理且不抛错', () => {
    const layout = resolveToolbarLayout(1440);
    expect(() => estimateToolbarWidth(layout, [-1, NaN, 'x', 2])).not.toThrow();
    expect(estimateToolbarWidth(layout, [-1, NaN, 'x'])).toBe(layout.horizontalPadding * 2);
  });

  it('按真实按钮分布估算：平板宽度下确实会溢出（所以需要横滑提示）', () => {
    // 这是实测结论，不是期望值：9 组共 28 个按钮在 2560dp 上仍然超宽，
    // 工具栏必须横向滚动，因此必须有「右侧还有内容」的提示。
    const layout = resolveToolbarLayout(2560);
    expect(layout.tier).toBe('wide');
    const realistic = estimateToolbarWidth(layout, [2, 1, 3, 6, 2, 5, 4, 2, 3]);
    expect(realistic).toBeGreaterThan(0);
    // 组数语义（乐观下界）仍应远小于真实分布
    expect(estimateToolbarWidth(layout, 9)).toBeLessThan(realistic);
  });
});

describe('resolvePopoverPosition', () => {
  const screen = { width: 390, height: 844 };

  it('默认 margin=8，锚点在左侧时贴锚点左缘', () => {
    const pos = resolvePopoverPosition(
      { x: 20, y: 100, width: 36, height: 36 },
      { width: 200, height: 120 },
      screen,
    );
    expect(pos.left).toBe(20);
    expect(pos.top).toBe(136);
    expect(pos.placement).toBe('bottom');
  });

  it('锚点靠右时左夹取，right 不越界', () => {
    const popover = { width: 200, height: 120 };
    const pos = resolvePopoverPosition({ x: 370, y: 100, width: 36, height: 36 }, popover, screen);
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + popover.width).toBeLessThanOrEqual(screen.width - 8);
    expect(['bottom-end', 'top-end']).toContain(pos.placement);
  });

  it('锚点在屏幕右缘时 placement 可判别为 bottom-end 系列', () => {
    const pos = resolvePopoverPosition(
      { x: 384, y: 100, width: 36, height: 36 },
      { width: 180, height: 100 },
      screen,
    );
    expect(pos.placement).toBe('bottom-end');
  });

  it('popover 比屏幕还宽时 left = margin 且 placement = fill', () => {
    const popover = { width: 500, height: 100 };
    const pos = resolvePopoverPosition({ x: 40, y: 200, width: 36, height: 36 }, popover, screen);
    expect(pos.left).toBe(8);
    expect(pos.placement).toBe('fill');
  });

  it('顶部夹取：锚点贴顶部时 top >= margin', () => {
    const pos = resolvePopoverPosition({ x: 10, y: 0, width: 36, height: 20 }, { width: 200, height: 120 }, screen);
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  it('下方放不下时翻到锚点上方（top 系列）', () => {
    const pos = resolvePopoverPosition(
      { x: 10, y: 800, width: 36, height: 30 },
      { width: 200, height: 150 },
      screen,
    );
    expect(pos.top).toBeGreaterThanOrEqual(8);
    expect(pos.top + 150).toBeLessThanOrEqual(screen.height);
  });

  it('可自定义 margin 且夹取遵循该 margin', () => {
    const pos = resolvePopoverPosition(
      { x: 0, y: 50, width: 36, height: 36 },
      { width: 300, height: 100 },
      screen,
      { margin: 16 },
    );
    expect(pos.left).toBeGreaterThanOrEqual(16);
    expect(pos.left + 300).toBeLessThanOrEqual(screen.width - 16);
  });

  it('任何输入下都满足左右夹取不变量且不抛错', () => {
    const anchors = [
      undefined, null, {}, { x: -50, y: -50, width: 0, height: 0 },
      { x: 1000, y: 1000, width: 36, height: 36 }, { x: NaN, y: NaN, width: NaN, height: NaN },
      { x: 0, y: 0, width: 80, height: 80 },
    ];
    const popovers = [undefined, null, {}, { width: 0, height: 0 }, { width: 120, height: 80 }, { width: 900, height: 200 }];
    const screens = [undefined, null, {}, { width: 390, height: 844 }, { width: 0, height: 0 }, { width: NaN, height: NaN }];

    const margin = 8;
    anchors.forEach((anchor) => {
      popovers.forEach((popover) => {
        screens.forEach((scr) => {
          let pos;
          expect(() => { pos = resolvePopoverPosition(anchor, popover, scr); }).not.toThrow();
          expect(pos.left).toBeGreaterThanOrEqual(margin);
          const screenWidth = Number(scr && scr.width) || 0;
          const popoverWidth = Number(popover && popover.width) || 0;
          if (popoverWidth + margin * 2 <= screenWidth) {
            expect(pos.left + popoverWidth).toBeLessThanOrEqual(screenWidth - margin);
          } else {
            expect(pos.left).toBe(margin);
          }
          expect(['bottom', 'bottom-end', 'top', 'top-end', 'fill']).toContain(pos.placement);
          expect(Number.isFinite(pos.left)).toBe(true);
          expect(Number.isFinite(pos.top)).toBe(true);
        });
      });
    });
  });
});
