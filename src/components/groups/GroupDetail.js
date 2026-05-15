/**
 * 群组详情组件
 */
import React, { useEffect, useState } from 'react';
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
import {
  fetchGroupDetail,
  fetchGroupMembers,
  generateJoinCode,
  leaveGroup,
  selectCurrentGroup,
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

  useEffect(() => {
    dispatch(fetchGroupDetail(groupId));
    dispatch(fetchGroupMembers(groupId));
  }, [dispatch, groupId]);

  const loadGroupData = () => {
    dispatch(fetchGroupDetail(groupId));
    dispatch(fetchGroupMembers(groupId));
  };

  const handleGenerateJoinCode = () => {
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
      });
  };

  const handleShareJoinCode = async () => {
    if (!joinCode) {
      return;
    }

    try {
      await Share.share({
        message: `加入我的群组“${group.name}”，使用加入码：${joinCode}`,
      });
      setInlineStatus('加入码分享面板已打开');
      setInlineStatusTone('success');
    } catch (shareError) {
      setInlineStatus(shareError.message || '分享失败，请稍后重试');
      setInlineStatusTone('error');
    }
  };

  const handleLeaveGroup = () => {
    setLeaveDialogVisible(false);
    dispatch(leaveGroup(groupId))
      .unwrap()
      .then(() => {
        navigation.goBack();
      })
      .catch((requestError) => {
        setInlineStatus(requestError || '离开群组失败，请稍后重试');
        setInlineStatusTone('error');
      });
  };

  const handleStartScreenShare = () => {
    navigation.navigate('ScreenShare', { groupId });
  };

  const canGenerateJoinCode = Boolean(group?.can_generate_join_code);
  const canInviteMembers = Boolean(group?.can_invite);

  const formatExpiryTime = (dateString) => {
    if (!dateString) {
      return '';
    }
    return new Date(dateString).toLocaleString();
  };

  if (isLoading && !group) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (error && !group) {
    return <ErrorState message={error} onRetry={loadGroupData} />;
  }

  if (!group) {
    return <ErrorState message="无法加载群组信息" onRetry={loadGroupData} />;
  }

  return (
    <View style={styles.container} testID="screen.groups.detail">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {inlineStatus ? (
          <View
            style={[
              styles.inlineStatusBanner,
              inlineStatusTone === 'error' ? styles.inlineStatusBannerError : styles.inlineStatusBannerInfo,
            ]}
            testID={`state.group.inlineStatus.${inlineStatusTone}`}
          >
            <Text style={inlineStatusTone === 'error' ? styles.inlineStatusTextError : styles.inlineStatusTextInfo}>
              {inlineStatus}
            </Text>
          </View>
        ) : null}

        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.memberCount}>{group.member_count} 位成员</Text>
          </View>

          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)} testID="action.group.openMenu">
            <Icon name="dots-vertical" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>

          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={{ x: 0, y: 0 }}
            style={styles.menu}
          >
            {canGenerateJoinCode ? (
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  handleGenerateJoinCode();
                }}
                title="生成加入码"
                leadingIcon="link-variant"
              />
            ) : null}
            {canInviteMembers ? (
              <Menu.Item
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate('InviteMembers', { groupId });
                }}
                title="邀请成员"
                leadingIcon="account-plus"
              />
            ) : null}
            {canGenerateJoinCode || canInviteMembers ? <Divider /> : null}
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                setLeaveDialogVisible(true);
              }}
              title="离开群组"
              leadingIcon="exit-to-app"
              titleStyle={{ color: COLORS.ERROR }}
            />
          </Menu>
        </View>

        {group.description ? (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>群组简介</Text>
            <Text style={styles.description}>{group.description}</Text>
          </View>
        ) : null}

        <View style={styles.actionsContainer}>
          <Button mode="contained" icon="monitor-share" style={styles.actionButton} onPress={handleStartScreenShare} testID="action.group.startShare">
            屏幕共享
          </Button>

          <Button
            mode="outlined"
            icon="refresh"
            style={styles.actionButton}
            onPress={loadGroupData}
            loading={isLoading}
            testID="action.group.refresh"
          >
            刷新
          </Button>
        </View>

        <View style={styles.membersContainer}>
          <Text style={styles.sectionTitle}>成员列表</Text>
          <MemberList members={members} groupId={groupId} />
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={joinCodeDialogVisible} onDismiss={() => setJoinCodeDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title>群组加入码</Dialog.Title>
          <Dialog.Content>
            <View style={styles.joinCodeContainer}>
              <Text style={styles.joinCode}>{joinCode || '----'}</Text>
              <Text style={styles.joinCodeExpiry}>有效期至：{formatExpiryTime(joinCodeExpiresAt)}</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setJoinCodeDialogVisible(false)}>关闭</Button>
            <Button onPress={handleShareJoinCode} mode="contained" disabled={!joinCode} testID="action.group.shareJoinCode">
              分享
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={leaveDialogVisible} onDismiss={() => setLeaveDialogVisible(false)}>
          <Dialog.Title>离开群组</Dialog.Title>
          <Dialog.Content>
            <Text>确定要离开“{group.name}”群组吗？</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLeaveDialogVisible(false)}>取消</Button>
            <Button onPress={handleLeaveGroup} mode="contained" buttonColor={COLORS.ERROR} testID="action.group.confirmLeave">
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
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollContent: {
    padding: SPACING.MEDIUM,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineStatusBanner: {
    marginBottom: SPACING.MEDIUM,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL + 2,
  },
  inlineStatusBannerInfo: {
    backgroundColor: 'rgba(33,150,243,0.10)',
    borderColor: 'rgba(33,150,243,0.30)',
  },
  inlineStatusBannerError: {
    backgroundColor: 'rgba(244,67,54,0.10)',
    borderColor: 'rgba(244,67,54,0.32)',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.MEDIUM,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
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
  menuButton: {
    padding: SPACING.SMALL,
    marginLeft: SPACING.MEDIUM,
  },
  menu: {
    marginTop: 50,
    marginRight: 16,
  },
  descriptionContainer: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
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
  membersContainer: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 20,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
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
});

export default GroupDetail;
