/**
 * 容器组件
 * 提供一个带有标准样式和行为的容器，用于包裹页面内容
 */
import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * 容器组件
 * @param {ReactNode} children - 子组件
 * @param {boolean} scrollable - 是否可滚动
 * @param {boolean} keyboardAvoiding - 是否避免键盘遮挡
 * @param {boolean} dismissKeyboard - 是否点击空白处关闭键盘
 * @param {boolean} useSafeArea - 是否使用安全区域
 * @param {string} backgroundColor - 背景颜色
 * @param {object} style - 自定义样式
 * @param {object} contentContainerStyle - 内容容器样式（仅在scrollable为true时有效）
 * @param {boolean} statusBarTranslucent - 状态栏是否透明
 * @param {string} statusBarStyle - 状态栏样式 ('light-content' 或 'dark-content')
 * @param {function} onScroll - 滚动事件回调
 * @param {object} scrollViewProps - 滚动视图额外属性
 */
const Container = ({
  children,
  scrollable = false,
  keyboardAvoiding = false,
  dismissKeyboard = false,
  useSafeArea = true,
  backgroundColor,
  style,
  contentContainerStyle,
  statusBarTranslucent = false,
  statusBarStyle,
  onScroll,
  scrollViewProps = {},
}) => {
  // 使用主题
  const { theme } = useTheme();
  const { colors } = theme;

  // 确定背景颜色
  const bgColor = backgroundColor || colors.background;

  // 确定状态栏样式
  const barStyle = statusBarStyle || (theme.dark ? 'light-content' : 'dark-content');

  // 渲染内容
  const renderContent = () => {
    // 基本内容
    let content = children;

    // 如果需要可滚动
    if (scrollable) {
      content = (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollViewContent,
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      );
    }

    // 如果需要避免键盘遮挡
    if (keyboardAvoiding) {
      content = (
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {content}
        </KeyboardAvoidingView>
      );
    }

    // 如果需要点击空白处关闭键盘
    if (dismissKeyboard) {
      content = (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.dismissKeyboardView}>{content}</View>
        </TouchableWithoutFeedback>
      );
    }

    return content;
  };

  // 渲染容器
  const renderContainer = () => {
    const containerStyle = [
      styles.container,
      { backgroundColor: bgColor },
      style,
    ];

    if (useSafeArea) {
      return (
        <SafeAreaView style={containerStyle}>
          {renderContent()}
        </SafeAreaView>
      );
    }

    return <View style={containerStyle}>{renderContent()}</View>;
  };

  return (
    <>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={statusBarTranslucent ? 'transparent' : bgColor}
        translucent={statusBarTranslucent}
      />
      {renderContainer()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  dismissKeyboardView: {
    flex: 1,
  },
});

export default Container;
