import React from 'react';
import {
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';

const MemberList = ({ members }) => {
  const normalizedMembers = Array.isArray(members) ? members : [];
  const memberCount = normalizedMembers.length;
  const listState = memberCount > 0 ? 'ready' : 'empty';

  const renderMemberItem = ({ item }) => {
    const user = item?.user || {};
    const username = user?.username || '未知成员';
    const avatarUri = user?.avatar || '';
    const isAdmin = item?.role === 'admin';
    const joinedAt = item?.joined_at ? new Date(item.joined_at).toLocaleDateString() : '未知时间';
    const avatarLabel = username.slice(0, 2).toUpperCase() || 'UN';

    return (
      <View style={styles.memberItem} testID={`item.group.member.${item?.id || username}`}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <Avatar.Text size={40} label={avatarLabel} style={styles.avatar} />
        )}

        <View style={styles.memberInfo}>
          <Text style={styles.username}>{username}</Text>
          <View style={styles.roleContainer}>
            <Text style={styles.role}>{isAdmin ? '管理员' : '成员'}</Text>
            {isAdmin ? (
              <Icon name="shield-account" size={14} color={COLORS.PRIMARY} style={styles.roleIcon} />
            ) : null}
          </View>
        </View>

        <Text style={styles.joinedAt}>{joinedAt}</Text>
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer} testID="state.group.members.empty.visibility.visible">
      <Icon name="account-group" size={48} color={COLORS.TEXT_TERTIARY} />
      <Text style={styles.emptyText}>暂无成员</Text>
    </View>
  );

  return (
    <View style={styles.container} testID={`state.group.members.state.${listState}`}>
      <View testID={`state.group.members.count.${memberCount}`} />
      <View testID={`state.group.members.empty.visibility.${memberCount === 0 ? 'visible' : 'hidden'}`} />
      <View style={styles.listContent} testID="list.group.members">
        {memberCount === 0
          ? renderEmptyComponent()
          : normalizedMembers.map((item, index) => (
            <React.Fragment key={String(item?.id || `${item?.user?.id || 'member'}-${index}`)}>
              {renderMemberItem({ item })}
            </React.Fragment>
          ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { flexGrow: 1 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.SMALL,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33,150,243,0.14)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.MEDIUM,
  },
  memberInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '600', color: COLORS.TEXT_PRIMARY },
  roleContainer: { flexDirection: 'row', alignItems: 'center' },
  role: { fontSize: 12, color: COLORS.TEXT_SECONDARY },
  roleIcon: { marginLeft: 4 },
  joinedAt: { fontSize: 12, color: COLORS.TEXT_TERTIARY },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: SPACING.XLARGE },
  emptyText: { marginTop: SPACING.MEDIUM, fontSize: 16, color: COLORS.TEXT_TERTIARY },
});

export default MemberList;
