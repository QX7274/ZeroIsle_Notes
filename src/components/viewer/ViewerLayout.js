import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import FileHistoryNavigation from './FileHistoryNavigation';

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
  hasExternalToolbar = false, // 是否有外部的ToolbarContainer
  externalToolbarHeight = 40, // 外部工具栏的高度（ToolbarContainer + AllInOneToolbar）
  showHistoryNavigation = true, // 是否显示历史导航
  historyNavigationHeight = 28, // 历史导航组件高度（缩小）
  noteId, // 笔记ID，用于历史导航
  navigation // 导航对象
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

    {/* 历史导航组件 - 位于标题栏和内容之间，高度受控 */}
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

    {/* 内容区域 - 考虑所有上方组件的高度 */}
    <View style={[
      styles.contentContainer,
      {
        // 计算上方所有组件的总高度
        marginTop: hasExternalToolbar
          ? externalToolbarHeight + (showHistoryNavigation ? historyNavigationHeight : 0) + 24 // 外部工具栏 + 历史导航 + 更大间距
          : (showToolbar ? toolbarHeight : 0) + (showHistoryNavigation ? historyNavigationHeight : 0) + 24, // 内部工具栏 + 历史导航 + 更大间距
        paddingTop: 0 // 移除额外的paddingTop，使用marginTop统一控制
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
  historyNavigationContainer: {
    backgroundColor: 'rgba(248, 249, 250, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden', // 确保内容不超出高度限制
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
    // 动态样式会覆盖这些默认值
  },
});

export default ViewerLayout;

