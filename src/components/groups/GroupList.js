/**
 * 群组列表组件
 */
import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fetchGroups, selectGroups, selectGroupsLoading, selectGroupsError } from '../../redux/slices/groupsSlice';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS, ELEVATION, SIZE, BORDER } from '../../theme/tokens';
import { EmptyState, ErrorState } from '../../components/common';

const GroupList = () => {
  const { theme } = useTheme();
  // Ensure correct color references
  const colors = theme.colors || theme;

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const groups = useSelector(selectGroups) || [];
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      await dispatch(fetchGroups()).unwrap();
    } catch (error) {
      console.error('加载群组列表失败:', error);
      // 无网时由 slice 回退为空数组，这里不再触发全局网络弹窗
    }
  };

  const handleGroupPress = (group) => {
    navigation.navigate('GroupDetail', { groupId: group.id });
  };

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.groupCard, { backgroundColor: colors.card || colors.surface }]}
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.7}
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
          创建于 {new Date(item.created_at).toLocaleDateString()}
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

    if (error) {
      return (
        <ErrorState
          message={error}
          onRetry={loadGroups}
        />
      );
    }

    return (
      <EmptyState
        icon="account-group"
        title="暂无群组"
        message="您还没有加入任何群组，点击下方按钮创建或加入群组"
        buttonTitle="创建群组"
        onButtonPress={() => navigation.navigate('CreateGroup')}
        secondaryButtonTitle="加入群组"
        onSecondaryButtonPress={() => navigation.navigate('JoinGroup')}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && (groups && groups.length > 0)}
            onRefresh={loadGroups}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
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
    borderColor: 'rgba(0,0,0,0.03)',
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
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
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
    borderTopColor: 'rgba(0,0,0,0.05)',
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
