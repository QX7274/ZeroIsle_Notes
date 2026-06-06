import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
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
  fetchFollowers,
  selectFollowers,
  selectFollowersPagination,
  selectIsLoading,
  selectError,
} from '../../redux/slices/communitySlice';
import useHideMainTabBar from './useHideMainTabBar';

const FollowersScreen = ({ route, navigation }) => {
  const { userId } = route.params || {};
  const dispatch = useDispatch();
  const followers = useSelector(selectFollowers) || [];
  const pagination = useSelector(selectFollowersPagination) || {};
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  useHideMainTabBar();

  const hasData = followers.length > 0;
  const hasMore = Number(pagination?.page || page) < Number(pagination?.totalPages || 1);
  const pageState = isLoading && !hasData ? 'loading' : hasData ? 'ready' : error ? 'error' : 'empty';

  useEffect(() => {
    if (userId) {
      dispatch(fetchFollowers({ userId, page: 1, pageSize: 20 }));
    }
  }, [dispatch, userId]);

  const handleRefresh = async () => {
    if (!userId || refreshing || isLoading) {return;}
    setRefreshing(true);
    setPage(1);
    try {
      await dispatch(fetchFollowers({ userId, page: 1, pageSize: 20 }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!userId || isLoading || refreshing || isLoadingMore || !hasMore) {return;}
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      await dispatch(fetchFollowers({ userId, page: nextPage, pageSize: 20 }));
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        { borderColor: `${theme.colors?.primary || '#2196F3'}24` },
      ]}
      onPress={() => navigation?.navigate?.('UserProfile', { userId: item.id })}
      testID={`item.community.followers.${item.id}`}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.colors?.text || '#000' }]} numberOfLines={1}>
          {item.nickname || '用户'}
        </Text>
        <View style={styles.metaRow}>
          <Icon name="schedule" size={13} color={theme.colors?.textSecondary || '#666'} />
          <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>
            {item.followedAt ? new Date(item.followedAt).toLocaleString() : '时间未知'}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={20} color={theme.colors?.textSecondary || '#95A3B2'} />
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap} testID="state.community.followers.empty">
      <Icon name="group" size={34} color={theme.colors?.textSecondary || '#8A99A8'} />
      <Text style={[styles.emptyText, { color: theme.colors?.textSecondary || '#8A99A8' }]}>暂无粉丝</Text>
      <TouchableOpacity
        style={[styles.retryButton, { borderColor: `${theme.colors?.primary || '#2196F3'}66` }]}
        onPress={handleRefresh}
        testID="action.community.followers.retryEmpty"
      >
        <Text style={[styles.retryButtonText, { color: theme.colors?.primary || '#2196F3' }]}>刷新</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!hasData) {return null;}
    if (isLoadingMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.followers.loadingMore">
          <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>正在加载更多...</Text>
        </View>
      );
    }
    if (!hasMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.followers.endOfList">
          <Icon name="check-circle" size={14} color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>已加载全部粉丝</Text>
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
      testID="screen.community.followers"
    >
      <View testID={`state.community.followers.state.${pageState}`} />
      <View testID={`state.community.followers.loading.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.followers.refreshing.visibility.${refreshing ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.followers.hasMore.${hasMore ? 'true' : 'false'}`} />
      <View testID={`state.community.followers.count.${followers.length}`} />

      <View style={styles.headerCard} testID="panel.community.followers.header">
        <View style={styles.headerRow}>
          <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.community.followers.back" style={styles.backButton} />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.colors?.text || '#102A43' }]}>粉丝列表</Text>
            <Text style={[styles.headerMeta, { color: theme.colors?.textSecondary || '#5B7083' }]}>共 {followers.length} 位</Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: `${theme.colors?.primary || '#2196F3'}44` }]}
            onPress={handleRefresh}
            disabled={isLoading || refreshing}
            testID="action.community.followers.refresh"
          >
            {isLoading || refreshing ? (
              <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
            ) : (
              <Icon name="refresh" size={18} color={theme.colors?.primary || '#2196F3'} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerHint, { color: theme.colors?.textSecondary || '#5B7083' }]}>
          点击成员卡片可继续进入对应个人主页。
        </Text>
      </View>

      <FlatList
        data={followers}
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
        testID="list.community.followers"
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
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingBottom: 18,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#D6DEEA',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
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
    justifyContent: 'center',
    alignItems: 'center',
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

export default FollowersScreen;
