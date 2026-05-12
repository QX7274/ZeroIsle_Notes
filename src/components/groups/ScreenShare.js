/**
 * 群组屏幕共享组件
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Clipboard as PlatformClipboard } from '../../platform';

import {
  clearActiveScreenShareSession,
  clearScreenShareError,
  createScreenShare,
  endScreenShare,
  fetchGroupDetail,
  fetchScreenShares,
  joinScreenShare,
  patchActiveScreenShareSession,
  pauseScreenShare,
  resumeScreenShare,
  selectActiveScreenShareSession,
  selectCurrentGroup,
  selectScreenShareError,
  selectScreenShareLoading,
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

const VIEWER_STREAM_TIMEOUT_MS = 12000;
const DIAGNOSTIC_EVENT_LIMIT = 12;

const CONNECTION_STATE_LABELS = {
  idle: '待连接',
  connecting: '正在连接信令',
  connected: '信令已连接',
  closed: '连接已关闭',
  error: '连接异常',
};

const ScreenShare = ({ groupId }) => {
  const dispatch = useDispatch();
  const isLoading = useSelector(selectScreenShareLoading);
  const error = useSelector(selectScreenShareError);
  const currentGroup = useSelector(selectCurrentGroup);
  const sharedScreens = useSelector(selectSharedScreens);
  const activeSession = useSelector(selectActiveScreenShareSession);
  const currentUser = useSelector((state) => state.auth.user);

  const [title, setTitle] = useState('');
  const [isJoiningShare, setIsJoiningShare] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isTogglingShareState, setIsTogglingShareState] = useState(false);
  const [diagnosticEvents, setDiagnosticEvents] = useState([]);
  const [isCopyingDiagnostic, setIsCopyingDiagnostic] = useState(false);

  const videoRef = useRef(null);
  const viewerTimeoutRef = useRef(null);
  const diagnosticClockRef = useRef(0);

  const activeGroupShares = useMemo(
    () =>
      (sharedScreens || []).filter(
        (share) => share?.group?.id === groupId && share?.status !== 'ended'
      ),
    [groupId, sharedScreens]
  );

  const canUseWebShare = Platform.OS === 'web';
  const activeSessionId = activeSession?.shareId || null;
  const joinedShare = activeSession?.role === 'viewer'
    ? (activeSession?.shareSnapshot || null)
    : null;
  const isSharing = activeSession?.role === 'host'
    && ['created', 'sharing', 'paused'].includes(activeSession?.status);
  const connectionState = activeSession?.connectionState || 'idle';
  const connectionDetail = activeSession?.connectionDetail || null;
  const hasRemoteStream = Boolean(activeSession?.hasRemoteStream);
  const viewerTimeoutReached = Boolean(activeSession?.viewerTimeoutReached);
  const activeRoomId = activeSession?.webrtcRoomId || null;
  const currentShare = activeGroupShares.find(
    (share) => String(share?.id || '') === String(activeSessionId || '')
  ) || null;
  const liveJoinedShare = joinedShare
    ? activeGroupShares.find((share) => String(share?.id || '') === String(joinedShare?.id || '')) || null
    : null;
  const diagnosticRole = isSharing ? '共享端' : (joinedShare ? '观看端' : '空闲');
  const isCurrentSharePaused = currentShare?.status === 'paused';

  const appendDiagnosticEvent = useCallback((label, detail) => {
    diagnosticClockRef.current += 1;
    const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const nextEvent = {
      id: `${Date.now()}-${diagnosticClockRef.current}`,
      stamp,
      label,
      detail,
    };

    setDiagnosticEvents((prev) => [nextEvent, ...prev].slice(0, DIAGNOSTIC_EVENT_LIMIT));
  }, []);

  const diagnosticSummary = useMemo(() => {
    const lines = [
      `角色：${diagnosticRole}`,
      `群组：${currentGroup?.name || '未知群组'}（ID: ${groupId || '未知'}）`,
      `当前用户：${currentUser?.username || '未知用户'}（ID: ${currentUser?.id || '未知'}）`,
      `共享会话ID：${activeSessionId || '无'}`,
      `WebRTC 房间：${activeRoomId || currentShare?.webrtc_room_id || liveJoinedShare?.webrtc_room_id || '无'}`,
      `连接状态：${CONNECTION_STATE_LABELS[connectionState] || connectionState || '未知'}`,
      `连接详情：${connectionDetail || '无'}`,
      `远端画面：${hasRemoteStream ? '已收到' : '未收到'}`,
      `等待超时：${viewerTimeoutReached ? `已超过 ${VIEWER_STREAM_TIMEOUT_MS / 1000} 秒` : '否'}`,
      `当前活跃共享数：${activeGroupShares.length}`,
      '',
      '最近关键事件：',
      ...(diagnosticEvents.length > 0
        ? diagnosticEvents.map((event) => `- [${event.stamp}] ${event.label}${event.detail ? `：${event.detail}` : ''}`)
        : ['- 暂无事件记录']),
    ];

    return lines.join('\n');
  }, [
    activeGroupShares.length,
    activeRoomId,
    activeSessionId,
    connectionDetail,
    connectionState,
    currentGroup?.name,
    currentUser?.id,
    currentUser?.username,
    diagnosticEvents,
    diagnosticRole,
    groupId,
    hasRemoteStream,
    liveJoinedShare?.webrtc_room_id,
    currentShare?.webrtc_room_id,
    viewerTimeoutReached,
  ]);

  useEffect(() => {
    dispatch(clearScreenShareError());
    dispatch(fetchGroupDetail(groupId));
    dispatch(fetchScreenShares());
    appendDiagnosticEvent('页面初始化', `群组 ${groupId} 的共享页已触发数据加载`);
  }, [appendDiagnosticEvent, dispatch, groupId]);

  useEffect(() => {
    if (Platform.OS === 'web' && currentUser?.id) {
      webrtcService.init(currentUser.id);
      appendDiagnosticEvent('信令身份初始化', `当前用户 ID=${currentUser.id}`);
    }
  }, [appendDiagnosticEvent, currentUser?.id]);

  useEffect(() => () => {
    if (viewerTimeoutRef.current) {
      clearTimeout(viewerTimeoutRef.current);
      viewerTimeoutRef.current = null;
    }
  }, []);

  const handleLeaveViewer = useCallback(({ silent = false } = {}) => {
    webrtcService.disconnect();
    dispatch(clearActiveScreenShareSession());
    setConnectedUsers([]);
    if (viewerTimeoutRef.current) {
      clearTimeout(viewerTimeoutRef.current);
      viewerTimeoutRef.current = null;
    }
    if (canUseWebShare && currentUser?.id) {
      webrtcService.init(currentUser.id);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    appendDiagnosticEvent(
      silent ? '观看态自动退出' : '观看态主动退出',
      silent ? '检测到共享失效或发起人离开，已自动回收观看态' : '用户已手动离开当前观看会话'
    );
    if (!silent) {
      dispatch(fetchScreenShares());
    }
  }, [appendDiagnosticEvent, canUseWebShare, currentUser?.id, dispatch]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return undefined;
    }

    const removeUserJoin = webrtcService.onUserJoin((user) => {
      setConnectedUsers((prev) => {
        if (prev.some((item) => item.id === user.id)) {
          return prev;
        }
        return [...prev, user];
      });
      appendDiagnosticEvent('成员接入', `${user?.username || user?.id || '未知成员'} 已进入当前共享链`);
    });

    const removeUserLeave = webrtcService.onUserLeave((user) => {
      setConnectedUsers((prev) => prev.filter((item) => item.id !== user.id));
      appendDiagnosticEvent('成员离开', `${user?.username || user?.id || '未知成员'} 已离开当前共享链`);
      if (
        activeSession?.role === 'viewer'
        && String(user?.id || '') === String(joinedShare?.user?.id || '')
      ) {
        handleLeaveViewer({ silent: true });
      }
    });

    const removeRemoteStream = webrtcService.onRemoteStream(({ stream }) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        dispatch(patchActiveScreenShareSession({
          hasRemoteStream: Boolean(stream),
          viewerTimeoutReached: false,
        }));
        appendDiagnosticEvent(
          stream ? '收到远端流' : '远端流断开',
          stream ? '观看端已拿到远端视频流' : '远端流对象为空，页面已回退到等待态'
        );
        if (stream) {
          if (viewerTimeoutRef.current) {
            clearTimeout(viewerTimeoutRef.current);
            viewerTimeoutRef.current = null;
          }
        }
      }
    });

    const removeConnectionState = webrtcService.onConnectionStateChange(({ state, detail }) => {
      dispatch(patchActiveScreenShareSession({
        connectionState: state,
        connectionDetail: detail || null,
      }));
      appendDiagnosticEvent(
        '信令状态更新',
        `${CONNECTION_STATE_LABELS[state] || state}${detail ? `：${detail}` : ''}`
      );
    });

    return () => {
      removeUserJoin?.();
      removeUserLeave?.();
      removeRemoteStream?.();
      removeConnectionState?.();
      if (activeSession?.role === 'host' && activeSession?.shareId) {
        dispatch(endScreenShare(activeSession.shareId));
      }
      webrtcService.disconnect();
    };
  }, [activeSession?.role, activeSession?.shareId, appendDiagnosticEvent, dispatch, handleLeaveViewer, joinedShare?.user?.id]);

  const isViewing = Boolean(joinedShare) && !isSharing;

  const refreshShares = async () => {
    setRefreshing(true);
    appendDiagnosticEvent('手动刷新', '开始重新拉取群组详情与活跃共享列表');
    try {
      await Promise.all([
        dispatch(fetchGroupDetail(groupId)).unwrap?.() ?? dispatch(fetchGroupDetail(groupId)),
        dispatch(fetchScreenShares()).unwrap?.() ?? dispatch(fetchScreenShares()),
      ]);
      appendDiagnosticEvent('手动刷新完成', '群组详情与共享列表已刷新完成');
    } finally {
      setRefreshing(false);
    }
  };

  const resetSessionState = () => {
    dispatch(clearActiveScreenShareSession());
    setConnectedUsers([]);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleStartShare = () => {
    if (!canUseWebShare) {
      setShowStartDialog(false);
      appendDiagnosticEvent('共享发起被阻止', '当前平台不是 Web，已按设计阻止创建假共享会话');
      Alert.alert('当前平台暂不支持', '移动端暂不创建共享会话，请使用 Web 端完成共享与观看验证。');
      return;
    }

    if (!title.trim()) {
      appendDiagnosticEvent('共享发起失败', '用户未填写共享标题');
      Alert.alert('标题不能为空', '请先输入一个便于群组成员识别的共享标题。');
      return;
    }

    setShowStartDialog(false);
    appendDiagnosticEvent('发起共享请求', `标题：${title.trim()}`);

    dispatch(createScreenShare({ groupId, title: title.trim() }))
      .unwrap()
      .then((share) => {
        appendDiagnosticEvent(
          '共享会话已创建',
          `会话ID=${share.id || '未知'}，房间=${share.webrtc_room_id || '未知'}`
        );
        return webrtcService.connect(share.webrtc_room_id)
          .then(() => webrtcService.startScreenShare())
          .then(() => {
            dispatch(patchActiveScreenShareSession({
              status: share?.status === 'paused' ? 'paused' : 'sharing',
              webrtcRoomId: share.webrtc_room_id || null,
              connectionState: 'connected',
              connectionDetail: null,
              shareSnapshot: share,
            }));
            appendDiagnosticEvent('共享推流已启动', '本地屏幕流已开始推送，等待其他成员接入');
            dispatch(fetchScreenShares());
          })
          .catch((requestError) => {
            dispatch(endScreenShare(share.id));
            dispatch(fetchScreenShares());
            appendDiagnosticEvent(
              '共享推流失败',
              requestError?.message || requestError || '共享会话创建后推流未成功启动'
            );
            throw requestError;
          });
      })
      .catch((requestError) => {
        appendDiagnosticEvent(
          '共享发起失败',
          requestError?.message || requestError || '创建共享接口或推流流程失败'
        );
        Alert.alert(
          '创建共享失败',
          requestError?.message || requestError || '暂时无法启动屏幕共享'
        );
      });
  };

  const handleJoinShare = (share) => {
    if (!canUseWebShare) {
      appendDiagnosticEvent('加入观看被阻止', '当前平台不是 Web，只保留观看入口说明');
      Alert.alert('当前平台暂不支持', '移动端当前只保留共享入口说明，请先使用 Web 端验证观看流程。');
      return;
    }

    if (!share?.id) {
      appendDiagnosticEvent('加入观看失败', '目标共享缺少会话 ID');
      Alert.alert('加入失败', '未找到可加入的共享会话。');
      return;
    }

    setIsJoiningShare(true);
    dispatch(patchActiveScreenShareSession({
      connectionDetail: null,
      hasRemoteStream: false,
      viewerTimeoutReached: false,
    }));
    appendDiagnosticEvent(
      '加入观看请求',
      `会话ID=${share.id}，标题=${share.title || '未命名共享'}`
    );
    if (viewerTimeoutRef.current) {
      clearTimeout(viewerTimeoutRef.current);
      viewerTimeoutRef.current = null;
    }

    dispatch(joinScreenShare(share.id))
      .unwrap()
      .then((data) =>
        webrtcService.connect(data.webrtc_room_id).then(() => {
          dispatch(patchActiveScreenShareSession({
            status: 'viewing',
            webrtcRoomId: data.webrtc_room_id || null,
            connectionState: 'connected',
            connectionDetail: null,
            hasRemoteStream: false,
            viewerTimeoutReached: false,
            shareSnapshot: share,
          }));
          appendDiagnosticEvent(
            '加入观看成功',
            `已接入房间 ${data.webrtc_room_id || '未知'}，等待远端推流`
          );
          viewerTimeoutRef.current = setTimeout(() => {
            dispatch(patchActiveScreenShareSession({
              viewerTimeoutReached: true,
            }));
            appendDiagnosticEvent(
              '远端流等待超时',
              `超过 ${VIEWER_STREAM_TIMEOUT_MS / 1000} 秒仍未收到远端画面`
            );
          }, VIEWER_STREAM_TIMEOUT_MS);
        })
      )
      .catch((requestError) => {
        appendDiagnosticEvent(
          '加入观看失败',
          requestError?.message || requestError || '加入共享接口或信令连接失败'
        );
        Alert.alert(
          '加入共享失败',
          requestError?.message || requestError || '暂时无法加入该共享'
        );
      })
      .finally(() => {
        setIsJoiningShare(false);
      });
  };

  useEffect(() => {
    if (isSharing || !joinedShare) {
      return;
    }

    if (!liveJoinedShare || liveJoinedShare.status === 'ended') {
      appendDiagnosticEvent('观看态失效', '刷新后目标共享已不存在或已结束，页面自动退出观看态');
      handleLeaveViewer({ silent: true });
      return;
    }

    if (liveJoinedShare !== joinedShare) {
      dispatch(patchActiveScreenShareSession({
        shareSnapshot: liveJoinedShare,
      }));
      appendDiagnosticEvent('共享快照已同步', '观看中的共享对象已更新为最新服务端快照');
    }
  }, [appendDiagnosticEvent, dispatch, handleLeaveViewer, isSharing, joinedShare, liveJoinedShare]);

  const handleEndShare = () => {
    setShowEndDialog(false);

    if (!activeSessionId) {
      webrtcService.disconnect();
      resetSessionState();
      appendDiagnosticEvent('共享结束', '当前无活动会话，已直接回收本地状态');
      return;
    }

    appendDiagnosticEvent('结束共享请求', `会话ID=${activeSessionId}`);
    dispatch(endScreenShare(activeSessionId))
      .unwrap()
      .then(() => {
        webrtcService.stopScreenShare();
        webrtcService.disconnect();
        resetSessionState();
        appendDiagnosticEvent('共享已结束', '已通知后端结束共享，并回收本地推流与连接状态');
        dispatch(fetchScreenShares());
      })
      .catch((requestError) => {
        appendDiagnosticEvent(
          '结束共享失败',
          requestError?.message || requestError || '结束共享接口失败'
        );
        Alert.alert(
          '结束共享失败',
          requestError?.message || requestError || '暂时无法结束共享'
        );
      });
  };

  const handlePauseOrResumeShare = () => {
    if (!activeSessionId) {
      appendDiagnosticEvent('共享状态切换失败', '当前没有可操作的共享会话');
      return;
    }

    const isPaused = currentShare?.status === 'paused';
    const actionLabel = isPaused ? '恢复共享请求' : '暂停共享请求';
    appendDiagnosticEvent(actionLabel, `会话ID=${activeSessionId}`);
    setIsTogglingShareState(true);

    const action = isPaused ? resumeScreenShare(activeSessionId) : pauseScreenShare(activeSessionId);

    dispatch(action)
      .unwrap()
      .then(() => {
        appendDiagnosticEvent(
          isPaused ? '共享已恢复' : '共享已暂停',
          isPaused ? '当前共享会话已恢复为可观看状态' : '当前共享会话已切换为暂停状态'
        );
        dispatch(fetchScreenShares());
      })
      .catch((requestError) => {
        appendDiagnosticEvent(
          isPaused ? '恢复共享失败' : '暂停共享失败',
          requestError?.message || requestError || '共享状态切换接口失败'
        );
        Alert.alert(
          isPaused ? '恢复共享失败' : '暂停共享失败',
          requestError?.message || requestError || '暂时无法切换共享状态'
        );
      })
      .finally(() => {
        setIsTogglingShareState(false);
      });
  };

  const handleCopyDiagnosticSummary = async () => {
    setIsCopyingDiagnostic(true);
    try {
      await PlatformClipboard.copy(diagnosticSummary);
      appendDiagnosticEvent('联调摘要已复制', '已复制当前共享链诊断摘要，便于回填文档或发给协作者');
      Alert.alert('复制成功', '当前联调摘要已复制到剪贴板。');
    } catch (copyError) {
      appendDiagnosticEvent(
        '联调摘要复制失败',
        copyError?.message || copyError || '剪贴板写入失败'
      );
      Alert.alert('复制失败', copyError?.message || '当前环境暂时无法写入剪贴板。');
    } finally {
      setIsCopyingDiagnostic(false);
    }
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
            {currentShare?.title || title || '未命名共享'}。
            {isCurrentSharePaused
              ? ' 当前共享已暂停，成员暂时不能加入观看。'
              : ' 保持当前页面开启，等待其他成员加入观看。'}
          </Text>
        </View>
      );
    }

    if (isViewing) {
      const connectionLabel = CONNECTION_STATE_LABELS[connectionState] || '连接状态未知';
      const viewerHint = viewerTimeoutReached
        ? '超过 12 秒仍未收到远端画面，请检查共享发起端是否正在推流，或重试加入会话。'
        : connectionDetail || '正在等待远端共享流推送到当前画面。';

      return (
        <View style={[styles.stageCard, styles.stageCardViewer]}>
          <Text style={styles.stageEyebrow}>观看中</Text>
          <Text style={styles.stageTitle}>已连接到共享会话</Text>
          <Text style={styles.stageDescription}>
            正在观看 {joinedShare?.user?.username || '群成员'} 的共享：
            {joinedShare?.title || '未命名共享'}。
          </Text>
          <View style={styles.viewerStage}>
            <video ref={videoRef} style={styles.viewerVideo} autoPlay playsInline />
            {!hasRemoteStream ? (
              <View style={styles.viewerOverlay}>
                <Icon
                  name={viewerTimeoutReached || connectionState === 'error' ? 'broadcast-off' : 'broadcast'}
                  size={34}
                  color="#FFFFFF"
                />
                <Text style={styles.viewerOverlayTitle}>
                  {viewerTimeoutReached ? '远端画面接入超时' : '已接入观看会话'}
                </Text>
                <Text style={styles.viewerOverlayBadge}>{connectionLabel}</Text>
                <Text style={styles.viewerOverlayText}>
                  {viewerHint}
                </Text>
              </View>
            ) : null}
          </View>
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

  const renderDiagnostics = () => {
    const connectionLabel = CONNECTION_STATE_LABELS[connectionState] || '连接状态未知';
    const viewerStateLabel = viewerTimeoutReached
      ? `等待超时（>${VIEWER_STREAM_TIMEOUT_MS / 1000} 秒）`
      : (hasRemoteStream ? '已收到远端流' : '等待远端流');
    const summaryRows = [
      { label: '当前角色', value: diagnosticRole },
      { label: '共享会话 ID', value: activeSessionId || '无' },
      { label: 'WebRTC 房间', value: activeRoomId || currentShare?.webrtc_room_id || liveJoinedShare?.webrtc_room_id || '无' },
      { label: '连接状态', value: connectionLabel },
      { label: '连接详情', value: connectionDetail || '无' },
      { label: '远端画面', value: viewerStateLabel },
    ];

    return (
      <View style={[styles.panel, styles.diagnosticPanel]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderBody}>
            <Text style={styles.sectionTitle}>联调摘要</Text>
            <Text style={styles.sectionMeta}>本地联调入口未完全打通前，先用页面内证据降低盲查成本</Text>
          </View>
          <Button
            compact
            icon="content-copy"
            onPress={handleCopyDiagnosticSummary}
            loading={isCopyingDiagnostic}
            disabled={isCopyingDiagnostic}
          >
            复制摘要
          </Button>
        </View>

        <View style={styles.diagnosticBadgeRow}>
          <View style={styles.diagnosticBadge}>
            <Text style={styles.diagnosticBadgeLabel}>{diagnosticRole}</Text>
          </View>
          <View style={[styles.diagnosticBadge, viewerTimeoutReached ? styles.diagnosticBadgeWarn : null]}>
            <Text style={styles.diagnosticBadgeLabel}>{connectionLabel}</Text>
          </View>
          <View style={[styles.diagnosticBadge, hasRemoteStream ? styles.diagnosticBadgeSuccess : null]}>
            <Text style={styles.diagnosticBadgeLabel}>{hasRemoteStream ? '远端流已到达' : '等待远端流'}</Text>
          </View>
        </View>

        <View style={styles.diagnosticGrid}>
          {summaryRows.map((row) => (
            <View key={row.label} style={styles.diagnosticRow}>
              <Text style={styles.diagnosticKey}>{row.label}</Text>
              <Text style={styles.diagnosticValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.diagnosticTimeline}>
          <Text style={styles.diagnosticTimelineTitle}>最近关键事件</Text>
          {diagnosticEvents.length > 0 ? (
            diagnosticEvents.map((event) => (
              <View key={event.id} style={styles.timelineItem}>
                <Text style={styles.timelineStamp}>{event.stamp}</Text>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>{event.label}</Text>
                  {event.detail ? <Text style={styles.timelineDetail}>{event.detail}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>当前还没有可展示的联调事件。</Text>
          )}
        </View>
      </View>
    );
  };

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
          const isPaused = share?.status === 'paused';
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
                {isPaused ? (
                  <Text style={styles.pausedHint}>暂停中的共享暂不可加入，需由发起人先恢复。</Text>
                ) : null}
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
                  disabled={!canUseWebShare || isJoiningShare || isPaused}
                  loading={isJoiningShare}
                >
                  {isPaused ? '已暂停' : '加入'}
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
        <>
          <Button
            mode="outlined"
            icon={isCurrentSharePaused ? 'play-circle-outline' : 'pause-circle-outline'}
            style={styles.secondaryButton}
            onPress={handlePauseOrResumeShare}
            loading={isTogglingShareState}
            disabled={isLoading || isTogglingShareState}
          >
            {isCurrentSharePaused ? '恢复共享' : '暂停共享'}
          </Button>
          <Button
            mode="contained"
            icon="monitor-off"
            style={[styles.button, styles.endButton]}
            onPress={() => setShowEndDialog(true)}
            loading={isLoading}
            disabled={isLoading || isTogglingShareState}
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
        {renderDiagnostics()}
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
  viewerExitButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.MEDIUM,
  },
  viewerStage: {
    width: '100%',
    minHeight: 240,
    marginTop: SPACING.MEDIUM,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#06131F',
    borderWidth: 1,
    borderColor: '#0F2C42',
    position: 'relative',
  },
  viewerVideo: {
    width: '100%',
    height: 240,
    objectFit: 'contain',
    backgroundColor: '#06131F',
  },
  viewerOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.LARGE,
    backgroundColor: 'rgba(6, 19, 31, 0.55)',
  },
  viewerOverlayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: SPACING.SMALL,
    marginBottom: 6,
  },
  viewerOverlayBadge: {
    fontSize: 12,
    color: '#D7F3EE',
    backgroundColor: 'rgba(15, 118, 110, 0.52)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  viewerOverlayText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.84)',
    textAlign: 'center',
  },
  panel: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 22,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  diagnosticPanel: {
    backgroundColor: '#F8FCFC',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.MEDIUM,
  },
  sectionHeaderBody: {
    flex: 1,
    paddingRight: SPACING.SMALL,
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
  diagnosticBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.SMALL,
    marginBottom: SPACING.MEDIUM,
  },
  diagnosticBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E8F3F2',
  },
  diagnosticBadgeWarn: {
    backgroundColor: '#FEF3C7',
  },
  diagnosticBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  diagnosticBadgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  diagnosticGrid: {
    gap: SPACING.SMALL,
  },
  diagnosticRow: {
    paddingVertical: SPACING.SMALL,
    borderTopWidth: 1,
    borderTopColor: '#E8EFF1',
  },
  diagnosticKey: {
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
    marginBottom: 4,
  },
  diagnosticValue: {
    fontSize: 14,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 20,
  },
  diagnosticTimeline: {
    marginTop: SPACING.MEDIUM,
    paddingTop: SPACING.MEDIUM,
    borderTopWidth: 1,
    borderTopColor: '#E8EFF1',
  },
  diagnosticTimelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SMALL,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.SMALL,
    borderTopWidth: 1,
    borderTopColor: '#EDF3F4',
  },
  timelineStamp: {
    width: 72,
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
    paddingTop: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  timelineDetail: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
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
  pausedHint: {
    fontSize: 12,
    color: COLORS.ACCENT,
    marginTop: 6,
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
