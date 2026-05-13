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
import networkService from '../../services/network/networkService';

const FALLBACK_THEME = {
  background: '#F2F7FB',
  card: '#FFFFFF',
  text: '#102A43',
  textSecondary: '#5B7083',
  primary: '#2196F3',
  border: '#D7E8F8',
  shadow: 'rgba(15, 23, 42, 0.10)',
};

const CommunityScreen = ({ navigation }) => {
  let palette = FALLBACK_THEME;

  try {
    const themeContext = useTheme();
    const colors = themeContext?.theme?.colors;
    if (colors) {
      palette = {
        background: colors.background || FALLBACK_THEME.background,
        card: colors.card || FALLBACK_THEME.card,
        text: colors.text || FALLBACK_THEME.text,
        textSecondary: colors.textSecondary || FALLBACK_THEME.textSecondary,
        primary: colors.primary || FALLBACK_THEME.primary,
        border: colors.border || FALLBACK_THEME.border,
        shadow: colors.shadow || FALLBACK_THEME.shadow,
      };
    }
  } catch (themeError) {
    console.error('CommunityScreen: 获取主题失败', themeError?.message || themeError);
  }

  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState('idle');
  const { posts, isLoading, error, pagination, likedPosts, bookmarkedPosts } = useSelector(state => state.community);
  const hasMore = pagination.page < pagination.totalPages;

  const loadPosts = useCallback(async (targetPage = 1) => {
    if (isLoading) {
      return;
    }

    const isOnline = await networkService.checkConnection();
    if (!isOnline) {
      setLoadState('offline');
      return;
    }

    try {
      setLoadState('loading');
      await dispatch(fetchPosts({
        page: targetPage,
        pageSize: 10,
        suppressGlobalErrorUI: true,
      })).unwrap();
      setLoadState('ready');
    } catch (requestError) {
      console.log('CommunityScreen: 加载帖子失败', requestError?.message || requestError);
      setLoadState('error');
    }
  }, [dispatch, isLoading]);

  useEffect(() => {
    loadPosts(1);
  }, [loadPosts]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    loadPosts(1).finally(() => setRefreshing(false));
  }, [loadPosts]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || !hasMore) {
      return;
    }

    const nextPage = page + 1;
    setPage(nextPage);
    dispatch(fetchPosts({
      page: nextPage,
      pageSize: 10,
      suppressGlobalErrorUI: true,
    }))
      .unwrap()
      .then(() => setLoadState('ready'))
      .catch(requestError => {
        console.warn('CommunityScreen: 加载更多失败', requestError?.message || requestError);
        setPage(current => Math.max(1, current - 1));
      });
  }, [dispatch, hasMore, isLoading, page]);

  const handleLike = useCallback((postId) => {
    dispatch(likePost({ postId, liked: !likedPosts[postId] }));
  }, [dispatch, likedPosts]);

  const handleBookmark = useCallback((postId) => {
    dispatch(toggleBookmark(postId));
  }, [dispatch]);

  const renderPostItem = useCallback(({ item }) => (
    <Card style={styles.postCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        testID={`item.community.post.${item.id}`}
      >
        <View style={styles.postHeader}>
          <View style={styles.authorContainer}>
            <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
            <Text style={[styles.authorName, { color: palette.text }]}>{item.author}</Text>
          </View>
          <Text style={[styles.timestamp, { color: palette.textSecondary }]}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.postTitle, { color: palette.text }]}>{item.title}</Text>
        <Text style={[styles.postPreview, { color: palette.textSecondary }]}>{item.preview}</Text>

        <View style={styles.tagsContainer}>
          {item.tags.map((tag, index) => (
            <View
              key={`${item.id}-tag-${index}`}
              style={[styles.tag, { backgroundColor: `${palette.primary}12`, borderColor: `${palette.primary}2E` }]}
            >
              <Text style={[styles.tagText, { color: palette.primary }]}>{tag}</Text>
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
              color={likedPosts[item.id] ? palette.primary : palette.textSecondary}
            />
            <Text style={[styles.statText, { color: likedPosts[item.id] ? palette.primary : palette.textSecondary }]}>
              {item.likes}
            </Text>
          </TouchableOpacity>

          <View style={styles.statItem}>
            <Icon name="comment" size={16} color={palette.textSecondary} />
            <Text style={[styles.statText, { color: palette.textSecondary }]}>{item.comments}</Text>
          </View>

          <View style={styles.statItem}>
            <Icon name="file-download" size={16} color={palette.textSecondary} />
            <Text style={[styles.statText, { color: palette.textSecondary }]}>{item.downloads}</Text>
          </View>

          <TouchableOpacity
            style={styles.statItem}
            onPress={() => handleBookmark(item.id)}
            testID={`action.community.bookmark.${item.id}`}
          >
            <Icon
              name={bookmarkedPosts[item.id] ? 'bookmark' : 'bookmark-border'}
              size={16}
              color={bookmarkedPosts[item.id] ? palette.primary : palette.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Card>
  ), [bookmarkedPosts, handleBookmark, handleLike, likedPosts, navigation, palette.primary, palette.text, palette.textSecondary]);

  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.postCard, styles.skeletonCard]}>
          <View style={styles.skeletonHeader}>
            <Skeleton circle width={40} height={40} />
            <View style={styles.skeletonMeta}>
              <Skeleton width={120} height={15} style={styles.skeletonLineTight} />
              <Skeleton width={80} height={10} />
            </View>
          </View>
          <Skeleton width="100%" height={20} style={styles.skeletonLine} />
          <Skeleton width="78%" height={14} style={styles.skeletonLineWide} />
          <View style={styles.skeletonFooter}>
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
            <Skeleton width={60} height={20} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderFooter = () => {
    if (!isLoading || posts.length === 0) {
      return null;
    }

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={palette.primary} />
        <Text style={[styles.footerText, { color: palette.textSecondary }]}>加载更多中...</Text>
      </View>
    );
  };

  const renderInlineState = () => {
    if (isLoading || posts.length > 0) {
      return null;
    }

    const isOffline = loadState === 'offline';
    const hasRequestError = loadState === 'error' || Boolean(error);
    const iconName = isOffline ? 'wifi-off' : hasRequestError ? 'cloud-off' : 'forum';
    const title = isOffline
      ? '当前处于离线状态'
      : hasRequestError
        ? '社区内容暂时不可用'
        : '暂无社区内容';
    const description = isOffline
      ? '未部署联调阶段会优先展示本地页面结构。连接同一局域网或启动后端后，再回来刷新即可。'
      : hasRequestError
        ? '页面主体和关键入口已经可访问，但帖子接口暂时没有返回数据。你仍然可以继续检查导航、搜索区和发布入口。'
        : '内容区已经准备好，后续接入后端或导入示例数据后会在这里显示社区帖子。';

    return (
      <View
        style={styles.emptyContainer}
        testID={isOffline ? 'state.community.offline' : hasRequestError ? 'state.community.error' : 'state.community.empty'}
      >
        <View style={styles.emptyIconShell}>
          <Icon name={iconName} size={32} color={palette.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{description}</Text>
        <Button
          title="重新加载"
          onPress={handleRefresh}
          type="primary"
          style={styles.refreshButton}
          testID="action.community.refreshEmpty"
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]} testID="screen.community">
      <View style={[styles.header, { borderBottomColor: `${palette.primary}14` }]}>
        <TouchableOpacity
          style={[styles.headerButton, { borderColor: `${palette.primary}28` }]}
          onPress={() => navigation.navigate('Notifications')}
          testID="action.community.notifications"
        >
          <Icon name="notifications" size={22} color={palette.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerButton, { borderColor: `${palette.primary}28` }]}
          onPress={() => navigation.navigate('Activity')}
          testID="action.community.activity"
        >
          <Icon name="dynamic-feed" size={22} color={palette.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <UnifiedSearchBar
          searchScope="community"
          resultScreenName="CommunitySearch"
          onSearch={(results) => {
            if (results && results.length > 0) {
              navigation.navigate('CommunitySearch', { results });
            }
          }}
        />
      </View>

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.categoryButton, { backgroundColor: palette.primary, borderColor: palette.primary }]}>
            <Text style={styles.categoryTextActive}>全部</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryButton}>
            <Text style={[styles.categoryText, { color: palette.primary }]}>笔记模板</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryButton}>
            <Text style={[styles.categoryText, { color: palette.primary }]}>学习资料</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryButton}>
            <Text style={[styles.categoryText, { color: palette.primary }]}>使用技巧</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.categoryButton}>
            <Text style={[styles.categoryText, { color: palette.primary }]}>知识图谱</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {isLoading && posts.length === 0 ? (
        renderLoadingSkeleton()
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={5}
          windowSize={5}
          removeClippedSubviews
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[palette.primary]}
              tintColor={palette.primary}
            />
          )}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={!isLoading ? renderInlineState() : null}
        />
      )}

      <TouchableOpacity
        style={[styles.fabButton, { backgroundColor: palette.primary }]}
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
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  headerButton: {
    padding: 12,
    marginLeft: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchContainer: {
    paddingHorizontal: SPACING.MEDIUM,
    marginVertical: SPACING.SMALL,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.MEDIUM,
    marginVertical: SPACING.MEDIUM,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  categoryButton: {
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.SMALL + 2,
    borderRadius: 24,
    marginRight: SPACING.MEDIUM,
    borderWidth: 1,
    borderColor: '#B6D8F7',
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryTextActive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContainer: {
    padding: SPACING.MEDIUM + 4,
    paddingBottom: SPACING.XLARGE + 24,
  },
  postCard: {
    marginBottom: SPACING.LARGE,
    padding: SPACING.LARGE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E1EEF9',
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.MEDIUM,
    paddingBottom: SPACING.MEDIUM,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF4FA',
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
    backgroundColor: '#D9ECFD',
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 14,
    opacity: 0.76,
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
    opacity: 0.86,
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
    borderWidth: 1,
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
    borderTopColor: '#EEF4FA',
    marginTop: SPACING.MEDIUM,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.LARGE,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(247,250,252,0.95)',
  },
  statText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '600',
  },
  skeletonContainer: {
    padding: 15,
  },
  skeletonCard: {
    padding: 15,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  skeletonMeta: {
    marginLeft: 10,
  },
  skeletonLineTight: {
    marginBottom: 6,
  },
  skeletonLine: {
    marginBottom: 10,
  },
  skeletonLineWide: {
    marginBottom: 16,
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LARGE,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    marginTop: SPACING.MEDIUM,
    borderWidth: 1,
    borderColor: '#D9EAF8',
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
    marginHorizontal: SPACING.LARGE,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#D6E9FB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  emptyIconShell: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33,150,243,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.18)',
    marginBottom: SPACING.MEDIUM,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.SMALL,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: SPACING.SMALL,
    marginBottom: SPACING.LARGE,
    opacity: 0.78,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 24,
    fontWeight: '500',
  },
  refreshButton: {
    width: 160,
    height: 50,
    borderRadius: 25,
  },
  fabButton: {
    position: 'absolute',
    right: SPACING.LARGE,
    bottom: SPACING.LARGE + 4,
    width: 120,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  fabButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default CommunityScreen;
