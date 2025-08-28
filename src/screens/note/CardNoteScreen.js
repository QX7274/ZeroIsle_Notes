import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Voice from '@react-native-voice/voice';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { updateNote } from '../../redux/slices/notesSlice';
import { offlineStorageService } from '../../services/offline';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import CheckboxTextInput from '../../components/note/CheckboxTextInput';
import Icon from 'react-native-vector-icons/MaterialIcons';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import FileHistoryNavigation from '../../components/viewer/FileHistoryNavigation';

/**
 * 卡片笔记屏幕
 * 类似备忘录的简单文本编辑界面
 * 支持语音转文字、会议纪要等功能
 */
const CardNoteScreen = ({ route, navigation }) => {
  const { noteId, title: initialTitle = '新建笔记', content: initialContent = '' } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();

  
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [wordCount, setWordCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [audioFiles, setAudioFiles] = useState([]);

  const contentInputRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const audioRecorderPlayer = useRef(null);
  
  // 在组件挂载时初始化 AudioRecorderPlayer
  useEffect(() => {
    try {
      // 检查 AudioRecorderPlayer 是否可用
      if (AudioRecorderPlayer) {
        audioRecorderPlayer.current = new AudioRecorderPlayer();
        console.log('AudioRecorderPlayer初始化成功');
      } else {
        console.warn('AudioRecorderPlayer模块不可用');
      }
    } catch (error) {
      console.warn('AudioRecorderPlayer初始化失败:', error);
    }

    return () => {
      // 组件卸载时清理资源
      if (audioRecorderPlayer.current) {
        try {
          audioRecorderPlayer.current.removeRecordBackListener();
          audioRecorderPlayer.current.removePlayBackListener();
        } catch (error) {
          console.warn('清理AudioRecorderPlayer失败:', error);
        }
      }
    };
  }, []);

  // 组件加载时恢复笔记数据
  useEffect(() => {
    const loadNote = async () => {
      if (noteId) {
        try {
          console.log('CardNoteScreen: 尝试加载笔记:', noteId);
          const savedNote = await offlineStorageService.getNote(noteId);
          if (savedNote) {
            console.log('CardNoteScreen: 成功加载笔记:', savedNote);
            setTitle(savedNote.title || '无标题');
            setContent(savedNote.content || '');
            setWordCount(savedNote.word_count || 0);
          } else {
            console.log('CardNoteScreen: 未找到保存的笔记，使用初始值');
          }
        } catch (error) {
          console.error('CardNoteScreen: 加载笔记失败:', error);
        }
      }
    };

    loadNote();
  }, [noteId]);

  useEffect(() => {
    // 计算字数
    const count = content.replace(/\s/g, '').length;
    setWordCount(count);

    // 自动保存（仅在有实际内容时）
    const hasRealContent = content.trim().length > 5 && title.trim().length > 0;

    if (hasRealContent) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        saveNote();
      }, 5000); // 5秒后自动保存，避免频繁保存
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content]);

  // 添加到文件历史（进入页面或标题变化时）
  useEffect(() => {
    try {
      const fileHistoryService = require('../../services/fileHistoryService').default;
      const effectiveTitle = (title || initialTitle || '卡片笔记').trim();
      if ((noteId || effectiveTitle) && effectiveTitle && fileHistoryService && fileHistoryService.addFile) {
        fileHistoryService.addFile({
          uri: noteId || effectiveTitle,
          title: effectiveTitle,
          type: 'card',
          noteType: 'card',
          fileName: effectiveTitle,
          noteId: noteId
        });
      }
    } catch (e) {
      // 静默处理，不影响主功能
    }
  }, [noteId, title]);

  // 初始化语音识别
  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = (error) => {
      console.error('语音识别错误:', error);
      setIsListening(false);
    };
    Voice.onSpeechResults = (result) => {
      if (result.value && result.value.length > 0) {
        const recognizedText = result.value[0];
        setRecognizedText(recognizedText);

        // 自动插入识别的文字到笔记中
        if (recognizedText.trim()) {
          Alert.alert(
            '语音识别完成',
            `识别结果: "${recognizedText}"\n\n是否插入到笔记中？`,
            [
              { text: '取消', style: 'cancel' },
              {
                text: '插入',
                onPress: () => {
                  const timestamp = new Date().toLocaleString();
                  const textToInsert = `\n\n[🎤 语音转文字 - ${timestamp}]\n${recognizedText}\n\n`;
                  setContent(prev => prev + textToInsert);
                  setRecognizedText('');
                }
              }
            ]
          );
        }
      }
    };
    Voice.onSpeechPartialResults = (result) => {
      if (result.value && result.value.length > 0) {
        setRecognizedText(result.value[0]);
      }
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const saveNote = async () => {
    try {
      // 如果没有实际内容，不保存
      if (content.trim().length < 5) {
        return { success: true };
      }

      const currentNoteId = noteId || `card_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      // 确保有标题
      const finalTitle = title.trim() || `卡片笔记_${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}_${new Date().getHours().toString().padStart(2,'0')}${new Date().getMinutes().toString().padStart(2,'0')}`;

      const noteData = {
        _id: currentNoteId,
        id: currentNoteId,
        title: finalTitle,
        content,
        type: 'card',
        noteType: 'card', // 添加noteType字段
        file_type: 'card',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        word_count: wordCount,
        is_deleted: false,
        is_synced: false,
        is_offline: true, // 标记为离线笔记
        user_id: 'current_user'
      };

      await offlineStorageService.saveNote(noteData);
      try {
        if (dispatch) {
          dispatch(updateNote(noteData));
        }
      } catch (reduxError) {
        console.warn('Redux更新失败:', reduxError);
        // Redux失败不影响保存功能
      }
      return { success: true };
    } catch (error) {
      console.error('保存失败:', error.message);
      throw error;
    }
  };

  // 请求录音权限
  const requestRecordPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '录音权限',
            message: '需要录音权限来使用语音功能',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const hasPermission = await requestRecordPermission();
      if (!hasPermission) {
        Alert.alert('权限不足', '需要录音权限才能使用语音功能');
        return;
      }

      const path = Platform.select({
        ios: 'voice_recording.m4a',
        android: 'sdcard/voice_recording.mp4',
      });

      if (!audioRecorderPlayer.current) {
        Alert.alert('错误', '录音器未初始化');
        return;
      }

      await audioRecorderPlayer.current.startRecorder(path);
      setIsRecording(true);
      setRecordTime('00:00');

      audioRecorderPlayer.current.addRecordBackListener((e) => {
        const minutes = Math.floor(e.currentPosition / 60000);
        const seconds = Math.floor((e.currentPosition % 60000) / 1000);
        setRecordTime(
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      });
    } catch (error) {
      console.error('开始录音失败:', error);
      Alert.alert('错误', '开始录音失败，请重试');
    }
  };

  // 停止录音
  const stopRecording = async () => {
    try {
      if (!audioRecorderPlayer.current) {
        setIsRecording(false);
        return;
      }

      const result = await audioRecorderPlayer.current.stopRecorder();
      audioRecorderPlayer.current.removeRecordBackListener();
      setIsRecording(false);
      setRecordTime('00:00');

      if (result) {
        // 保存录音文件信息
        const audioFile = {
          path: result,
          duration: recordTime,
          timestamp: new Date().toLocaleString()
        };
        setAudioFiles(prev => [...prev, audioFile]);

        Alert.alert(
          '录音完成',
          `录音时长: ${recordTime}\n请选择操作`,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '插入录音',
              onPress: () => {
                const timestamp = new Date().toLocaleString();
                const audioId = `audio_${Date.now()}`;
                const placeholder = `\n\n[🎵 语音录音 - ${timestamp}]\n录音时长: ${recordTime}\n音频ID: ${audioId}\n[点击播放录音]\n\n`;
                setContent(prev => prev + placeholder);

                // 保存音频文件映射
                setAudioFiles(prev => [...prev, { id: audioId, path: result, duration: recordTime }]);
              }
            },
            {
              text: '转为文字',
              onPress: async () => {
                Alert.alert(
                  '语音转文字',
                  '请重新说一遍内容，系统将自动识别并转换为文字',
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '开始识别',
                      onPress: () => startSpeechRecognition()
                    }
                  ]
                );
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('停止录音失败:', error);
      Alert.alert('错误', '停止录音失败');
      setIsRecording(false);
    }
  };

  // 开始语音识别
  const startSpeechRecognition = async () => {
    try {
      const hasPermission = await requestRecordPermission();
      if (!hasPermission) {
        Alert.alert('权限不足', '需要录音权限才能使用语音识别功能');
        return;
      }

      setRecognizedText('');
      await Voice.start('zh-CN'); // 使用中文识别
    } catch (error) {
      console.error('开始语音识别失败:', error);
      Alert.alert('错误', '开始语音识别失败，请重试');
    }
  };

  // 停止语音识别
  const stopSpeechRecognition = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (error) {
      console.error('停止语音识别失败:', error);
    }
  };

  // 播放录音文件
  const playAudio = async (filePath) => {
    try {
      if (!audioRecorderPlayer.current) {
        Alert.alert('错误', '播放器未初始化');
        return;
      }

      await audioRecorderPlayer.current.startPlayer(filePath);
      audioRecorderPlayer.current.addPlayBackListener((e) => {
        if (e.currentPosition === e.duration) {
          if (audioRecorderPlayer.current) {
            audioRecorderPlayer.current.stopPlayer();
            audioRecorderPlayer.current.removePlayBackListener();
          }
        }
      });
    } catch (error) {
      console.error('播放录音失败:', error);
      Alert.alert('错误', '播放录音失败');
    }
  };

  // 主语音按钮处理函数
  const handleVoiceAction = () => {
    Alert.alert(
      '语音功能',
      '请选择语音功能类型',
      [
        {
          text: '录音',
          onPress: () => {
            if (isRecording) {
              stopRecording();
            } else {
              startRecording();
            }
          }
        },
        {
          text: '语音转文字',
          onPress: () => {
            if (isListening) {
              stopSpeechRecognition();
            } else {
              startSpeechRecognition();
            }
          }
        },
        {
          text: '取消',
          style: 'cancel'
        }
      ]
    );
  };











  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ViewerLayout
        colors={colors}
        title={title}
        noteId={noteId}
        navigation={navigation}
        showHistoryNavigation={true}
        historyNavigationHeight={20}
        contentStyle={{ paddingTop: 0 }}
        onBack={() => {
          saveNote();
          navigation.goBack();
        }}
        showToolbar={true}
        headerLeft={
          <BackButton
            onPress={() => {
              saveNote();
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Home');
              }
            }}
            color={colors.primary}
            background={colors.primary + '20'}
          />
        }
        headerRight={
          <View style={styles.headerRight}>
            <SaveButton
              onSave={saveNote}
              text="保存"
              showSuccessToast={true}
              showErrorAlert={true}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            />
            <Text style={[styles.wordCount, { color: colors.onSurface }]}>
              {wordCount}字
            </Text>
          </View>
        }
      >
        {/* 文件历史导航 */}
        <FileHistoryNavigation />

        <View style={styles.content}>
          {/* 标题输入 */}
          <TextInput
            style={[styles.titleInput, {
              color: colors.onSurface,
              borderBottomColor: colors.outline
            }]}
            value={title}
            onChangeText={setTitle}
            placeholder="输入标题..."
            placeholderTextColor={colors.onSurfaceVariant}
            fontSize={20}
            fontWeight="bold"
            multiline={false}
            returnKeyType="next"
            onSubmitEditing={() => contentInputRef.current?.focus()}
          />

          {/* 内容输入 */}
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <CheckboxTextInput
              ref={contentInputRef}
              value={content}
              onChangeText={setContent}
              placeholder="开始输入内容..."
              style={[styles.contentInput, {
                color: colors.onSurface
              }]}
              multiline
            />

            {/* 音频播放提示 */}
            {audioFiles.length > 0 && (
              <TouchableOpacity
                style={[styles.audioHint, { backgroundColor: colors.primaryContainer }]}
                onPress={() => {
                  Alert.alert(
                    '音频文件管理',
                    `共有 ${audioFiles.length} 个录音文件`,
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '播放最新录音',
                        onPress: () => {
                          const latestAudio = audioFiles[audioFiles.length - 1];
                          if (latestAudio) {
                            playAudio(latestAudio.path);
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Icon name="audiotrack" size={16} color={colors.onPrimaryContainer} />
                <Text style={[styles.audioHintText, { color: colors.onPrimaryContainer }]}>
                  {audioFiles.length} 个录音文件
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* 右下角语音按钮 */}
        <TouchableOpacity
          style={[
            styles.voiceButton,
            {
              backgroundColor: isRecording ? colors.error : colors.primary
            }
          ]}
          onPress={handleVoiceAction}
        >
          <Icon
            name={isRecording ? "stop" : isListening ? "mic-outline" : "mic"}
            size={16}
            color={colors.onPrimary}
          />
          <Text style={[styles.voiceButtonText, { color: colors.onPrimary }]}>
            {isRecording ? recordTime : isListening ? '识别中...' : '语音'}
          </Text>
        </TouchableOpacity>

        {/* 语音识别状态显示 */}
        {isListening && (
          <View style={[styles.recognitionStatus, { backgroundColor: colors.surface }]}>
            <Text style={[styles.recognitionText, { color: colors.onSurface }]}>
              🎤 正在识别语音...
            </Text>
            {recognizedText ? (
              <Text style={[styles.recognizedText, { color: colors.primary }]}>
                "{recognizedText}"
              </Text>
            ) : null}
          </View>
        )}
      </ViewerLayout>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 8, // 减少顶部间距，使其紧贴文件历史导航
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  saveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginRight: 4,
    minHeight: 24,
  },
  wordCount: {
    fontSize: 11,
    opacity: 0.8,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    marginBottom: 0,
    borderRadius: 8,
  },
  contentScroll: {
    flex: 1,
    marginTop: 0,
  },
  contentInput: {
    fontSize: 17,
    lineHeight: 26,
    textAlignVertical: 'top',
    paddingVertical: 16,
    paddingHorizontal: 0,
    minHeight: 400,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'Roboto',
  },
  voiceButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recognitionStatus: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  recognitionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  recognizedText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  audioHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginTop: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  audioHintText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default CardNoteScreen;