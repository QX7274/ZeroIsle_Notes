/**
 * 屏幕共享组件
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Text, Button, ActivityIndicator, Portal, Dialog } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  createScreenShare,
  endScreenShare,
  joinScreenShare,
  selectGroupsLoading,
  selectGroupsError,
  selectCurrentGroup,
} from '../../redux/slices/groupsSlice';
import { webrtcService } from '../../services/webrtc/webrtcService';
import { SPACING } from '../../utils/constants/dimensions';
// 定义颜色常量
const COLORS = {
  PRIMARY: '#007AFF',
  ERROR: '#FF3B30',
  TEXT_PRIMARY: '#000000',
  TEXT_SECONDARY: '#8E8E93',
  TEXT_TERTIARY: '#C7C7CC',
};

const ScreenShare = ({ groupId }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isLoading = useSelector(selectGroupsLoading);
  const error = useSelector(selectGroupsError);
  const currentGroup = useSelector(selectCurrentGroup);

  const [title, setTitle] = useState('');
  const [shareId, setShareId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);

  const videoRef = useRef(null);

  useEffect(() => {
    // 初始化WebRTC服务
    if (Platform.OS === 'web') {
      const userId = currentGroup?.creator?.id;
      if (userId) {
        webrtcService.init(userId);
      }
    }

    return () => {
      // 清理
      if (isSharing) {
        handleEndShare();
      }
      webrtcService.disconnect();
    };
  }, []);

  useEffect(() => {
    // 注册WebRTC事件监听
    if (Platform.OS === 'web') {
      webrtcService.onUserJoin((user) => {
        setConnectedUsers((prev) => {
          if (!prev.some((u) => u.id === user.id)) {
            return [...prev, user];
          }
          return prev;
        });
      });

      webrtcService.onUserLeave((user) => {
        setConnectedUsers((prev) => prev.filter((u) => u.id !== user.id));
      });

      webrtcService.onRemoteStream(({ userId, stream }) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    }
  }, []);

  const handleStartShare = () => {
    if (!title.trim()) {
      Alert.alert('错误', '请输入共享标题');
      return;
    }

    setShowStartDialog(false);

    dispatch(createScreenShare({ groupId, title: title.trim() }))
      .unwrap()
      .then((share) => {
        setShareId(share.id);
        setRoomId(share.webrtc_room_id);

        if (Platform.OS === 'web') {
          // 连接到WebRTC信令服务器
          webrtcService.connect(share.webrtc_room_id)
            .then(() => {
              // 开始屏幕共享
              return webrtcService.startScreenShare();
            })
            .then(() => {
              setIsSharing(true);
            })
            .catch((error) => {
              console.error('屏幕共享失败:', error);
              Alert.alert('屏幕共享失败', error.message || '无法启动屏幕共享');

              // 结束共享
              dispatch(endScreenShare(share.id));
            });
        } else {
          Alert.alert('提示', '移动端暂不支持屏幕共享，请使用Web端进行屏幕共享');
        }
      })
      .catch((error) => {
        console.error('创建屏幕共享失败:', error);
        Alert.alert('创建屏幕共享失败', error);
      });
  };

  const handleJoinShare = (shareId) => {
    dispatch(joinScreenShare(shareId))
      .unwrap()
      .then((data) => {
        setRoomId(data.webrtc_room_id);

        if (Platform.OS === 'web') {
          // 连接到WebRTC信令服务器
          webrtcService.connect(data.webrtc_room_id)
            .then(() => {
              // 已连接，等待接收流
            })
            .catch((error) => {
              console.error('加入屏幕共享失败:', error);
              Alert.alert('加入屏幕共享失败', error.message || '无法连接到共享');
            });
        } else {
          Alert.alert('提示', '移动端暂不支持屏幕共享，请使用Web端查看屏幕共享');
        }
      })
      .catch((error) => {
        console.error('加入屏幕共享失败:', error);
        Alert.alert('加入屏幕共享失败', error);
      });
  };

  const handleEndShare = () => {
    setShowEndDialog(false);

    if (shareId) {
      dispatch(endScreenShare(shareId))
        .unwrap()
        .then(() => {
          // 停止屏幕共享
          if (Platform.OS === 'web') {
            webrtcService.stopScreenShare();
            webrtcService.disconnect();
          }

          setIsSharing(false);
          setShareId(null);
          setRoomId(null);
          setConnectedUsers([]);
        })
        .catch((error) => {
          console.error('结束屏幕共享失败:', error);
          Alert.alert('结束屏幕共享失败', error);
        });
    } else {
      // 如果没有shareId，只需要清理本地状态
      if (Platform.OS === 'web') {
        webrtcService.stopScreenShare();
        webrtcService.disconnect();
      }

      setIsSharing(false);
      setRoomId(null);
      setConnectedUsers([]);
    }
  };

  // 仅在Web平台上渲染视频元素
  const renderVideo = () => {
    if (Platform.OS !== 'web') {
      return (
        <View style={styles.unsupportedContainer}>
          <Icon name="monitor-off" size={48} color={COLORS.TEXT_TERTIARY} />
          <Text style={styles.unsupportedText}>
            移动端暂不支持屏幕共享，请使用Web端
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        {isSharing ? (
          <Text style={styles.sharingText}>正在共享您的屏幕</Text>
        ) : (
          <video
            ref={videoRef}
            style={styles.video}
            autoPlay
            playsInline
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {isSharing ? '正在共享屏幕' : '屏幕共享'}
          </Text>
          <Text style={styles.subtitle}>
            {currentGroup?.name}
          </Text>
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
                {user.is_sharing && (
                  <Text style={styles.sharingBadge}>共享中</Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>暂无连接用户</Text>
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
              disabled={isLoading}
            >
              开始共享
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
        <Dialog
          visible={showStartDialog}
          onDismiss={() => setShowStartDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title>开始屏幕共享</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              请输入共享标题，然后点击"开始共享"按钮。
            </Text>
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
            <Button onPress={handleStartShare} mode="contained">开始共享</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showEndDialog}
          onDismiss={() => setShowEndDialog(false)}
        >
          <Dialog.Title>结束屏幕共享</Dialog.Title>
          <Dialog.Content>
            <Text>确定要结束当前的屏幕共享吗？</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEndDialog(false)}>取消</Button>
            <Button
              onPress={handleEndShare}
              mode="contained"
              buttonColor={COLORS.ERROR}
            >
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
  },
  unsupportedText: {
    fontSize: 16,
    color: COLORS.TEXT_TERTIARY,
    textAlign: 'center',
    marginTop: SPACING.MEDIUM,
    paddingHorizontal: SPACING.LARGE,
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
