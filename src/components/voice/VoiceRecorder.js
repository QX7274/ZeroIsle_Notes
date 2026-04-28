/**
 * 语音录制组件
 * 提供语音录制功能，支持录制、暂停、继续和停止
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { analyticsService } from '../../services/analytics/analyticsService';

/**
 * 语音录制组件
 * @param {function} onRecordingComplete - 录制完成回调，参数为录音文件路径
 * @param {function} onRecordingCancel - 录制取消回调
 * @param {function} onRecordingStart - 录制开始回调
 * @param {function} onRecordingPause - 录制暂停回调
 * @param {function} onRecordingResume - 录制继续回调
 * @param {number} maxDuration - 最大录制时长（秒）
 * @param {string} filePrefix - 录音文件名前缀
 * @param {object} style - 自定义样式
 */
const VoiceRecorder = ({
  onRecordingComplete,
  onRecordingCancel,
  onRecordingStart,
  onRecordingPause,
  onRecordingResume,
  maxDuration = 300, // 默认最大录制时长5分钟
  filePrefix = 'recording',
  style,
}) => {
  // 使用主题
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00');
  const [recordSecs, setRecordSecs] = useState(0);
  const [filePath, setFilePath] = useState('');
  const [hasPermission, setHasPermission] = useState(false);

  // 引用
  const audioRecorderPlayer = useRef(null);
  const recordingTimeout = useRef(null);

  // 初始化AudioRecorderPlayer
  useEffect(() => {
    try {
      audioRecorderPlayer.current = new AudioRecorderPlayer();
      console.log('VoiceRecorder: AudioRecorderPlayer初始化成功');
    } catch (error) {
      console.warn('VoiceRecorder: AudioRecorderPlayer初始化失败:', error);
    }
  }, []);

  // 组件挂载时检查权限
  useEffect(() => {
    checkPermission();

    // 组件卸载时清理
    return () => {
      if (isRecording) {
        stopRecording(true);
      }
      if (recordingTimeout.current) {
        clearTimeout(recordingTimeout.current);
      }
    };
  }, []);

  // 检查录音权限
  const checkPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);

        if (
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
            PermissionsAndroid.RESULTS.GRANTED
        ) {
          setHasPermission(true);
        } else {
          setHasPermission(false);
          Alert.alert(
            '权限被拒绝',
            '请授予录音和存储权限以使用录音功能'
          );
        }
      } catch (err) {
        console.error('权限请求错误:', err);
        setHasPermission(false);
      }
    } else {
      setHasPermission(true);
    }
  };

  // 开始录音
  const startRecording = async () => {
    if (!hasPermission) {
      await checkPermission();
      if (!hasPermission) {
        return;
      }
    }

    try {
      // 生成录音文件路径
      const path = Platform.select({
        ios: `${RNFS.DocumentDirectoryPath}/${filePrefix}_${Date.now()}.m4a`,
        android: `${RNFS.ExternalDirectoryPath}/${filePrefix}_${Date.now()}.mp3`,
      });

      setFilePath(path);

      // 配置录音选项
      const audioSet = {
        AudioEncoderAndroid: Platform.OS === 'android' ?
          AudioRecorderPlayer.AudioEncoderAndroidType.AAC : undefined,
        AudioSourceAndroid: Platform.OS === 'android' ?
          AudioRecorderPlayer.AudioSourceAndroidType.MIC : undefined,
        AVEncoderAudioQualityKeyIOS: Platform.OS === 'ios' ?
          AudioRecorderPlayer.AVEncoderAudioQualityIOSType.high : undefined,
        AVNumberOfChannelsKeyIOS: Platform.OS === 'ios' ? 2 : undefined,
        AVFormatIDKeyIOS: Platform.OS === 'ios' ?
          AudioRecorderPlayer.AVEncoderAudioQualityIOSType.m4a : undefined,
      };

      // 开始录音
      await audioRecorderPlayer.current.startRecorder(path, audioSet);

      // 设置录音状态
      setIsRecording(true);
      setIsPaused(false);

      // 监听录音进度
      audioRecorderPlayer.current.addRecordBackListener((e) => {
        setRecordSecs(e.currentPosition / 1000);
        setRecordTime(audioRecorderPlayer.current.mmssss(e.currentPosition));
      });

      // 设置最大录制时长
      if (maxDuration > 0) {
        recordingTimeout.current = setTimeout(() => {
          stopRecording();
        }, maxDuration * 1000);
      }

      // 调用回调
      if (onRecordingStart) {
        onRecordingStart();
      }

      // 记录分析事件
      analyticsService.trackVoiceAction('start_recording');
    } catch (error) {
      console.error('开始录音失败:', error);
      Alert.alert('错误', '开始录音失败: ' + error.message);
    }
  };

  // 暂停录音
  const pauseRecording = async () => {
    if (!isRecording || isPaused) {return;}

    try {
      await audioRecorderPlayer.current.pauseRecorder();
      setIsPaused(true);

      // 暂停时清除超时计时器
      if (recordingTimeout.current) {
        clearTimeout(recordingTimeout.current);
        recordingTimeout.current = null;
      }

      // 调用回调
      if (onRecordingPause) {
        onRecordingPause();
      }

      // 记录分析事件
      analyticsService.trackVoiceAction('pause_recording');
    } catch (error) {
      console.error('暂停录音失败:', error);
    }
  };

  // 继续录音
  const resumeRecording = async () => {
    if (!isRecording || !isPaused) {return;}

    try {
      await audioRecorderPlayer.current.resumeRecorder();
      setIsPaused(false);

      // 重新设置超时计时器
      if (maxDuration > 0) {
        const remainingTime = maxDuration - recordSecs;
        if (remainingTime > 0) {
          recordingTimeout.current = setTimeout(() => {
            stopRecording();
          }, remainingTime * 1000);
        } else {
          stopRecording();
        }
      }

      // 调用回调
      if (onRecordingResume) {
        onRecordingResume();
      }

      // 记录分析事件
      analyticsService.trackVoiceAction('resume_recording');
    } catch (error) {
      console.error('继续录音失败:', error);
    }
  };

  // 停止录音
  const stopRecording = async (cancel = false) => {
    if (!isRecording) {return;}

    try {
      // 停止录音
      const result = await audioRecorderPlayer.current.stopRecorder();
      audioRecorderPlayer.current.removeRecordBackListener();

      // 重置状态
      setIsRecording(false);
      setIsPaused(false);
      setRecordTime('00:00');
      setRecordSecs(0);

      // 清除超时计时器
      if (recordingTimeout.current) {
        clearTimeout(recordingTimeout.current);
        recordingTimeout.current = null;
      }

      // 如果是取消录音，删除文件
      if (cancel) {
        if (filePath && await RNFS.exists(filePath)) {
          await RNFS.unlink(filePath);
        }

        // 调用取消回调
        if (onRecordingCancel) {
          onRecordingCancel();
        }

        // 记录分析事件
        analyticsService.trackVoiceAction('cancel_recording');
      } else {
        // 调用完成回调
        if (onRecordingComplete) {
          onRecordingComplete(filePath);
        }

        // 记录分析事件
        analyticsService.trackVoiceAction('complete_recording', {
          duration: recordSecs,
          fileSize: (await RNFS.stat(filePath)).size,
        });
      }
    } catch (error) {
      console.error('停止录音失败:', error);
    }
  };

  // 取消录音
  const cancelRecording = () => {
    stopRecording(true);
  };

  // 格式化时间显示
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, style]}>
      {/* 录音状态显示 */}
      <View
        style={[
          styles.statusContainer,
          {
            backgroundColor: isRecording
              ? isPaused
                ? `${colors.warning}20`
                : `${colors.error}20`
              : `${colors.card}`,
            borderColor: isRecording
              ? isPaused
                ? colors.warning
                : colors.error
              : colors.border,
          },
        ]}
      >
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View
              style={[
                styles.recordingDot,
                {
                  backgroundColor: isPaused ? colors.warning : colors.error,
                  opacity: isPaused ? 0.7 : (recordSecs % 2 < 1 ? 1 : 0.5),
                },
              ]}
            />
            <Text
              variant="body"
              size="medium"
              style={{
                color: isPaused ? colors.warning : colors.error,
                marginLeft: 8,
              }}
            >
              {isPaused ? '已暂停' : '录音中'}
            </Text>
          </View>
        )}

        <Text
          variant="heading"
          level="h6"
          style={{
            color: isRecording
              ? isPaused
                ? colors.warning
                : colors.error
              : colors.text,
            fontSize: 24,
          }}
        >
          {isRecording ? formatTime(recordSecs) : '00:00'}
        </Text>
      </View>

      {/* 控制按钮 */}
      <View style={styles.controlsContainer}>
        {isRecording ? (
          <>
            {/* 取消按钮 */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: `${colors.error}20`,
                  borderColor: colors.error,
                },
              ]}
              onPress={cancelRecording}
            >
              <Icon name="close" size={24} color={colors.error} />
            </TouchableOpacity>

            {/* 暂停/继续按钮 */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                styles.mainButton,
                {
                  backgroundColor: isPaused
                    ? `${colors.success}20`
                    : `${colors.warning}20`,
                  borderColor: isPaused ? colors.success : colors.warning,
                },
              ]}
              onPress={isPaused ? resumeRecording : pauseRecording}
            >
              <Icon
                name={isPaused ? 'play-arrow' : 'pause'}
                size={32}
                color={isPaused ? colors.success : colors.warning}
              />
            </TouchableOpacity>

            {/* 停止按钮 */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: `${colors.success}20`,
                  borderColor: colors.success,
                },
              ]}
              onPress={() => stopRecording()}
            >
              <Icon name="stop" size={24} color={colors.success} />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.controlButton,
              styles.mainButton,
              {
                backgroundColor: `${colors.primary}20`,
                borderColor: colors.primary,
              },
            ]}
            onPress={startRecording}
          >
            <Icon name="mic" size={32} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 16,
  },
  statusContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    margin: 8,
  },
  mainButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
});

export default VoiceRecorder;
