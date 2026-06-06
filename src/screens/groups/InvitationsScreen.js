/**
 * 群组邀请列表屏幕
 */
import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  fetchGroupInvitations,
  acceptGroupInvitation,
  rejectGroupInvitation,
  selectGroupInvitations,
  selectGroupsError,
  selectGroupsLoading,
} from '../../redux/slices/groupsSlice';
import { COLORS } from '../../utils/constants/colors';
import networkErrorService from '../../services/networkErrorService';

const InvitationsScreen = () => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const invitations = useSelector(selectGroupInvitations) || [];
  const isLoading = useSelector(selectGroupsLoading);
  const groupsError = useSelector(selectGroupsError);
  const [pendingInvitationId, setPendingInvitationId] = useState(null);
  const [pendingActionType, setPendingActionType] = useState(null);

  const isNetworkFallback = useMemo(() => {
    const message = groupsError || '';
    return (
      message.toLowerCase().includes('network error') ||
      message.includes('网络') ||
      message.includes('离线') ||
      message.includes('无缓存') ||
      message.includes('offline')
    );
  }, [groupsError]);

  const hasInvitations = invitations.length > 0;
  const pageState = isLoading ? 'loading' : hasInvitations ? 'ready' : 'empty';
  const busyVisible = Boolean(pendingInvitationId);
  const errorVisible = Boolean(groupsError) && !isNetworkFallback;
  const networkFallbackVisible = Boolean(isNetworkFallback);
  const isNetworkError = Boolean(groupsError) && isNetworkFallback;

  const loadInvitations = useCallback(() => {
    dispatch(fetchGroupInvitations());
  }, [dispatch]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  useEffect(() => {
    if (!isNetworkError || !groupsError) {
      return;
    }

    networkErrorService.handleApiError(new Error(String(groupsError)), {
      context: '加载群组邀请',
      customMessage: '网络连接失败，无法加载群组邀请',
    });
  }, [groupsError, isNetworkError]);

  const handleAccept = async (invitationId) => {
    if (!invitationId) {
      return;
    }
    setPendingInvitationId(invitationId);
    setPendingActionType('accept');
    try {
      await dispatch(acceptGroupInvitation(invitationId));
      loadInvitations();
    } finally {
      setPendingInvitationId(null);
      setPendingActionType(null);
    }
  };

  const handleReject = async (invitationId) => {
    if (!invitationId) {
      return;
    }
    setPendingInvitationId(invitationId);
    setPendingActionType('reject');
    try {
      await dispatch(rejectGroupInvitation(invitationId));
      loadInvitations();
    } finally {
      setPendingInvitationId(null);
      setPendingActionType(null);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card} testID={`state.group.invitations.item.${item.id}`}>
      <View style={styles.row}>
        <Icon name="account-group" size={20} color={COLORS.PRIMARY} />
        <Text style={styles.title} numberOfLines={1}>
          {item.group?.name || '未命名群组'}
        </Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {item.inviter?.username
          ? `${item.inviter.username} 邀请你加入群组`
          : '你收到一条新的群组邀请'}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.accept, busyVisible && styles.btnDisabled]}
          onPress={() => handleAccept(item.id)}
          disabled={busyVisible}
          testID={`action.group.invitations.accept.${item.id}`}
        >
          <Icon name="check" size={18} color="#fff" />
          <Text style={styles.btnText}>接受</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.reject, busyVisible && styles.btnDisabled]}
          onPress={() => handleReject(item.id)}
          disabled={busyVisible}
          testID={`action.group.invitations.reject.${item.id}`}
        >
          <Icon name="close" size={18} color="#fff" />
          <Text style={styles.btnText}>拒绝</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Icon name="inbox" size={34} color={COLORS.TEXT_SECONDARY} />
      <Text style={styles.emptyText}>当前没有待处理邀请</Text>
      {isNetworkFallback ? (
        <Text
          style={styles.hintText}
          testID={`state.group.invitations.networkFallback.visibility.${networkFallbackVisible ? 'visible' : 'hidden'}`}
        >
          当前网络不可用，已显示离线空列表
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]} testID={`state.group.invitations.state.${pageState}`}>
      <View style={styles.headerCard} testID="panel.group.invitations.header">
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>群组邀请</Text>
          <Text style={styles.headerMeta}>待处理：{invitations.length}</Text>
        </View>
        <Button
          compact
          mode="outlined"
          onPress={loadInvitations}
          loading={isLoading}
          disabled={isLoading || busyVisible}
          testID="action.group.invitations.refresh"
        >
          刷新
        </Button>
      </View>

      <Text style={styles.stateAnchorText} testID={`state.group.invitations.loading.visibility.${isLoading ? 'visible' : 'hidden'}`}>
        loading:{isLoading ? 'visible' : 'hidden'}
      </Text>
      <Text style={styles.stateAnchorText} testID={`state.group.invitations.busy.visibility.${busyVisible ? 'visible' : 'hidden'}`}>
        busy:{busyVisible ? 'visible' : 'hidden'}:{pendingActionType || 'idle'}
      </Text>
      <Text style={styles.stateAnchorText} testID={`state.group.invitations.error.visibility.${errorVisible ? 'visible' : 'hidden'}`}>
        error:{errorVisible ? 'visible' : 'hidden'}
      </Text>
      <Text style={styles.stateAnchorText} testID={`state.group.invitations.networkFallback.visibility.${networkFallbackVisible ? 'visible' : 'hidden'}`}>
        networkFallback:{networkFallbackVisible ? 'visible' : 'hidden'}
      </Text>

      {errorVisible ? (
        <View style={styles.errorCard} testID="state.group.invitations.error">
          <Icon name="alert-circle-outline" size={18} color={COLORS.ERROR} />
          <Text style={styles.errorText}>{groupsError}</Text>
        </View>
      ) : null}

      <FlatList
        data={invitations}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={invitations.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={renderEmpty}
        refreshing={isLoading}
        onRefresh={loadInvitations}
        testID="list.group.invitations"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  headerCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    backgroundColor: 'rgba(255,255,255,0.86)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 3,
  },
  headerTitleRow: {
    flex: 1,
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
  },
  stateAnchorText: {
    marginTop: 6,
    marginHorizontal: 16,
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 14,
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: 'rgba(254,242,242,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: COLORS.ERROR,
    flex: 1,
    lineHeight: 19,
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
    paddingHorizontal: 18,
  },
  emptyText: {
    marginTop: 8,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  hintText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
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
    lineHeight: 20,
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
    borderRadius: 10,
    marginRight: 10,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  accept: {
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  reject: {
    backgroundColor: '#DC2626',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  btnText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '600',
  },
});

export default InvitationsScreen;
