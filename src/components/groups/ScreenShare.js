/**
 * 群组屏幕共享组件（稳定版）
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  clearActiveScreenShareSession,
  clearScreenShareError,
  createScreenShare,
  endScreenShare,
  fetchGroupDetail,
  fetchScreenShares,
  joinScreenShare,
  pauseScreenShare,
  resumeScreenShare,
  selectActiveScreenShareSession,
  selectCurrentGroup,
  selectScreenShareError,
  selectScreenShareLoading,
  selectSharedScreens,
} from '../../redux/slices/groupsSlice';
import { SPACING } from '../../utils/constants/dimensions';

const COLORS = {
  PRIMARY: '#1D4ED8',
  PRIMARY_SOFT: '#DBEAFE',
  ACCENT: '#2563EB',
  ERROR: '#DC2626',
  SUCCESS: '#166534',
  SURFACE: '#FFFFFF',
  BORDER: '#CFE0F6',
  TEXT_PRIMARY: '#102A43',
  TEXT_SECONDARY: '#5C6F7B',
  TEXT_TERTIARY: '#8EA0AA',
};

const ScreenShare = ({ groupId }) => {
  const dispatch = useDispatch();
  const isLoading = useSelector(selectScreenShareLoading);
  const error = useSelector(selectScreenShareError);
  const currentGroup = useSelector(selectCurrentGroup);
  const sharedScreens = useSelector(selectSharedScreens) || [];
  const activeSession = useSelector(selectActiveScreenShareSession);
  const currentUser = useSelector((state) => state.auth.user);

  const [title, setTitle] = useState('');
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canUseWebShare = Platform.OS === 'web';
  const activeGroupShares = useMemo(
    () => sharedScreens.filter((share) => share?.group?.id === groupId && share?.status !== 'ended'),
    [groupId, sharedScreens]
  );

  const joinedShare = activeSession?.role === 'viewer' ? activeSession?.shareSnapshot || null : null;
  const isSharing = activeSession?.role === 'host' && ['created', 'sharing', 'paused'].includes(activeSession?.status);
  const activeSessionId = activeSession?.shareId || null;
  const currentShare = activeGroupShares.find((share) => String(share?.id || '') === String(activeSessionId || '')) || null;
  const isCurrentSharePaused = currentShare?.status === 'paused';

  const busyVisible = Boolean(isLoading || refreshing);
  const errorVisible = Boolean(error);
  const stageState = isSharing ? 'host' : joinedShare ? 'viewer' : canUseWebShare ? 'idle' : 'mobileFallback';
  const pageState = busyVisible ? 'busy' : errorVisible ? 'error' : activeGroupShares.length > 0 ? 'ready' : 'empty';

  useEffect(() => {
    dispatch(clearScreenShareError());
    dispatch(fetchGroupDetail(groupId));
    dispatch(fetchScreenShares());
  }, [dispatch, groupId]);

  const refreshShares = async () => {
    setRefreshing(true);
    try {
      await Promise.all([dispatch(fetchGroupDetail(groupId)), dispatch(fetchScreenShares())]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleStartShare = async () => {
    if (!canUseWebShare) {
      setShowStartDialog(false);
      return;
    }
    if (!title.trim()) {
      return;
    }
    setShowStartDialog(false);
    const result = await dispatch(createScreenShare({ groupId, title: title.trim() }));
    if (createScreenShare.fulfilled.match(result)) {
      setTitle('');
      dispatch(fetchScreenShares());
    }
  };

  const handleJoinShare = async (share) => {
    if (!canUseWebShare || !share?.id) {
      return;
    }
    await dispatch(joinScreenShare(share.id));
    dispatch(fetchScreenShares());
  };

  const handlePauseOrResumeShare = async () => {
    if (!currentShare?.id) {
      return;
    }
    if (isCurrentSharePaused) {
      await dispatch(resumeScreenShare(currentShare.id));
    } else {
      await dispatch(pauseScreenShare(currentShare.id));
    }
    dispatch(fetchScreenShares());
  };

  const handleEndShare = async () => {
    if (!currentShare?.id) {
      setShowEndDialog(false);
      return;
    }
    await dispatch(endScreenShare(currentShare.id));
    dispatch(clearActiveScreenShareSession());
    dispatch(fetchScreenShares());
    setShowEndDialog(false);
  };

  const handleLeaveViewer = () => {
    dispatch(clearActiveScreenShareSession());
  };

  return (
    <View style={styles.container} testID={`state.share.page.state.${pageState}`}>
      <Text style={styles.stateAnchorText} testID={`state.share.busy.visibility.${busyVisible ? 'visible' : 'hidden'}`}>
        busy:{busyVisible ? 'visible' : 'hidden'}
      </Text>
      <Text style={styles.stateAnchorText} testID={`state.share.error.visibility.${errorVisible ? 'visible' : 'hidden'}`}>
        error:{errorVisible ? 'visible' : 'hidden'}
      </Text>
      <Text style={styles.stateAnchorText} testID={`state.share.stage.visibility.${stageState}`}>
        stage:{stageState}
      </Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshShares} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>屏幕共享</Text>
          <Text style={styles.subtitle}>{currentGroup?.name || '正在加载群组信息'}</Text>
        </View>

        <View style={styles.panel} testID="panel.share.summary">
          <Text style={styles.sectionTitle}>当前状态</Text>
          <Text style={styles.sectionText}>角色：{isSharing ? '共享方' : joinedShare ? '观看方' : '空闲'}</Text>
          <Text style={styles.sectionText}>活跃共享数：{activeGroupShares.length}</Text>
          <Text style={styles.sectionText}>平台能力：{canUseWebShare ? '支持网页共享' : '移动端仅展示状态'}</Text>
        </View>

        <View style={styles.panel} testID="panel.share.list">
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>活跃共享列表</Text>
            <Button compact onPress={refreshShares} loading={refreshing} testID="action.share.refresh">
              刷新
            </Button>
          </View>
          {activeGroupShares.length > 0 ? (
            activeGroupShares.map((share) => {
              const isOwner = String(share?.user?.id || '') === String(currentUser?.id || '');
              const isJoined = String(joinedShare?.id || '') === String(share?.id || '');
              const isPaused = share?.status === 'paused';
              return (
                <View key={String(share.id)} style={styles.shareCard} testID={`state.share.item.${share.id}`}>
                  <View style={styles.shareCardBody}>
                    <Text style={styles.shareTitle}>{share.title || '未命名共享'}</Text>
                    <Text style={styles.shareSubtitle}>发起人：{share?.user?.username || '未知成员'}</Text>
                    <Text style={styles.shareSubtitle}>状态：{isPaused ? '已暂停' : '共享中'}</Text>
                  </View>
                  {isOwner ? (
                    <Text style={styles.ownerBadge}>我的共享</Text>
                  ) : isJoined ? (
                    <Button mode="outlined" compact onPress={handleLeaveViewer} testID="action.share.leaveViewerInline">
                      离开
                    </Button>
                  ) : (
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() => handleJoinShare(share)}
                      disabled={!canUseWebShare || isPaused || busyVisible}
                      testID={`action.share.join.${share.id}`}
                    >
                      {isPaused ? '已暂停' : '加入'}
                    </Button>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText} testID="state.share.empty">当前群组暂无活跃共享。</Text>
          )}
        </View>

        <View style={styles.actionsContainer} testID="panel.share.actions">
          {isSharing ? (
            <>
              <Button
                mode="outlined"
                icon={isCurrentSharePaused ? 'play-circle-outline' : 'pause-circle-outline'}
                style={styles.secondaryButton}
                onPress={handlePauseOrResumeShare}
                disabled={busyVisible}
                testID="action.share.pauseOrResume"
              >
                {isCurrentSharePaused ? '恢复共享' : '暂停共享'}
              </Button>
              <Button
                mode="contained"
                icon="monitor-off"
                style={[styles.button, styles.endButton]}
                onPress={() => setShowEndDialog(true)}
                disabled={busyVisible}
                testID="action.share.openEndDialog"
              >
                结束共享
              </Button>
            </>
          ) : (
            <Button
              mode="contained"
              icon="monitor-share"
              style={styles.button}
              onPress={() => setShowStartDialog(true)}
              disabled={busyVisible || !canUseWebShare || Boolean(joinedShare)}
              testID="action.share.openStartDialog"
            >
              {canUseWebShare ? '开始共享屏幕' : '仅 Web 端支持共享'}
            </Button>
          )}
          {joinedShare ? (
            <Button
              mode="outlined"
              icon="close-circle-outline"
              style={styles.secondaryButton}
              onPress={handleLeaveViewer}
              testID="action.share.leaveViewer"
            >
              离开当前观看
            </Button>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorContainer} testID="state.share.error">
            <Icon name="alert-circle" size={20} color={COLORS.ERROR} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Portal>
        <Dialog visible={showStartDialog} onDismiss={() => setShowStartDialog(false)} style={styles.dialog} testID="dialog.share.start">
          <Dialog.Title>开始屏幕共享</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>请输入共享标题，方便群成员识别本次共享内容。</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="例如：需求评审演示 / 调试现场"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              testID="input.share.title"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowStartDialog(false)} testID="action.share.cancelStart">取消</Button>
            <Button onPress={handleStartShare} mode="contained" testID="action.share.confirmStart">开始共享</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showEndDialog} onDismiss={() => setShowEndDialog(false)} testID="dialog.share.end">
          <Dialog.Title>结束当前共享</Dialog.Title>
          <Dialog.Content>
            <Text>确认结束当前共享吗？结束后其他成员将无法继续观看。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEndDialog(false)} testID="action.share.cancelEnd">取消</Button>
            <Button onPress={handleEndShare} mode="contained" buttonColor={COLORS.ERROR} testID="action.share.confirmEnd">
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
    backgroundColor: '#F6FAFF',
  },
  stateAnchorText: {
    marginTop: 4,
    marginHorizontal: SPACING.MEDIUM,
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.TEXT_TERTIARY,
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
  panel: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 22,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.SMALL,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.SMALL,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderTopWidth: 1,
    borderTopColor: '#E2ECF8',
    gap: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
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
    backgroundColor: '#F6FAFF',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: SPACING.SMALL,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
});

export default ScreenShare;
