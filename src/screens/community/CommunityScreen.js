import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button, Card, Skeleton } from '../../components/common';
import { SPACING } from '../../utils/constants/dimensions';
import { fetchPosts, likePost, toggleBookmark } from '../../redux/slices/communitySlice';
import { UnifiedSearchBar } from '../../components/search';
import communityApi from '../../services/api/communityApi';
import networkErrorService from '../../services/networkErrorService';
import networkService from '../../services/network/networkService';

/**
 * 社区屏幕组件
 * 用于展示社区内容、分享资源和交流互动
 */
const CommunityScreen = ({ navigation }) => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('CommunityScreen: 主题未正确加载，使用默认主题');
      theme = {
        background: '#F2F2F2',
        card: '#FFFFFF',
        text: '#000000',
        textSecondary: '#666666',
        primary: '#007AFF',
        border: '#E5E5EA',
        shadow: 'rgba(0, 0, 0, 0.1)',
      };
    } else {
      // 确保所有需要的颜色属性都存在
      theme = {
        background: theme.colors.background || '#F2F2F2',
        card: theme.colors.card || '#FFFFFF',
        text: theme.colors.text || '#000000',
        textSecondary: theme.colors.textSecondary || '#666666',
        primary: theme.colors.primary || '#007AFF',
        border: theme.colors.border || '#E5E5EA',
        shadow: theme.colors.shadow || 'rgba(0, 0, 0, 0.1)',
      };
    }
  } catch (error) {
    console.error('CommunityScreen: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      background: '#F2F2F2',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#666666',
      primary: '#007AFF',
      border: '#E5E5EA',
      shadow: 'rgba(0, 0, 0, 0.1)',
    };
  }

  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  // 从Redux获取状态
  const { posts, isLoading, error, pagination, likedPosts, bookmarkedPosts } = useSelector(state => state.community);
  const hasMore = pagination.page < pagination.totalPages;

  // 加载数据
  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    if (isLoading) {return;}

    const isOnline = await networkService.checkConnection();
    if (!isOnline) {
      networkErrorService.handleApiError({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        isNetworkError: true,
      }, {
        context: '加载社区帖子',
        customMessage: '当前无网络连接，无法加载社区内容',
      });
      return;
    }

    try {
      // 尝试从API加载帖子
      await dispatch(fetchPosts({ page, pageSize: 10 })).unwrap();
    } catch (error) {
      console.log('加载帖子失败:', error?.message || error);
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '加载社区帖子',
          customMessage: '网络连接失败，无法加载社区内容',
        });
      }
      // API加载失败时不使用模拟数据，保持错误状态由Redux处理
    }
  };

  // 下拉刷新
  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);

    dispatch(fetchPosts({ page: 1, pageSize: 10 }))
      .catch(error => {
        console.warn('刷新帖子失败:', error?.message || error);
        if (networkErrorService.isNetworkError(error)) {
          networkErrorService.handleApiError(error, {
            context: '刷新社区帖子',
            customMessage: '网络连接失败，无法刷新社区内容',
          });
        }
      })
      .finally(() => setRefreshing(false));
  };

  // 加载更多
  const handleLoadMore = () => {
    if (isLoading || !hasMore) {return;}

    const nextPage = page + 1;
    setPage(nextPage);
    dispatch(fetchPosts({ page: nextPage, pageSize: 10 }))
      .catch(error => {
        console.warn('加载更多帖子失败:', error?.message || error);
        if (networkErrorService.isNetworkError(error)) {
          networkErrorService.handleApiError(error, {
            context: '加载更多社区帖子',
            customMessage: '网络连接失败，无法加载更多内容',
          });
        }
      });
  };

  // 处理点赞 (优化: useCallback)
  const handleLike = useCallback((postId) => {
    dispatch(likePost({ postId, liked: !likedPosts[postId] }));
  }, [dispatch, likedPosts]);

  // 处理收藏 (优化: useCallback)
  const handleBookmark = useCallback((postId) => {
    dispatch(toggleBookmark(postId));
  }, [dispatch]);

  // 渲染帖子项 (优化: useCallback)
  const renderPostItem = useCallback(({ item }) => (
    <Card style={styles.postCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        testID={`item.community.post.${item.id}`}
      >
        <View style={styles.postHeader}>
          <View style={styles.authorContainer}>
            <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
            <Text style={[styles.authorName, { color: theme.text }]}>{item.author}</Text>
          </View>
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.postTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.postPreview, { color: theme.textSecondary }]}>{item.preview}</Text>

        <View style={styles.tagsContainer}>
          {item.tags.map((tag, index) => (
            <View key={index} style={[styles.tag, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.postFooter}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => handleLike(item.id)}
            testID={`action.community.like.${item.id}`}
          >
            <Icon
              name={likedPosts[item.id] ? 'thumb-up' : 'thumb-up-off-alt'}
              size={16}
              color={likedPosts[item.id] ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[styles.statText, {
                color: likedPosts[item.id] ? theme.primary : theme.textSecondary,
              }]}
            >
              {item.likes}
            </Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Icon name="comment" size={16} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>{item.comments}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="file-download" size={16} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>{item.downloads}</Text>
          </View>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => handleBookmark(item.id)}
            testID={`action.community.bookmark.${item.id}`}
          >
            <Icon
              name={bookmarkedPosts[item.id] ? 'bookmark' : 'bookmark-border'}
              size={16}
              color={bookmarkedPosts[item.id] ? theme.primary : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Card>
  ), [theme, likedPosts, bookmarkedPosts, navigation, handleLike, handleBookmark]);

  // 渲染加载中的骨架屏
  const renderLoadingSkeleton = () => (
    <View style={{ padding: 15 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={[styles.postCard, { padding: 15 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Skeleton circle width={40} height={40} />
            <View style={{ marginLeft: 10 }}>
              <Skeleton width={120} height={15} style={{ marginBottom: 5 }} />
              <Skeleton width={80} height={10} />
            </View>
          </View>
          <Skeleton width="100%" height={20} style={{ marginBottom: 10 }} />
          <Skeleton width="80%" height={15} style={{ marginBottom: 15 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
          </View>
        </View>
      ))}
    </View>
  );

  // 渲染列表底部
  const renderFooter = () => {
    if (!isLoading || posts.length === 0) {return null;}

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>加载更多...</Text>
      </View>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="screen.community"
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Notifications')}
          testID="action.community.notifications"
        >
          <Icon name="notifications" size={22} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Activity')}
          testID="action.community.activity"
        >
          <Icon name="dynamic-feed" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <UnifiedSearchBar
          searchScope="community"
          resultScreenName="CommunitySearch"
          onSearch={(results) => {
            // 处理搜索结果
            if (results && results.length > 0) {
              navigation.navigate('CommunitySearch', { results });
            }
          }}
        />
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.primary }]}>
            <Text style={[styles.categoryText, { color: '#FFFFFF' }]}>全部</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: '#ffffff' }]}>
            <Text style={[styles.categoryText, { color: theme.primary }]}>笔记模板</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: '#ffffff' }]}>
            <Text style={[styles.categoryText, { color: theme.primary }]}>学习资料</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: '#ffffff' }]}>
            <Text style={[styles.categoryText, { color: theme.primary }]}>使用技巧</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: '#ffffff' }]}>
            <Text style={[styles.categoryText, { color: theme.primary }]}>知识图谱</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      {isLoading && posts.length === 0 ? (
        renderLoadingSkeleton()
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={5}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyContainer}>
                <Icon name="forum" size={64} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  暂无社区内容
                </Text>
                <Button
                  title="刷新"
                  onPress={handleRefresh}
                  type="primary"
                  style={styles.refreshButton}
                  testID="action.community.refreshEmpty"
                />
              </View>
            ) : null
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: '#2196F3' }]}
        onPress={() => navigation.navigate('CreatePost')}
        testID="action.community.createPost"
      >
        <Icon name="add" size={28} color="#FFFFFF" />
        <Text style={styles.fabButtonText}>发布</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LARGE,
    paddingTop: SPACING.LARGE + 4,
    paddingBottom: SPACING.MEDIUM + 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 12,
    marginLeft: 14,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  searchContainer: {
    paddingHorizontal: SPACING.MEDIUM,
    marginVertical: SPACING.SMALL,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.MEDIUM,
    marginVertical: SPACING.MEDIUM,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2196F3',
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryButton: {
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.SMALL + 2,
    borderRadius: 24,
    marginRight: SPACING.MEDIUM,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: '#ffffff',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: SPACING.MEDIUM + 4,
    paddingBottom: SPACING.XLARGE,
  },
  postCard: {
    marginBottom: SPACING.LARGE,
    padding: SPACING.LARGE,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.MEDIUM,
    paddingBottom: SPACING.MEDIUM,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: SPACING.MEDIUM,
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '500',
  },
  postTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: SPACING.MEDIUM,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  postPreview: {
    fontSize: 16,
    marginBottom: SPACING.LARGE,
    lineHeight: 24,
    opacity: 0.85,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.MEDIUM,
  },
  tag: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: '#ffffff',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: SPACING.MEDIUM,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: SPACING.MEDIUM,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.LARGE,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  statText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LARGE,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: SPACING.MEDIUM,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  footerText: {
    marginLeft: SPACING.MEDIUM,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XLARGE,
    marginTop: SPACING.XLARGE + 10,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginHorizontal: SPACING.LARGE,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  emptyText: {
    fontSize: 18,
    marginTop: SPACING.LARGE,
    marginBottom: SPACING.LARGE,
    opacity: 0.7,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 26,
    fontWeight: '500',
  },
  refreshButton: {
    width: 160,
    height: 50,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  fabButton: {
    position: 'absolute',
    right: SPACING.LARGE,
    bottom: SPACING.LARGE + 4,
    width: 120,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  fabButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default CommunityScreen;
