/**
 * 可访问性上下文
 * 提供应用范围内的可访问性状态和功能
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Accessibility from '../utils/accessibility';

// 创建可访问性上下文
const AccessibilityContext = createContext({
  isScreenReaderEnabled: false,
  isReduceMotionEnabled: false,
  isHighContrastEnabled: false,
  isBoldTextEnabled: false,
  isGrayscaleEnabled: false,
  isInvertColorsEnabled: false,
  announceForAccessibility: () => {},
  getAccessibilityProps: () => ({}),
});

// 可访问性提供者组件
export const AccessibilityProvider = ({ children }) => {
  // 可访问性状态
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isHighContrastEnabled, setIsHighContrastEnabled] = useState(false);
  const [isBoldTextEnabled, setIsBoldTextEnabled] = useState(false);
  const [isGrayscaleEnabled, setIsGrayscaleEnabled] = useState(false);
  const [isInvertColorsEnabled, setIsInvertColorsEnabled] = useState(false);

  // 初始化可访问性状态
  useEffect(() => {
    const initAccessibility = async () => {
      // 获取屏幕阅读器状态
      const screenReaderEnabled = await Accessibility.isScreenReaderEnabled();
      setIsScreenReaderEnabled(screenReaderEnabled);

      // 获取减少动画状态
      const reduceMotionEnabled = await Accessibility.isReduceMotionEnabled();
      setIsReduceMotionEnabled(reduceMotionEnabled);

      // 获取高对比度状态
      const highContrastEnabled = await Accessibility.isHighContrastEnabled();
      setIsHighContrastEnabled(highContrastEnabled);

      // 获取粗体文本状态
      const boldTextEnabled = await Accessibility.isBoldTextEnabled();
      setIsBoldTextEnabled(boldTextEnabled);

      // 获取灰度模式状态
      const grayscaleEnabled = await Accessibility.isGrayscaleEnabled();
      setIsGrayscaleEnabled(grayscaleEnabled);

      // 获取反转颜色状态
      const invertColorsEnabled = await Accessibility.isInvertColorsEnabled();
      setIsInvertColorsEnabled(invertColorsEnabled);
    };

    initAccessibility();
  }, []);

  // 添加可访问性状态变化监听器
  useEffect(() => {
    // 屏幕阅读器状态变化监听器
    const screenReaderListener = Accessibility.addScreenReaderListener(
      (isEnabled) => {
        setIsScreenReaderEnabled(isEnabled);
      }
    );

    // 减少动画状态变化监听器
    const reduceMotionListener = Accessibility.addReduceMotionListener(
      (isEnabled) => {
        setIsReduceMotionEnabled(isEnabled);
      }
    );

    // 高对比度状态变化监听器
    const highContrastListener = Accessibility.addHighContrastListener(
      (isEnabled) => {
        setIsHighContrastEnabled(isEnabled);
      }
    );

    // 粗体文本状态变化监听器
    const boldTextListener = Accessibility.addBoldTextListener(
      (isEnabled) => {
        setIsBoldTextEnabled(isEnabled);
      }
    );

    // 灰度模式状态变化监听器
    const grayscaleListener = Accessibility.addGrayscaleListener(
      (isEnabled) => {
        setIsGrayscaleEnabled(isEnabled);
      }
    );

    // 反转颜色状态变化监听器
    const invertColorsListener = Accessibility.addInvertColorsListener(
      (isEnabled) => {
        setIsInvertColorsEnabled(isEnabled);
      }
    );

    // 清理监听器
    return () => {
      screenReaderListener();
      reduceMotionListener();
      highContrastListener();
      boldTextListener();
      grayscaleListener();
      invertColorsListener();
    };
  }, []);

  // 宣告屏幕阅读器消息
  const announceForAccessibility = (message) => {
    Accessibility.announceForAccessibility(message);
  };

  // 获取可访问性属性
  const getAccessibilityProps = (
    label,
    hint = '',
    isButton = false,
    isSelected = false,
    isDisabled = false
  ) => {
    return Accessibility.getAccessibilityProps(
      label,
      hint,
      isButton,
      isSelected,
      isDisabled
    );
  };

  // 上下文值
  const contextValue = {
    isScreenReaderEnabled,
    isReduceMotionEnabled,
    isHighContrastEnabled,
    isBoldTextEnabled,
    isGrayscaleEnabled,
    isInvertColorsEnabled,
    announceForAccessibility,
    getAccessibilityProps,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// 使用可访问性的钩子
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export default AccessibilityContext;
