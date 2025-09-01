import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  PermissionsAndroid,
  Keyboard
} from 'react-native';
import Voice from '@react-native-voice/voice';
import nativeAudioService from '../../services/audio/nativeAudioService';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { addNote, updateOneNote } from '../../redux/slices/notesSlice';
import { offlineStorageService } from '../../services/offline';
import ViewerLayout from '../../components/viewer/ViewerLayout';
// 删除复杂的组件，使用简单的TextInput
import Icon from 'react-native-vector-icons/MaterialIcons';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';

/**
 * 卡片笔记屏幕
 * 类似备忘录的简单文本编辑界面
 * 支持语音转文字、会议纪要等功能
 */
const CardNoteScreen = ({ route, navigation }) => {
  const { noteId, title: initialTitle = '新建笔记', content: initialContent = '' } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const notesEntities = useSelector(state => state.notes.entities);

  
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [wordCount, setWordCount] = useState(0);
  // 删除卡片类型相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [audioFiles, setAudioFiles] = useState([]);
  const [isVoicePaused, setIsVoicePaused] = useState(false);
  const [partialText, setPartialText] = useState(''); // 实时显示的部分识别结果
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentRecordingPath, setCurrentRecordingPath] = useState('');
  const [noteCreated, setNoteCreated] = useState(false); // 跟踪笔记是否已创建

  const contentInputRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);
  
  // 添加键盘状态监听
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // 缓存语音按钮文本，减少重新渲染
  const voiceButtonText = useMemo(() => {
    if (isRecording) {
      // 只在录音状态下显示时间，避免频繁更新
      return recordTime || '录音中...';
    } else if (isListening) {
      return '识别中...';
    } else {
      return '语音';
    }
  }, [isRecording, isListening, recordTime]);
  
  // 缓存语音按钮图标名称
  const voiceButtonIcon = useMemo(() => {
    if (isRecording) {
      return "stop";
    } else if (isListening) {
      return "hearing";
    } else {
      return "keyboard-voice";
    }
  }, [isRecording, isListening]);
  
  // 初始化音频服务
  useEffect(() => {
    let isMounted = true;
    
    // 添加音频事件监听器
    const recordingProgressListener = (data) => {
      if (isMounted && data.formattedTime !== recordTime) {
        // 使用 requestAnimationFrame 来节流更新，减少闪烁
        requestAnimationFrame(() => {
          if (isMounted) {
            setRecordTime(data.formattedTime);
          }
        });
      }
    };

    const speechPartialResultsListener = (e) => {
      if (isMounted && e.value && e.value.length > 0) {
        const partialResult = e.value[0];
        setPartialText(partialResult);
      }
    };

    const speechResultsListener = (e) => {
      if (isMounted && e.value && e.value.length > 0) {
        const finalText = e.value[0];
        setRecognizedText(finalText);

        // 实时写入文件内容
        const timestamp = new Date().toLocaleString();
        const textToInsert = `${finalText} `;
        setContent(prev => prev + textToInsert);

        setPartialText(''); // 清除部分结果
        setIsListening(false);
      }
    };

    const speechErrorListener = (e) => {
      if (isMounted) {
        console.error('语音识别错误:', e);
        setIsListening(false);
        setPartialText('');
        Alert.alert('语音识别失败', '请重试或检查网络连接');
      }
    };

    // 注册监听器
    nativeAudioService.addListener('recordingProgress', recordingProgressListener);
    nativeAudioService.addListener('speechPartialResults', speechPartialResultsListener);
    nativeAudioService.addListener('speechResults', speechResultsListener);
    nativeAudioService.addListener('speechError', speechErrorListener);

    return () => {
      isMounted = false;
      // 清理监听器
      nativeAudioService.removeListener('recordingProgress', recordingProgressListener);
      nativeAudioService.removeListener('speechPartialResults', speechPartialResultsListener);
      nativeAudioService.removeListener('speechResults', speechResultsListener);
      nativeAudioService.removeListener('speechError', speechErrorListener);
      // 清理资源
      nativeAudioService.destroy();
    };
  }, []); // 移除 recordTime 依赖项，避免频繁重新注册监听器

  // 组件加载时恢复笔记数据
  useEffect(() => {
    let isMounted = true;
    
    const loadNote = async () => {
      try {
        if (noteId) {
          console.log('CardNoteScreen: 尝试加载现有笔记:', noteId);
          
          // 尝试从离线存储加载笔记
          const existingNote = await offlineStorageService.getNote(noteId);
          
          if (isMounted && existingNote) {
            console.log('CardNoteScreen: 找到现有笔记:', existingNote.title);
            setTitle(existingNote.title || initialTitle);
            setContent(existingNote.content || initialContent);
            setWordCount(existingNote.word_count || 0);
            setNoteCreated(true); // 标记笔记已存在
            
            // 恢复其他状态
            if (existingNote.audioFiles) {
              setAudioFiles(existingNote.audioFiles);
            }
            
            console.log('CardNoteScreen: 笔记数据恢复完成');
          } else if (isMounted) {
            console.log('CardNoteScreen: 未找到笔记:', noteId);
            // 如果找不到笔记，检查是否应该创建新的
            if (route.params?.createNew || route.params?.isNew) {
              console.log('CardNoteScreen: 明确要求创建新笔记');
              await createNewNote();
            } else {
              console.log('CardNoteScreen: 未明确要求创建新笔记，保持空白状态');
              // 保持初始状态，不创建新笔记
            }
          }
        } else if (isMounted) {
          console.log('CardNoteScreen: 没有noteId，检查是否需要创建新笔记');
          // 只有在明确指定创建新笔记时才创建
          if (route.params?.createNew || route.params?.isNew) {
            console.log('CardNoteScreen: 明确要求创建新笔记');
            await createNewNote();
          } else {
            console.log('CardNoteScreen: 未明确要求创建新笔记，保持空白状态');
            // 保持初始状态，不创建新笔记
          }
        }
      } catch (error) {
        console.error('CardNoteScreen: 加载笔记失败:', error);
        // 即使加载失败，也不自动创建新笔记
        if (isMounted) {
          Alert.alert('错误', '加载笔记失败，请重试');
        }
      }
    };

    loadNote();
    
    return () => {
      isMounted = false;
    };
  }, [noteId, initialTitle, initialContent, route.params?.createNew, route.params?.isNew]);

  // 监听键盘状态
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // 创建新笔记
  const createNewNote = async () => {
    try {
      // 检查是否已经创建过笔记，避免重复创建
      if (noteCreated) {
        console.log('CardNoteScreen: 笔记已创建，跳过重复创建');
        return;
      }
      
      // 优先使用传入的noteId，如果没有则生成新的
      const newNoteId = noteId || `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('CardNoteScreen: 创建新笔记，ID:', newNoteId, '使用传入ID:', !!noteId, '传入ID:', noteId);
      
      const newNote = {
        _id: newNoteId,
        id: newNoteId,
        title: title || initialTitle || '新建笔记',
        content: initialContent || '',
        type: 'card',
        noteType: 'card',
        file_type: 'card',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        word_count: 0,
        is_deleted: false,
        is_synced: false,
        is_offline: true,
        user_id: 'current_user',
        // 添加文件URI用于识别
        file_uri: `card://${newNoteId}`,
        uri: `card://${newNoteId}`
      };

      // 保存到离线存储
      const saveResult = await offlineStorageService.saveNote(newNote);
      
      if (saveResult.success) {
        // 更新Redux store
        if (dispatch) {
          dispatch(addNote(newNote));
        }
        
        console.log('CardNoteScreen: 新笔记创建成功');
        
        // 更新本地状态
        setTitle(newNote.title);
        setContent(newNote.content);
        setWordCount(newNote.word_count);
        setNoteCreated(true); // 标记笔记已创建
        
        // 重要：更新noteId，确保后续保存使用正确的ID
        // 由于noteId是从route.params来的，我们需要通过navigation.setParams来更新
        if (navigation && navigation.setParams) {
          navigation.setParams({ noteId: newNoteId });
        }
      } else {
        throw new Error('保存新笔记失败');
      }
      
    } catch (error) {
      console.error('CardNoteScreen: 创建新笔记失败:', error);
      throw error;
    }
  };

  useEffect(() => {
    // 计算字数
    const count = content.replace(/\s/g, '').length;
    setWordCount(count);

    // 自动保存（仅在有实际内容且不是初始状态时）
    const hasRealContent = content.trim().length > 10 && title.trim().length > 0;
    const isNotInitialState = content.trim() !== '' || title.trim() !== (initialTitle || '');

    if (hasRealContent && isNotInitialState && noteId) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        saveNote();
      }, 8000); // 8秒后自动保存，给用户更多时间输入
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content, noteId, initialTitle]);

  // 添加到文件历史（进入页面或标题变化时）
  useEffect(() => {
    let isMounted = true;
    
    try {
      const fileHistoryService = require('../../services/fileHistoryService').default;
      const effectiveTitle = (title || initialTitle || '卡片笔记').trim();
      if (isMounted && (noteId || effectiveTitle) && effectiveTitle && fileHistoryService && fileHistoryService.addFile) {
        console.log('CardNoteScreen: 添加到文件历史记录:', { noteId, effectiveTitle });
        fileHistoryService.addFile({
          uri: noteId || effectiveTitle,
          title: effectiveTitle,
          type: 'card',
          noteType: 'card',
          fileName: title || initialTitle || '新建笔记',
          noteId: noteId
        });
      } else {
        console.log('CardNoteScreen: 跳过添加到文件历史记录:', { 
          isMounted, 
          noteId, 
          effectiveTitle, 
          hasFileHistoryService: !!fileHistoryService,
          hasAddFile: !!(fileHistoryService && fileHistoryService.addFile)
        });
      }
    } catch (e) {
      console.error('CardNoteScreen: 添加到文件历史记录失败:', e);
    }
    
    return () => {
      isMounted = false;
    };
  }, [noteId, title]);

  // 组件卸载时的清理函数
  useEffect(() => {
    return () => {
      // 清理所有定时器
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      // 停止录音和语音识别
      if (isRecording) {
        stopRecording();
      }
      if (isListening) {
        stopSpeechRecognition();
      }
      
      // 保存当前笔记 - 只有在有noteId且有内容时才保存，避免创建重复笔记
      if (noteId && (title.trim() || content.trim())) {
        saveNote().catch(err => console.warn('组件卸载时保存笔记失败:', err));
      }
      // 移除没有noteId时的保存逻辑，避免创建重复笔记
    };
  }, []);

  // 初始化语音识别
  useEffect(() => {
    let isMounted = true;
    
    Voice.onSpeechStart = () => {
      if (isMounted) setIsListening(true);
    };
    Voice.onSpeechEnd = () => {
      if (isMounted) setIsListening(false);
    };
    Voice.onSpeechError = (error) => {
      console.error('语音识别错误:', error);
      if (isMounted) setIsListening(false);
    };
    Voice.onSpeechResults = (result) => {
      if (isMounted && result.value && result.value.length > 0) {
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
      if (isMounted && result.value && result.value.length > 0) {
        setRecognizedText(result.value[0]);
      }
    };

    return () => {
      isMounted = false;
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const saveNote = async () => {
    try {
      // 如果没有实际内容，不保存
      if (content.trim().length < 5 && title.trim().length < 2) {
        return { success: true };
      }

      // 如果没有noteId，不保存，避免创建重复笔记
      let currentNoteId = noteId;
      if (!currentNoteId) {
        console.log('CardNoteScreen: 没有noteId，跳过保存，避免创建重复笔记');
        return { success: false, error: 'No noteId available' };
      }

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
        user_id: 'current_user',
        // 确保有文件URI
        file_uri: `card://${currentNoteId}`,
        uri: `card://${currentNoteId}`
      };

      const result = await offlineStorageService.saveNote(noteData);
      
      if (result.success) {
        // 使用保存后返回的笔记数据，确保ID字段一致
        const savedNote = result.note || noteData;
        
        // 确保ID字段一致
        const finalNote = {
          ...savedNote,
          id: savedNote.id || savedNote._id || currentNoteId,
          _id: savedNote._id || savedNote.id || currentNoteId,
          file_uri: savedNote.file_uri || `card://${savedNote.id || savedNote._id || currentNoteId}`,
          uri: savedNote.uri || `card://${savedNote.id || savedNote._id || currentNoteId}`,
          // 确保所有必要字段都是正确的类型
          type: 'card',
          noteType: 'card',
          file_type: 'card',
          title: finalTitle,
          content: content,
          word_count: wordCount,
          created_at: savedNote.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
          is_synced: false,
          is_offline: true,
          user_id: 'current_user'
        };
        
        try {
          if (dispatch) {
            // 检查笔记是否已存在于Redux状态中
            const existingNote = notesEntities[finalNote.id];
            
            if (existingNote) {
              // 如果笔记已存在，使用updateOneNote（同步action）
              dispatch(updateOneNote({
                id: finalNote.id,
                changes: finalNote
              }));
            } else {
              // 如果是新笔记，使用addNote
              dispatch(addNote(finalNote));
            }
          }
        } catch (reduxError) {
          console.warn('Redux更新失败:', reduxError);
          // Redux失败不影响保存功能
        }
        
        // 如果noteId是新创建的，更新路由参数
        if (!noteId && currentNoteId) {
          if (navigation && navigation.setParams) {
            navigation.setParams({ noteId: currentNoteId });
          }
        }
        
        console.log('卡片笔记保存成功:', finalNote.id);
        console.log('保存的笔记数据:', {
          id: finalNote.id,
          title: finalNote.title,
          type: finalNote.type,
          noteType: finalNote.noteType,
          file_type: finalNote.file_type
        });
        return { success: true, note: finalNote };
      } else {
        throw new Error('保存失败');
      }
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
      const recordingPath = await nativeAudioService.startRecording({
        fileName: `card_note_${Date.now()}`
      });

      setIsRecording(true);
      setRecordingDuration(0);
      setCurrentRecordingPath(recordingPath);

      // 开始计时 - 使用更高效的计时方式，减少更新频率
      let startTime = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        // 使用 requestAnimationFrame 来节流更新
        requestAnimationFrame(() => {
          setRecordingDuration(elapsed);
        });
      }, 1000);

      // 保存计时器引用
      recordingTimerRef.current = timer;

      console.log('开始录音:', recordingPath);
    } catch (error) {
      console.error('开始录音失败:', error);
      Alert.alert('错误', '开始录音失败: ' + error.message);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    try {
      // 清除计时器
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const result = await nativeAudioService.stopRecording();
      setIsRecording(false);

      if (result && result.path) {
        // 创建音频文件对象
        const audioFile = {
          id: Date.now().toString(),
          path: result.path,
          duration: recordingDuration,
          timestamp: new Date().toLocaleString(),
          name: `录音_${new Date().toLocaleTimeString()}`
        };
        setAudioFiles(prev => [...prev, audioFile]);

        Alert.alert(
          '录音完成',
          `录音时长: ${formatDuration(recordingDuration)}\n请选择操作`,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '插入录音',
              onPress: () => {
                // 在内容中插入音频引用
                const audioReference = `\n\n[🎵 ${audioFile.name} - ${formatDuration(recordingDuration)}]\n[点击播放录音]\n\n`;
                setContent(prev => prev + audioReference);

                console.log('录音已插入到笔记中:', audioFile);
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
      setIsListening(true);
      setRecognizedText('');
      await nativeAudioService.startSpeechToText('zh-CN');
    } catch (error) {
      console.error('开始语音识别失败:', error);
      setIsListening(false);
      Alert.alert('错误', '开始语音识别失败: ' + error.message);
    }
  };

  // 停止语音识别
  const stopSpeechRecognition = async () => {
    try {
      await nativeAudioService.stopSpeechToText();
      setIsListening(false);
    } catch (error) {
      console.error('停止语音识别失败:', error);
      setIsListening(false);
    }
  };

  // 播放录音文件
  const playAudio = async (filePath) => {
    try {
      await nativeAudioService.playAudio(filePath);
    } catch (error) {
      console.error('播放录音失败:', error);
      Alert.alert('错误', '播放录音失败: ' + error.message);
    }
  };

  // 暂停语音识别
  const pauseVoiceRecognition = () => {
    setIsVoicePaused(true);
  };

  // 恢复语音识别
  const resumeVoiceRecognition = () => {
    setIsVoicePaused(false);
  };

  // 格式化录音时间
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 删除重复的播放录音函数

  // 主语音按钮处理函数
  const handleVoiceAction = () => {
    // 立即隐藏键盘，确保语音按钮可见
    Keyboard.dismiss();
    
    // 添加一个小延迟，确保键盘完全隐藏
    setTimeout(() => {
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
                if (isVoicePaused) {
                  resumeVoiceRecognition();
                } else {
                  Alert.alert(
                    '语音识别中',
                    '请选择操作',
                    [
                      {
                        text: '暂停',
                        onPress: pauseVoiceRecognition
                      },
                      {
                        text: '停止',
                        onPress: stopSpeechRecognition,
                        style: 'destructive'
                      },
                      { text: '取消', style: 'cancel' }
                    ]
                  );
                }
              } else {
                startSpeechRecognition();
              }
            }
          },
          { text: '取消', style: 'cancel' }
        ]
      );
    }, 100);
  };











  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
        enabled={true}
      >
        <ViewerLayout
          colors={colors}
          title={title}
          noteId={noteId}
          navigation={navigation}
          showHistoryNavigation={true}
          historyNavigationHeight={25}
          contentStyle={{ paddingTop: 0, marginTop: -8 }}
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
              <TextInput
                ref={contentInputRef}
                value={content}
                onChangeText={setContent}
                placeholder="开始输入内容..."
                placeholderTextColor={colors.onSurfaceVariant}
                style={[styles.contentInput, {
                  color: colors.onSurface,
                  backgroundColor: colors.surface,
                  borderColor: colors.outline,
                }]}
                multiline
                textAlignVertical="top"
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
                  <Icon name="music-note" size={16} color={colors.onPrimaryContainer} />
                  <Text style={[styles.audioHintText, { color: colors.onPrimaryContainer }]}>
                    {audioFiles.length} 个录音文件
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* 语音识别状态显示 */}
          {isListening && (
            <View style={[styles.voiceRecognitionStatus, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <View style={styles.voiceStatusHeader}>
                <Text style={[styles.voiceStatusTitle, { color: colors.primary }]}>
                  {isVoicePaused ? '语音识别已暂停' : '正在识别语音...'}
                </Text>
                <TouchableOpacity
                  style={styles.voiceCloseButton}
                  onPress={stopSpeechRecognition}
                >
                  <Icon name="close" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              {/* 实时显示识别结果 */}
              {partialText && !isVoicePaused && (
                <View style={styles.partialTextContainer}>
                  <Text style={[styles.partialText, { color: colors.onSurfaceVariant }]}>
                    {partialText}
                  </Text>
                </View>
              )}

              {/* 控制按钮 */}
              <View style={styles.voiceControlButtons}>
                <TouchableOpacity
                  style={[styles.voiceControlButton, { backgroundColor: isVoicePaused ? colors.primary : colors.outline }]}
                  onPress={isVoicePaused ? resumeVoiceRecognition : pauseVoiceRecognition}
                >
                  <Icon
                    name={isVoicePaused ? 'play-arrow' : 'pause'}
                    size={16}
                    color={isVoicePaused ? colors.onPrimary : colors.onSurfaceVariant}
                  />
                  <Text style={[styles.voiceControlText, {
                    color: isVoicePaused ? colors.onPrimary : colors.onSurfaceVariant
                  }]}>
                    {isVoicePaused ? '继续' : '暂停'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.voiceControlButton, { backgroundColor: colors.error }]}
                  onPress={stopSpeechRecognition}
                >
                  <Icon name="stop" size={16} color={colors.onError} />
                  <Text style={[styles.voiceControlText, { color: colors.onError }]}>
                    停止
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ViewerLayout>
      </KeyboardAvoidingView>

      {/* 右下角语音按钮 - 使用绝对定位，确保不受键盘影响 */}
      <TouchableOpacity
        style={[
          styles.voiceButton,
          {
            backgroundColor: isRecording ? colors.error : (isListening ? colors.secondary : colors.primary),
            // 确保按钮位置固定，不受键盘影响
            bottom: 30,
            right: 20,
            position: 'absolute',
            zIndex: 9999,
          }
        ]}
        onPress={handleVoiceAction}
        activeOpacity={0.8}
      >
        <Icon
          name={voiceButtonIcon}
          size={16}
          color={colors.onPrimary}
        />
        <Text style={[styles.voiceButtonText, { color: colors.onPrimary }]} numberOfLines={1}>
          {voiceButtonText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 确保容器支持绝对定位
    position: 'relative',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 0, // 完全移除顶部间距，使内容紧贴文件历史导航
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
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    marginBottom: 8,
    marginTop: 8,
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
    // 移除position: 'absolute'，因为我们在内联样式中设置
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
    minWidth: 80,
    minHeight: 44,
    justifyContent: 'center',
    // 添加稳定性样式，减少布局抖动
    backfaceVisibility: 'hidden',
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    // 添加稳定性样式，减少文本抖动
    includeFontPadding: false,
    textAlignVertical: 'center',
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
  simpleRecognitionStatus: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  simpleRecognitionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  voiceRecognitionStatus: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    // 移除阴影和elevation
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
  },
  voiceStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  voiceCloseButton: {
    padding: 4,
  },
  partialTextContainer: {
    backgroundColor: 'rgba(33, 150, 243, 0.08)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.2)',
  },
  partialText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  voiceControlButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  voiceControlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    // 移除阴影，使用纯色背景
    borderWidth: 1.5,
  },
  voiceControlText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default CardNoteScreen;