/**
 * 缇ょ粍璇︽儏缁勪欢
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Dialog, Divider, Menu, Portal, Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { ErrorState } from '../../components/common';
import { COLORS } from '../../utils/constants/colors';
import { SPACING } from '../../utils/constants/dimensions';
import networkErrorService from '../../services/networkErrorService';
import {
  fetchGroupDetail,
  fetchGroupMembers,
  generateJoinCode,
  leaveGroup,
  setCurrentGroup,
  selectCurrentGroup,
  selectGroups,
  selectGroupMembers,
  selectGroupsError,
  selectGroupsLoading,
  selectJoinCode,
  selectJoinCodeExpiresAt,
} from '../../redux/slices/groupsSlice';
import MemberList from './MemberList';

const GroupDetail = ({ groupId }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const group = useSelector(selectCurrentGroup);
  const groups = useSelector(selectGroups);
  const members = useSelector(selectGroupMembers);
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);
  const joinCode = useSelector(selectJoinCode);
  const joinCodeExpiresAt = useSelector(selectJoinCodeExpiresAt);

  const [menuVisible, setMenuVisible] = useState(false);
  const [joinCodeDialogVisible, setJoinCodeDialogVisible] = useState(false);
  const [leaveDialogVisible, setLeaveDialogVisible] = useState(false);
  const [inlineStatus, setInlineStatus] = useState('');
  const [inlineStatusTone, setInlineStatusTone] = useState('info');
  const [isGeneratingJoinCode, setIsGeneratingJoinCode] = useState(false);
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [isSharingJoinCode, setIsSharingJoinCode] = useState(false);
  const [isStartingShare, setIsStartingShare] = useState(false);
  const [isRefreshingGroup, setIsRefreshingGroup] = useState(false);
  const startShareResetTimerRef = useRef(null);
  const interactionBusy = isLoading || isRefreshingGroup || isGeneratingJoinCode || isSharingJoinCode || isLeavingGroup;
  const detailState = isLoading && !group ? 'loading' : error && !group ? 'error' : !group ? 'empty' : 'ready';
  const isNetworkLikeError = (value) => {
    const message = String(value || '');
    return (
      message.toLowerCase().includes('network error')
      || message.includes('网络')
      || message.includes('离线')
      || message.includes('无缓存')
      || message.includes('offline')
    );
  };
  const showErrorState = Boolean(error) && !group && !isNetworkLikeError(error);
  const showNetworkFallback = Boolean(error) && !group && isNetworkLikeError(error);
  const localGroupFromList = groups.find((item) => String(item?.id) === String(groupId) && item?.local_only);
  const localGroup = localGroupFromList || (
    String(group?.id || '') === String(groupId || '') && group?.local_only
      ? group
      : null
  );
  const isLocalGroup = Boolean(localGroup);

  useEffect(() => {
    if (isLocalGroup) {
      dispatch(setCurrentGroup(localGroup));
      return;
    }
    dispatch(fetchGroupDetail(groupId));
    dispatch(fetchGroupMembers(groupId));
  }, [dispatch, groupId, isLocalGroup, localGroup]);

  useEffect(() => () => {
    if (startShareResetTimerRef.current) {
      clearTimeout(startShareResetTimerRef.current);
      startShareResetTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!error || group || !isNetworkLikeError(error)) {
      return;
    }

    networkErrorService.handleApiError(new Error(String(error)), {
      context: '加载群组详情',
      customMessage: '网络连接失败，无法加载群组详情',
    });
  }, [error, group]);

  const loadGroupData = async () => {
    if (isRefreshingGroup || isGeneratingJoinCode || isLeavingGroup || isSharingJoinCode) {
      return;
    }

    if (isLocalGroup) {
      dispatch(setCurrentGroup(localGroup));
      setInlineStatus('当前是本地离线草稿，联网后再刷新即可同步远端群组数据');
      setInlineStatusTone('info');
      return;
    }

    setIsRefreshingGroup(true);
    try {
      await Promise.all([
        dispatch(fetchGroupDetail(groupId)),
        dispatch(fetchGroupMembers(groupId)),
      ]);
    } finally {
      setIsRefreshingGroup(false);
    }
  };

  const handleGenerateJoinCode = () => {
    if (isGeneratingJoinCode) {
      return;
    }
    setIsGeneratingJoinCode(true);
    dispatch(generateJoinCode({ groupId, expiresIn: 30 }))
      .unwrap()
      .then(() => {
        setInlineStatus('加入码已生成，可复制或分享');
        setInlineStatusTone('success');
        setJoinCodeDialogVisible(true);
      })
      .catch((requestError) => {
        setInlineStatus(requestError || '生成加入码失败，请稍后重试');
        setInlineStatusTone('error');
      })
      .finally(() => {
        setIsGeneratingJoinCode(false);
      });
  };

  const handleShareJoinCode = async () => {
    if (!joinCode || isSharingJoinCode) {
      return;
    }

    setIsSharingJoinCode(true);
    try {
      await Share.share({
        message: `加入我的群组“${group.name}”，使用加入码：${joinCode}`,
      });
      setInlineStatus('加入码分享面板已打开');
      setInlineStatusTone('success');
    } catch (shareError) {
      setInlineStatus(shareError.message || '分享失败，请稍后重试');
      setInlineStatusTone('error');
    } finally {
      setIsSharingJoinCode(false);
    }
  };

  const handleLeaveGroup = () => {
    if (isLeavingGroup) {
      return;
    }
    setIsLeavingGroup(true);
    dispatch(leaveGroup(groupId))
      .unwrap()
      .then(() => {
        setLeaveDialogVisible(false);
        navigation.goBack();
      })
      .catch((requestError) => {
        setInlineStatus(requestError || '离开群组失败，请稍后重试');
        setInlineStatusTone('error');
      })
      .finally(() => {
        setIsLeavingGroup(false);
      });
  };

  const handleStartScreenShare = () => {
    if (isStartingShare || interactionBusy) {
      return;
    }
    setIsStartingShare(true);
    navigation.navigate('ScreenShare', { groupId });
    if (startShareResetTimerRef.current) {
      clearTimeout(startShareResetTimerRef.current);
    }
    startShareResetTimerRef.current = setTimeout(() => {
      setIsStartingShare(false);
      startShareResetTimerRef.current = null;
    }, 300);
  };

  const handleInviteMembers = () => {
    if (isGeneratingJoinCode || isSharingJoinCode || isLeavingGroup || isRefreshingGroup) {
      return;
    }
    setMenuVisible(false);
    navigation.navigate('InviteMembers', { groupId });
  };

  const handleOpenMenu = () => {
    if (interactionBusy) {
      return;
    }
    setMenuVisible(true);
  };

  const closeMenu = () => {
    if (interactionBusy) {
      return;
    }
    setMenuVisible(false);
  };

  const handleMenuGenerateJoinCode = () => {
    if (interactionBusy) {
      return;
    }
    setMenuVisible(false);
    handleGenerateJoinCode();
  };

  const handleOpenLeaveDialog = () => {
    if (interactionBusy) {
      return;
    }
    setMenuVisible(false);
    setLeaveDialogVisible(true);
  };

  const canGenerateJoinCode = !isLocalGroup && Boolean(group?.can_generate_join_code);
  const canInviteMembers = !isLocalGroup && Boolean(group?.can_invite);
  const shouldShowShareAction = !isLocalGroup;
  const refreshButtonLabel = isLocalGroup ? '查看草稿状态' : '刷新';
  const draftStatusText = isLocalGroup ? '本地离线草稿，当前仅保留详情浏览与删除草稿操作。' : '';

  const closeJoinCodeDialog = () => {
    if (isSharingJoinCode) {
      return;
    }
    setJoinCodeDialogVisible(false);
  };

  const closeLeaveDialog = () => {
    if (isLeavingGroup) {
      return;
    }
    setLeaveDialogVisible(false);
  };

  const formatExpiryTime = (dateString) => {
    if (!dateString) {
      return '';
    }
    return new Date(dateString).toLocaleString();
  };

  if (isLoading && !group) {
    return (
      <View style={styles.centerContainer} testID="state.group.detail.loading">
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (showErrorState) {
    return <ErrorState message={error} onRetry={loadGroupData} testID="state.group.detail.error" />;
  }

  if (showNetworkFallback) {
    return (
      <View style={styles.centerContainer} testID="state.group.detail.networkFallback">
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={styles.networkFallbackTitle}>群组信息暂时不可用</Text>
        <Text style={styles.networkFallbackText}>已使用统一网络提示，稍后可重试加载。</Text>
        <Button mode="contained" onPress={loadGroupData} style={styles.networkFallbackButton} testID="action.group.detail.retryNetwork">
          重试
        </Button>
      </View>
    );
  }

  if (!group) {
    return <ErrorState message="无法加载群组信息" onRetry={loadGroupData} testID="state.group.detail.empty" />;
  }

  return (
    <View style={styles.container} testID="screen.groups.detail">
      <View testID={`state.group.detail.state.${detailState}`} />
      <View testID={`state.group.detail.interactionBusy.visibility.${interactionBusy ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.detail.menu.visibility.${menuVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.detail.joinCodeDialog.visibility.${joinCodeDialogVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.detail.leaveDialog.visibility.${leaveDialogVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.detail.inlineStatus.visibility.${inlineStatus ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.detail.startShareBusy.visibility.${isStartingShare ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.detail.canGenerateJoinCode.${canGenerateJoinCode ? 'true' : 'false'}`} />
      <View testID={`state.group.detail.canInviteMembers.${canInviteMembers ? 'true' : 'false'}`} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {inlineStatus ? (
          <View
            style={[
              styles.inlineStatusBanner,
              inlineStatusTone === 'error'
                ? styles.inlineStatusBannerError
                : inlineStatusTone === 'success'
                  ? styles.inlineStatusBannerSuccess
                  : styles.inlineStatusBannerInfo,
            ]}
            testID={`state.group.inlineStatus.${inlineStatusTone}`}
          >
            <Text
              style={
                inlineStatusTone === 'error'
                  ? styles.inlineStatusTextError
                  : inlineStatusTone === 'success'
                    ? styles.inlineStatusTextSuccess
                    : styles.inlineStatusTextInfo
              }
            >
              {inlineStatus}
            </Text>
          </View>
        ) : null}

        <View style={[styles.header, styles.glassBlock]}>
          <View style={styles.headerContent}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.memberCount}>{group.member_count} 位成员</Text>
            {draftStatusText ? (
              <Text style={styles.draftBadge} testID="state.group.detail.localDraftHint">
                {draftStatusText}
              </Text>
            ) : null}
          </View>

          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            style={styles.menu}
            anchor={(
              <TouchableOpacity
                style={styles.menuButton}
                onPress={handleOpenMenu}
                disabled={interactionBusy}
                testID="action.group.openMenu"
              >
                <Icon name="dots-vertical" size={24} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>
            )}
          >
            {canGenerateJoinCode ? (
              <Menu.Item
                onPress={handleMenuGenerateJoinCode}
                title="生成加入码"
                leadingIcon="link-variant"
                testID="action.group.menu.generateJoinCode"
                disabled={interactionBusy}
              />
            ) : null}
            {canInviteMembers ? (
              <Menu.Item
                onPress={handleInviteMembers}
                title="邀请成员"
                leadingIcon="account-plus"
                testID="action.group.menu.inviteMembers"
                disabled={interactionBusy}
              />
            ) : null}
            {canGenerateJoinCode || canInviteMembers ? <Divider /> : null}
            <Menu.Item
              onPress={handleOpenLeaveDialog}
              title={isLocalGroup ? '删除草稿' : '离开群组'}
              leadingIcon="exit-to-app"
              titleStyle={{ color: COLORS.ERROR }}
              testID="action.group.menu.leaveGroup"
              disabled={interactionBusy}
            />
          </Menu>
        </View>

        {group.description ? (
          <View style={[styles.descriptionContainer, styles.glassBlock]}>
            <Text style={styles.descriptionTitle}>群组简介</Text>
            <Text style={styles.description}>{group.description}</Text>
          </View>
        ) : null}

        <View style={styles.actionsContainer}>
          {shouldShowShareAction ? (
            <Button mode="contained" icon="monitor-share" style={styles.actionButton} onPress={handleStartScreenShare} testID="action.group.startShare" loading={isStartingShare} disabled={isStartingShare || isLeavingGroup || isRefreshingGroup}>
              屏幕共享
            </Button>
          ) : null}

          <Button
            mode="outlined"
            icon="refresh"
            style={[styles.actionButton, !shouldShowShareAction ? styles.singleActionButton : null]}
            onPress={loadGroupData}
            loading={isLoading || isRefreshingGroup}
            testID="action.group.refresh"
            disabled={isLoading || isRefreshingGroup || isLeavingGroup || isGeneratingJoinCode || isSharingJoinCode}
          >
            {refreshButtonLabel}
          </Button>
        </View>

        <View style={[styles.membersContainer, styles.glassBlock]}>
          <Text style={styles.sectionTitle}>成员列表</Text>
          <MemberList members={members} groupId={groupId} />
        </View>
      </ScrollView>

      <Portal>
        <Dialog
          visible={joinCodeDialogVisible}
          onDismiss={closeJoinCodeDialog}
          style={styles.dialog}
          testID="dialog.group.joinCode"
        >
          <Dialog.Title>群组加入码</Dialog.Title>
          <Dialog.Content>
            <View style={styles.joinCodeContainer}>
              <Text style={styles.joinCode}>{joinCode || '----'}</Text>
              <Text style={styles.joinCodeExpiry}>有效期至：{formatExpiryTime(joinCodeExpiresAt)}</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeJoinCodeDialog} testID="action.group.closeJoinCodeDialog" disabled={isSharingJoinCode}>关闭</Button>
            <Button onPress={handleShareJoinCode} mode="contained" disabled={!joinCode || isSharingJoinCode} loading={isSharingJoinCode} testID="action.group.shareJoinCode">
              分享
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={leaveDialogVisible}
          onDismiss={closeLeaveDialog}
          testID="dialog.group.leaveConfirm"
        >
          <Dialog.Title>离开群组</Dialog.Title>
          <Dialog.Content>
            <Text>{`确定要离开“${group.name}”群组吗？`}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeLeaveDialog} testID="action.group.cancelLeave" disabled={isLeavingGroup}>取消</Button>
            <Button onPress={handleLeaveGroup} mode="contained" buttonColor={COLORS.ERROR} testID="action.group.confirmLeave" loading={isLeavingGroup} disabled={isLeavingGroup}>
              离开
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  scrollContent: {
    padding: SPACING.MEDIUM,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkFallbackTitle: {
    marginTop: SPACING.MEDIUM,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  networkFallbackText: {
    marginTop: SPACING.SMALL,
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  networkFallbackButton: {
    marginTop: SPACING.MEDIUM,
  },
  inlineStatusBanner: {
    marginBottom: SPACING.MEDIUM,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL + 2,
  },
  inlineStatusBannerInfo: {
    backgroundColor: '#EAF2FF',
    borderColor: '#CFE1FF',
  },
  inlineStatusBannerError: {
    backgroundColor: 'rgba(244,67,54,0.10)',
    borderColor: 'rgba(244,67,54,0.32)',
  },
  inlineStatusBannerSuccess: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  inlineStatusTextInfo: {
    color: COLORS.PRIMARY,
    fontSize: 13,
    fontWeight: '600',
  },
  inlineStatusTextError: {
    color: COLORS.ERROR,
    fontSize: 13,
    fontWeight: '600',
  },
  inlineStatusTextSuccess: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.MEDIUM,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    elevation: 4,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE1FF',
  },
  headerContent: {
    flex: 1,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SMALL,
  },
  memberCount: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  draftBadge: {
    marginTop: SPACING.SMALL,
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
  },
  menuButton: {
    padding: SPACING.SMALL,
    marginLeft: SPACING.MEDIUM,
  },
  menu: {
    marginTop: 50,
    marginRight: 16,
  },
  descriptionContainer: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
    elevation: 2,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#CFE1FF',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SMALL,
  },
  description: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.MEDIUM,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: SPACING.XSMALL,
    borderRadius: 16,
  },
  singleActionButton: {
    marginHorizontal: 0,
  },
  membersContainer: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
    elevation: 2,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#CFE1FF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MEDIUM,
  },
  dialog: {
    borderRadius: 16,
  },
  joinCodeContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.MEDIUM,
  },
  joinCode: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.PRIMARY,
    marginBottom: SPACING.SMALL,
  },
  joinCodeExpiry: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  glassBlock: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#CFE1FF',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
});

export default GroupDetail;

