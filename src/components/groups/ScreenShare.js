/**
 * 屏幕共享组件
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Text, Button, Portal, Dialog } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  createScreenShare,
  endScreenShare,
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
  PRIMARY: '#007AFF',
  ERROR: '#FF3B30',
  TEXT_PRIMARY: '#000000',
  TEXT_SECONDARY: '#8E8E93',
  TEXT_TERTIARY: '#C7C7CC',
  SURFACE: '#FFFFFF',
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
  const [isSharing, setIsSharing] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);

  const videoRef = useRef(null);
  const latestShareIdRef = useRef(null);
  const latestIsSharingRef = useRef(false);

  const activeGroupShares = (sharedScreens || []).filter(
    (share) => share?.group?.id === groupId && share?.status !== 'ended'
  );

  useEffect(() => {
    dispatch(fetchScreenShares());
  }, [dispatch]);

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
        if (!prev.some((item) => item.id === user.id)) {
          return [...prev, user];
        }
        return prev;
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

  const resetShareState = () => {
    setIsSharing(false);
    setShareId(null);
    setConnectedUsers([]);
  };

  const handleStartShare = () => {
    if (Platform.OS !== 'web') {
      setShowStartDialog(false);
      Alert.alert('暂不支持', '移动端当前不创建共享会话，避免产生假活跃共享记录。');
      return;
    }

    if (!title.trim()) {
      Alert.alert('错误', '请输入共享标题');
      return;
    }

    setShowStartDialog(false);

    dispatch(createScreenShare({ groupId, title: title.trim() }))
      .unwrap()
      .then((share) => {
        setShareId(share.id);
        return webrtcService.connect(share.webrtc_room_id).then(() => {
          return webrtcService.startScreenShare().then(() => {
            setIsSharing(true);
            dispatch(fetchScreenShares());
          });
        }).catch((requestError) => {
          dispatch(endScreenShare(share.id));
          dispatch(fetchScreenShares());
          throw requestError;
        });
      })
      .catch((requestError) => {
        Alert.alert('创建屏幕共享失败', requestError?.message || requestError || '暂时无法启动屏幕共享');
      });
  };

  const handleJoinShare = (share) => {
    if (Platform.OS !== 'web') {
      Alert.alert('暂不支持', '移动端当前不支持加入屏幕共享，请先使用 Web 端验证该流程。');
      return;
    }

    dispatch(joinScreenShare(share.id))
      .unwrap()
      .then((data) => {
        return webrtcService.connect(data.webrtc_room_id);
      })
      .catch((requestError) => {
        Alert.alert('加入屏幕共享失败', requestError?.message || requestError || '暂时无法加入该共享');
      });
  };

  const handleEndShare = () => {
    setShowEndDialog(false);

    if (!shareId) {
      webrtcService.disconnect();
      resetShareState();
      return;
    }

    dispatch(endScreenShare(shareId))
      .unwrap()
      .then(() => {
        webrtcService.stopScreenShare();
        webrtcService.disconnect();
        resetShareState();
        dispatch(fetchScreenShares());
      })
      .catch((requestError) => {
        Alert.alert('结束屏幕共享失败', requestError?.message || requestError || '暂时无法结束共享');
      });
  };

  const renderVideo = () => {
    if (Platform.OS !== 'web') {
      return (
        <View style={styles.unsupportedContainer}>
          <Icon name="monitor-off" size={48} color={COLORS.TEXT_TERTIARY} />
          <Text style={styles.unsupportedText}>移动端当前仅保留共享入口说明，请优先使用 Web 端共享或观看。</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        {isSharing ? (
          <Text style={styles.sharingText}>正在共享您的屏幕</Text>
        ) : (
          <video ref={videoRef} style={styles.video} autoPlay playsInline />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{isSharing ? '正在共享屏幕' : '屏幕共享'}</Text>
          <Text style={styles.subtitle}>{currentGroup?.name}</Text>
        </View>

        {renderVideo()}

        <View style={styles.usersContainer}>
          <Text style={styles.sectionTitle}>已连接用户</Text>
          {connectedUsers.length > 0 ? (
            connectedUsers.map((user) => (
              <View key={user.id} style={styles.userItem}>
                <Icon
                  name={user.is_sharing ? 'monitor-share' : 'account'}
                  size={20}
                  color={COLORS.TEXT_PRIMARY}
                  style={styles.userIcon}
                />
                <Text style={styles.username}>{user.username}</Text>
                {user.is_sharing ? <Text style={styles.sharingBadge}>共享中</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>暂无已连接用户</Text>
          )}
        </View>

        <View style={styles.usersContainer}>
          <Text style={styles.sectionTitle}>当前群组活跃共享</Text>
          {activeGroupShares.length > 0 ? (
            activeGroupShares.map((share) => {
              const isOwner = String(share?.user?.id || '') === String(currentUser?.id || '');
              return (
                <View key={share.id} style={styles.userItem}>
                  <View style={styles.shareMeta}>
                    <Text style={styles.username}>{share.title || '未命名共享'}</Text>
                    <Text style={styles.shareSubtitle}>{share?.user?.username || '未知成员'}</Text>
                  </View>
                  {isOwner ? (
                    <Text style={styles.sharingBadge}>我的共享</Text>
                  ) : (
                    <Button mode="outlined" compact onPress={() => handleJoinShare(share)} disabled={Platform.OS !== 'web'}>
                      加入
                    </Button>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>当前群组暂无活跃共享</Text>
          )}
        </View>

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
              disabled={isLoading || Platform.OS !== 'web'}
            >
              {Platform.OS === 'web' ? '开始共享' : '仅 Web 支持共享'}
            </Button>
          )}
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={20} color={COLORS.ERROR} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Portal>
        <Dialog visible={showStartDialog} onDismiss={() => setShowStartDialog(false)} style={styles.dialog}>
          <Dialog.Title>开始屏幕共享</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>请输入共享标题，然后点击“开始共享”。</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="共享标题"
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
          <Dialog.Title>结束屏幕共享</Dialog.Title>
          <Dialog.Content>
            <Text>确定要结束当前屏幕共享吗？</Text>
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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: SPACING.MEDIUM,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.LARGE,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SMALL,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
  },
  videoContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.LARGE,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  sharingText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  unsupportedContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.LARGE,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: SPACING.LARGE,
  },
  unsupportedText: {
    fontSize: 16,
    color: COLORS.TEXT_TERTIARY,
    textAlign: 'center',
    marginTop: SPACING.MEDIUM,
  },
  usersContainer: {
    backgroundColor: '#FFFFFF',
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
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  userIcon: {
    marginRight: SPACING.SMALL,
  },
  username: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  shareMeta: {
    flex: 1,
    marginRight: SPACING.SMALL,
  },
  shareSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  sharingBadge: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    backgroundColor: 'rgba(0,122,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.TEXT_TERTIARY,
    textAlign: 'center',
    padding: SPACING.MEDIUM,
  },
  actionsContainer: {
    marginBottom: SPACING.LARGE,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 6,
  },
  endButton: {
    backgroundColor: COLORS.ERROR,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    padding: SPACING.MEDIUM,
    borderRadius: 8,
    marginBottom: SPACING.MEDIUM,
  },
  errorText: {
    color: COLORS.ERROR,
    marginLeft: SPACING.SMALL,
    flex: 1,
  },
  dialog: {
    borderRadius: 20,
  },
  dialogText: {
    marginBottom: SPACING.MEDIUM,
  },
  titleInput: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: SPACING.SMALL,
    fontSize: 16,
  },
});

export default ScreenShare;
