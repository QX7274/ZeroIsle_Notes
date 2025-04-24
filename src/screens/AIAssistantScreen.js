/**
 * 现代化AI助手屏幕
 * 支持渐变背景和动画效果
 */

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
  StatusBar,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AIAssistantModule from '../native/AIAssistantModule';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import LinearGradient from 'react-native-linear-gradient';
import { SPACING, BORDER_RADIUS, SHADOW } from '../utils/constants/dimensions';
import { Card, Button } from '../components/common';

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
  const { colors, isDarkMode } = useTheme();

  // 状态管理
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

  // 引用
  const flatListRef = useRef(null);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const audioFilePath = useRef(Platform.OS === 'android' ?
    `${RNFS.CachesDirectoryPath}/audio_message.mp3` :
    `${RNFS.CachesDirectoryPath}/audio_message.m4a`).current;

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const messageFadeAnim = useRef(new Animated.Value(0)).current;

  // 渐变色
  const headerGradient = isDarkMode
    ? colors.gradients.header
    : ['#4361EE', '#4CC9F0'];
  const userMessageGradient = isDarkMode
    ? colors.gradients.primary
    : ['#4361EE', '#3A0CA3'];
  const suggestionGradient = isDarkMode
    ? ['rgba(67, 97, 238, 0.2)', 'rgba(76, 201, 240, 0.1)']
    : ['rgba(67, 97, 238, 0.1)', 'rgba(76, 201, 240, 0.05)'];

  // 加载设置和聊天历史
  useEffect(() => {
    loadSettings();
    loadChatHistory();

    // 设置状态栏
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }

    // 监听键盘显示隐藏事件
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setShowQuickActions(false);
    });

    // 启动动画
    Animated.parallel([
      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(messageFadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

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
  const renderMessageItem = ({ item, index }) => {
    const isUser = item.sender === 'user';
    const isSelected = selectedMessageId === item.id;

    // 计算动画延迟，实现列表项的交错动画
    const animDelay = index * 100;

    // 格式化时间
    const formattedTime = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <Animated.View
        style={[
          styles.messageWrapper,
          {
            opacity: messageFadeAnim,
            transform: [{
              translateY: messageFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }]
          }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => toggleQuickActions(item.id)}
          style={styles.messageTouchable}
        >
          {isUser ? (
            // 用户消息 - 使用渐变背景
            <View style={styles.userMessageWrapper}>
              <LinearGradient
                colors={userMessageGradient}
                style={[
                  styles.messageContainer,
                  styles.userMessageContainer,
                  item.isError && styles.errorMessageContainer,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.userMessageText}>
                  {item.text}
                </Text>
                <Text style={styles.userTimestampText}>
                  {formattedTime}
                </Text>
              </LinearGradient>
            </View>
          ) : (
            // 助手消息 - 使用卡片样式
            <View style={styles.assistantMessageWrapper}>
              <View style={styles.assistantAvatarContainer}>
                <LinearGradient
                  colors={headerGradient}
                  style={styles.assistantAvatar}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Icon name="smart-toy" size={16} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <View
                style={[
                  styles.messageContainer,
                  styles.assistantMessageContainer,
                  { backgroundColor: colors.cardBackground },
                  item.isError && styles.errorMessageContainer,
                ]}
              >
                {markdownEnabled && !item.isError ? (
                  <Markdown
                    style={{
                      body: {
                        color: colors.text,
                        fontSize: 16,
                        lineHeight: 22,
                      },
                      code_block: {
                        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
                        padding: 12,
                        borderRadius: BORDER_RADIUS.MEDIUM,
                        marginVertical: SPACING.SMALL,
                      },
                      code_inline: {
                        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
                        padding: 4,
                        borderRadius: BORDER_RADIUS.SMALL,
                      },
                      link: {
                        color: colors.primary,
                        textDecorationLine: 'underline',
                      },
                      blockquote: {
                        borderLeftWidth: 4,
                        borderLeftColor: colors.primary + '80',
                        paddingLeft: SPACING.MEDIUM,
                        opacity: 0.8,
                        marginVertical: SPACING.SMALL,
                      },
                      bullet_list: {
                        marginVertical: SPACING.SMALL,
                      },
                      ordered_list: {
                        marginVertical: SPACING.SMALL,
                      },
                      heading1: {
                        fontSize: 24,
                        fontWeight: 'bold',
                        marginVertical: SPACING.MEDIUM,
                        color: colors.text,
                      },
                      heading2: {
                        fontSize: 20,
                        fontWeight: 'bold',
                        marginVertical: SPACING.SMALL,
                        color: colors.text,
                      },
                      heading3: {
                        fontSize: 18,
                        fontWeight: 'bold',
                        marginVertical: SPACING.SMALL,
                        color: colors.text,
                      },
                      hr: {
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        height: 1,
                        marginVertical: SPACING.MEDIUM,
                      },
                      table: {
                        borderWidth: 1,
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                        borderRadius: BORDER_RADIUS.SMALL,
                        marginVertical: SPACING.SMALL,
                      },
                      th: {
                        padding: SPACING.SMALL,
                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      },
                      td: {
                        padding: SPACING.SMALL,
                        borderTopWidth: 1,
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
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
                      styles.assistantMessageText,
                      { color: colors.text },
                      item.isError && styles.errorMessageText,
                    ]}
                  >
                    {item.text}
                  </Text>
                )}
                <Text
                  style={[
                    styles.assistantTimestampText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {formattedTime}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {isSelected && showQuickActions && (
          <Animated.View
            style={[
              styles.quickActionsContainer,
              {
                opacity: fadeAnim,
                backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                ...SHADOW.MEDIUM
              }
            ]}
          >
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => copyMessageToClipboard(item.text)}
            >
              <Icon name="content-copy" size={20} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.text }]}>复制</Text>
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
                <Icon name="volume-up" size={20} color={colors.primary} />
                <Text style={[styles.quickActionText, { color: colors.text }]}>朗读</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => shareMessage(item.text)}
            >
              <Icon name="share" size={20} color={colors.primary} />
              <Text style={[styles.quickActionText, { color: colors.text }]}>分享</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* 渐变背景 */}
      <LinearGradient
        colors={isDarkMode ? ['#121212', '#1E1E1E'] : ['#F8F9FA', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* 渐变头部 */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: headerFadeAnim,
            transform: [{ translateY: headerSlideAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={headerGradient}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>AI助手</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={exportChatHistory}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Icon name="save-alt" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={clearChatHistory}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Icon name="delete" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={openSettings}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Icon name="settings" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.engineBanner}>
            <View style={styles.engineBadge}>
              <Icon
                name={
                  aiEngine === AIAssistantModule.ENGINE_LOCAL ? 'memory' :
                  aiEngine === AIAssistantModule.ENGINE_BAIDU ? 'psychology' :
                  aiEngine === AIAssistantModule.ENGINE_XUNFEI ? 'bolt' :
                  aiEngine === AIAssistantModule.ENGINE_ZHIPU ? 'smart-toy' : 'help'
                }
                size={14}
                color="#FFFFFF"
                style={styles.engineIcon}
              />
              <Text style={styles.engineBadgeText}>
                {aiEngine === AIAssistantModule.ENGINE_LOCAL ? '本地引擎' :
                 aiEngine === AIAssistantModule.ENGINE_BAIDU ? '百度文心一言' :
                 aiEngine === AIAssistantModule.ENGINE_XUNFEI ? '讯飞星火' :
                 aiEngine === AIAssistantModule.ENGINE_ZHIPU ? '智谱ChatGLM' : '未知引擎'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* 消息列表 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* 输入区域 */}
      <View style={[
        styles.inputContainer,
        { borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
      ]}>
        {isVoiceMode ? (
          // 语音输入模式
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isRecording && styles.recordingButton,
              { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.7}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <View style={styles.transcribingContainer}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.voiceButtonText, { color: colors.text }]}>正在转写...</Text>
              </View>
            ) : (
              <>
                <Icon
                  name={isRecording ? "mic" : "mic-none"}
                  size={28}
                  color={isRecording ? "#FFFFFF" : colors.text}
                />
                <Text style={[
                  styles.voiceButtonText,
                  { color: isRecording ? "#FFFFFF" : colors.text }
                ]}>
                  {isRecording ? `录音中 ${recordTime}` : "按住说话"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          // 文本输入模式
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: 'transparent',
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="输入消息..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.modeToggleButton,
              { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }
            ]}
            onPress={toggleVoiceMode}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Icon
              name={isVoiceMode ? "keyboard" : "mic"}
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              isLoading || (!isVoiceMode && !inputText.trim())
                ? { opacity: 0.5 }
                : { opacity: 1 }
            ]}
            onPress={sendMessage}
            disabled={isLoading || (!isVoiceMode && !inputText.trim())}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <LinearGradient
              colors={colors.gradients.primary}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              borderRadius={22}
            />
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Icon name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 快速建议 */}
      <View style={[
        styles.quickSuggestions,
        { borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }
      ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionScrollContent}
        >
          {[
            '介绍一下你自己',
            '零屿笔记有哪些功能？',
            '如何使用思维导图？',
            '如何切换AI模型？',
            '写一篇短文',
            '帮我分析一个问题'
          ].map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionChip}
              onPress={() => setInputText(suggestion)}
            >
              <LinearGradient
                colors={suggestionGradient}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                borderRadius={16}
              />
              <Text style={[styles.suggestionText, { color: colors.primary }]}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // 基础容器样式
  container: {
    flex: 1,
  },

  // 头部样式
  headerContainer: {
    width: '100%',
    overflow: 'hidden',
    ...SHADOW.MEDIUM,
  },
  header: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.MEDIUM,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: SPACING.LARGE,
  },

  // 引擎标签样式
  engineBanner: {
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.LARGE,
    alignItems: 'center',
  },
  engineBadge: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.TINY,
    borderRadius: BORDER_RADIUS.ROUND,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  engineIcon: {
    marginRight: SPACING.TINY,
  },
  engineBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  // 消息列表样式
  messagesList: {
    padding: SPACING.LARGE,
    paddingBottom: SPACING.XXLARGE,
  },
  messageWrapper: {
    marginBottom: SPACING.MEDIUM,
  },
  messageTouchable: {
    width: '100%',
  },

  // 用户消息样式
  userMessageWrapper: {
    alignItems: 'flex-end',
    width: '100%',
  },
  messageContainer: {
    maxWidth: '80%',
    padding: SPACING.MEDIUM,
    borderRadius: BORDER_RADIUS.LARGE,
    ...SHADOW.SMALL,
  },
  userMessageContainer: {
    borderBottomRightRadius: BORDER_RADIUS.SMALL,
  },
  userMessageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  userTimestampText: {
    fontSize: 10,
    marginTop: SPACING.SMALL,
    alignSelf: 'flex-end',
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // 助手消息样式
  assistantMessageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  assistantAvatarContainer: {
    marginRight: SPACING.SMALL,
    marginTop: SPACING.SMALL,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assistantMessageContainer: {
    borderBottomLeftRadius: BORDER_RADIUS.SMALL,
  },
  assistantMessageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  assistantTimestampText: {
    fontSize: 10,
    marginTop: SPACING.SMALL,
    alignSelf: 'flex-end',
  },

  // 错误消息样式
  errorMessageContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  errorMessageText: {
    color: '#FF3B30',
  },

  // 快捷操作样式
  quickActionsContainer: {
    flexDirection: 'row',
    marginTop: SPACING.SMALL,
    marginBottom: SPACING.MEDIUM,
    padding: SPACING.MEDIUM,
    borderRadius: BORDER_RADIUS.LARGE,
    alignSelf: 'center',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.MEDIUM,
    padding: SPACING.SMALL,
  },
  quickActionText: {
    marginLeft: SPACING.SMALL,
    fontSize: 14,
  },

  // 输入区域样式
  inputContainer: {
    flexDirection: 'row',
    padding: SPACING.MEDIUM,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.ROUND,
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.MEDIUM,
    maxHeight: 100,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.SMALL,
  },
  modeToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.SMALL,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // 语音输入样式
  voiceButton: {
    flex: 1,
    height: 50,
    borderRadius: BORDER_RADIUS.ROUND,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  voiceButtonText: {
    marginLeft: SPACING.MEDIUM,
    fontSize: 16,
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 快速建议样式
  quickSuggestions: {
    paddingVertical: SPACING.MEDIUM,
    borderTopWidth: 1,
  },
  suggestionScrollContent: {
    paddingHorizontal: SPACING.LARGE,
  },
  suggestionChip: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    borderRadius: BORDER_RADIUS.ROUND,
    marginRight: SPACING.MEDIUM,
    overflow: 'hidden',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AIAssistantScreen;
