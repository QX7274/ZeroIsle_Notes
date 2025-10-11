import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import FileHistoryNavigation from './FileHistoryNavigation';
import AllInOneToolbar from '../common/AllInOneToolbar';

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
  toolbarHeight = 56, // 标准工具栏高度
  showHistoryNavigation = true, // 是否显示历史导航
  historyNavigationHeight = 28, // 历史导航组件高度（缩小）
  noteId, // 笔记ID，用于历史导航
  navigation, // 导航对象
  // 工具栏相关props
  toolbarProps = {},
  showExternalToolbar = true, // 是否显示工具栏
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

    {/* 历史导航组件 - 位于标题栏和工具栏之间，高度受控 */}
    {showHistoryNavigation && noteId && navigation && (
      <View style={[styles.historyNavigationContainer, { height: historyNavigationHeight }]}>
        <FileHistoryNavigation
          noteId={noteId}
          navigation={navigation}
          colors={colors}
          compact={true}
        />
      </View>
    )}

    {/* 工具栏 */}
    {showExternalToolbar && (
      <View style={styles.toolbarContainer}>
        <AllInOneToolbar
          {...toolbarProps}
        />
      </View>
    )}

    {/* 内容区域 - 使用flex布局自动填充剩余空间 */}
    <View style={[
      styles.contentContainer,
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
    zIndex: 10, // 确保工具栏在最上层
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
  historyNavigationContainer: {
    backgroundColor: 'rgba(248, 249, 250, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden', // 确保内容不超出高度限制
    zIndex: 9, // 确保历史导航在内容之上，但在工具栏之下
  },
  toolbarContainer: {
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    zIndex: 8,
  },
  contentContainer: {
    flex: 1,
    zIndex: 1, // 确保内容可见，但低于工具栏和历史导航
    // 动态样式会覆盖这些默认值
  },
});

export default ViewerLayout;

