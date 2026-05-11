describe('MindMapView accessibility smoke', () => {
  it('declares essential accessibility labels in source', () => {
    // 避免直接渲染 RN Animated/SVG 组件导致 Jest 环境不稳定，
    // 这里用源码契约测试保障关键可访问性文案不回退。
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const fs = require('fs');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const path = require('path');

    const filePath = path.join(process.cwd(), 'src/components/mind_map/MindMapView.js');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('accessibilityLabel="放大导图"');
    expect(content).toContain('accessibilityLabel="缩小导图"');
    expect(content).toContain('accessibilityLabel="重置视图"');
  });
});
