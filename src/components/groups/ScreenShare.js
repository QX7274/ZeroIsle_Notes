/**
 * 群组屏幕共享组件
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  createScreenShare,
  endScreenShare,
  fetchGroupDetail,
  fetchScreenShares,
  joinScreenShare,
  selectCurrentGroup,
  selectGroupsError,
  selectGroupsLoading,
  selectSharedScreens,
} from '../../redux/slices/groupsSlice';
import { webrtcService } from '../../services/webrtc/webrtcService';
import { SPACING } from '../../utils/constants/dimensions';

const COLORS = {
  PRIMARY: '#0F766E',
  PRIMARY_SOFT: '#D7F3EE',
  ACCENT: '#C2410C',
  ERROR: '#DC2626',
  SUCCESS: '#166534',
  SURFACE: '#FFFFFF',
  SURFACE_ALT: '#F6FAFB',
  BORDER: '#D9E6E8',
  TEXT_PRIMARY: '#102A43',
  TEXT_SECONDARY: '#5C6F7B',
  TEXT_TERTIARY: '#8EA0AA',
  DARK_PANEL: '#102A43',
};

const ScreenShare = ({ groupId }) => {
  const dispatch = useDispatch();
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);
  const currentGroup = useSelector(selectCurrentGroup);
  const sharedScreens = useSelector(selectSharedScreens);
  const currentUser = useSelector((state) => state.auth.user);

  const [title, setTitle] = useState('');
  const [shareId, setShareId] = useState(null);
  const [joinedShare, setJoinedShare] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isJoiningShare, setIsJoiningShare] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const videoRef = useRef(null);
  const latestShareIdRef = useRef(null);
  const latestIsSharingRef = useRef(false);

  const activeGroupShares = useMemo(
    () =>
      (sharedScreens || []).filter(
        (share) => share?.group?.id === groupId && share?.status !== 'ended'
      ),
    [groupId, sharedScreens]
  );

  const canUseWebShare = Platform.OS === 'web';
  const currentShare = activeGroupShares.find((share) => share?.id === shareId) || null;

  useEffect(() => {
    dispatch(fetchGroupDetail(groupId));
    dispatch(fetchScreenShares());
  }, [dispatch, groupId]);

  useEffect(() => {
    if (Platform.OS === 'web' && currentUser?.id) {
      webrtcService.init(currentUser.id);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    latestShareIdRef.current = shareId;
    latestIsSharingRef.current = isSharing;
  }, [shareId, isSharing]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    webrtcService.onUserJoin((user) => {
      setConnectedUsers((prev) => {
        if (prev.some((item) => item.id === user.id)) {
          return prev;
        }
        return [...prev, user];
      });
    });

    webrtcService.onUserLeave((user) => {
      setConnectedUsers((prev) => prev.filter((item) => item.id !== user.id));
    });

    webrtcService.onRemoteStream(({ stream }) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    });

    return () => {
      if (latestIsSharingRef.current && latestShareIdRef.current) {
        dispatch(endScreenShare(latestShareIdRef.current));
      }
      webrtcService.disconnect();
    };
  }, [dispatch]);

  const isViewing = Boolean(joinedShare) && !isSharing;

  const refreshShares = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchGroupDetail(groupId)).unwrap?.() ?? dispatch(fetchGroupDetail(groupId)),
        dispatch(fetchScreenShares()).unwrap?.() ?? dispatch(fetchScreenShares()),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const resetSessionState = () => {
    setIsSharing(false);
    setShareId(null);
    setJoinedShare(null);
    setConnectedUsers([]);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleStartShare = () => {
    if (!canUseWebShare) {
      setShowStartDialog(false);
      Alert.alert('当前平台暂不支持', '移动端暂不创建共享会话，请使用 Web 端完成共享与观看验证。');
      return;
    }

    if (!title.trim()) {
      Alert.alert('标题不能为空', '请先输入一个便于群组成员识别的共享标题。');
      return;
    }

    setShowStartDialog(false);

    dispatch(createScreenShare({ groupId, title: title.trim() }))
      .unwrap()
      .then((share) => {
        setShareId(share.id);
        setJoinedShare(null);
        return webrtcService.connect(share.webrtc_room_id)
          .then(() => webrtcService.startScreenShare())
          .then(() => {
            setIsSharing(true);
            dispatch(fetchScreenShares());
          })
          .catch((requestError) => {
            dispatch(endScreenShare(share.id));
            dispatch(fetchScreenShares());
            throw requestError;
          });
      })
      .catch((requestError) => {
        Alert.alert(
          '创建共享失败',
          requestError?.message || requestError || '暂时无法启动屏幕共享'
        );
      });
  };

  const handleJoinShare = (share) => {
    if (!canUseWebShare) {
      Alert.alert('当前平台暂不支持', '移动端当前只保留共享入口说明，请先使用 Web 端验证观看流程。');
      return;
    }

    if (!share?.id) {
      Alert.alert('加入失败', '未找到可加入的共享会话。');
      return;
    }

    setIsJoiningShare(true);

    dispatch(joinScreenShare(share.id))
      .unwrap()
      .then((data) =>
        webrtcService.connect(data.webrtc_room_id).then(() => {
          setJoinedShare(share);
          setShareId(null);
        })
      )
      .catch((requestError) => {
        Alert.alert(
          '加入共享失败',
          requestError?.message || requestError || '暂时无法加入该共享'
        );
      })
      .finally(() => {
        setIsJoiningShare(false);
      });
  };

  const handleLeaveViewer = () => {
    webrtcService.disconnect();
    setJoinedShare(null);
    setConnectedUsers([]);
    if (canUseWebShare && currentUser?.id) {
      webrtcService.init(currentUser.id);
    }
  };

  const handleEndShare = () => {
    setShowEndDialog(false);

    if (!shareId) {
      webrtcService.disconnect();
      resetSessionState();
      return;
    }

    dispatch(endScreenShare(shareId))
      .unwrap()
      .then(() => {
        webrtcService.stopScreenShare();
        webrtcService.disconnect();
        resetSessionState();
        dispatch(fetchScreenShares());
      })
      .catch((requestError) => {
        Alert.alert(
          '结束共享失败',
          requestError?.message || requestError || '暂时无法结束共享'
        );
      });
  };

  const renderStagePanel = () => {
    if (!canUseWebShare) {
      return (
        <View style={styles.stageCard}>
          <Icon name="tablet-cellphone-off" size={46} color={COLORS.TEXT_TERTIARY} />
          <Text style={styles.stageTitle}>移动端当前不承载共享会话</Text>
          <Text style={styles.stageDescription}>
            为避免制造假活跃共享记录，当前移动端只展示共享状态、加入入口说明和后续验证提示。真正的共享/观看链请在 Web 端完成。
          </Text>
        </View>
      );
    }

    if (isSharing) {
      return (
        <View style={[styles.stageCard, styles.stageCardActive]}>
          <Text style={styles.stageEyebrow}>共享中</Text>
          <Text style={styles.stageTitle}>你正在向群组直播屏幕</Text>
          <Text style={styles.stageDescription}>
            {currentShare?.title || title || '未命名共享'}。保持当前页面开启，等待其他成员加入观看。
          </Text>
        </View>
      );
    }

    if (isViewing) {
      return (
        <View style={[styles.stageCard, styles.stageCardViewer]}>
          <Text style={styles.stageEyebrow}>观看中</Text>
          <Text style={styles.stageTitle}>已连接到共享会话</Text>
          <Text style={styles.stageDescription}>
            正在观看 {joinedShare?.user?.username || '群成员'} 的共享：
            {joinedShare?.title || '未命名共享'}。
          </Text>
          <Button
            mode="outlined"
            icon="logout"
            style={styles.viewerExitButton}
            onPress={handleLeaveViewer}
          >
            离开观看
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.stageCard}>
        <Text style={styles.stageEyebrow}>空闲</Text>
        <Text style={styles.stageTitle}>当前还没有进行中的本地会话</Text>
        <Text style={styles.stageDescription}>
          你可以发起新的共享，或从下方活跃共享列表中加入其他成员的会话。
        </Text>
        <video ref={videoRef} style={styles.video} autoPlay playsInline />
      </View>
    );
  };

  const renderParticipants = () => (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>连接状态</Text>
        <Text style={styles.sectionMeta}>{connectedUsers.length} 人在线</Text>
      </View>
      {connectedUsers.length > 0 ? (
        connectedUsers.map((user) => (
          <View key={user.id} style={styles.listRow}>
            <View style={styles.listRowIcon}>
              <Icon
                name={user.is_sharing ? 'monitor-share' : 'account'}
                size={18}
                color={COLORS.PRIMARY}
              />
            </View>
            <View style={styles.listRowBody}>
              <Text style={styles.listRowTitle}>{user.username || '未知成员'}</Text>
              <Text style={styles.listRowSubtitle}>
                {user.is_sharing ? '正在推流共享' : '已连接等待中'}
              </Text>
            </View>
            {user.is_sharing ? <Text style={styles.badge}>共享中</Text> : null}
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>当前还没有其他连接成员。</Text>
      )}
    </View>
  );

  const renderShares = () => (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>当前群组活跃共享</Text>
        <Button compact onPress={refreshShares} loading={refreshing}>
          刷新
        </Button>
      </View>
      {activeGroupShares.length > 0 ? (
        activeGroupShares.map((share) => {
          const isOwner = String(share?.user?.id || '') === String(currentUser?.id || '');
          const isJoined = String(joinedShare?.id || '') === String(share?.id || '');
          return (
            <View key={share.id} style={styles.shareCard}>
              <View style={styles.shareCardBody}>
                <Text style={styles.shareTitle}>{share.title || '未命名共享'}</Text>
                <Text style={styles.shareSubtitle}>
                  发起人：{share?.user?.username || '未知成员'}
                </Text>
                <Text style={styles.shareSubtitle}>
                  状态：{share?.status === 'paused' ? '已暂停' : '共享中'}
                </Text>
              </View>
              {isOwner ? (
                <Text style={styles.ownerBadge}>我的共享</Text>
              ) : isJoined ? (
                <Button mode="outlined" compact onPress={handleLeaveViewer}>
                  离开
                </Button>
              ) : (
                <Button
                  mode="contained-tonal"
                  compact
                  onPress={() => handleJoinShare(share)}
                  disabled={!canUseWebShare || isJoiningShare}
                  loading={isJoiningShare}
                >
                  加入
                </Button>
              )}
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyText}>当前群组暂无活跃共享。</Text>
      )}
    </View>
  );

  const renderActions = () => (
    <View style={styles.actionsContainer}>
      {isSharing ? (
        <Button
          mode="contained"
          icon="monitor-off"
          style={[styles.button, styles.endButton]}
          onPress={() => setShowEndDialog(true)}
          loading={isLoading}
          disabled={isLoading}
        >
          结束共享
        </Button>
      ) : (
        <Button
          mode="contained"
          icon="monitor-share"
          style={styles.button}
          onPress={() => setShowStartDialog(true)}
          loading={isLoading}
          disabled={isLoading || !canUseWebShare || isViewing}
        >
          {canUseWebShare ? '开始共享屏幕' : '仅 Web 端支持共享'}
        </Button>
      )}
      {isViewing ? (
        <Button
          mode="outlined"
          icon="close-circle-outline"
          style={styles.secondaryButton}
          onPress={handleLeaveViewer}
        >
          离开当前观看
        </Button>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshShares} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>屏幕共享</Text>
          <Text style={styles.subtitle}>
            {currentGroup?.name || '正在加载群组信息'}
          </Text>
        </View>

        {renderStagePanel()}
        {renderParticipants()}
        {renderShares()}
        {renderActions()}

        {error ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={20} color={COLORS.ERROR} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Portal>
        <Dialog
          visible={showStartDialog}
          onDismiss={() => setShowStartDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title>开始屏幕共享</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              输入一个清晰的共享标题，方便群组成员快速判断这场共享的内容。
            </Text>
            <TextInput
              style={styles.titleInput}
              placeholder="例如：需求评审演示 / 调试现场"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowStartDialog(false)}>取消</Button>
            <Button onPress={handleStartShare} mode="contained">
              开始共享
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showEndDialog} onDismiss={() => setShowEndDialog(false)}>
          <Dialog.Title>结束当前共享</Dialog.Title>
          <Dialog.Content>
            <Text>确认结束当前共享吗？结束后其他成员将失去观看入口。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEndDialog(false)}>取消</Button>
            <Button onPress={handleEndShare} mode="contained" buttonColor={COLORS.ERROR}>
              结束共享
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
    backgroundColor: '#F3F8F8',
  },
  scrollContent: {
    padding: SPACING.MEDIUM,
    paddingBottom: SPACING.XLARGE,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: SPACING.LARGE,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
  },
  stageCard: {
    minHeight: 220,
    backgroundColor: COLORS.SURFACE,
    borderRadius: 24,
    padding: SPACING.LARGE,
    marginBottom: SPACING.LARGE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    justifyContent: 'center',
  },
  stageCardActive: {
    backgroundColor: COLORS.DARK_PANEL,
    borderColor: '#183B56',
  },
  stageCardViewer: {
    backgroundColor: COLORS.PRIMARY_SOFT,
    borderColor: '#B8E5DC',
  },
  stageEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.ACCENT,
    marginBottom: 10,
  },
  stageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 10,
  },
  stageDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  video: {
    width: 0,
    height: 0,
  },
  viewerExitButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.MEDIUM,
  },
  panel: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 22,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.MEDIUM,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  sectionMeta: {
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
    borderTopWidth: 1,
    borderTopColor: '#EDF3F4',
  },
  listRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.SMALL,
  },
  listRowBody: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  listRowSubtitle: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  badge: {
    fontSize: 12,
    color: COLORS.SUCCESS,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
    borderTopWidth: 1,
    borderTopColor: '#EDF3F4',
    gap: SPACING.SMALL,
  },
  shareCardBody: {
    flex: 1,
  },
  shareTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  shareSubtitle: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 3,
  },
  ownerBadge: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.TEXT_TERTIARY,
    lineHeight: 21,
    paddingVertical: SPACING.SMALL,
  },
  actionsContainer: {
    gap: SPACING.SMALL,
    marginBottom: SPACING.LARGE,
  },
  button: {
    borderRadius: 18,
    paddingVertical: 6,
    backgroundColor: COLORS.PRIMARY,
  },
  secondaryButton: {
    borderRadius: 18,
  },
  endButton: {
    backgroundColor: COLORS.ERROR,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: SPACING.MEDIUM,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: COLORS.ERROR,
    marginLeft: SPACING.SMALL,
    flex: 1,
    lineHeight: 20,
  },
  dialog: {
    borderRadius: 24,
  },
  dialogText: {
    marginBottom: SPACING.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
  },
  titleInput: {
    backgroundColor: COLORS.SURFACE_ALT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: SPACING.SMALL,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
});

export default ScreenShare;
