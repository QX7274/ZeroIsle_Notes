/**
 * 社区帖子列表组件
 */
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import PostItem from './PostItem';

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
  const { colors } = theme;

  const postCount = posts.length;
  const listState = error ? 'error' : isLoading && postCount === 0 ? 'loading' : postCount === 0 ? 'empty' : 'ready';
  const loadingMoreVisible = isLoading && !isRefreshing && postCount > 0;

  const renderEmpty = () => {
    if (isLoading && !isRefreshing) {
      return null;
    }
    return (
      <View style={styles.emptyContainer} testID="state.community.postList.empty">
        <Icon name="forum" size={64} color={colors.textSecondary} />
        <Text variant="body" size="medium" color="hint" style={styles.emptyText}>
          暂无社区内容
        </Text>
      </View>
    );
  };

  const renderError = () => {
    if (!error) {
      return null;
    }
    return (
      <View style={styles.errorContainer} testID="state.community.postList.error">
        <Icon name="error" size={48} color={colors.error} />
        <Text variant="body" size="medium" color="error" style={styles.errorText}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onRefresh}
          testID="action.community.postList.retry"
        >
          <Text variant="body" size="small" color="card">
            重试
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMoreVisible) {
      return null;
    }
    return (
      <View style={styles.footerContainer} testID="state.community.postList.loadingMore">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text variant="body" size="small" color="hint" style={styles.footerText}>
          正在加载更多...
        </Text>
      </View>
    );
  };

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

  const handleLoadMore = () => {
    if (isLoading || !hasMore) {
      return;
    }
    onLoadMore && onLoadMore();
  };

  return (
    <View style={styles.container} testID={`state.community.postList.state.${listState}`}>
      <View testID={`state.community.postList.count.${postCount}`} />
      <View testID={`state.community.postList.refreshing.visibility.${isRefreshing ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.postList.loadingMore.visibility.${loadingMoreVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.postList.error.visibility.${error ? 'visible' : 'hidden'}`} />

      {error ? (
        renderError()
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item?.id || `post-${index}`)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              testID="action.community.postList.refresh"
            />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          testID="list.community.postList"
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
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.20)',
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
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
