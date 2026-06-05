import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  selectNotifications,
  selectNotificationsPagination,
  selectIsLoading,
  selectError,
} from '../../redux/slices/communitySlice';

const EMPTY_ARRAY = [];

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const notifications = useSelector(selectNotifications) ?? EMPTY_ARRAY;
  const pagination = useSelector(selectNotificationsPagination) || {};
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const { theme } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [markAllBusy, setMarkAllBusy] = useState(false);

  const hasData = notifications.length > 0;
  const hasMore = Number(pagination?.page || page) < Number(pagination?.totalPages || 1);
  const pageState = isLoading && !hasData ? 'loading' : hasData ? 'ready' : error ? 'error' : 'empty';

  useEffect(() => {
    dispatch(fetchNotifications({ page: 1, pageSize: 20 }));
  }, [dispatch]);

  const handleRefresh = async () => {
    if (refreshing || isLoading) {return;}
    setRefreshing(true);
    setPage(1);
    try {
      await dispatch(fetchNotifications({ page: 1, pageSize: 20 }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoading || refreshing || isLoadingMore || !hasMore) {return;}
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      await dispatch(fetchNotifications({ page: nextPage, pageSize: 20 }));
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (markAllBusy || isLoading) {return;}
    setMarkAllBusy(true);
    try {
      await dispatch(markAllNotificationsRead());
    } finally {
      setMarkAllBusy(false);
    }
  };

  const handleMarkRead = async (id) => {
    if (!id || isLoading) {return;}
    await dispatch(markNotificationRead(id));
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item?.is_read).length,
    [notifications]
  );

  const friendlyError = useMemo(() => {
    if (!error) {return '';}
    const raw = String(error);
    if (raw.includes('Network Error') || raw.includes('网络')) {
      return '网络连接异常，请稍后重试';
    }
    return raw;
  }, [error]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        {
          opacity: item.is_read ? 0.72 : 1,
          borderColor: item.is_read ? 'rgba(203,213,225,0.72)' : `${theme.colors?.primary || '#2196F3'}30`,
          backgroundColor: item.is_read ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.88)',
        },
      ]}
      onPress={() => handleMarkRead(item.id)}
      testID={`item.community.notifications.${item.id}`}
    >
      <View style={styles.itemHead}>
        <Text style={[styles.title, { color: theme.colors?.text || '#000' }]} numberOfLines={1}>
          {item.title || '通知'}
        </Text>
        {!item.is_read ? <View style={styles.unreadDot} testID={`state.community.notifications.read.${item.id}.unread`} /> : null}
      </View>
      <Text style={[styles.message, { color: theme.colors?.textSecondary || '#666' }]}>{item.message || '暂无消息内容'}</Text>
      <View style={styles.metaRow}>
        <Icon name="schedule" size={13} color={theme.colors?.textSecondary || '#666'} />
        <Text style={[styles.time, { color: theme.colors?.textSecondary || '#666' }]}>
          {item.created_at ? new Date(item.created_at).toLocaleString() : '时间未知'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap} testID="state.community.notifications.empty">
      <Icon name="notifications-off" size={34} color={theme.colors?.textSecondary || '#8A99A8'} />
      <Text style={[styles.emptyText, { color: theme.colors?.textSecondary || '#8A99A8' }]}>暂无通知消息</Text>
      <TouchableOpacity
        style={[styles.retryButton, { borderColor: `${theme.colors?.primary || '#2196F3'}66` }]}
        onPress={handleRefresh}
        testID="action.community.notifications.retryEmpty"
      >
        <Text style={{ color: theme.colors?.primary || '#2196F3', fontWeight: '600' }}>刷新</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!hasData) {return null;}
    if (isLoadingMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.notifications.loadingMore">
          <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>正在加载更多...</Text>
        </View>
      );
    }
    if (!hasMore) {
      return (
        <View style={styles.footerWrap} testID="state.community.notifications.endOfList">
          <Icon name="check-circle" size={14} color={theme.colors?.primary || '#2196F3'} />
          <Text style={[styles.footerText, { color: theme.colors?.textSecondary || '#666' }]}>已加载全部通知</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#F2F7FB' }]} testID="screen.community.notifications">
      <View testID={`state.community.notifications.state.${pageState}`} />
      <View testID={`state.community.notifications.error.visibility.${friendlyError ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.notifications.loading.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.notifications.refreshing.visibility.${refreshing ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.notifications.markAllBusy.visibility.${markAllBusy ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.notifications.hasMore.${hasMore ? 'true' : 'false'}`} />
      <View testID={`state.community.notifications.unread.count.${unreadCount}`} />

      <View style={styles.headerCard} testID="panel.community.notifications.header">
        <View style={styles.headerRow}>
          <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.community.notifications.back" style={styles.backButton} />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.colors?.text || '#102A43' }]}>通知消息</Text>
            <Text style={[styles.headerMeta, { color: theme.colors?.textSecondary || '#5B7083' }]}>未读 {unreadCount} 条</Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: `${theme.colors?.primary || '#2196F3'}44` }]}
            onPress={handleRefresh}
            disabled={isLoading || refreshing}
            testID="action.community.notifications.refresh"
          >
            {isLoading || refreshing ? (
              <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
            ) : (
              <Icon name="refresh" size={18} color={theme.colors?.primary || '#2196F3'} />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.markAllBtn, { borderColor: `${theme.colors?.primary || '#2196F3'}44` }]}
          onPress={handleMarkAllRead}
          disabled={markAllBusy || isLoading}
          testID="action.community.notifications.markAllRead"
        >
          {markAllBusy ? (
            <ActivityIndicator size="small" color={theme.colors?.primary || '#2196F3'} />
          ) : (
            <Text style={{ color: theme.colors?.primary || '#2196F3', fontWeight: '600' }}>全部标记已读</Text>
          )}
        </TouchableOpacity>
      </View>

      {friendlyError ? (
        <View style={styles.errorCard} testID="state.community.notifications.error">
          <Icon name="error-outline" size={16} color="#B91C1C" />
          <Text style={styles.errorText}>{friendlyError}</Text>
        </View>
      ) : null}

      <FlatList
        data={notifications}
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
        testID="list.community.notifications"
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  backButton: { width: 40 },
  markAllBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
  },
  errorCard: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: 'rgba(254,242,242,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#B91C1C',
    flex: 1,
    lineHeight: 18,
    fontSize: 13,
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
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
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

export default NotificationsScreen;
