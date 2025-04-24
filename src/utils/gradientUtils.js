/**
 * 渐变色工具函数
 * 用于在React Native中创建渐变背景
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { getGradientComponent } from './gradientFixUtils';

// 获取可用的渐变组件
const LinearGradient = getGradientComponent();

/**
 * 创建线性渐变背景
 * @param {Array} colors - 渐变颜色数组
 * @param {Array} locations - 渐变位置数组，可选
 * @param {string} start - 渐变起点，格式为 {x, y}
 * @param {string} end - 渐变终点，格式为 {x, y}
 * @param {object} style - 附加样式
 * @param {object} props - 其他属性
 * @returns {JSX.Element} - 渐变组件
 */
export const createLinearGradient = (
  colors,
  {
    locations = null,
    start = { x: 0, y: 0 },
    end = { x: 1, y: 0 },
    style = {},
    ...props
  } = {}
) => {
  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      locations={locations}
      style={[styles.gradient, style]}
      {...props}
    />
  );
};

/**
 * 创建水平渐变背景
 * @param {Array} colors - 渐变颜色数组
 * @param {object} options - 配置选项
 * @returns {JSX.Element} - 渐变组件
 */
export const createHorizontalGradient = (colors, options = {}) => {
  return createLinearGradient(colors, {
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    ...options
  });
};

/**
 * 创建垂直渐变背景
 * @param {Array} colors - 渐变颜色数组
 * @param {object} options - 配置选项
 * @returns {JSX.Element} - 渐变组件
 */
export const createVerticalGradient = (colors, options = {}) => {
  return createLinearGradient(colors, {
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    ...options
  });
};

/**
 * 创建对角线渐变背景
 * @param {Array} colors - 渐变颜色数组
 * @param {object} options - 配置选项
 * @returns {JSX.Element} - 渐变组件
 */
export const createDiagonalGradient = (colors, options = {}) => {
  return createLinearGradient(colors, {
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    ...options
  });
};

/**
 * 创建反对角线渐变背景
 * @param {Array} colors - 渐变颜色数组
 * @param {object} options - 配置选项
 * @returns {JSX.Element} - 渐变组件
 */
export const createReverseDiagonalGradient = (colors, options = {}) => {
  return createLinearGradient(colors, {
    start: { x: 1, y: 0 },
    end: { x: 0, y: 1 },
    ...options
  });
};

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});

export default {
  createLinearGradient,
  createHorizontalGradient,
  createVerticalGradient,
  createDiagonalGradient,
  createReverseDiagonalGradient,
};
