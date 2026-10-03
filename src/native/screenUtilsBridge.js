/**
 * ScreenUtils 原生模块桥接
 *
 * 提供了访问原生屏幕工具（如颜色拾取器）的功能
 */

import { NativeModules } from 'react-native';

const { ScreenUtils } = NativeModules;

/**
 * ScreenUtils 是否真的具备取色能力。
 *
 * 为什么需要显式探测：ScreenUtils 只有 iOS 原生实现（ios/ScreenUtils.m），
 * Android 侧 android/ 下不存在该模块。此前 pickColor 直接解引用
 * NativeModules.ScreenUtils，在 Android 上表现为 TypeError 被 catch 吞掉，
 * 调用方只能看到「取色失败」的弹窗 —— 属于「按钮在、点了必然失败」。
 * 判据只认「模块存在且导出了 pickColor 函数」，因此 Android 将来补上原生模块后
 * 前端无需改动即自动可用（而不是按 Platform.OS 写死）。
 */
const isPickColorAvailable = () => !!(ScreenUtils && typeof ScreenUtils.pickColor === 'function');

/**
 * 屏幕颜色拾取器
 *
 * @returns {Promise<string|null>} - 返回用户选择的十六进制颜色值；能力缺失时返回 null
 */
const pickColor = async () => {
  if (!isPickColorAvailable()) {
    // 不抛错、不弹窗：能力缺失是「已知的平台差异」，由 UI 层按 accessible 降级呈现。
    return null;
  }

  try {
    const color = await ScreenUtils.pickColor();
    return color;
  } catch (error) {
    console.warn('颜色拾取失败或被取消:', error);
    return null;
  }
};

export default {
  isPickColorAvailable,
  pickColor,
};

