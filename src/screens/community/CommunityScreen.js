import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Button, Card, Skeleton } from '../../components/common';
import { UnifiedSearchBar } from '../../components/search';
import { fetchPosts, likePost, toggleBookmark } from '../../redux/slices/communitySlice';
import networkService from '../../services/network/networkService';
import networkErrorService from '../../services/networkErrorService';
import { SPACING } from '../../utils/constants/dimensions';

const FALLBACK_THEME = {
  background: '#F2F7FB',
  card: '#FFFFFF',
  text: '#102A43',
  textSecondary: '#5B7083',
  primary: '#2196F3',
  border: '#D7E8F8',
};

const CATEGORY_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'note_template', label: '笔记模板' },
  { key: 'learning', label: '学习资料' },
  { key: 'tips', label: '使用技巧' },
  { key: 'knowledge_graph', label: '知识图谱' },
];
const DEV_COMMUNITY_QA_USER_ID = '1';
const DEV_COMMUNITY_QA_POST_ID = '1';

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
      };
    }
  } catch (themeError) {
    console.warn('CommunityScreen theme fallback:', themeError?.message || themeError);
  }
  const insets = useSafeAreaInsets();

  const dispatch = useDispatch();
  const requestInFlightRef = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loadMoreError, setLoadMoreError] = useState('');
  const [actionSource, setActionSource] = useState('');

  const { posts, isLoading, error, pagination, likedPosts, bookmarkedPosts } = useSelector((state) => state.community);
  const hasMore = pagination.page < pagination.totalPages;
  const interactionBusy = isLoading || refreshing || requestInFlightRef.current;
  const currentCategoryLabel = CATEGORY_OPTIONS.find((i) => i.key === activeCategory)?.label || '全部';

  const resetTransient = useCallback(() => {
    setLoadMoreError('');
  }, []);

  const loadPosts = useCallback(
    async (targetPage = 1, categoryOverride = undefined) => {
      if (requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      const isOnline = await networkService.checkConnection();
      if (!isOnline) {
        requestInFlightRef.current = false;
        return;
      }

      try {
        const resolvedCategory = categoryOverride !== undefined
          ? categoryOverride
          : activeCategory === 'all'
            ? undefined
            : activeCategory;
        await dispatch(
          fetchPosts({
            page: targetPage,
            pageSize: 10,
            suppressGlobalErrorUI: true,
            category: resolvedCategory,
          })
        ).unwrap();
      } catch (requestError) {
        console.warn('CommunityScreen load failed:', requestError?.message || requestError);
      } finally {
        requestInFlightRef.current = false;
      }
    },
    [activeCategory, dispatch]
  );

  useEffect(() => {
    const category = activeCategory === 'all' ? undefined : activeCategory;
    loadPosts(1, category);
  }, [activeCategory, loadPosts]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        requestInFlightRef.current = false;
        setRefreshing(false);
        setPage(1);
        setActionSource('');
        resetTransient();
      };
    }, [resetTransient])
  );

  const handleRefresh = useCallback(() => {
    if (interactionBusy) {
      return;
    }
    setActionSource('refresh');
    setRefreshing(true);
    setPage(1);
    resetTransient();
    loadPosts(1).finally(() => setRefreshing(false));
  }, [interactionBusy, loadPosts, resetTransient]);

  const handleLoadMore = useCallback(() => {
    if (interactionBusy || !hasMore) {
      return;
    }
    requestInFlightRef.current = true;
    setActionSource(loadMoreError ? 'retryLoadMore' : 'loadMore');
    const nextPage = page + 1;
    const category = activeCategory === 'all' ? undefined : activeCategory;
    dispatch(
      fetchPosts({
        page: nextPage,
        pageSize: 10,
        suppressGlobalErrorUI: true,
        category,
      })
    )
      .unwrap()
      .then(() => {
        setPage(nextPage);
        setLoadMoreError('');
      })
      .catch((requestError) => {
        if (networkErrorService.isNetworkError(requestError)) {
          networkErrorService.handleApiError(requestError, {
            context: '加载更多社区帖子',
          });
          return;
        }
        setLoadMoreError(requestError?.message || '加载更多失败，请重试');
      })
      .finally(() => {
        requestInFlightRef.current = false;
      });
  }, [activeCategory, dispatch, hasMore, interactionBusy, loadMoreError, page]);

  const handleLike = useCallback(
    (postId) => {
      if (interactionBusy) {
        return;
      }
      setActionSource(`likePost.${postId}`);
      dispatch(likePost({ postId, liked: !likedPosts[postId] }));
    },
    [dispatch, interactionBusy, likedPosts]
  );

  const handleBookmark = useCallback(
    (postId) => {
      if (interactionBusy) {
        return;
      }
      setActionSource(`bookmarkPost.${postId}`);
      dispatch(toggleBookmark(postId));
    },
    [dispatch, interactionBusy]
  );

  const renderPostItem = useCallback(
    ({ item }) => (
      <Card style={[styles.postCard, { backgroundColor: `${palette.card}EE`, borderColor: `${palette.primary}20` }]}>
        <TouchableOpacity
          onPress={() => {
            if (interactionBusy) {
              return;
            }
            setActionSource(`openPost.${item.id}`);
            navigation.navigate('PostDetail', { postId: item.id });
          }}
          disabled={interactionBusy}
          testID={`item.community.post.${item.id}`}
        >
          <View testID={`state.community.postLike.${item.id}.${likedPosts[item.id] ? 'on' : 'off'}`} />
          <View testID={`state.community.postBookmark.${item.id}.${bookmarkedPosts[item.id] ? 'on' : 'off'}`} />
          <View style={styles.postHeader}>
            <View style={styles.authorContainer}>
              <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
              <Text style={[styles.authorName, { color: palette.text }]}>{item.author}</Text>
            </View>
            <Text style={[styles.timestamp, { color: palette.textSecondary }]}>{new Date(item.timestamp).toLocaleDateString()}</Text>
          </View>
          <Text style={[styles.postTitle, { color: palette.text }]}>{item.title}</Text>
          <Text style={[styles.postPreview, { color: palette.textSecondary }]}>{item.preview}</Text>
          <View style={styles.tagsContainer}>
            {(item.tags || []).map((tag, index) => (
              <View key={`${item.id}-tag-${index}`} style={[styles.tag, { borderColor: `${palette.primary}2B` }]}>
                <Text style={[styles.tagText, { color: palette.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.postFooter}>
            <TouchableOpacity onPress={() => handleLike(item.id)} style={styles.statItem} disabled={interactionBusy} testID={`action.community.like.${item.id}`}>
              <Icon name={likedPosts[item.id] ? 'thumb-up' : 'thumb-up-off-alt'} size={16} color={likedPosts[item.id] ? palette.primary : palette.textSecondary} />
              <Text style={[styles.statText, { color: palette.textSecondary }]}>{item.likes}</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Icon name="comment" size={16} color={palette.textSecondary} />
              <Text style={[styles.statText, { color: palette.textSecondary }]}>{item.comments}</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="file-download" size={16} color={palette.textSecondary} />
              <Text style={[styles.statText, { color: palette.textSecondary }]}>{item.downloads}</Text>
            </View>
            <TouchableOpacity onPress={() => handleBookmark(item.id)} style={styles.statItem} disabled={interactionBusy} testID={`action.community.bookmark.${item.id}`}>
              <Icon name={bookmarkedPosts[item.id] ? 'bookmark' : 'bookmark-border'} size={16} color={bookmarkedPosts[item.id] ? palette.primary : palette.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Card>
    ),
    [bookmarkedPosts, handleBookmark, handleLike, interactionBusy, likedPosts, navigation, palette.card, palette.primary, palette.text, palette.textSecondary]
  );

  const footer = useMemo(() => {
    if (posts.length === 0) {
      return null;
    }
    if (isLoading) {
      return (
        <View style={styles.footerLoader} testID="state.community.loadingMore">
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={[styles.footerText, { color: palette.textSecondary }]}>加载更多中…</Text>
        </View>
      );
    }
    if (!hasMore) {
      return (
        <View style={styles.footerLoader} testID="state.community.endOfList">
          <Icon name="check-circle" size={16} color={palette.primary} />
          <Text style={[styles.footerText, { color: palette.textSecondary }]}>已加载全部内容</Text>
        </View>
      );
    }
    return null;
  }, [hasMore, isLoading, palette.primary, palette.textSecondary, posts.length]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer} testID="state.community.empty">
      <View style={styles.emptyIconShell}>
        <Icon name="forum" size={28} color={palette.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>暂无社区内容</Text>
      <Text style={[styles.emptyText, { color: palette.textSecondary }]}>可下拉刷新，或切换分类后再试。</Text>
      <Button mode="contained" onPress={handleRefresh} testID="action.community.refreshEmpty">
        立即刷新
      </Button>
      {__DEV__ ? (
        <View style={styles.devQaPanel} testID="panel.community.devQa">
          <View style={styles.devQaHead}>
            <Icon name="science" size={16} color={palette.primary} />
            <Text style={[styles.devQaTitle, { color: palette.text }]}>社区深层页验证入口</Text>
          </View>
          <Text style={[styles.devQaText, { color: palette.textSecondary }]}>
            仅开发联调可见，用于平板真机快速命中帖子详情、粉丝列表与关注列表。
          </Text>
          <View style={styles.devQaActions}>
            <TouchableOpacity
              style={[styles.devQaButton, { borderColor: `${palette.primary}33`, backgroundColor: `${palette.primary}12` }]}
              onPress={() => navigation.navigate('PostDetail', { postId: DEV_COMMUNITY_QA_POST_ID })}
              testID="action.community.devQa.postDetail"
            >
              <Text style={[styles.devQaButtonText, { color: palette.primary }]}>帖子详情</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.devQaButton, { borderColor: `${palette.primary}33`, backgroundColor: `${palette.primary}12` }]}
              onPress={() => navigation.navigate('Followers', { userId: DEV_COMMUNITY_QA_USER_ID })}
              testID="action.community.devQa.followers"
            >
              <Text style={[styles.devQaButtonText, { color: palette.primary }]}>粉丝列表</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.devQaButton, { borderColor: `${palette.primary}33`, backgroundColor: `${palette.primary}12` }]}
              onPress={() => navigation.navigate('Following', { userId: DEV_COMMUNITY_QA_USER_ID })}
              testID="action.community.devQa.following"
            >
              <Text style={[styles.devQaButtonText, { color: palette.primary }]}>关注列表</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer} testID="state.community.loading">
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

  const pageState = isLoading && posts.length === 0 ? 'loading' : error ? 'error' : posts.length === 0 ? 'empty' : 'ready';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, SPACING.SMALL),
        },
      ]}
      testID={`state.community.pageState.${pageState}`}
    >
      <View testID={`state.community.busy.visibility.${interactionBusy ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.actionSource.visibility.${actionSource ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.activeCategory.${activeCategory}`} />

      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>社区</Text>
          <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>浏览帖子、动态和社区资源</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleRefresh} disabled={interactionBusy} testID="action.community.refresh">
            <Icon name="refresh" size={21} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              if (interactionBusy) {
                return;
              }
              setActionSource('openNotifications');
              navigation.navigate('Notifications');
            }}
            disabled={interactionBusy}
            testID="action.community.notifications"
          >
            <Icon name="notifications" size={21} color={palette.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              if (interactionBusy) {
                return;
              }
              setActionSource('openActivity');
              navigation.navigate('Activity');
            }}
            disabled={interactionBusy}
            testID="action.community.activity"
          >
            <Icon name="dynamic-feed" size={21} color={palette.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <UnifiedSearchBar
          searchScope="community"
          resultScreenName="CommunitySearch"
          onSearch={(results) => {
            if (!results || results.length === 0 || interactionBusy) {
              return;
            }
            setActionSource('openSearchResults');
            navigation.navigate('CommunitySearch', { results });
          }}
        />
      </View>

      <View style={styles.categoryWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.categoryButton,
                activeCategory === option.key ? { backgroundColor: palette.primary, borderColor: palette.primary } : null,
                interactionBusy ? styles.disabled : null,
              ]}
              onPress={() => {
                if (interactionBusy || option.key === activeCategory) {
                  return;
                }
                setActionSource(`switchCategory.${option.key}`);
                setPage(1);
                resetTransient();
                setActiveCategory(option.key);
              }}
              disabled={interactionBusy}
              testID={`filter.community.${option.key}`}
            >
              <Text style={activeCategory === option.key ? styles.categoryTextActive : [styles.categoryText, { color: palette.primary }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.activeHint}>
          <Icon name="tune" size={14} color={palette.primary} />
          <Text style={[styles.activeHintText, { color: palette.primary }]} testID="state.community.activeCategoryText">
            当前分类：{currentCategoryLabel}
          </Text>
        </View>
      </View>

      {loadMoreError ? (
        <View style={styles.loadMoreErrorBanner} testID="state.community.loadMoreError">
          <Icon name="warning-amber" size={16} color="#B45309" />
          <Text style={styles.loadMoreErrorText}>{loadMoreError}</Text>
          <TouchableOpacity onPress={handleLoadMore} disabled={interactionBusy} testID="action.community.retryLoadMore">
            <Text style={styles.loadMoreRetryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading && posts.length === 0 ? (
        renderSkeleton()
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[palette.primary]} tintColor={palette.primary} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          ListEmptyComponent={renderEmpty}
          testID="list.community.posts"
        />
      )}

      <TouchableOpacity
        style={[
          styles.fabButton,
          {
            backgroundColor: palette.primary,
            bottom: Math.max(insets.bottom, SPACING.LARGE),
          },
          interactionBusy ? styles.disabled : null,
        ]}
        onPress={() => {
          if (interactionBusy) {
            return;
          }
          setActionSource('createPost');
          navigation.navigate('CreatePost');
        }}
        disabled={interactionBusy}
        testID="action.community.createPost"
      >
        <Icon name="add" size={26} color="#FFFFFF" />
        <Text style={styles.fabButtonText}>发布</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LARGE,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderBottomWidth: 1,
    borderBottomColor: '#DDEAF7',
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: SPACING.MEDIUM,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CAE0F6',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: { paddingHorizontal: SPACING.MEDIUM, marginTop: 0, marginBottom: SPACING.SMALL },
  categoryWrap: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.MEDIUM,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DBEBFA',
  },
  categoryButton: {
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.SMALL + 2,
    borderRadius: 24,
    marginRight: SPACING.SMALL,
    borderWidth: 1,
    borderColor: '#B6D8F7',
    backgroundColor: 'rgba(255,255,255,0.80)',
  },
  categoryText: { fontSize: 15, fontWeight: '600' },
  categoryTextActive: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  activeHint: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.24)',
    backgroundColor: 'rgba(33,150,243,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeHintText: { marginLeft: 6, fontSize: 12, fontWeight: '600' },
  listContainer: { padding: SPACING.MEDIUM, paddingBottom: SPACING.XLARGE + 24 },
  postCard: {
    marginBottom: SPACING.MEDIUM,
    padding: SPACING.MEDIUM,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SMALL,
    paddingBottom: SPACING.SMALL,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF4FA',
  },
  authorContainer: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: SPACING.SMALL, backgroundColor: '#D9ECFD' },
  authorName: { fontSize: 15, fontWeight: '700' },
  timestamp: { fontSize: 12 },
  postTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.SMALL },
  postPreview: { fontSize: 14, lineHeight: 21 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.SMALL },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 6, marginBottom: 6, borderWidth: 1 },
  tagText: { fontSize: 12, fontWeight: '600' },
  postFooter: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.SMALL, paddingTop: SPACING.SMALL, borderTopWidth: 1, borderTopColor: '#EEF4FA' },
  statItem: { flexDirection: 'row', alignItems: 'center', marginRight: SPACING.MEDIUM, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18, backgroundColor: 'rgba(247,250,252,0.95)' },
  statText: { marginLeft: 6, fontSize: 12, fontWeight: '600' },
  skeletonContainer: { padding: SPACING.MEDIUM },
  skeletonCard: { padding: SPACING.MEDIUM },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  skeletonMeta: { marginLeft: 10 },
  skeletonLineTight: { marginBottom: 6 },
  skeletonLine: { marginBottom: 10 },
  skeletonLineWide: { marginBottom: 16 },
  skeletonFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9EAF8',
    backgroundColor: 'rgba(255,255,255,0.88)',
    padding: SPACING.MEDIUM,
    marginTop: SPACING.SMALL,
  },
  footerText: { marginLeft: 8, fontSize: 13, fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.MEDIUM,
    marginTop: SPACING.XLARGE,
    padding: SPACING.LARGE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D6E9FB',
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  emptyIconShell: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(33,150,243,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.18)',
    marginBottom: SPACING.SMALL,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.SMALL },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: SPACING.MEDIUM },
  devQaPanel: {
    width: '100%',
    marginTop: SPACING.LARGE,
    paddingTop: SPACING.MEDIUM,
    borderTopWidth: 1,
    borderTopColor: '#E1EEF9',
  },
  devQaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devQaTitle: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
  },
  devQaText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  devQaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: SPACING.MEDIUM,
  },
  devQaButton: {
    minWidth: 88,
    marginHorizontal: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  devQaButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loadMoreErrorBanner: {
    marginHorizontal: SPACING.MEDIUM,
    marginTop: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadMoreErrorText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600' },
  loadMoreRetryText: { color: '#1D4ED8', fontSize: 13, fontWeight: '700' },
  errorBanner: {
    marginHorizontal: SPACING.MEDIUM,
    marginBottom: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBannerText: { color: '#B91C1C', flex: 1, fontSize: 13 },
  fabButton: {
    position: 'absolute',
    right: SPACING.LARGE,
    width: 116,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  fabButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginLeft: 6 },
  disabled: { opacity: 0.56 },
});

export default CommunityScreen;
