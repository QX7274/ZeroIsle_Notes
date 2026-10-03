/**
 * ColorPicker 取色器入口的平台能力探测回归（WS-C 缺陷 6）
 *
 * 真实缺陷：screenUtilsBridge 调 NativeModules.ScreenUtils.pickColor()，
 * iOS 有原生实现（ios/ScreenUtils.m），Android 的 android/ 下根本没有这个模块。
 * 旧实现无条件渲染取色按钮，Android 用户点下去必然走到 catch 弹「无法启动取色器」——
 * 一个「存在但必然失败」的按钮。这里锁定：能力缺失时必须禁用并说明原因，
 * 能力存在时（iOS）必须可用，以免降级把 iOS 一起关掉。
 */

const React = require('react');
const { render } = require('@testing-library/react-native');
// 顶部就取到真实 react-native 模块对象：jestSetup 对 react-native 的 mock 是
// 即时工厂（没有 __esModule 标记），稳定引用才是同一个对象，
// 后面给 NativeModules 挂/摘 ScreenUtils 才能被 screenUtilsBridge 看到。
const RN = require('react-native');

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockColors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  primary: '#2563EB',
  text: '#111111',
  textSecondary: '#666666',
  textDisabled: '#9CA3AF',
  border: '#DDDDDD',
};

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: mockColors,
    theme: { colors: mockColors },
    isDarkMode: false,
  }),
}));

// 能力探测的唯一判据是「原生模块是否真的导出了 pickColor」。
// 这里只把这条判据做成可控开关，ColorPicker 的探测逻辑本身原样执行。
// （jest.mock 工厂禁止引用外部变量，所以用 global 传递开关。）
global.__screenUtilsAvailable = false;

jest.mock('../../../native/screenUtilsBridge', () => ({
  __esModule: true,
  default: {
    // 与真实实现同签名：真实实现判 NativeModules.ScreenUtils.pickColor，
    // 这里用同一个开关模拟「Android 无模块 / iOS 有模块」。
    isPickColorAvailable: () => global.__screenUtilsAvailable === true,
    pickColor: jest.fn(async () => null),
  },
}));

const ColorPicker = require('../ColorPicker').default;

const renderPicker = (props = {}) => render(
  React.createElement(ColorPicker, {
    visible: true,
    onClose: jest.fn(),
    onColorChange: jest.fn(),
    initialColor: '#FF0000',
    showEyedropper: true,
    ...props,
  }),
);

describe('ColorPicker 取色器平台能力探测', () => {
  afterEach(() => {
    global.__screenUtilsAvailable = false;
  });

  it('原生模块缺失（Android 现状）时入口 disabled 且 hint 说明原因', () => {
    global.__screenUtilsAvailable = false;

    const { getByLabelText } = renderPicker();
    const button = getByLabelText('屏幕取色器');

    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(button.props.disabled).toBe(true);
    // hint 必须让用户知道这是平台/版本限制，而不是操作错误。
    expect(button.props.accessibilityHint).toMatch(/暂未提供|暂不支持/);
  });

  it('原生模块存在且导出 pickColor（iOS 现状）时入口可用', () => {
    global.__screenUtilsAvailable = true;

    const { getByLabelText } = renderPicker();
    const button = getByLabelText('屏幕取色器');

    // 降级不能把 iOS 一起关掉：可用时按钮必须真的可点，且不显示「暂不支持」。
    expect(button.props.accessibilityState.disabled).toBe(false);
    expect(button.props.disabled).toBe(false);
    expect(button.props.accessibilityHint).toMatch(/拾取颜色/);
    expect(button.props.accessibilityHint).not.toMatch(/暂不支持|暂未提供/);
  });

  it('调用方显式关闭 showEyedropper 时入口不出现', () => {
    global.__screenUtilsAvailable = true;

    const { queryByLabelText } = renderPicker({ showEyedropper: false });
    expect(queryByLabelText('屏幕取色器')).toBeNull();
  });

  it('visible=false 时整个面板不渲染', () => {
    const { queryByLabelText } = renderPicker({ visible: false });
    expect(queryByLabelText('屏幕取色器')).toBeNull();
  });

  // 说明：本文件顶部对 screenUtilsBridge 做了模块级 mock，而 jest.mock 是按解析路径
  // 注册到模块注册表上的，即便换绝对路径 require 也仍会命中（实测确认）。
  // 因此要断言「真实桥接实现本身」，必须绕开模块注册表：手工用 babel 转译源码后求值。
  // 这也正好复现生产语义 —— 桥接在模块求值那一刻就把 NativeModules.ScreenUtils 解构了。
  const loadRealBridge = () => {
    const sourcePath = require('path').resolve(__dirname, '../../../native/screenUtilsBridge.js');
    const { code } = require('@babel/core').transformSync(
      require('fs').readFileSync(sourcePath, 'utf8'),
      { filename: sourcePath, configFile: './babel.config.js', cwd: process.cwd() },
    );

    const moduleShim = { exports: {} };
    // eslint-disable-next-line no-new-func -- 需要绕开 jest 模块注册表，见上方说明
    const evaluate = new Function('module', 'exports', 'require', code);
    evaluate(moduleShim, moduleShim.exports, require);

    return moduleShim.exports.default;
  };

  describe('screenUtilsBridge 自身（真实实现，绕开模块注册表加载）', () => {

    const originalNativeModules = RN.NativeModules;

    afterEach(() => {
      RN.NativeModules = originalNativeModules;
    });

    it('原生模块缺失（Android）时 isPickColorAvailable() 为 false，pickColor() 返回 null 且不抛错', async () => {
      RN.NativeModules = {};

      const bridge = loadRealBridge();
      expect(bridge.isPickColorAvailable()).toBe(false);
      await expect(bridge.pickColor()).resolves.toBeNull();
    });

    it('模块存在但没有 pickColor 函数时同样判为不可用（半成品原生模块也不能崩）', () => {
      RN.NativeModules = { ScreenUtils: {} };
      expect(loadRealBridge().isPickColorAvailable()).toBe(false);

      RN.NativeModules = { ScreenUtils: { pickColor: 'not-a-function' } };
      expect(loadRealBridge().isPickColorAvailable()).toBe(false);
    });

    it('原生模块存在且导出 pickColor（iOS）时 isPickColorAvailable() 为 true 并返回原生结果', async () => {
      RN.NativeModules = { ScreenUtils: { pickColor: async () => '#00FF00' } };

      const bridge = loadRealBridge();
      expect(bridge.isPickColorAvailable()).toBe(true);
      await expect(bridge.pickColor()).resolves.toBe('#00FF00');
    });

    it('原生取色被用户取消/失败时返回 null，不向调用方抛错', async () => {
      RN.NativeModules = {
        ScreenUtils: { pickColor: async () => { throw new Error('USER_CANCELLED'); } },
      };

      await expect(loadRealBridge().pickColor()).resolves.toBeNull();
    });
  });
});
