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
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';
import { EmptyState, ErrorState } from '../../components/common';

const GroupList = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const groups = useSelector(selectGroups) || [];
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = () => {
    dispatch(fetchGroups());
  };

  const handleGroupPress = (group) => {
    navigation.navigate('GroupDetail', { groupId: group.id });
  };

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{item.name}</Text>
        <View style={styles.memberCount}>
          <Icon name="account-group" size={16} color={COLORS.TEXT_SECONDARY} />
          <Text style={styles.memberCountText}>{item.member_count}</Text>
        </View>
      </View>

      {item.description ? (
        <Text style={styles.groupDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={styles.groupFooter}>
        <Text style={styles.createdAt}>
          创建于 {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyComponent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
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
    <View style={styles.container}>
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
            colors={COLORS.PRIMARY ? [COLORS.PRIMARY] : ['#007AFF']}
            tintColor={COLORS.PRIMARY || '#007AFF'}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  listContent: {
    padding: SPACING.MEDIUM,
    paddingBottom: SPACING.XLARGE,
    flexGrow: 1,
  },
  groupCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
    elevation: 4,
    shadowColor: COLORS.TEXT_PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)', // 轻微的边框颜色
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SMALL,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)', // 轻微的背景色
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  memberCountText: {
    fontSize: 14,
    marginLeft: 4,
    color: COLORS.TEXT_SECONDARY,
  },
  groupDescription: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.MEDIUM,
    lineHeight: 20,
  },
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: SPACING.SMALL,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)', // 轻微的边框颜色
  },
  createdAt: {
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.XLARGE,
  },
});

export default GroupList;
