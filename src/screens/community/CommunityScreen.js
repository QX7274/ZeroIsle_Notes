import React, { useState, useEffect } from 'react';
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
import { Button, Card } from '../../components/common';
import { SPACING } from '../../utils/constants/dimensions';
import { fetchPosts, likePost, toggleBookmark } from '../../redux/slices/communitySlice';
import { UnifiedSearchBar } from '../../components/search';

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

  // 模拟数据
  const mockPosts = [
    {
      id: '1',
      title: '高效笔记方法分享',
      author: '学习达人',
      authorAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      preview: '分享我使用零屿笔记提高学习效率的几个小技巧...',
      likes: 128,
      comments: 32,
      downloads: 56,
      timestamp: '2025-04-20T10:30:00Z',
      tags: ['学习方法', '效率提升', '笔记技巧'],
    },
    {
      id: '2',
      title: '知识图谱构建案例',
      author: '知识管理专家',
      authorAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      preview: '如何利用零屿笔记的知识图谱功能构建个人知识体系...',
      likes: 256,
      comments: 48,
      downloads: 112,
      timestamp: '2025-04-19T14:20:00Z',
      tags: ['知识图谱', '知识管理', '案例分享'],
    },
    {
      id: '3',
      title: '手写识别功能使用技巧',
      author: '科技爱好者',
      authorAvatar: 'https://randomuser.me/api/portraits/men/67.jpg',
      preview: '零屿笔记手写识别功能的几个隐藏用法，提高识别准确率...',
      likes: 89,
      comments: 15,
      downloads: 34,
      timestamp: '2025-04-18T09:15:00Z',
      tags: ['手写识别', '使用技巧', '功能介绍'],
    },
    {
      id: '4',
      title: '语音转文本实用场景',
      author: '效率专家',
      authorAvatar: 'https://randomuser.me/api/portraits/women/28.jpg',
      preview: '在会议记录、采访整理等场景下如何高效使用语音转文本功能...',
      likes: 76,
      comments: 23,
      downloads: 41,
      timestamp: '2025-04-17T16:40:00Z',
      tags: ['语音转文本', '会议记录', '效率工具'],
    },
    {
      id: '5',
      title: '零屿笔记模板分享',
      author: '模板设计师',
      authorAvatar: 'https://randomuser.me/api/portraits/men/15.jpg',
      preview: '分享几个我设计的高效笔记模板，适用于学习、工作和项目管理...',
      likes: 312,
      comments: 67,
      downloads: 245,
      timestamp: '2025-04-16T11:25:00Z',
      tags: ['笔记模板', '资源分享', '效率工具'],
    },
  ];

  // 加载数据
  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    if (isLoading) return;

    try {
      // 尝试从API加载帖子
      await dispatch(fetchPosts({ page, pageSize: 10 })).unwrap();
    } catch (error) {
      console.error('加载帖子失败:', error);

      // 如果API加载失败，使用模拟数据
      dispatch({
        type: 'community/fetchPostsSuccess',
        payload: {
          posts: mockPosts,
          pagination: {
            page: 1,
            totalPages: 1,
            totalItems: mockPosts.length
          }
        }
      });
    }
  };

  // 下拉刷新
  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);

    dispatch(fetchPosts({ page: 1, pageSize: 10 }))
      .finally(() => setRefreshing(false));
  };

  // 加载更多
  const handleLoadMore = () => {
    if (isLoading || !hasMore) return;

    const nextPage = page + 1;
    setPage(nextPage);
    dispatch(fetchPosts({ page: nextPage, pageSize: 10 }));
  };

  // 处理点赞
  const handleLike = (postId) => {
    dispatch(likePost({ postId, liked: !likedPosts[postId] }));
  };

  // 处理收藏
  const handleBookmark = (postId) => {
    dispatch(toggleBookmark(postId));
  };

  // 渲染帖子项
  const renderPostItem = ({ item }) => (
    <Card style={styles.postCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
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
          >
            <Icon
              name={likedPosts[item.id] ? "thumb-up" : "thumb-up-off-alt"}
              size={16}
              color={likedPosts[item.id] ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[styles.statText, {
                color: likedPosts[item.id] ? theme.primary : theme.textSecondary
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
          >
            <Icon
              name={bookmarkedPosts[item.id] ? "bookmark" : "bookmark-border"}
              size={16}
              color={bookmarkedPosts[item.id] ? theme.primary : theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Card>
  );

  // 渲染列表底部
  const renderFooter = () => {
    if (!isLoading) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>加载更多...</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
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

      <FlatList
        data={posts}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
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
          isLoading ? null : (
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
              />
            </View>
          )
        }
      />

      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: '#2196F3' }]}
        onPress={() => navigation.navigate('CreatePost')}
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
