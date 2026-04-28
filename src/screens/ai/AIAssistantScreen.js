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
// 使用MongoDB替代AsyncStorage
import realmService from '../../services/database/realmService';
import tokenService from '../../services/auth/tokenService';
import Clipboard from '@react-native-clipboard/clipboard';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
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
} from '../../redux/slices/aiAssistantSlice';
import { ChatMessage, ChatInput, ChatHistorySidebar } from '../../components/ai';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AIAssistantModule from '../../native/AIAssistantModule';
import nativeAudioService from '../../services/audio/nativeAudioService';
import RNFS from 'react-native-fs';
import networkErrorService from '../../services/networkErrorService';
import networkService from '../../services/network/networkService';

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showAISelector, setShowAISelector] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(Date.now().toString());

  // AI引擎选项
  const aiEngineOptions = [
    { id: AIAssistantModule.ENGINE_BAIDU, name: '百度文心一言' },
    { id: AIAssistantModule.ENGINE_XUNFEI, name: '讯飞星火' },
    { id: AIAssistantModule.ENGINE_ZHIPU, name: '智谱ChatGLM' },
    { id: AIAssistantModule.ENGINE_QIANFAN, name: '千帆大模型' },
    { id: AIAssistantModule.ENGINE_MOONSHOT, name: 'Moonshot AI' },
  ];

  // 引用
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const audioRecorderPlayer = useRef(null);
  const audioFilePath = useRef(Platform.OS === 'android' ?
    `${RNFS.CachesDirectoryPath}/audio_message.mp3` :
    `${RNFS.CachesDirectoryPath}/audio_message.m4a`).current;

  // 初始化语音识别服务
  useEffect(() => {
    // 添加语音识别事件监听器
    nativeAudioService.addListener('speechResults', (e) => {
      if (e.value && e.value.length > 0) {
        const recognizedText = e.value[0];
        setInputText(recognizedText);
        setIsRecording(false);
        console.log('语音识别结果:', recognizedText);
      }
    });

    nativeAudioService.addListener('speechError', (e) => {
      console.error('语音识别错误:', e);
      setIsRecording(false);
      Alert.alert('语音识别失败', '请重试或检查网络连接');
    });

    nativeAudioService.addListener('speechEnd', () => {
      setIsRecording(false);
    });

    return () => {
      nativeAudioService.destroy();
    };
  }, []);

  // 加载设置和聊天历史
  useEffect(() => {
    // 加载聊天历史
    dispatch(loadChatHistory());

    // 监听键盘显示隐藏事件
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      // 键盘显示时的处理逻辑
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
  const handleSendMessage = async (text) => {
    if (!text.trim()) {return;}

    const isOnline = await networkService.checkConnection();
    if (!isOnline) {
      networkErrorService.handleApiError({
        message: 'Network Error',
        code: 'ERR_NETWORK',
        isNetworkError: true,
      }, {
        context: 'AI消息发送',
        customMessage: '当前无网络连接，无法发送消息',
      });
      return;
    }

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

    // 保存聊天历史到当前会话
    dispatch(saveChatHistory(currentSessionId));
  };

  // 处理重试
  const handleRetry = (message) => {
    if (message.sender !== 'assistant' || !message.isError) {return;}

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

  // 创建新对话
  const handleCreateNewChat = () => {
    // 创建新会话ID
    const newSessionId = Date.now().toString();
    setCurrentSessionId(newSessionId);

    // 重置会话
    dispatch(resetSession());
    // 清空本地消息
    dispatch(clearMessages());
    // 保存聊天历史
    dispatch(saveChatHistory(newSessionId));
  };

  // 处理消息复制
  const handleMessageAction = (action, text) => {
    if (action === 'copy') {
      try {
        Clipboard.setString(text);
        if (Platform.OS === 'android') {
          ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
        } else {
          Alert.alert('提示', '已复制到剪贴板');
        }
      } catch (error) {
        console.error('复制到剪贴板失败:', error);
        Alert.alert('错误', '复制到剪贴板失败');
      }
    }
  };

  // 请求录音权限
  const requestRecordPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '麦克风权限申请',
            message: '需要访问您的麦克风以进行语音输入',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          Alert.alert(
            '权限被拒绝',
            '语音功能需要麦克风权限。请在设置中手动开启权限。',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '去设置',
                onPress: () => {
                  // 可以添加跳转到设置的逻辑
                  Alert.alert('提示', '请在应用设置中开启麦克风权限');
                },
              },
            ]
          );
          return false;
        }
      } catch (err) {
        console.error('权限请求错误:', err);
        Alert.alert('错误', '权限请求失败，请重试');
        return false;
      }
    }
    return true; // iOS默认返回true，权限在Info.plist中配置
  };

  // 开始语音输入
  const startVoiceInput = async () => {
    const hasPermission = await requestRecordPermission();
    if (!hasPermission) {return;}

    try {
      setIsRecording(true);
      // 确保目录存在
      const dirPath = audioFilePath.substring(0, audioFilePath.lastIndexOf('/'));
      await RNFS.mkdir(dirPath);

      // 开始语音识别
      await nativeAudioService.startSpeechToText('zh-CN');
      console.log('开始语音识别');
    } catch (error) {
      console.error('录音失败:', error);
      Alert.alert('错误', `录音失败: ${error.message}`);
      setIsRecording(false);
    }
  };

  // 停止语音识别
  const stopVoiceInput = async () => {
    if (!isRecording) {return;}

    try {
      await nativeAudioService.stopSpeechToText();
      setIsRecording(false);
      console.log('语音识别结束');

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
      formData.append('file', {
        uri: Platform.OS === 'android' ? `file://${audioFilePath}` : audioFilePath,
        type: Platform.OS === 'android' ? 'audio/mp3' : 'audio/m4a',
        name: Platform.OS === 'android' ? 'audio.mp3' : 'audio.m4a',
      });

      try {
        // 从 TokenService 获取认证令牌
        const tokenData = await tokenService.getAccessToken();
        const authToken = tokenData ? tokenData.token : null;

        if (!authToken) {
          console.warn('转写音频: 未能获取到有效的认证令牌');
        }

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

        // 使用网络错误服务处理错误
        if (networkErrorService.isNetworkError(apiError)) {
          networkErrorService.handleApiError(apiError, {
            context: '语音转文字',
            customMessage: '网络连接失败，无法进行语音转文字',
          });
        }

        // 如果后端API调用失败，尝试使用本地模块
        if (AIAssistantModule.transcribeAudio) {
          const result = await AIAssistantModule.transcribeAudio(audioFilePath);
          setInputText(result.text);
        } else {
          const errorMessage = '语音转写服务不可用，请稍后重试';
          if (Platform.OS === 'android') {
            ToastAndroid.show(errorMessage, ToastAndroid.SHORT);
          } else {
            Alert.alert('提示', errorMessage);
          }
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
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Icon name="smart-toy" size={24} color={colors.primary} style={{ marginRight: 10 }} />
              <Text
                variant="heading"
                level="h4"
                style={styles.modalTitle}
              >
                选择AI引擎
              </Text>
            </View>

            <FlatList
              data={aiEngineOptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.aiOptionItem,
                    {
                      backgroundColor: colors.card,
                      borderBottomColor: colors.border,
                      borderLeftWidth: item.id === aiEngine ? 3 : 0,
                      borderLeftColor: colors.primary,
                      borderWidth: 1,
                      borderColor: item.id === aiEngine ? colors.primary : `${colors.primary}30`,
                    },
                  ]}
                  onPress={() => handleSelectEngine(item.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.card,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                      borderWidth: 1,
                      borderColor: colors.primary,
                    }}>
                      <Icon name="smart-toy" size={18} color={colors.primary} />
                    </View>
                    <Text
                      variant="body"
                      size="medium"
                      color={item.id === aiEngine ? 'primary' : 'text'}
                      bold={item.id === aiEngine}
                    >
                      {item.name}
                    </Text>
                  </View>
                  {item.id === aiEngine && (
                    <Icon name="check-circle" size={24} color={colors.primary} />
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
      <View style={[styles.header, {
        borderBottomColor: colors.border,
        paddingTop: 24, // 增加顶部内边距，使标题往下移
      }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: `${colors.primary}15`,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            <Icon name="psychology" size={20} color={colors.primary} />
          </View>
          <Text
            variant="heading"
            level="h4"
            style={styles.headerTitle}
          >
            AI助手
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: showHistorySidebar ? colors.primary : '#ffffff',
                flexDirection: 'row',
                paddingHorizontal: 0,
                width: 80,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.primary,
                elevation: 3,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                justifyContent: 'center',
                alignItems: 'center',
                paddingBottom: 2, // 向上微调文字位置
              },
            ]}
            onPress={() => setShowHistorySidebar(!showHistorySidebar)}
            activeOpacity={0.7}
          >
            <Text
              variant="body"
              size="small"
              color={showHistorySidebar ? 'card' : 'primary'}
              style={{
                fontWeight: '600',
                lineHeight: 18, // 调整行高
                marginTop: -7, // 向上移动文字
              }}
            >
              历史记录
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderAISelector()}

      {/* AI引擎选择器 - 放在顶部 */}
      <View style={[
        styles.aiSelectorContainer,
        {
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          paddingVertical: 8, // 减少垂直内边距
        },
      ]}>

        <TouchableOpacity
          style={[
            styles.aiSelectorButton,
            {
              borderColor: colors.primary,
              borderWidth: 1,
              backgroundColor: '#ffffff',
              marginTop: 4, // 减少顶部边距
              elevation: 3,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              borderRadius: 24,
            },
          ]}
          onPress={() => setShowAISelector(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#ffffff',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
              borderWidth: 1,
              borderColor: colors.primary,
            }}>
              <Icon name="smart-toy" size={16} color={colors.primary} />
            </View>
            <Text
              variant="body"
              size="medium"
              color="text"
              style={[styles.aiSelectorText, { fontWeight: '600' }]}
            >
              {aiEngineOptions.find(option => option.id === aiEngine)?.name || '选择AI引擎'}
            </Text>
          </View>
          <Icon name="keyboard-arrow-down" size={24} color={colors.primary} />
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
        onStartVoice={startVoiceInput}
        onStopVoice={stopVoiceInput}
        isRecording={isRecording}
        onCancel={handleCancel}
      />

      {/* 历史记录侧边栏遮罩层 */}
      {showHistorySidebar && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
          activeOpacity={1}
          onPress={() => setShowHistorySidebar(false)}
        />
      )}

      {/* 历史记录侧边栏 */}
      <ChatHistorySidebar
        visible={showHistorySidebar}
        onClose={() => setShowHistorySidebar(false)}
        onSelectSession={(sessionId) => {
          setCurrentSessionId(sessionId);
          dispatch(loadChatHistory(sessionId));
          setShowHistorySidebar(false);
        }}
        colors={colors}
        currentSessionId={currentSessionId}
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
    paddingHorizontal: 20,
    paddingTop: 24, // 增加顶部内边距
    paddingBottom: 16,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    marginLeft: 10,
    fontSize: 24,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    minWidth: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  errorBanner: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,0,0,0.1)',
    backgroundColor: 'rgba(255,0,0,0.05)',
  },
  messagesList: {
    padding: 20,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    height: 350,
  },
  // AI选择器相关样式
  aiSelectorContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10, // 减少垂直内边距
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  aiSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiSelectorLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  aiSettingsButton: {
    padding: 8, // 减少内边距
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    width: 36, // 减小尺寸
    height: 36, // 减小尺寸
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSelectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    backgroundColor: '#ffffff',
  },
  aiSelectorIcon: {
    marginRight: 8, // 减少右边距
  },
  aiSelectorText: {
    flex: 1,
    fontWeight: '600',
    fontSize: 15, // 减小字体大小
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    marginBottom: 24,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  aiOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});

export default AIAssistantScreen;
