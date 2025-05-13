import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { realmStorageService } from '../../services/storage/realmStorageService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';

// 存储键
const STORAGE_KEYS = {
  CHAT_HISTORY: 'ai_chat_history',
};

const ChatHistorySidebar = ({
  visible,
  onClose,
  onSelectSession,
  colors,
  currentSessionId,
}) => {
  const [chatSessions, setChatSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const slideAnim = useState(new Animated.Value(visible ? 0 : -300))[0];
  const screenWidth = Dimensions.get('window').width;
  const sidebarWidth = Math.min(300, screenWidth * 0.8);

  // 当visible属性变化时，执行动画
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -sidebarWidth,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim, sidebarWidth]);

  // 加载聊天历史
  useEffect(() => {
    if (visible) {
      loadChatHistory();
    }
  }, [visible]);

  // 加载聊天历史
  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      const historyJson = await realmStorageService.getItem(STORAGE_KEYS.CHAT_HISTORY);
      if (historyJson) {
        const history = JSON.parse(historyJson);
        // 将历史记录转换为会话列表
        const sessions = Object.keys(history).map(key => {
          // 确保history[key]是一个数组
          if (!history[key] || !Array.isArray(history[key])) {
            return {
              id: key,
              title: `对话 ${new Date(parseInt(key)).toLocaleString()}`,
              customTitle: history[key]?.customTitle,
              date: new Date(parseInt(key)),
              messageCount: 0,
              lastMessage: '无消息',
            };
          }

          // 使用第一条用户消息作为标题
          const firstUserMessage = history[key].find(msg => msg.sender === 'user');
          const title = firstUserMessage ?
            (firstUserMessage.text.length > 30 ?
              firstUserMessage.text.substring(0, 30) + '...' :
              firstUserMessage.text) :
            `对话 ${new Date(parseInt(key)).toLocaleString()}`;

          return {
            id: key,
            title: title,
            customTitle: history[key].customTitle,
            date: new Date(parseInt(key)),
            messageCount: history[key].length,
            lastMessage: history[key][history[key].length - 1]?.text || '无消息',
          };
        });

        // 按日期排序，最新的在前面
        sessions.sort((a, b) => b.date - a.date);

        // 过滤掉1970年的测试数据
        const filteredSessions = sessions.filter(session =>
          session.date.getFullYear() > 1971
        );

        setChatSessions(filteredSessions);
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      Alert.alert('错误', '加载聊天历史失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 创建新会话
  const handleCreateNewSession = () => {
    const newSessionId = Date.now().toString();
    onSelectSession(newSessionId);
    onClose();
  };

  // 选择会话
  const handleSelectSession = (sessionId) => {
    onSelectSession(sessionId);
    onClose();
  };

  // 删除会话
  const handleDeleteSession = async (sessionId) => {
    try {
      const historyJson = await realmStorageService.getItem(STORAGE_KEYS.CHAT_HISTORY);
      if (historyJson) {
        const history = JSON.parse(historyJson);
        // 删除指定会话
        delete history[sessionId];
        // 保存更新后的历史记录
        await realmStorageService.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(history));
        // 更新状态
        setChatSessions(chatSessions.filter(session => session.id !== sessionId));

        // 如果删除的是当前会话，创建一个新会话
        if (sessionId === currentSessionId) {
          handleCreateNewSession();
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error);
      Alert.alert('错误', '删除会话失败');
    }
  };

  // 确认删除会话
  const confirmDeleteSession = (session) => {
    Alert.alert(
      '确认删除',
      `确定要删除会话 "${session.customTitle || session.title}" 吗？`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          onPress: () => handleDeleteSession(session.id),
          style: 'destructive',
        },
      ]
    );
  };

  // 开始编辑会话标题
  const startEditingTitle = (session) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.customTitle || session.title);
  };

  // 保存会话标题
  const saveSessionTitle = async () => {
    if (!editingSessionId) return;

    try {
      const historyJson = await realmStorageService.getItem(STORAGE_KEYS.CHAT_HISTORY);
      if (historyJson) {
        const history = JSON.parse(historyJson);
        if (history[editingSessionId]) {
          // 添加自定义标题
          history[editingSessionId].customTitle = editingTitle;
          // 保存更新后的历史记录
          await realmStorageService.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(history));

          // 更新状态
          setChatSessions(chatSessions.map(session =>
            session.id === editingSessionId
              ? {...session, customTitle: editingTitle}
              : session
          ));
        }
      }
    } catch (error) {
      console.error('保存会话标题失败:', error);
      Alert.alert('错误', '保存会话标题失败');
    } finally {
      setEditingSessionId(null);
    }
  };

  // 渲染会话项
  const renderSessionItem = ({ item }) => {
    const isEditing = item.id === editingSessionId;
    const isActive = item.id === currentSessionId;

    return (
      <View style={[
        styles.sessionItem,
        {
          backgroundColor: isActive ? `${colors.primary}15` : 'transparent',
          borderLeftWidth: isActive ? 3 : 0,
          borderLeftColor: colors.primary
        }
      ]}>
        {isEditing ? (
          <View style={styles.editTitleContainer}>
            <TextInput
              style={[styles.editTitleInput, { color: colors.text, borderColor: colors.border }]}
              value={editingTitle}
              onChangeText={setEditingTitle}
              autoFocus
              onBlur={saveSessionTitle}
              onSubmitEditing={saveSessionTitle}
            />
            <TouchableOpacity onPress={saveSessionTitle} style={styles.saveButton}>
              <Icon name="check" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.sessionContent}
            onPress={() => handleSelectSession(item.id)}
          >
            <View style={styles.sessionInfo}>
              <Text
                variant="body"
                size="medium"
                bold={isActive}
                style={{
                  color: isActive ? colors.primary : colors.text,
                  marginBottom: 4
                }}
              >
                {item.customTitle || item.title}
              </Text>
              <Text
                variant="caption"
                size="tiny"
                style={{ color: colors.textSecondary }}
              >
                {new Date(parseInt(item.id)).toLocaleDateString()} · {item.messageCount}条消息
              </Text>
            </View>
            <View style={styles.sessionActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => startEditingTitle(item)}
              >
                <Icon name="edit" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => confirmDeleteSession(item)}
              >
                <Icon name="delete" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderRightColor: colors.border,
          width: sidebarWidth,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text
            variant="heading"
            level="h4"
            style={styles.headerTitle}
          >
            聊天历史
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[
          styles.newChatButton,
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 24,
            elevation: 3,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
          }
        ]}
        onPress={handleCreateNewSession}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon name="add" size={24} color={colors.primary} />
          <Text
            variant="body"
            size="medium"
            style={[styles.newChatButtonText, { color: colors.primary, fontWeight: '700' }]}
          >
            新对话
          </Text>
        </View>
      </TouchableOpacity>

      {chatSessions.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Icon name="history" size={48} color={`${colors.textSecondary}50`} />
          <Text
            variant="body"
            size="medium"
            color="textSecondary"
            center
            style={{ marginTop: 16 }}
          >
            暂无聊天历史
          </Text>
        </View>
      ) : (
        <FlatList
          data={chatSessions}
          renderItem={renderSessionItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.sessionsList}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    borderRightWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 14,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  newChatButtonText: {
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  sessionsList: {
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  sessionItem: {
    borderRadius: 8,
    marginVertical: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  sessionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  sessionInfo: {
    flex: 1,
    paddingRight: 8,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 6,
    marginLeft: 4,
  },
  editTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  editTitleInput: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderRadius: 4,
    fontSize: 14,
  },
  saveButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default ChatHistorySidebar;
