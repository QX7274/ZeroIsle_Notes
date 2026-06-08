import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import {
  fetchFollowing,
  selectFollowing,
  selectFollowingPagination,
  selectIsLoading,
  selectError,
} from '../../redux/slices/communitySlice';
import useHideMainTabBar from './useHideMainTabBar';

const FollowingScreen = ({ route, navigation }) => {
  const { userId } = route.params || {};
  const dispatch = useDispatch();
  const following = useSelector(selectFollowing) || [];
  const pagination = useSelector(selectFollowingPagination) || {};
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  useHideMainTabBar();

  const hasData = following.length > 0;
  const hasMore = Number(pagination?.page || page) < Number(pagination?.totalPages || 1);
  const pageState = isLoading && !hasData ? 'loading' : hasData ? 'ready' : error ? 'error' : 'empty';

  useEffect(() => {
    if (userId) {
      dispatch(fetchFollowing({ userId, page: 1, pageSize: 20 }));
    }
  }, [dispatch, userId]);

  const handleRefresh = async () => {
    if (!userId || refreshing || isLoading) {return;}
    setRefreshing(true);
    setPage(1);
    try {
      await dispatch(fetchFollowing({ userId, page: 1, pageSize: 20 }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!userId || isLoading || refreshing || isLoadingMore || !hasMore) {return;}
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      await dispatch(fetchFollowing({ userId, page: nextPage, pageSize: 20 }));
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const getTargetTypeLabel = (contentType) => {
    switch (contentType) {
      case 'user':
        return '用户';
      case 'post':
        return '帖子';
      case 'tag':
        return '标签';
      default:
        return '对象';
    }
  };

  const handleFollowingPress = (item) => {
    if (!item) {
      return;
    }

    if (item.contentType === 'user' && item.targetId) {
      navigation?.navigate?.('UserProfile', {
        userId: item.targetId,
        initialUser: {
          id: item.targetId,
          username: `用户 ${item.targetId}`,
          nickname: `用户 ${item.targetId}`,
        },
      });
      return;
    }

    if (item.contentType === 'post' && item.targetId) {
      navigation?.navigate?.('PostDetail', {
        postId: item.targetId,
        title: '帖子详情',
      });
      return;
    }

    if (item.contentType === 'tag' && item.targetId) {
      navigation?.navigate?.('Community', { tag: item.targetId });
      return;
    }

    navigation?.navigate?.('Community');
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        { borderColor: `${theme.colors?.primary || '#2196F3'}24` },
      ]}
      onPress={() => handleFollowingPress(item)}
      testID={`item.community.following.${item.id}`}
    >
      <View style={styles.itemHead}>
        <Text style={[styles.name, { color: theme.colors?.text || '#000' }]} numberOfLines={1}>
          {getTargetTypeLabel(item.contentType)}：{item.targetId || '-'}
        </Text>
        <Icon name="chevron-right" size={20} color={theme.colors?.textSecondary || '#95A3B2'} />
      </View>
      <View style={styles.metaRow}>
        <Icon name="schedule" size={13} color={theme.colors?.textSecondary || '#666'} />
        <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>
          {item.followedAt ? new Date(item.followedAt).toLocaleString() : '时间未知'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap} testID="state.community.following.empty">
      <Icon name="favorite-border" size={34} color={theme.colors?.textSecondary || '#8A99A8'} />
      <Text style={[styles.emptyText, { color: theme.colors?.textSecondary || '#8A99A8' }]}>暂无关注对象</Text>
      <TouchableOpacity
        style={[styles.retryButton, { borderColor: `${theme.colors?.primary || '#2196F3'}66` }]}
        onPress={handleRefresh}
        testID="action.community.following.retryEmpty"
      >
        <Text style={[styles.retryButtonText, { color: theme.colors?.primary || '#2196F3' }]}>刷新</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!hasData) {return null;}
    if (isLoadingMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.following.loadingMore">
          <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>正在加载更多...</Text>
        </View>
      );
    }
    if (!hasMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.following.endOfList">
          <Icon name="check-circle" size={14} color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>已加载全部关注项</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors?.background || '#F2F7FB',
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
      testID="screen.community.following"
    >
      <View testID={`state.community.following.state.${pageState}`} />
      <View testID={`state.community.following.loading.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.following.refreshing.visibility.${refreshing ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.following.hasMore.${hasMore ? 'true' : 'false'}`} />
      <View testID={`state.community.following.count.${following.length}`} />

      <View style={styles.headerCard} testID="panel.community.following.header">
        <View style={styles.headerRow}>
          <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.community.following.back" style={styles.backButton} />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.colors?.text || '#102A43' }]}>关注列表</Text>
            <Text style={[styles.headerMeta, { color: theme.colors?.textSecondary || '#5B7083' }]}>共 {following.length} 项</Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: `${theme.colors?.primary || '#2196F3'}44` }]}
            onPress={handleRefresh}
            disabled={isLoading || refreshing}
            testID="action.community.following.refresh"
          >
            {isLoading || refreshing ? (
              <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
            ) : (
              <Icon name="refresh" size={18} color={theme.colors?.primary || '#2196F3'} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerHint, { color: theme.colors?.textSecondary || '#5B7083' }]}>
          当前按对象类型汇总展示，方便继续核验关注链路与分页状态。
        </Text>
      </View>

      <FlatList
        data={following}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={hasData ? styles.listContent : styles.emptyListContent}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors?.primary || '#2196F3']}
            tintColor={theme.colors?.primary || '#2196F3'}
          />
        )}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        testID="list.community.following"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 0,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.20)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: { flex: 1, marginHorizontal: 8 },
  backButton: { width: 40 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  headerHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  emptyListContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 24,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  itemCard: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  time: {
    fontSize: 12,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 26,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
  retryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  retryButtonText: {
    fontWeight: '600',
  },
  footerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingBottom: 12,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
  },
});

export default FollowingScreen;
