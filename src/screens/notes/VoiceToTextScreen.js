/**
 * 语音转文本屏幕（增强版）
 * 支持语音转文字、说话人分离和离线处理
 * 优化版本：更现代的UI和交互体验
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Modal,
  StatusBar,
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Haptics } from '../../utils/expoCompatibility';

// API 服务
import * as voiceApi from '../../services/api/voiceApi';

// 组件
import { Button, Loading } from '../../components/common';
import AudioWaveform from '../../components/voice/AudioWaveform';
import RecordButton from '../../components/voice/RecordButton';
import TranscriptionResult from '../../components/voice/TranscriptionResult';

const { width, height } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();

const VoiceToTextScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  // 状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingPath, setRecordingPath] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState(null);
  const [amplitude, setAmplitude] = useState(0);
  const [transcription, setTranscription] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isDiarizationProcessing, setIsDiarizationProcessing] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [currentSegmentId, setCurrentSegmentId] = useState(null);
  const [audioFileName, setAudioFileName] = useState('');

  // 路由参数
  const { onTranscribed, noteId } = route.params || {};

  // 引用
  const durationTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const amplitudeTimerRef = useRef(null);
  const scrollViewRef = useRef(null);

  // 权限管理
  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        return (
          granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.error(err);
        return false;
      }
    }
    return true;
  };

  // Toast 消息
  const displayToast = useCallback((message, type = 'info') => {
    // 清除之前的计时器
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    // 设置消息内容和类型
    setToastMessage({ text: message, type });
    setShowToast(true);

    // 触发震动反馈
    try {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(
          type === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : type === 'success'
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning
        );
      } else {
        // Android振动
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.log('Haptics not available');
    }

    // 显示动画
    Animated.sequence([
      Animated.parallel([
        Animated.timing(toastAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5))
        }),
      ])
    ]).start();

    // 设置自动隐藏
    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic)
      }).start(() => {
        setShowToast(false);
      });
    }, 3000);
  }, [toastAnim]);

  // 获取服务状态
  const fetchServiceStatus = async () => {
    try {
      const netInfo = await NetInfo.fetch();

      // 检查网络状态，设置离线模式
      if (!netInfo.isConnected) {
        setIsOfflineMode(true);
      } else {
        // 获取语音服务状态
        const result = await voiceApi.getServiceStatus();
        if (result.success) {
          setServiceStatus(result.data);
          setIsOfflineMode(result.data.mode === 'offline');
        }
      }
    } catch (error) {
      console.error('获取服务状态失败:', error);
      setIsOfflineMode(true);
    }
  };

  // 初始化
  useEffect(() => {
    fetchServiceStatus();
  }, []);

  // 录音管理
  const startRecording = async () => {
    try {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        displayToast('需要麦克风和存储权限', 'error');
        return;
      }

      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `recording_${timestamp}`;
      setAudioFileName(fileName);

      const path = Platform.select({
        ios: `${RNFS.LibraryDirectoryPath}/${fileName}.m4a`,
        android: `${RNFS.ExternalDirectoryPath}/${fileName}.mp3`,
      });

      // 开始录音前的动画效果
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ]).start();

      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.log('Haptics not available');
      }

      await audioRecorderPlayer.startRecorder(path);

      // 添加录音回调，获取音量信息
      audioRecorderPlayer.addRecordBackListener((e) => {
        // 计算振幅（0-1之间的值）
        const currentAmplitude = Math.min(1, e.currentMetering / 100);
        setAmplitude(currentAmplitude);
      });

      setRecordingPath(path);
      setIsRecording(true);
      setRecordingDuration(0);
      setTranscription(null);

      // 开始计时
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      displayToast(
        isOfflineMode ? '开始录音(离线模式)' : '开始录音',
        'success'
      );
    } catch (error) {
      console.error('开始录音失败:', error);
      displayToast(`录音失败: ${error.message}`, 'error');
    }
  };

  const stopRecording = async () => {
    try {
      // 清除计时器
      clearInterval(durationTimerRef.current);

      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (error) {
        console.log('Haptics not available');
      }

      // 停止录音
      const path = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();

      setIsRecording(false);
      setAudioUri(`file://${path}`);
      setAmplitude(0);

      // 获取文件大小和时长信息
      try {
        const fileInfo = await RNFS.stat(path.replace('file://', ''));
        const fileSizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);

        displayToast(
          `录音已保存 (${fileSizeMB}MB, ${formatDuration(recordingDuration)})`,
          'success'
        );
      } catch (error) {
        displayToast('录音已保存', 'success');
      }
    } catch (error) {
      console.error('停止录音失败:', error);
      displayToast('保存录音失败', 'error');
    }
  };

  // 音频播放
  const playRecording = async () => {
    try {
      if (!audioUri) {
        displayToast('没有可播放的录音', 'error');
        return;
      }

      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.log('Haptics not available');
      }

      setIsPlaying(true);
      await audioRecorderPlayer.startPlayer(audioUri);

      // 添加播放回调
      audioRecorderPlayer.addPlayBackListener((e) => {
        // 更新播放进度
        setCurrentPlaybackTime(e.currentPosition / 1000); // 转换为秒
        setPlaybackDuration(e.duration / 1000); // 转换为秒

        // 如果有转写结果，尝试同步当前播放的片段
        if (transcription && transcription.segments && transcription.segments.length > 0) {
          const currentTime = e.currentPosition / 1000;
          // 查找当前时间对应的片段
          const currentSegment = transcription.segments.find(
            segment => currentTime >= segment.start && currentTime <= (segment.end || segment.start + 5)
          );

          if (currentSegment && currentSegment.id !== currentSegmentId) {
            setCurrentSegmentId(currentSegment.id);
          }
        }

        // 生成更自然的波形振幅
        const position = e.currentPosition / e.duration; // 0-1之间的播放进度
        const baseAmplitude = 0.3; // 基础振幅
        const randomFactor = Math.sin(Date.now() / 200) * 0.2 + 0.2; // 添加一些随机性
        setAmplitude(baseAmplitude + randomFactor);

        // 播放结束
        if (e.currentPosition === e.duration) {
          audioRecorderPlayer.stopPlayer();
          setIsPlaying(false);
          setAmplitude(0);
          setCurrentPlaybackTime(0);
          setCurrentSegmentId(null);

          // 播放结束提示
          displayToast('播放完成', 'success');
        }
      });

      // 显示文件名和时长
      const durationStr = formatDuration(playbackDuration || 0);
      const displayName = audioFileName || '录音文件';
      displayToast(`正在播放: ${displayName} (${durationStr})`, 'info');
    } catch (error) {
      console.error('播放失败:', error);
      displayToast('播放录音失败', 'error');
      setIsPlaying(false);
    }
  };

  // 停止播放
  const stopPlayback = async () => {
    try {
      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.log('Haptics not available');
      }

      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
      setIsPlaying(false);
      setAmplitude(0);
      setCurrentPlaybackTime(0);
      setCurrentSegmentId(null);

      displayToast('播放已停止', 'info');
    } catch (error) {
      console.error('停止播放失败:', error);
    }
  };

  // 文件选择
  const selectAudioFile = async () => {
    try {
      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.log('Haptics not available');
      }

      const [res] = await DocumentPicker.pick({
        type: [DocumentPicker.types.audio],
      });

      // 提取文件名
      const uriParts = res.uri.split('/');
      const fileName = uriParts[uriParts.length - 1];
      setAudioFileName(fileName);

      setAudioUri(res.uri);
      setTranscription(null);
      setCurrentSegmentId(null);

      // 获取文件信息
      try {
        const fileInfo = await RNFS.stat(res.uri.replace('file://', ''));
        const fileSizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);
        displayToast(`已选择: ${fileName} (${fileSizeMB}MB)`, 'success');
      } catch (error) {
        displayToast(`已选择: ${fileName}`, 'success');
      }

      // 重置界面动画
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ]).start();

    } catch (error) {
      console.error('选择文件失败:', error);
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        displayToast('选择文件失败', 'error');
      }
    }
  };

  // 语音转写
  const transcribeAudio = async () => {
    if (!audioUri) {
      displayToast('请先录制或选择音频', 'error');
      return;
    }

    try {
      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.log('Haptics not available');
      }

      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected && !isOfflineMode) {
        displayToast('无网络连接，切换到离线模式', 'warning');
        setIsOfflineMode(true);
      }

      setIsTranscribing(true);

      // 显示转写开始提示
      displayToast(
        `开始转写${isOfflineMode ? '(离线模式)' : ''}，请稍候...`,
        'info'
      );

      // 读取音频文件
      const fileContent = await RNFS.readFile(audioUri.replace('file://', ''), 'base64');

      // 调用转写API
      const result = await voiceApi.transcribeFromRecording(fileContent, noteId);

      if (result.success) {
        // 创建转写结果对象，添加唯一ID
        const transcriptionResult = {
          id: result.id || Date.now().toString(),
          text: result.text,
          segments: result.text.split(/[。？！.?!]/).filter(Boolean).map((sentence, index) => ({
            id: index,
            start: index * 2, // 模拟时间戳
            end: (index + 1) * 2,
            text: sentence + (sentence.match(/[。？！.?!]/) ? '' : '。')
          })),
          is_speaker_diarization: false,
          language: result.language || 'zh'
        };

        setTranscription(transcriptionResult);

        // 转写成功动画
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
          })
        ]).start();

        // 显示成功消息
        displayToast(
          `转写成功 (${transcriptionResult.segments.length}个片段)`,
          'success'
        );
      } else {
        throw new Error(result.message || '转写失败');
      }
    } catch (error) {
      console.error('转写失败:', error);
      displayToast(`转写失败: ${error.message || '请稍后重试'}`, 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  // 处理说话人分离
  const processDiarization = async () => {
    if (!transcription || !transcription.id) {
      displayToast('没有可处理的转写内容', 'error');
      return;
    }

    try {
      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.log('Haptics not available');
      }

      setIsDiarizationProcessing(true);
      displayToast('正在识别说话人，这可能需要一些时间...', 'info');

      // 调用说话人分离API
      const result = await voiceApi.processDiarization(transcription.id);

      if (result.success) {
        // 重新获取转写内容
        const transcriptionResult = await voiceApi.getTranscriptionById(transcription.id);

        if (transcriptionResult.success) {
          // 转写成功动画
          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 0.3,
              duration: 200,
              useNativeDriver: true
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true
            })
          ]).start();

          // 更新转写数据
          setTranscription(transcriptionResult.data);

          // 计算识别到的说话人数量
          const speakerCount = new Set(
            transcriptionResult.data.segments
              .filter(s => s.speaker !== undefined)
              .map(s => s.speaker)
          ).size;

          displayToast(`说话人分离成功，识别到${speakerCount}位说话人`, 'success');
        } else {
          throw new Error(transcriptionResult.message || '获取转写结果失败');
        }
      } else {
        throw new Error(result.message || '说话人分离处理失败');
      }
    } catch (error) {
      console.error('说话人分离失败:', error);
      displayToast(`说话人分离失败: ${error.message || '请稍后重试'}`, 'error');
    } finally {
      setIsDiarizationProcessing(false);
    }
  };

  // 更新说话人信息
  const handleUpdateSpeaker = async (speakerId, newName, updatedSegments) => {
    if (!transcription || !transcription.id) {
      return;
    }

    try {
      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.log('Haptics not available');
      }

      // 调用重命名API
      const result = await voiceApi.renameSpeaker(speakerId, newName, transcription.id);

      if (result.success) {
        // 更新本地转写数据
        setTranscription(prev => ({
          ...prev,
          segments: updatedSegments
        }));

        displayToast(`已将说话人重命名为 "${newName}"`, 'success');
      } else {
        throw new Error(result.message || '重命名失败');
      }
    } catch (error) {
      console.error('更新说话人失败:', error);
      displayToast(`更新说话人失败: ${error.message || '请稍后重试'}`, 'error');
    }
  };

  // 生成会议纪要
  const generateMeetingSummary = async () => {
    if (!transcription || !transcription.text) {
      displayToast('请先转写语音内容', 'error');
      return;
    }

    try {
      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.log('Haptics not available');
      }

      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        displayToast('无网络连接，无法生成会议纪要', 'error');
        return;
      }

      setIsGeneratingSummary(true);
      displayToast('正在生成会议纪要，请稍候...', 'info');

      // 调用会议纪要API
      const result = await voiceApi.generateMeetingSummary(transcription.text);

      if (result.success && result.summary) {
        // 设置会议纪要内容
        setMeetingSummary(result.summary);

        // 显示会议纪要弹窗
        setShowSummary(true);

        // 成功提示
        displayToast('会议纪要生成成功', 'success');

        // 触发成功反馈
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.log('Haptics not available');
        }
      } else {
        throw new Error(result.message || '生成会议纪要失败');
      }
    } catch (error) {
      console.error('生成会议纪要错误:', error);
      displayToast(`生成会议纪要失败: ${error.message || '请稍后重试'}`, 'error');

      // 触发错误反馈
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (error) {
        console.log('Haptics not available');
      }
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 保存转写文本
  const saveTranscribedText = () => {
    if (!transcription || !transcription.text) {
      displayToast('没有可保存的转写内容', 'error');
      return;
    }

    // 触发震动反馈
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptics not available');
    }

    if (onTranscribed) {
      onTranscribed(transcription.text);
      displayToast('转写内容已保存', 'success');
      navigation.goBack();
    } else if (noteId) {
      // 保存到指定笔记
      displayToast('正在保存转写内容...', 'info');

      voiceApi.saveTranscribedTextToNote(transcription.text, noteId)
        .then(() => {
          displayToast('转写内容已保存到笔记', 'success');

          // 触发成功反馈
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.log('Haptics not available');
          }

          navigation.goBack();
        })
        .catch(error => {
          console.error('保存转写内容失败:', error);
          displayToast(`保存失败: ${error.message || '请稍后重试'}`, 'error');

          // 触发错误反馈
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch (error) {
            console.log('Haptics not available');
          }
        });
    } else {
      // 创建新笔记
      const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      navigation.navigate('NoteEdit', {
        isNew: true,
        initialContent: transcription.text,
        title: `语音转写笔记 - ${timestamp}`,
      });

      displayToast('已创建新笔记', 'success');
    }
  };

  // 切换在线/离线模式
  const toggleOfflineMode = async () => {
    try {
      // 触发震动反馈
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.log('Haptics not available');
      }

      const newMode = isOfflineMode ? 'online' : 'offline';

      // 检查网络连接
      if (newMode === 'online') {
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          displayToast('无网络连接，无法切换到在线模式', 'error');
          return;
        }
      }

      displayToast(`正在切换到${newMode === 'offline' ? '离线' : '在线'}模式...`, 'info');

      // 调用API切换模式
      const result = await voiceApi.toggleServiceMode(newMode);

      if (result.success) {
        setIsOfflineMode(newMode === 'offline');
        displayToast(
          `已切换到${newMode === 'offline' ? '离线' : '在线'}模式`,
          'success'
        );

        // 刷新服务状态
        fetchServiceStatus();
      } else {
        throw new Error(result.message || '切换模式失败');
      }
    } catch (error) {
      console.error('切换模式失败:', error);
      displayToast(`切换模式失败: ${error.message || '请稍后重试'}`, 'error');
    }
  };

  // 保存会议纪要
  const saveMeetingSummary = () => {
    if (!meetingSummary) {
      displayToast('没有可保存的会议纪要', 'error');
      return;
    }

    // 触发震动反馈
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptics not available');
    }

    if (onTranscribed) {
      onTranscribed(meetingSummary);
      setShowSummary(false);
      displayToast('会议纪要已保存', 'success');
      navigation.goBack();
    } else if (noteId) {
      // 保存到指定笔记
      displayToast('正在保存会议纪要...', 'info');

      voiceApi.saveTranscribedTextToNote(meetingSummary, noteId)
        .then(() => {
          displayToast('会议纪要已保存到笔记', 'success');

          // 触发成功反馈
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.log('Haptics not available');
          }

          setShowSummary(false);
          navigation.goBack();
        })
        .catch(error => {
          console.error('保存会议纪要失败:', error);
          displayToast(`保存失败: ${error.message || '请稍后重试'}`, 'error');

          // 触发错误反馈
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch (error) {
            console.log('Haptics not available');
          }
        });
    } else {
      // 创建新笔记
      const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      navigation.navigate('NoteEdit', {
        isNew: true,
        initialContent: meetingSummary,
        title: `会议纪要 - ${timestamp}`,
      });

      setShowSummary(false);
      displayToast('已创建新笔记', 'success');
    }
  };

  // 清除录音和转写内容
  const clearAll = () => {
    // 确认是否正在录音
    if (isRecording) {
      stopRecording();
    }

    // 确认是否正在播放
    if (isPlaying) {
      stopPlayback();
    }

    // 触发震动反馈
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('Haptics not available');
    }

    // 重置所有状态
    setAudioUri(null);
    setAudioFileName('');
    setTranscription(null);
    setRecordingDuration(0);
    setMeetingSummary('');
    setCurrentSegmentId(null);
    setAmplitude(0);

    // 重置动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 20,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => {
      // 动画完成后重置为初始状态
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();
    });

    displayToast('已清除所有内容', 'info');
  };

  // 格式化时间
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 初始化动画
  useEffect(() => {
    // 页面加载时的动画效果
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: 100,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: 100,
        useNativeDriver: true
      })
    ]).start();

    return () => {
      // 清理动画
      fadeAnim.stopAnimation();
      slideAnim.stopAnimation();
    };
  }, []);

  // 组件清理
  useEffect(() => {
    return () => {
      // 停止所有音频相关操作
      if (isRecording) {
        audioRecorderPlayer.stopRecorder();
      }
      if (isPlaying) {
        audioRecorderPlayer.stopPlayer();
      }

      audioRecorderPlayer.removeRecordBackListener();
      audioRecorderPlayer.removePlayBackListener();

      // 清除所有计时器
      clearInterval(durationTimerRef.current);
      clearTimeout(toastTimerRef.current);
    };
  }, [isRecording, isPlaying]);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* 顶部导航栏 */}
      <Animated.View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          语音转文本
        </Text>

        <View style={styles.headerActions}>
          {/* 在线/离线模式切换 */}
          <TouchableOpacity
            onPress={toggleOfflineMode}
            style={[
              styles.modeButton,
              { backgroundColor: colors.card }
            ]}
          >
            <Icon
              name={isOfflineMode ? "wifi-off" : "wifi"}
              size={20}
              color={isOfflineMode ? colors.warning : colors.success}
            />
            <Text style={[styles.modeText, { color: isOfflineMode ? colors.warning : colors.success }]}>
              {isOfflineMode ? '离线' : '在线'}
            </Text>
          </TouchableOpacity>

          {/* 清除按钮 */}
          <TouchableOpacity
            onPress={clearAll}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="delete-outline" size={24} color={colors.error || colors.danger} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {/* 音频信息显示 */}
        {audioUri && (
          <View style={[styles.audioInfoContainer, { backgroundColor: colors.card }]}>
            <Icon
              name={isPlaying ? "pause-circle" : "music-circle"}
              size={24}
              color={colors.primary}
              style={styles.audioInfoIcon}
            />
            <View style={styles.audioInfoTextContainer}>
              <Text style={[styles.audioFileName, { color: colors.text }]} numberOfLines={1}>
                {audioFileName || '录音文件'}
              </Text>
              {playbackDuration > 0 && (
                <Text style={[styles.audioDuration, { color: colors.textSecondary }]}>
                  {formatDuration(currentPlaybackTime)} / {formatDuration(playbackDuration)}
                </Text>
              )}
            </View>
            {isPlaying && (
              <TouchableOpacity onPress={stopPlayback} style={styles.stopButton}>
                <Icon name="stop-circle" size={28} color={colors.error || colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 波形显示区域 */}
        <AudioWaveform
          isRecording={isRecording}
          isPlaying={isPlaying}
          amplitude={amplitude}
          duration={playbackDuration}
          currentTime={currentPlaybackTime}
          style={[
            styles.waveform,
            { backgroundColor: colors.card }
          ]}
          gradientColors={[
            colors.primary + '99',
            colors.primary,
            colors.primary + '99'
          ]}
          mirrorWave={true}
          rounded={true}
        />

        {/* 录音控制区域 */}
        <View style={styles.recordingSection}>
          {/* 录音按钮 */}
          <RecordButton
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            isRecording={isRecording}
            size={70}
            showTimer={true}
            maxDuration={180}
            style={styles.recordButton}
            vibrate={true}
          />

          {/* 控制按钮 */}
          <View style={styles.controlsRow}>
            {/* 文件选择按钮 */}
            <TouchableOpacity
              onPress={selectAudioFile}
              style={[
                styles.controlIconButton,
                isRecording && styles.disabledButton
              ]}
              disabled={isRecording}
            >
              <LinearGradient
                colors={[colors.card, colors.background]}
                style={styles.controlButtonGradient}
              >
                <Icon
                  name="folder-open-outline"
                  size={28}
                  color={isRecording ? colors.textSecondary : colors.primary}
                />
                <Text style={[
                  styles.controlButtonText,
                  { color: isRecording ? colors.textSecondary : colors.text }
                ]}>
                  选择文件
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 播放/停止按钮 */}
            {audioUri && !isRecording && (
              <TouchableOpacity
                onPress={isPlaying ? stopPlayback : playRecording}
                style={styles.controlIconButton}
              >
                <LinearGradient
                  colors={[colors.card, colors.background]}
                  style={styles.controlButtonGradient}
                >
                  <Icon
                    name={isPlaying ? "stop-circle" : "play-circle"}
                    size={28}
                    color={isPlaying ? colors.error || colors.danger : colors.primary}
                  />
                  <Text style={[
                    styles.controlButtonText,
                    { color: colors.text }
                  ]}>
                    {isPlaying ? '停止' : '播放'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* 转写按钮 */}
            {audioUri && !isRecording && (
              <TouchableOpacity
                onPress={transcribeAudio}
                style={[
                  styles.controlIconButton,
                  isTranscribing && styles.disabledButton
                ]}
                disabled={isTranscribing}
              >
                <LinearGradient
                  colors={[colors.card, colors.background]}
                  style={styles.controlButtonGradient}
                >
                  {isTranscribing ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[
                        styles.controlButtonText,
                        { color: colors.textSecondary }
                      ]}>
                        转写中...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Icon
                        name="text-to-speech"
                        size={28}
                        color={colors.primary}
                      />
                      <Text style={[
                        styles.controlButtonText,
                        { color: colors.text }
                      ]}>
                        转写
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 转写结果区域 */}
        <View style={styles.transcriptionSection}>
          <TranscriptionResult
            transcription={transcription}
            isLoading={isTranscribing}
            showSpeakers={true}
            onProcessDiarization={processDiarization}
            isDiarizationProcessing={isDiarizationProcessing}
            onUpdateSpeaker={handleUpdateSpeaker}
            style={styles.transcriptionResult}
            highlightCurrentSegment={isPlaying}
            currentSegmentId={currentSegmentId}
            onSegmentPress={(segment) => {
              if (audioUri && !isPlaying && segment.start) {
                // 设置当前片段并开始播放
                setCurrentSegmentId(segment.id);
                playRecording();
              }
            }}
          />

          {/* 操作按钮 */}
          {transcription && !isTranscribing && (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                onPress={saveTranscribedText}
                style={[styles.actionButton, styles.saveButton]}
              >
                <Icon name="content-save-outline" size={20} color={colors.white} />
                <Text style={styles.actionButtonText}>保存文本</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={generateMeetingSummary}
                style={[
                  styles.actionButton,
                  styles.summaryButton,
                  isGeneratingSummary && styles.disabledActionButton
                ]}
                disabled={isGeneratingSummary}
              >
                {isGeneratingSummary ? (
                  <>
                    <ActivityIndicator color={colors.white} size="small" />
                    <Text style={styles.actionButtonText}>生成中...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="text-box-check-outline" size={20} color={colors.white} />
                    <Text style={styles.actionButtonText}>生成会议纪要</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Toast消息 */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor:
                toastMessage.type === 'error' ? colors.error || '#ff3b30' :
                toastMessage.type === 'success' ? colors.success || '#34c759' :
                toastMessage.type === 'warning' ? colors.warning || '#ff9500' :
                'rgba(0, 0, 0, 0.7)',
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }
              ]
            }
          ]}
        >
          <Icon
            name={
              toastMessage.type === 'error' ? 'alert-circle' :
              toastMessage.type === 'success' ? 'check-circle' :
              toastMessage.type === 'warning' ? 'alert' :
              'information'
            }
            size={20}
            color="#fff"
            style={styles.toastIcon}
          />
          <Text style={styles.toastText}>{toastMessage.text}</Text>
        </Animated.View>
      )}

      {/* 会议纪要弹窗 */}
      <Modal
        visible={showSummary}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowSummary(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSummary(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: colors.card }
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Icon name="text-box-check" size={24} color={colors.primary} style={styles.modalIcon} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  会议纪要
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSummary(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.summaryScrollView}
              contentContainerStyle={styles.summaryScrollContent}
            >
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {meetingSummary}
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowSummary(false)}
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: colors.border }
                ]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  关闭
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveMeetingSummary}
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  { backgroundColor: colors.primary }
                ]}
              >
                <Icon name="content-save-outline" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.confirmButtonText}>
                  保存纪要
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  clearButton: {
    padding: 8,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  modeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // 音频信息区域
  audioInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  audioInfoIcon: {
    marginRight: 12,
  },
  audioInfoTextContainer: {
    flex: 1,
  },
  audioFileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  audioDuration: {
    fontSize: 12,
    marginTop: 4,
  },
  stopButton: {
    padding: 4,
  },
  // 波形区域
  waveform: {
    marginBottom: 16,
    height: 100,
    borderRadius: 16,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  // 录音控制区域
  recordingSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    marginBottom: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  controlIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  controlButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    width: 90,
    height: 90,
  },
  controlButtonText: {
    fontSize: 13,
    marginTop: 8,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // 转写结果区域
  transcriptionSection: {
    flex: 1,
    marginTop: 8,
  },
  transcriptionResult: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  saveButton: {
    backgroundColor: colors.success,
    flex: 1,
    marginRight: 8,
  },
  summaryButton: {
    backgroundColor: colors.info,
    flex: 1,
    marginLeft: 8,
  },
  disabledActionButton: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },
  buttonIcon: {
    marginRight: 6,
  },
  // Toast消息
  toast: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
  },
  toastIcon: {
    marginRight: 10,
  },
  toastText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '500',
  },
  // 会议纪要弹窗
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    width: '100%',
    maxHeight: height * 0.8,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  summaryScrollView: {
    maxHeight: height * 0.5,
  },
  summaryScrollContent: {
    paddingVertical: 10,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 26,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: colors.border,
  },
  cancelButtonText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default VoiceToTextScreen;