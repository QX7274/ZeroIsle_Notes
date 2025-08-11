import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';

/**
 * 文档查看器通用布局组件
 * 确保所有查看器的布局一致性，内容区域紧贴工具栏下方
 */
const ViewerLayout = ({
  colors,
  children,
  style,
  contentStyle,
  headerLeft,
  headerRight,
  title,
  showToolbar = true,
  toolbarHeight = 56 // 标准工具栏高度
}) => (
  <View style={[styles.container, { backgroundColor: colors?.background }, style]}>
    {/* 工具栏区域 */}
    {showToolbar && (
      <View style={[styles.toolbar, { height: toolbarHeight, backgroundColor: colors?.surface || colors?.background }]}>
        {/* 左侧按钮 */}
        {!!headerLeft && (
          <View style={styles.headerLeftWrap} pointerEvents="box-none">
            {headerLeft}
          </View>
        )}


        {/* 标题 */}
        {title && (
          <View style={styles.titleContainer}>
            <Text style={[styles.titleText, { color: colors?.text }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
        )}

        {/* 右侧按钮 */}
        {!!headerRight && (
          <View style={styles.headerRightWrap} pointerEvents="box-none">
            {headerRight}
          </View>
        )}
      </View>
    )}

    {/* 内容区域 - 紧贴工具栏下方，无额外间距 */}
    <View style={[
      styles.contentContainer,
      {
        marginTop: showToolbar ? 0 : (Platform.OS === 'ios' ? 44 : 24) // 如果没有工具栏，添加状态栏间距
      },
      contentStyle
    ]}>
      {children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 24, // 状态栏高度
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'flex-start',
  },
  headerRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'flex-end',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
    // 确保内容区域紧贴工具栏，无额外间距
    marginTop: 0,
    paddingTop: 0,
  },
});

export default ViewerLayout;

