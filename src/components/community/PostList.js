/**
 * 社区帖子列表组件
 */
import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PostItem from './PostItem';

/**
 * 社区帖子列表组件
 * @param {Array} posts - 帖子数组
 * @param {boolean} isLoading - 是否正在加载
 * @param {boolean} isRefreshing - 是否正在刷新
 * @param {string} error - 错误信息
 * @param {Function} onRefresh - 刷新回调
 * @param {Function} onLoadMore - 加载更多回调
 * @param {Function} onPostPress - 帖子点击回调
 * @param {Function} onLikePress - 点赞回调
 * @param {Function} onCommentPress - 评论回调
 * @param {Function} onSharePress - 分享回调
 * @param {Function} onUserPress - 用户点击回调
 * @param {boolean} hasMore - 是否有更多数据
 */
const PostList = ({
  posts = [],
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onLoadMore,
  onPostPress,
  onLikePress,
  onCommentPress,
  onSharePress,
  onUserPress,
  hasMore = false,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 渲染空状态
  const renderEmpty = () => {
    if (isLoading && !isRefreshing) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="forum" size={64} color={colors.textSecondary} />
        <Text
          variant="body"
          size="medium"
          color="hint"
          style={styles.emptyText}
        >
          暂无社区内容
        </Text>
      </View>
    );
  };
  
  // 渲染错误状态
  const renderError = () => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={48} color={colors.error} />
        <Text
          variant="body"
          size="medium"
          color="error"
          style={styles.errorText}
        >
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onRefresh}
        >
          <Text
            variant="body"
            size="small"
            color="card"
          >
            重试
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // 渲染底部
  const renderFooter = () => {
    if (!isLoading || isRefreshing) return null;
    
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text
          variant="body"
          size="small"
          color="hint"
          style={styles.footerText}
        >
          正在加载更多...
        </Text>
      </View>
    );
  };
  
  // 渲染帖子项
  const renderItem = ({ item }) => (
    <PostItem
      post={item}
      onPress={() => onPostPress && onPostPress(item)}
      onLikePress={() => onLikePress && onLikePress(item)}
      onCommentPress={() => onCommentPress && onCommentPress(item)}
      onSharePress={() => onSharePress && onSharePress(item)}
      onUserPress={() => onUserPress && onUserPress(item.user)}
    />
  );
  
  // 处理加载更多
  const handleLoadMore = () => {
    if (isLoading || !hasMore) return;
    onLoadMore && onLoadMore();
  };
  
  return (
    <View style={styles.container}>
      {error ? (
        renderError()
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    marginLeft: 8,
  },
});

export default PostList;
