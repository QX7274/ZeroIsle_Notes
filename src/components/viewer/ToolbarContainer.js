import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const ToolbarContainer = ({ children, style }) => (
  <View style={[styles.toolbarContainer, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  toolbarContainer: {
    position: 'absolute',
    // 调整位置紧贴文件历史控件
    // 标题栏高度 + 文件历史控件高度，无间距
    top: 84,
    left: 0,
    right: 0,
    zIndex: 1000, // 提高层级，确保在顶层
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    elevation: 10, // Android 层级
  },
});

export default ToolbarContainer;

