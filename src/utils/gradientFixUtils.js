/**
 * 渐变组件修复工具
 * 
 * 这个文件用于修复LinearGradient组件的问题
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { checkNativeModule } from './nativeModuleFix';

// 检查BVLinearGradient模块是否存在
const hasBVLinearGradient = checkNativeModule('BVLinearGradient');

/**
 * 创建备用渐变组件
 * 当原生LinearGradient组件不可用时使用
 */
export const FallbackGradient = ({ colors, style, children, ...props }) => {
  // 使用第一个颜色作为背景色
  const backgroundColor = Array.isArray(colors) && colors.length > 0 ? colors[0] : '#FFFFFF';
  
  return (
    <View style={[{ backgroundColor }, style]} {...props}>
      {children}
    </View>
  );
};

/**
 * 获取可用的渐变组件
 * 如果原生LinearGradient组件不可用，则使用备用组件
 */
export const getGradientComponent = () => {
  if (hasBVLinearGradient) {
    // 动态导入LinearGradient组件
    try {
      const LinearGradient = require('react-native-linear-gradient').default;
      return LinearGradient;
    } catch (error) {
      console.warn('无法导入LinearGradient组件:', error);
      return FallbackGradient;
    }
  }
  
  console.warn('BVLinearGradient模块不可用，使用备用渐变组件');
  return FallbackGradient;
};

export default {
  hasBVLinearGradient,
  FallbackGradient,
  getGradientComponent,
};
