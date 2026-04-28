/**
 * ScreenUtils 原生模块桥接
 *
 * 提供了访问原生屏幕工具（如颜色拾取器）的功能
 */

import { NativeModules } from 'react-native';

const { ScreenUtils } = NativeModules;

/**
 * 屏幕颜色拾取器
 *
 * @returns {Promise<string>} - 返回用户选择的十六进制颜色值
 */
const pickColor = async () => {
  try {
    const color = await ScreenUtils.pickColor();
    return color;
  } catch (error) {
    console.warn('颜色拾取失败或被取消:', error);
    return null;
  }
};

export default {
  pickColor,
};

