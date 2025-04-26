/**
 * 虚拟列表组件
 * 提供高性能的大数据列表渲染
 */
import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Text,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * 虚拟列表组件
 * @param {Array} data - 列表数据
 * @param {function} renderItem - 渲染项函数
 * @param {function} keyExtractor - 提取键函数
 * @param {function} onEndReached - 到达末尾回调
 * @param {function} onRefresh - 刷新回调
 * @param {boolean} refreshing - 是否正在刷新
 * @param {boolean} loading - 是否正在加载更多
 * @param {boolean} hasMore - 是否有更多数据
 * @param {string} emptyText - 空列表文本
 * @param {React.ReactNode} emptyComponent - 自定义空列表组件
 * @param {React.ReactNode} headerComponent - 列表头部组件
 * @param {React.ReactNode} footerComponent - 列表底部组件
 * @param {object} style - 自定义样式
 * @param {object} contentContainerStyle - 内容容器自定义样式
 * @param {number} initialNumToRender - 初始渲染数量
 * @param {number} maxToRenderPerBatch - 每批次最大渲染数量
 * @param {number} windowSize - 窗口大小
 * @param {number} updateCellsBatchingPeriod - 更新单元格批处理周期
 */
const VirtualizedList = ({
  data = [],
  renderItem,
  keyExtractor,
  onEndReached,
  onRefresh,
  refreshing = false,
  loading = false,
  hasMore = true,
  emptyText = '暂无数据',
  emptyComponent,
  headerComponent,
  footerComponent,
  style,
  contentContainerStyle,
  initialNumToRender = 10,
  maxToRenderPerBatch = 10,
  windowSize = 21,
  updateCellsBatchingPeriod = 50,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  const flatListRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  // 处理内容尺寸变化
  const handleContentSizeChange = useCallback((width, height) => {
    setContentHeight(height);
  }, []);
  
  // 处理容器尺寸变化
  const handleLayout = useCallback((event) => {
    setContainerHeight(event.nativeEvent.layout.height);
  }, []);
  
  // 渲染空列表
  const renderEmpty = useCallback(() => {
    if (emptyComponent) {
      return emptyComponent;
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Text
          style={[
            styles.emptyText,
            { color: colors.textSecondary },
          ]}
        >
          {emptyText}
        </Text>
      </View>
    );
  }, [emptyComponent, emptyText, colors.textSecondary]);
  
  // 渲染底部
  const renderFooter = useCallback(() => {
    if (loading && data.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    
    if (!hasMore && data.length > 0) {
      return (
        <View style={styles.footerContainer}>
          <Text
            style={[
              styles.footerText,
              { color: colors.textSecondary },
            ]}
          >
            没有更多数据了
          </Text>
        </View>
      );
    }
    
    if (footerComponent) {
      return footerComponent;
    }
    
    return null;
  }, [loading, hasMore, data.length, colors, footerComponent]);
  
  // 处理到达末尾
  const handleEndReached = useCallback(
    ({ distanceFromEnd }) => {
      if (!loading && hasMore && onEndReached) {
        onEndReached({ distanceFromEnd });
      }
    },
    [loading, hasMore, onEndReached]
  );
  
  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);
  
  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && contentHeight > containerHeight) {
      flatListRef.current.scrollToOffset({
        offset: contentHeight - containerHeight,
        animated: true,
      });
    }
  }, [contentHeight, containerHeight]);
  
  // 滚动到索引
  const scrollToIndex = useCallback((index, animated = true) => {
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated,
        viewPosition: 0.5,
      });
    }
  }, []);
  
  return (
    <FlatList
      ref={flatListRef}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor || ((item, index) => String(index))}
      style={[styles.list, style]}
      contentContainerStyle={[
        styles.contentContainer,
        data.length === 0 && styles.emptyContentContainer,
        contentContainerStyle,
      ]}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      ListEmptyComponent={renderEmpty}
      ListHeaderComponent={headerComponent}
      ListFooterComponent={renderFooter}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      updateCellsBatchingPeriod={updateCellsBatchingPeriod}
      removeClippedSubviews={true}
      {...props}
    />
  );
};

// 创建样式
const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  emptyContentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  footerContainer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default VirtualizedList;
