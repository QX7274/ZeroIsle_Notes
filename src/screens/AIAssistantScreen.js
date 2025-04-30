import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ToastAndroid,
  Animated,
  Keyboard,
  PermissionsAndroid,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  sendMessage,
  loadChatHistory,
  saveChatHistory,
  resetSession,
  cancelCurrentStream,
  clearMessages,
  setAiEngine,
  setAiModel,
  selectMessages,
  selectIsLoading,
  selectError,
  selectMarkdownEnabled,
  selectVoiceEnabled,
  selectAiEngine,
  selectAiModel,
} from '../store/slices/aiAssistantSlice';
import { ChatMessage, ChatInput } from '../components/ai';
import { Text } from '../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AIAssistantModule from '../native/AIAssistantModule';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

// 存储键
const STORAGE_KEYS = {
  AI_ENGINE: 'ai_engine',
  AI_MODEL: 'ai_model',
  CHAT_HISTORY: 'ai_chat_history',
  STREAM_RESPONSE: 'stream_response',
  VOICE_ENABLED: 'voice_enabled',
  MARKDOWN_ENABLED: 'markdown_enabled',
};

const AIAssistantScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const messages = useSelector(selectMessages);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const markdownEnabled = useSelector(selectMarkdownEnabled);
  const voiceEnabled = useSelector(selectVoiceEnabled);
  const aiEngine = useSelector(selectAiEngine);
  const aiModel = useSelector(selectAiModel);

  // 本地状态
  const [inputText, setInputText] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showAISelector, setShowAISelector] = useState(false);

  // AI引擎选项
  const aiEngineOptions = [
    { id: AIAssistantModule.ENGINE_BAIDU, name: '百度文心一言' },
    { id: AIAssistantModule.ENGINE_XUNFEI, name: '讯飞星火' },
    { id: AIAssistantModule.ENGINE_ZHIPU, name: '智谱ChatGLM' },
    { id: AIAssistantModule.ENGINE_QIANFAN, name: '千帆大模型' },
    { id: AIAssistantModule.ENGINE_MOONSHOT, name: 'Moonshot AI' },
    { id: AIAssistantModule.ENGINE_LOCAL, name: '本地引擎' },
  ];

  // 引用
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const audioFilePath = useRef(Platform.OS === 'android' ?
    `${RNFS.CachesDirectoryPath}/audio_message.mp3` :
    `${RNFS.CachesDirectoryPath}/audio_message.m4a`).current;

  // 加载设置和聊天历史
  useEffect(() => {
    // 加载聊天历史
    dispatch(loadChatHistory());

    // 监听键盘显示隐藏事件
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setShowQuickActions(false);
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, [dispatch]);

  // 当消息更新时，滚动到底部
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // 处理发送消息
  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    // 保存输入文本，以便在发送后清空
    const messageText = text.trim();
    setInputText('');

    // 准备聊天历史
    const chatHistory = messages
      .filter(msg => !msg.isError)
      .map(msg => ({
        text: msg.text,
        sender: msg.sender,
      }));

    // 发送消息
    dispatch(sendMessage({
      message: messageText,
      history: chatHistory,
    }));
  };

  // 处理重试
  const handleRetry = (message) => {
    if (message.sender !== 'assistant' || !message.isError) return;

    // 找到用户的上一条消息
    const userMessageIndex = messages.findIndex(msg =>
      msg.sender === 'user' &&
      new Date(msg.timestamp) < new Date(message.timestamp)
    );

    if (userMessageIndex !== -1) {
      const userMessage = messages[userMessageIndex];
      handleSendMessage(userMessage.text);
    }
  };

  // 处理取消
  const handleCancel = () => {
    dispatch(cancelCurrentStream());
  };

  // 清空聊天历史
  const handleClearChatHistory = () => {
    Alert.alert(
      '确认',
      '确定要清空聊天历史吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确定',
          onPress: () => {
            // 重置会话
            dispatch(resetSession());
            // 清空本地消息
            dispatch(clearMessages());
            // 保存聊天历史
            dispatch(saveChatHistory());
          },
        },
      ],
      { cancelable: true }
    );
  };

  // 打开设置
  const handleOpenSettings = () => {
    navigation.navigate('AIAssistantSettings');
  };

  // 复制消息内容
  const handleCopyMessage = async (text) => {
    try {
      await Clipboard.setStringAsync(text);
      if (Platform.OS === 'android') {
        ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
      } else {
        Alert.alert('提示', '已复制到剪贴板');
      }
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      Alert.alert('错误', '复制到剪贴板失败');
    }
    setSelectedMessageId(null);
    setShowQuickActions(false);
  };

  // 显示/隐藏快捷操作
  const toggleQuickActions = (messageId) => {
    if (selectedMessageId === messageId) {
      setSelectedMessageId(null);
      setShowQuickActions(false);
    } else {
      setSelectedMessageId(messageId);
      setShowQuickActions(true);

      // 动画效果
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  // 请求录音权限
  const requestRecordPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);

        if (
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          grants[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          return true;
        } else {
          Alert.alert('权限错误', '需要录音和存储权限才能使用语音功能');
          return false;
        }
      } catch (err) {
        console.error('权限请求错误:', err);
        return false;
      }
    }
    return true; // iOS默认返回true，权限在Info.plist中配置
  };

  // 开始录音
  const startRecording = async () => {
    const hasPermission = await requestRecordPermission();
    if (!hasPermission) return;

    try {
      setIsRecording(true);
      // 确保目录存在
      const dirPath = audioFilePath.substring(0, audioFilePath.lastIndexOf('/'));
      await RNFS.mkdir(dirPath);

      // 开始录音
      const result = await audioRecorderPlayer.startRecorder(audioFilePath);
      audioRecorderPlayer.addRecordBackListener((e) => {
        const seconds = Math.floor(e.currentPosition / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        setRecordTime(
          `${minutes < 10 ? '0' + minutes : minutes}:${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}`
        );
      });
      console.log('开始录音:', result);
    } catch (error) {
      console.error('录音失败:', error);
      Alert.alert('错误', `录音失败: ${error.message}`);
      setIsRecording(false);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    if (!isRecording) return;

    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordTime('00:00');
      console.log('录音结束:', result);

      // 转写音频
      transcribeAudio();
    } catch (error) {
      console.error('停止录音失败:', error);
      Alert.alert('错误', `停止录音失败: ${error.message}`);
      setIsRecording(false);
      setRecordTime('00:00');
    }
  };

  // 转写音频
  const transcribeAudio = async () => {
    try {
      setIsTranscribing(true);

      // 检查文件是否存在
      const fileExists = await RNFS.exists(audioFilePath);
      if (!fileExists) {
        throw new Error('录音文件不存在');
      }

      // 准备表单数据
      const formData = new FormData();
      formData.append('audio', {
        uri: Platform.OS === 'android' ? `file://${audioFilePath}` : audioFilePath,
        type: Platform.OS === 'android' ? 'audio/mp3' : 'audio/m4a',
        name: Platform.OS === 'android' ? 'audio.mp3' : 'audio.m4a',
      });

      try {
        // 获取认证令牌
        const authToken = await AsyncStorage.getItem('auth_token');

        // 调用后端API进行转写
        const response = await fetch(`${AIAssistantModule.getApiUrl('ai-assistant/transcribe/')}`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
        });

        if (!response.ok) {
          throw new Error(`服务器响应错误: ${response.status}`);
        }

        const result = await response.json();
        if (result.text) {
          setInputText(result.text);
        } else {
          // 如果后端返回错误
          throw new Error(result.error || '转写失败');
        }
      } catch (apiError) {
        console.error('调用转写API失败:', apiError);

        // 如果后端API调用失败，尝试使用本地模块
        if (AIAssistantModule.transcribeAudio) {
          const result = await AIAssistantModule.transcribeAudio(audioFilePath);
          setInputText(result.text);
        } else {
          // 如果本地模块也不可用，使用模拟数据
          setInputText('这是一段语音转文字的内容。由于无法连接到转写服务，这是模拟的结果。');
        }
      }
    } catch (error) {
      console.error('音频转写失败:', error);
      Alert.alert('错误', `音频转写失败: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 选择AI引擎
  const handleSelectEngine = (engine) => {
    dispatch(setAiEngine(engine));
    setShowAISelector(false);

    // 根据引擎设置默认模型
    switch (engine) {
      case AIAssistantModule.ENGINE_BAIDU:
        dispatch(setAiModel(AIAssistantModule.MODEL_ERNIE_BOT));
        break;
      case AIAssistantModule.ENGINE_XUNFEI:
        dispatch(setAiModel(AIAssistantModule.MODEL_SPARK_DESK));
        break;
      case AIAssistantModule.ENGINE_ZHIPU:
        dispatch(setAiModel(AIAssistantModule.MODEL_CHATGLM_TURBO));
        break;
      case AIAssistantModule.ENGINE_QIANFAN:
        dispatch(setAiModel(AIAssistantModule.MODEL_QIANFAN_LLAMA));
        break;
      case AIAssistantModule.ENGINE_MOONSHOT:
        dispatch(setAiModel(AIAssistantModule.MODEL_MOONSHOT_V1));
        break;
      default:
        dispatch(setAiModel(''));
        break;
    }
  };

  // 渲染AI选择器
  const renderAISelector = () => {
    return (
      <Modal
        visible={showAISelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAISelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAISelector(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text
              variant="body"
              size="large"
              bold
              style={styles.modalTitle}
            >
              选择AI引擎
            </Text>

            <FlatList
              data={aiEngineOptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.aiOptionItem,
                    {
                      backgroundColor: item.id === aiEngine ? colors.primary + '20' : 'transparent',
                      borderBottomColor: colors.border
                    }
                  ]}
                  onPress={() => handleSelectEngine(item.id)}
                >
                  <Text
                    variant="body"
                    size="medium"
                    color={item.id === aiEngine ? 'primary' : 'text'}
                    bold={item.id === aiEngine}
                  >
                    {item.name}
                  </Text>
                  {item.id === aiEngine && (
                    <Icon name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // 渲染消息项
  const renderMessageItem = ({ item }) => {
    return (
      <ChatMessage
        message={item}
        markdownEnabled={markdownEnabled}
        onRetry={handleRetry}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text
          variant="heading"
          level="h4"
          style={styles.headerTitle}
        >
          AI助手
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={handleClearChatHistory}>
            <Icon name="delete" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleOpenSettings}>
            <Icon name="settings" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {renderAISelector()}

      {/* AI引擎选择器 - 放在顶部 */}
      <View style={[styles.aiSelectorContainer, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[styles.aiSelectorButton, { borderColor: colors.border }]}
          onPress={() => setShowAISelector(true)}
        >
          <Icon name="smart-toy" size={22} color={colors.primary} style={styles.aiSelectorIcon} />
          <Text
            variant="body"
            size="medium"
            style={styles.aiSelectorText}
          >
            {aiEngineOptions.find(option => option.id === aiEngine)?.name || '选择AI引擎'}
          </Text>
          <Icon name="arrow-drop-down" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.errorLight }]}>
          <Text
            variant="body"
            size="small"
            color="error"
            center
          >
            {error}
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text
              variant="body"
              size="medium"
              color="hint"
              center
            >
              开始与AI助手对话吧
            </Text>
          </View>
        }
      />

      <ChatInput
        onSend={handleSendMessage}
        isLoading={isLoading}
        voiceEnabled={voiceEnabled}
        onStartVoice={startRecording}
        onStopVoice={stopRecording}
        isRecording={isRecording}
        onCancel={handleCancel}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    marginLeft: 8,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  errorBanner: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,0,0,0.1)',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    height: 200,
  },
  // AI选择器相关样式
  aiSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  aiSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiSelectorLabel: {
    fontSize: 16,
  },
  aiSettingsButton: {
    padding: 4,
  },
  aiSelectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  aiSelectorText: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  aiOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
});

export default AIAssistantScreen;
