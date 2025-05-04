/**
 * 群组成员列表组件
 */
import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';

const MemberList = ({ members, groupId }) => {
  const renderMemberItem = ({ item }) => (
    <View style={styles.memberItem}>
      {item.user.avatar ? (
        <Image
          source={{ uri: item.user.avatar }}
          style={styles.avatar}
        />
      ) : (
        <Avatar.Text
          size={40}
          label={item.user.username.substring(0, 2).toUpperCase()}
          style={styles.avatar}
        />
      )}

      <View style={styles.memberInfo}>
        <Text style={styles.username}>{item.user.username}</Text>
        <View style={styles.roleContainer}>
          <Text style={styles.role}>
            {item.role === 'admin' ? '管理员' : '成员'}
          </Text>
          {item.role === 'admin' && (
            <Icon name="shield-account" size={14} color={COLORS.PRIMARY} style={styles.roleIcon} />
          )}
        </View>
      </View>

      <Text style={styles.joinedAt}>
        {new Date(item.joined_at).toLocaleDateString()}
      </Text>
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="account-group" size={48} color={COLORS.TEXT_TERTIARY} />
      <Text style={styles.emptyText}>暂无成员</Text>
    </View>
  );

  return (
    <FlatList
      data={members}
      renderItem={renderMemberItem}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={renderEmptyComponent}
      contentContainerStyle={styles.listContent}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.MEDIUM,
  },
  memberInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  role: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  roleIcon: {
    marginLeft: 4,
  },
  joinedAt: {
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XLARGE,
  },
  emptyText: {
    marginTop: SPACING.MEDIUM,
    fontSize: 16,
    color: COLORS.TEXT_TERTIARY,
  },
});

export default MemberList;
