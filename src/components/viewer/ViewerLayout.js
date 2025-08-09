import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// 文件查看器通用布局（顶部预留工具栏间距、内容层、底部页码层）
const ViewerLayout = ({ colors, children, style, contentStyle }) => (
  <View style={[styles.container, { backgroundColor: colors?.background || 'white' }, style]}>
    <View style={[styles.contentContainer, contentStyle]}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 40 : 30,
    position: 'relative',
  },
});

export default ViewerLayout;

