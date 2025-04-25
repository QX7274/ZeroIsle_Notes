import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Clipboard,
  ToastAndroid,
  Animated,
  Keyboard,
  ScrollView,
  Share,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AIAssistantModule from '../native/AIAssistantModule';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiEngine, setAiEngine] = useState(AIAssistantModule.ENGINE_LOCAL);
  const [aiModel, setAiModel] = useState('');
  const [markdownEnabled, setMarkdownEnabled] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const audioFilePath = useRef(Platform.OS === 'android' ?
    `${RNFS.CachesDirectoryPath}/audio_message.mp3` :
    `${RNFS.CachesDirectoryPath}/audio_message.m4a`).current;

  // 加载设置和聊天历史
  useEffect(() => {
    loadSettings();
    loadChatHistory();

    // 监听键盘显示隐藏事件
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setShowQuickActions(false);
    });

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  // 加载设置
  const loadSettings = async () => {
    try {
      const savedEngine = await AsyncStorage.getItem(STORAGE_KEYS.AI_ENGINE);
      if (savedEngine) {
        setAiEngine(savedEngine);
      }

      const savedModel = await AsyncStorage.getItem(STORAGE_KEYS.AI_MODEL);
      if (savedModel) {
        setAiModel(savedModel);
      }

      const savedMarkdownEnabled = await AsyncStorage.getItem(STORAGE_KEYS.MARKDOWN_ENABLED);
      if (savedMarkdownEnabled !== null) {
        setMarkdownEnabled(savedMarkdownEnabled === 'true');
      }
    } catch (error) {
      console.error('加载AI设置失败:', error);
    }
  };

  // 加载聊天历史
  const loadChatHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
      if (savedHistory) {
        setMessages(JSON.parse(savedHistory));
      } else {
        // 添加欢迎消息
        const welcomeMessage = {
          id: Date.now().toString(),
          text: '你好！我是零屿笔记的AI助手，有什么可以帮助你的吗？',
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
        await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify([welcomeMessage]));
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    }
  };

  // 保存聊天历史
  const saveChatHistory = async (newMessages) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(newMessages));
    } catch (error) {
      console.error('保存聊天历史失败:', error);
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    saveChatHistory(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      // 检查是否启用流式响应
      const streamEnabled = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_RESPONSE);
      const useStream = streamEnabled === 'true';

      // 初始化助手消息
      const assistantMessageId = (Date.now() + 1).toString();
      const initialAssistantMessage = {
        id: assistantMessageId,
        text: useStream ? '' : '...',
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        isStreaming: useStream,
      };

      // 添加初始助手消息
      const messagesWithAssistant = [...newMessages, initialAssistantMessage];
      setMessages(messagesWithAssistant);

      if (useStream) {
        // 使用流式响应
        const response = await AIAssistantModule.sendMessageStream(
          userMessage.text,
          aiEngine,
          messages.filter(msg => !msg.isError).map(msg => ({
            text: msg.text,
            sender: msg.sender,
            timestamp: msg.timestamp,
          }))
        );

        // 监听流式响应
        response.onMessage = (content, fullText) => {
          setMessages(currentMessages => {
            const updatedMessages = [...currentMessages];
            const assistantMessageIndex = updatedMessages.findIndex(msg => msg.id === assistantMessageId);

            if (assistantMessageIndex !== -1) {
              updatedMessages[assistantMessageIndex] = {
                ...updatedMessages[assistantMessageIndex],
                text: fullText,
              };
            }

            return updatedMessages;
          });
        };

        // 流式响应完成
        response.onComplete = (fullText) => {
          setMessages(currentMessages => {
            const updatedMessages = [...currentMessages];
            const assistantMessageIndex = updatedMessages.findIndex(msg => msg.id === assistantMessageId);

            if (assistantMessageIndex !== -1) {
              updatedMessages[assistantMessageIndex] = {
                ...updatedMessages[assistantMessageIndex],
                text: fullText,
                isStreaming: false,
              };
            }

            return updatedMessages;
          });

          // 保存更新后的消息历史
          setMessages(currentMessages => {
            saveChatHistory(currentMessages);
            return currentMessages;
          });

          setIsLoading(false);
        };

        // 流式响应错误
        response.onError = (error) => {
          console.error('AI助手流式响应失败:', error);

          setMessages(currentMessages => {
            const updatedMessages = [...currentMessages];
            const assistantMessageIndex = updatedMessages.findIndex(msg => msg.id === assistantMessageId);

            if (assistantMessageIndex !== -1) {
              updatedMessages[assistantMessageIndex] = {
                ...updatedMessages[assistantMessageIndex],
                text: `抱歉，我遇到了一些问题: ${error}`,
                isStreaming: false,
                isError: true,
              };
            }

            saveChatHistory(updatedMessages);
            return updatedMessages;
          });

          setIsLoading(false);
        };

        // 开始流式响应
        response.start();
      } else {
        // 使用普通响应
        const response = await AIAssistantModule.sendMessage(userMessage.text, aiEngine);

        const assistantMessage = {
          id: assistantMessageId,
          text: response.text,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };

        const updatedMessages = messagesWithAssistant.map(msg =>
          msg.id === assistantMessageId ? assistantMessage : msg
        );

        setMessages(updatedMessages);
        saveChatHistory(updatedMessages);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('AI助手响应失败:', error);
      Alert.alert('错误', `AI助手响应失败: ${error.message}`);

      // 添加错误消息
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: `抱歉，我遇到了一些问题: ${error.message}`,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        isError: true,
      };

      const updatedMessages = [...newMessages, errorMessage];
      setMessages(updatedMessages);
      saveChatHistory(updatedMessages);
      setIsLoading(false);
    }
  };

  // 清空聊天历史
  const clearChatHistory = async () => {
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
          onPress: async () => {
            // 添加欢迎消息
            const welcomeMessage = {
              id: Date.now().toString(),
              text: '你好！我是零屿笔记的AI助手，有什么可以帮助你的吗？',
              sender: 'assistant',
              timestamp: new Date().toISOString(),
            };
            setMessages([welcomeMessage]);
            await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify([welcomeMessage]));

            // 重置会话
            AIAssistantModule.resetSession();
          },
        },
      ],
      { cancelable: true }
    );
  };

  // 打开设置
  const openSettings = () => {
    navigation.navigate('AIAssistantSettings');
  };

  // 复制消息内容
  const copyMessageToClipboard = (text) => {
    Clipboard.setString(text);
    if (Platform.OS === 'android') {
      ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
    } else {
      Alert.alert('提示', '已复制到剪贴板');
    }
    setSelectedMessageId(null);
    setShowQuickActions(false);
  };

  // 分享消息
  const shareMessage = async (text) => {
    try {
      await Share.share({
        message: text,
        title: '来自零屿笔记AI助手的消息',
      });
      setSelectedMessageId(null);
      setShowQuickActions(false);
    } catch (error) {
      console.error('分享失败:', error);
      Alert.alert('错误', `分享失败: ${error.message}`);
    }
  };

  // 导出聊天记录
  const exportChatHistory = async () => {
    try {
      // 格式化聊天记录
      const formattedHistory = messages.map(msg => {
        const sender = msg.sender === 'user' ? '我' : 'AI助手';
        const time = new Date(msg.timestamp).toLocaleString();
        return `${sender} (${time}):\n${msg.text}\n\n`;
      }).join('');

      // 分享聊天记录
      await Share.share({
        message: formattedHistory,
        title: '零屿笔记AI助手聊天记录',
      });
    } catch (error) {
      console.error('导出聊天记录失败:', error);
      Alert.alert('错误', `导出聊天记录失败: ${error.message}`);
    }
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

  // 切换语音模式
  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode);
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
        // 调用后端API进行转写
        const response = await fetch(`${AIAssistantModule.getApiUrl('ai-assistant/transcribe/')}`, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
            // TODO: 添加认证头
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

  // 渲染消息项
  const renderMessageItem = ({ item }) => {
    const isUser = item.sender === 'user';
    const isSelected = selectedMessageId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => toggleQuickActions(item.id)}
        style={styles.messageWrapper}
      >
        <View
          style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
            isUser
              ? { backgroundColor: theme.colors.primary }
              : { backgroundColor: theme.colors.card },
            item.isError && { backgroundColor: '#ffdddd' },
          ]}
        >
          {markdownEnabled && !isUser && !item.isError ? (
            <Markdown
              style={{
                body: {
                  color: theme.colors.text,
                  fontSize: 16,
                  lineHeight: 22,
                },
                code_block: {
                  backgroundColor: theme.colors.card + '80',
                  padding: 8,
                  borderRadius: 4,
                },
                code_inline: {
                  backgroundColor: theme.colors.card + '80',
                  padding: 2,
                  borderRadius: 2,
                },
                link: {
                  color: theme.colors.primary,
                  textDecorationLine: 'underline',
                },
                blockquote: {
                  borderLeftWidth: 4,
                  borderLeftColor: theme.colors.primary + '80',
                  paddingLeft: 8,
                  opacity: 0.8,
                },
              }}
              onLinkPress={(url) => {
                Linking.openURL(url);
                return false;
              }}
            >
              {item.text}
            </Markdown>
          ) : (
            <Text
              style={[
                styles.messageText,
                isUser
                  ? { color: '#fff' }
                  : { color: theme.colors.text },
                item.isError && { color: '#ff0000' },
              ]}
            >
              {item.text}
            </Text>
          )}
          <Text
            style={[
              styles.timestampText,
              isUser
                ? { color: '#fff8' }
                : { color: theme.colors.text + '80' },
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </View>

        {isSelected && showQuickActions && (
          <Animated.View
            style={[styles.quickActionsContainer, { opacity: fadeAnim }]}
          >
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => copyMessageToClipboard(item.text)}
            >
              <Icon name="content-copy" size={20} color={theme.colors.primary} />
              <Text style={[styles.quickActionText, { color: theme.colors.text }]}>复制</Text>
            </TouchableOpacity>

            {!isUser && (
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => {
                  // 这里可以添加朗读文本的功能
                  Alert.alert('提示', '朗读功能即将上线');
                  setSelectedMessageId(null);
                  setShowQuickActions(false);
                }}
              >
                <Icon name="volume-up" size={20} color={theme.colors.primary} />
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>朗读</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => shareMessage(item.text)}
            >
              <Icon name="share" size={20} color={theme.colors.primary} />
              <Text style={[styles.quickActionText, { color: theme.colors.text }]}>分享</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>AI助手</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={exportChatHistory}>
            <Icon name="save-alt" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={clearChatHistory}>
            <Icon name="delete" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={openSettings}>
            <Icon name="settings" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.engineBanner}>
        <View style={[styles.engineBadge, { backgroundColor: theme.colors.primary + '20' }]}>
          <Text style={[styles.engineBadgeText, { color: theme.colors.primary }]}>
            {aiEngine === AIAssistantModule.ENGINE_LOCAL ? '本地引擎' :
             aiEngine === AIAssistantModule.ENGINE_BAIDU ? '百度文心一言' :
             aiEngine === AIAssistantModule.ENGINE_XUNFEI ? '讯飞星火' :
             aiEngine === AIAssistantModule.ENGINE_ZHIPU ? '智谱ChatGLM' : '未知引擎'}
          </Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputContainer}>
        {isVoiceMode ? (
          <TouchableOpacity
            style={[styles.voiceButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.7}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <View style={styles.transcribingContainer}>
                <ActivityIndicator color={theme.colors.primary} size="small" />
                <Text style={[styles.voiceButtonText, { color: theme.colors.text }]}>正在转写...</Text>
              </View>
            ) : (
              <>
                <Icon
                  name={isRecording ? "mic" : "mic-none"}
                  size={28}
                  color={isRecording ? "#fff" : theme.colors.text}
                />
                <Text style={[styles.voiceButtonText, { color: isRecording ? "#fff" : theme.colors.text }]}>
                  {isRecording ? `录音中 ${recordTime}` : "按住说话"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TextInput
            style={[
              styles.input,
              {
                color: theme.colors.text,
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入消息..."
            placeholderTextColor={theme.colors.text + '80'}
            multiline
          />
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.modeToggleButton}
            onPress={toggleVoiceMode}
          >
            <Icon
              name={isVoiceMode ? "keyboard" : "mic"}
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
            onPress={sendMessage}
            disabled={isLoading || (!isVoiceMode && !inputText.trim())}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Icon name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.quickSuggestions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.suggestionChip, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={() => setInputText('介绍一下你自己')}
          >
            <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>介绍一下你自己</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.suggestionChip, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={() => setInputText('零屿笔记有哪些功能？')}
          >
            <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>零屿笔记有哪些功能？</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.suggestionChip, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={() => setInputText('如何使用思维导图？')}
          >
            <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>如何使用思维导图？</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.suggestionChip, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={() => setInputText('如何切换AI模型？')}
          >
            <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>如何切换AI模型？</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
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
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  engineBanner: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  engineBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  engineBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesList: {
    padding: 16,
  },
  messageWrapper: {
    marginBottom: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignSelf: 'center',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    padding: 4,
  },
  quickActionText: {
    marginLeft: 4,
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  voiceButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  recordingButton: {
    backgroundColor: '#ff4c4c',
  },
  voiceButtonText: {
    marginLeft: 8,
    fontSize: 16,
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSuggestions: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
  },
});

export default AIAssistantScreen;
