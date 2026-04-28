/**
 * 群组邀请列表屏幕
 */
import React, { useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  fetchGroupInvitations,
  acceptGroupInvitation,
  rejectGroupInvitation,
  selectGroupInvitations,
  selectGroupsLoading,
} from '../../redux/slices/groupsSlice';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../utils/constants/colors';

const InvitationsScreen = () => {
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const invitations = useSelector(selectGroupInvitations) || [];
  const isLoading = useSelector(selectGroupsLoading);
  const groupsError = useSelector((state) => state.groups.error);
  const isNetworkFallback = useMemo(() => {
    const message = groupsError || '';
    return message.includes('网络') || message.includes('Network Error');
  }, [groupsError]);

  const loadInvitations = useCallback(() => {
    dispatch(fetchGroupInvitations());
  }, [dispatch]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleAccept = (invitationId) => {
    dispatch(acceptGroupInvitation(invitationId)).then(() => {
      loadInvitations();
    });
  };

  const handleReject = (invitationId) => {
    dispatch(rejectGroupInvitation(invitationId)).then(() => {
      loadInvitations();
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="account-group" size={20} color={COLORS.TEXT_SECONDARY} />
        <Text style={styles.title} numberOfLines={1}>{item.group?.name || '群组'}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {item.inviter?.username ? `${item.inviter.username} 邀请你加入` : '你收到一个群组邀请'}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => handleAccept(item.id)}>
          <Icon name="check" size={18} color="#fff" />
          <Text style={styles.btnText}>接受</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.reject]} onPress={() => handleReject(item.id)}>
          <Icon name="close" size={18} color="#fff" />
          <Text style={styles.btnText}>拒绝</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Icon name="inbox" size={32} color={COLORS.TEXT_SECONDARY} />
      <Text style={styles.emptyText}>暂无邀请</Text>
      {isNetworkFallback && (
        <Text style={styles.hintText}>当前网络不可用，已显示离线空列表</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={invitations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={invitations.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={renderEmpty}
        refreshing={isLoading}
        onRefresh={loadInvitations}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.TEXT_SECONDARY,
  },
  hintText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 16,
    color: COLORS.TEXT,
  },
  message: {
    marginTop: 8,
    color: COLORS.TEXT_SECONDARY,
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  accept: {
    backgroundColor: '#4CAF50',
  },
  reject: {
    backgroundColor: '#F44336',
  },
  btnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
});

export default InvitationsScreen;


