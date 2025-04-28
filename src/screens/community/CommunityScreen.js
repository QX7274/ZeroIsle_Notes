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

/**
 * 社区屏幕组件
 * 用于展示社区内容、分享资源和交流互动
 */
const CommunityScreen = ({ navigation }) => {
  const { theme } = useTheme();
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

    dispatch(fetchPosts({ page, pageSize: 10 }));
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>社区</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('ApiTest')}
          >
            <Icon name="code" size={24} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('CommunitySearch')}
          >
            <Icon name="search" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.primary }]}>
            <Text style={[styles.categoryText, { color: '#FFFFFF' }]}>全部</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.categoryText, { color: theme.text }]}>笔记模板</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.categoryText, { color: theme.text }]}>学习资料</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.categoryText, { color: theme.text }]}>使用技巧</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.categoryText, { color: theme.text }]}>知识图谱</Text>
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
        style={[styles.fabButton, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('CreatePost')}
      >
        <Icon name="add" size={24} color="#FFFFFF" />
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
    paddingTop: SPACING.LARGE,
    paddingBottom: SPACING.MEDIUM,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: SPACING.SMALL,
    marginLeft: SPACING.SMALL,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
  },
  categoryButton: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    borderRadius: 20,
    marginRight: SPACING.SMALL,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    padding: SPACING.MEDIUM,
    paddingBottom: SPACING.XLARGE,
  },
  postCard: {
    marginBottom: SPACING.MEDIUM,
    padding: SPACING.MEDIUM,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SMALL,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.SMALL,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.SMALL,
  },
  postPreview: {
    fontSize: 14,
    marginBottom: SPACING.MEDIUM,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.MEDIUM,
  },
  tag: {
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.LARGE,
  },
  statText: {
    fontSize: 14,
    marginLeft: 4,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.MEDIUM,
  },
  footerText: {
    marginLeft: SPACING.SMALL,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XLARGE,
  },
  emptyText: {
    fontSize: 16,
    marginTop: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
  },
  refreshButton: {
    width: 120,
  },
  fabButton: {
    position: 'absolute',
    right: SPACING.LARGE,
    bottom: SPACING.LARGE,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default CommunityScreen;
