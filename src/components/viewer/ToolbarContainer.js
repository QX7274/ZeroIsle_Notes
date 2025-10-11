import React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 动态计算工具栏位置
const getToolbarTopPosition = () => {
  const statusBarHeight = Platform.OS === 'ios' ? 44 : 24;
  const headerHeight = 50; // 标题栏高度
  const historyHeight = 25; // 历史导航高度
  return statusBarHeight + headerHeight + historyHeight; // 无间隔，紧贴文件历史器
};

const ToolbarContainer = ({ children, style }) => (
  <View style={[styles.toolbarContainer, { top: getToolbarTopPosition() }, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  toolbarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000, // 确保在顶层
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    elevation: 10, // Android 层级
    // 添加安全区域支持
    ...(Platform.OS === 'ios' && {
      paddingTop: 0,
      paddingBottom: 0,
    }),
  },
});

export default ToolbarContainer;

