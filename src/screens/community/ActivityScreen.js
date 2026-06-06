import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchActivity,
  selectActivity,
  selectActivityPagination,
  selectIsLoading,
  selectError,
} from '../../redux/slices/communitySlice';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import useHideMainTabBar from './useHideMainTabBar';

const ActivityScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const activity = useSelector(selectActivity) || [];
  const pagination = useSelector(selectActivityPagination) || {};
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();

  useHideMainTabBar();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  const hasData = activity.length > 0;
  const hasMore = Number(pagination?.page || page) < Number(pagination?.totalPages || 1);
  const pageState = isLoading && !hasData ? 'loading' : hasData ? 'ready' : error ? 'error' : 'empty';

  useEffect(() => {
    dispatch(fetchActivity({ page: 1, pageSize: 20 }));
  }, [dispatch]);

  const handleRefresh = async () => {
    if (refreshing || isLoading) {return;}
    setRefreshing(true);
    setPage(1);
    try {
      await dispatch(fetchActivity({ page: 1, pageSize: 20 }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoading || refreshing || isLoadingMore || !hasMore) {return;}
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      await dispatch(fetchActivity({ page: nextPage, pageSize: 20 }));
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.itemCard,
        {
          backgroundColor: 'rgba(255,255,255,0.86)',
          borderColor: `${theme.colors?.primary || '#2196F3'}22`,
        },
      ]}
      testID={`item.community.activity.${item.id}`}
    >
      <Text style={[styles.title, { color: theme.colors?.text || '#000' }]}>{item.title || '活动'}</Text>
      <Text style={[styles.message, { color: theme.colors?.textSecondary || '#666' }]}>{item.message || '暂无活动描述'}</Text>
      <View style={styles.metaRow}>
        <Icon name="schedule" size={14} color={theme.colors?.textSecondary || '#666'} />
        <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>
          {item.created_at ? new Date(item.created_at).toLocaleString() : '时间未知'}
        </Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap} testID="state.community.activity.empty">
      <Icon name="dynamic-feed" size={34} color={theme.colors?.textSecondary || '#8A99A8'} />
      <Text style={[styles.emptyText, { color: theme.colors?.textSecondary || '#8A99A8' }]}>暂无活动动态</Text>
      <TouchableOpacity
        style={[styles.retryButton, { borderColor: `${theme.colors?.primary || '#2196F3'}66` }]}
        onPress={handleRefresh}
        testID="action.community.activity.retryEmpty"
      >
        <Text style={{ color: theme.colors?.primary || '#2196F3', fontWeight: '600' }}>刷新</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!hasData) {return null;}
    if (isLoadingMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.activity.loadingMore">
          <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>正在加载更多...</Text>
        </View>
      );
    }
    if (!hasMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.activity.endOfList">
          <Icon name="check-circle" size={14} color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>已加载全部动态</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#F2F7FB' }]} testID="screen.community.activity">
      <View testID={`state.community.activity.state.${pageState}`} />
      <View testID={`state.community.activity.loading.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.activity.refreshing.visibility.${refreshing ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.activity.hasMore.${hasMore ? 'true' : 'false'}`} />
      <View style={styles.headerCard} testID="panel.community.activity.header">
        <View style={styles.headerMainRow}>
          <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.community.activity.back" style={styles.backButton} />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.colors?.text || '#102A43' }]}>活动动态</Text>
            <Text style={[styles.headerMeta, { color: theme.colors?.textSecondary || '#5B7083' }]}>共 {activity.length} 条</Text>
          </View>
        </View>
        <View>
          <TouchableOpacity
            style={[styles.refreshAction, { borderColor: `${theme.colors?.primary || '#2196F3'}44` }]}
            onPress={handleRefresh}
            disabled={isLoading || refreshing}
            testID="action.community.activity.refresh"
          >
            {isLoading || refreshing ? (
              <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
            ) : (
              <Icon name="refresh" size={18} color={theme.colors?.primary || '#2196F3'} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activity}
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
        testID="list.community.activity"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 12,
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
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 8,
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  backButton: {
    width: 40,
  },
  refreshAction: {
    width: 40,
    height: 40,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    alignSelf: 'flex-end',
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    marginBottom: 7,
    lineHeight: 20,
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

export default ActivityScreen;
