/**
 * 群组列表组件
 */
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchGroups, selectGroups, selectGroupsError, selectGroupsLoading } from '../../redux/slices/groupsSlice';
import { useTheme } from '../../context/ThemeContext';
import { EmptyState, ErrorState } from '../../components/common';
import { BORDER, ELEVATION, RADIUS, SIZE, SPACING } from '../../theme/tokens';

const isNetworkLikeError = (value) => {
  const message = String(value || '');
  return (
    message.includes('Network Error') ||
    message.includes('network error') ||
    message.includes('网络') ||
    message.includes('离线') ||
    message.includes('无缓存') ||
    message.includes('offline')
  );
};

const GroupList = () => {
  const { theme } = useTheme();
  const colors = theme.colors || theme;
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const groups = useSelector(selectGroups) || [];
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);
  const showErrorState = Boolean(error) && !isNetworkLikeError(error);

  const groupCount = groups.length;
  const listState = isLoading ? 'loading' : showErrorState ? 'error' : groupCount === 0 ? 'empty' : 'ready';
  const refreshingVisible = isLoading && groupCount > 0;
  const busyVisible = Boolean(isLoading);
  const errorVisible = showErrorState;
  const emptyVisible = !isLoading && !showErrorState && groupCount === 0;

  const loadGroups = async () => {
    if (isLoading) {
      return;
    }
    try {
      await dispatch(fetchGroups()).unwrap();
    } catch (fetchError) {
      console.warn('Load groups failed:', fetchError?.message || fetchError);
    }
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGroupPress = (group) => {
    if (isLoading) {
      return;
    }
    navigation.navigate('GroupDetail', { groupId: group.id });
  };

  const handleCreateGroup = () => {
    if (isLoading) {
      return;
    }
    navigation.navigate('CreateGroup');
  };

  const handleJoinGroup = () => {
    if (isLoading) {
      return;
    }
    navigation.navigate('JoinGroup');
  };

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.groupCard, { backgroundColor: `${(colors.card || colors.surface)}E0` }]}
      onPress={() => handleGroupPress(item)}
      disabled={isLoading}
      activeOpacity={0.75}
      testID={`item.group.list.${item.id}`}
    >
      <View style={styles.groupHeader}>
        <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
        <View style={styles.memberCount}>
          <Icon name="account-group" size={SIZE.icon.sm} color={colors.textSecondary} />
          <Text style={[styles.memberCountText, { color: colors.textSecondary }]}>{item.member_count}</Text>
        </View>
      </View>

      {item.description ? (
        <Text style={[styles.groupDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.groupFooter}>
        <Text style={[styles.createdAt, { color: colors.textTertiary || colors.textDescription }]}>
          创建于：{new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (showErrorState) {
      return <ErrorState message={error} onRetry={loadGroups} />;
    }

    return (
      <EmptyState
        icon="account-group"
        title="暂无群组"
        message="你还没有加入任何群组，点击下方按钮创建或加入群组。"
        buttonTitle="创建群组"
        buttonTestID="action.group.emptyCreate"
        onButtonPress={handleCreateGroup}
        secondaryButtonTitle="加入群组"
        secondaryButtonTestID="action.group.emptyJoin"
        onSecondaryButtonPress={handleJoinGroup}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View testID={`state.groups.list.state.${listState}`} />
      <View testID={`state.groups.list.count.${groupCount}`} />
      <View testID={`state.groups.list.refreshing.visibility.${refreshingVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.groups.list.busy.visibility.${busyVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.groups.list.error.visibility.${errorVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.groups.list.empty.visibility.${emptyVisible ? 'visible' : 'hidden'}`} />

      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={(
          <RefreshControl
            refreshing={refreshingVisible}
            onRefresh={loadGroups}
            colors={[colors.primary]}
            tintColor={colors.primary}
            testID="action.group.list.refresh"
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },
  groupCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...ELEVATION.sm,
    borderWidth: BORDER.width.thin,
    borderColor: '#CFE1FF',
    shadowColor: '#4C8DFF',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#CFE1FF',
  },
  memberCountText: {
    fontSize: 14,
    marginLeft: 4,
  },
  groupDescription: {
    fontSize: 14,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER.width.thin,
    borderTopColor: '#DBEAFE',
  },
  createdAt: {
    fontSize: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
});

export default GroupList;
