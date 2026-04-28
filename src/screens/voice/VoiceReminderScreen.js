import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  PermissionsAndroid,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import networkService from '../../services/network/networkService';
import { useDispatch } from 'react-redux';

// 导入API服务
import * as reminderApi from '../../services/api/reminderApi';
import * as voiceApi from '../../services/api/voiceApi';

// 导入组件
import { Button, Loading, Toast } from '../../components/common';

// 导入常量和工具函数
import { useTheme } from '../../context/ThemeContext';

const VoiceReminderScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();

  // 获取路由参数
  const { noteId } = route.params || {};

  // 状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPath, setRecordingPath] = useState(null);
  const [audioUri, setAudioUri] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [useVoiceReminder, setUseVoiceReminder] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // 引用
  const audioRecorderPlayer = useRef(null);
  const durationTimerRef = useRef(null);

  // 初始化AudioRecorderPlayer
  useEffect(() => {
    try {
      if (AudioRecorderPlayer && typeof AudioRecorderPlayer === 'function') {
        audioRecorderPlayer.current = new AudioRecorderPlayer();
        console.log('VoiceReminderScreen: AudioRecorderPlayer初始化成功');
      } else {
        console.warn('VoiceReminderScreen: AudioRecorderPlayer模块不可用或不是构造函数');
      }
    } catch (error) {
      console.warn('VoiceReminderScreen: AudioRecorderPlayer初始化失败:', error);
    }
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (audioRecorderPlayer.current) {
        try {
          audioRecorderPlayer.current.stopRecorder();
          audioRecorderPlayer.current.removeRecordBackListener();
        } catch (error) {
          console.warn('VoiceReminderScreen: 清理AudioRecorderPlayer失败:', error);
        }
      }
    };
  }, []);

  // 请求录音权限
  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        if (
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          grants[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED &&
          grants[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          return true;
        } else {
          displayToast('需要录音和存储权限');
          return false;
        }
      } catch (err) {
        console.error('请求权限错误:', err);
        return false;
      }
    } else {
      return true; // iOS会自动请求权限
    }
  };

  // 显示提示
  const displayToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        return;
      }

      const path = Platform.select({
        ios: `${RNFS.LibraryDirectoryPath}/voice_reminder.m4a`,
        android: `${RNFS.ExternalDirectoryPath}/voice_reminder_${Date.now()}.mp3`,
      });

      if (!audioRecorderPlayer.current) {
        displayToast('录音器未初始化');
        return;
      }

      await audioRecorderPlayer.current.startRecorder(path);
      audioRecorderPlayer.current.addRecordBackListener(() => {});

      setRecordingPath(path);
      setIsRecording(true);
      setRecordingDuration(0);

      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      displayToast('开始录音...');
    } catch (error) {
      console.error('开始录音失败:', error);
      displayToast(`录音失败: ${error.message}`);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    try {
      clearInterval(durationTimerRef.current);
      const path = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();

      setIsRecording(false);
      setAudioUri(`file://${path}`);
      displayToast('录音已完成');

      // 自动开始转写
      transcribeAudio(`file://${path}`);
    } catch (error) {
      console.error('停止录音失败:', error);
      displayToast('停止录音失败');
    }
  };

  // 播放录音
  const playRecording = async () => {
    try {
      if (!audioUri) {
        displayToast('没有录音文件');
        return;
      }

      await audioRecorderPlayer.startPlayer(audioUri);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.current_position === e.duration) {
          audioRecorderPlayer.stopPlayer();
        }
      });
    } catch (error) {
      console.error('播放失败:', error);
      displayToast('播放录音失败');
    }
  };

  // 转写音频
  const transcribeAudio = async (uri) => {
    if (!uri) {
      displayToast('没有录音文件');
      return;
    }

    try {
      // 检查网络连接
      const isOnline = await networkService.checkConnection();
      if (!isOnline) {
        displayToast('需要网络连接');
        return;
      }

      setIsTranscribing(true);

      // 读取音频文件
      const fileContent = await RNFS.readFile(uri.replace('file://', ''), 'base64');

      // 调用转写API
      const result = await voiceApi.transcribeFromRecording(fileContent);

      if (result.success) {
        setTranscribedText(result.text);
        // 如果标题为空，使用转写文本的前20个字符作为标题
        if (!title && result.text) {
          setTitle(result.text.substring(0, 20) + (result.text.length > 20 ? '...' : ''));
        }
        displayToast('转写成功');
      } else {
        throw new Error(result.message || '转写失败');
      }
    } catch (error) {
      console.error('转写失败:', error);
      displayToast(`转写失败: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 处理日期变更
  const handleDateChange = (event, selectedDate) => {
    // 在Android上，当用户点击取消时，event.type可能为'dismissed'
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }

    // 无论如何都关闭日期选择器
    setShowDatePicker(false);

    // 只有当用户选择了日期时才更新
    if (selectedDate) {
      // 保持时间不变，只更新日期
      const newDate = new Date(selectedDate);
      newDate.setHours(date.getHours(), date.getMinutes());
      setDate(newDate);
    }
  };

  // 处理时间变更
  const handleTimeChange = (event, selectedTime) => {
    // 在Android上，当用户点击取消时，event.type可能为'dismissed'
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }

    // 无论如何都关闭时间选择器
    setShowTimePicker(false);

    // 只有当用户选择了时间时才更新
    if (selectedTime) {
      // 保持日期不变，只更新时间
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDate(newDate);
    }
  };

  // 创建提醒
  const createReminder = async () => {
    if (!title.trim()) {
      displayToast('请输入提醒标题');
      return;
    }

    if (date <= new Date()) {
      displayToast('提醒时间必须是未来时间');
      return;
    }

    try {
      setIsSubmitting(true);

      const reminderData = {
        title: title.trim(),
        content: transcribedText,
        remind_at: date.toISOString(),
        note_id: noteId || null,
        use_voice: useVoiceReminder,
      };

      // 如果有音频文件且启用了语音提醒
      if (audioUri && useVoiceReminder) {
        const audioContent = await RNFS.readFile(audioUri.replace('file://', ''), 'base64');
        reminderData.audio_content = audioContent;
      }

      // 调用创建提醒API
      const result = await reminderApi.createReminder(reminderData);

      if (result.success) {
        displayToast('提醒创建成功');
        setTimeout(() => {
          navigation.goBack();
        }, 1500);
      } else {
        throw new Error(result.message || '创建提醒失败');
      }
    } catch (error) {
      console.error('创建提醒失败:', error);
      displayToast(`创建提醒失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 格式化日期
  const formatDate = (date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 格式化时间
  const formatTime = (date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化录音时长
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>语音提醒</Text>
          <TouchableOpacity
            style={[styles.saveButton, isSubmitting && styles.disabledButton]}
            onPress={createReminder}
            disabled={isSubmitting}
          >
            <Text style={[styles.saveButtonText, { color: colors.primary }]}>
              {isSubmitting ? '保存中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.contentContainer}>
          <View style={[styles.formSection, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>提醒内容</Text>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>标题</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.border }]}
                value={title}
                onChangeText={setTitle}
                placeholder="输入提醒标题"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.recordingContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>录音</Text>

              <View style={styles.recordingControls}>
                {isRecording ? (
                  <TouchableOpacity
                    style={[styles.recordButton, styles.stopButton]}
                    onPress={stopRecording}
                  >
                    <Icon name="stop" size={24} color="#fff" />
                    <Text style={styles.recordButtonText}>
                      {formatDuration(recordingDuration)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.recordButton, { backgroundColor: colors.primary }]}
                    onPress={startRecording}
                  >
                    <Icon name="mic" size={24} color="#fff" />
                    <Text style={styles.recordButtonText}>录音</Text>
                  </TouchableOpacity>
                )}

                {audioUri && !isRecording && (
                  <TouchableOpacity
                    style={[styles.playButton, { backgroundColor: colors.secondary }]}
                    onPress={playRecording}
                  >
                    <Icon name="play-arrow" size={24} color="#fff" />
                    <Text style={styles.recordButtonText}>播放</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.transcriptionContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>转写内容</Text>

              {isTranscribing ? (
                <View style={styles.loadingContainer}>
                  <Loading size="small" />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    正在转写...
                  </Text>
                </View>
              ) : (
                <TextInput
                  style={[
                    styles.transcriptionInput,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  value={transcribedText}
                  onChangeText={setTranscribedText}
                  placeholder="录音转写内容将显示在这里"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
              )}
            </View>
          </View>

          <View style={[styles.formSection, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>提醒时间</Text>

            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Icon name="calendar-today" size={24} color={colors.primary} />
              <Text style={[styles.datePickerText, { color: colors.text }]}>
                {formatDate(date)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Icon name="access-time" size={24} color={colors.primary} />
              <Text style={[styles.datePickerText, { color: colors.text }]}>
                {formatTime(date)}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={date}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}
          </View>

          <View style={[styles.formSection, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>提醒方式</Text>

            <View style={styles.switchContainer}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>
                使用语音提醒
              </Text>
              <Switch
                value={useVoiceReminder}
                onValueChange={setUseVoiceReminder}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={useVoiceReminder ? colors.primaryLight : '#f4f3f4'}
              />
            </View>

            {useVoiceReminder && (
              <Text style={[styles.switchDescription, { color: colors.textSecondary }]}>
                启用后，系统将在提醒时播放您录制的语音内容
              </Text>
            )}
          </View>
        </ScrollView>

        {showToast && (
          <Toast message={toastMessage} />
        )}

        {isSubmitting && (
          <View style={styles.loadingOverlay}>
            <Loading size="large" />
          </View>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  recordingContainer: {
    marginBottom: 16,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginRight: 12,
  },
  stopButton: {
    backgroundColor: '#e74c3c',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  recordButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  transcriptionContainer: {
    marginBottom: 16,
  },
  transcriptionInput: {
    height: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginBottom: 16,
  },
  datePickerText: {
    fontSize: 16,
    marginLeft: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 16,
  },
  switchDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VoiceReminderScreen;
