import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import base64 from 'react-native-base64';

import AudioWaveform from './AudioWaveform';
import RecordButton from './RecordButton';

// API服务
import * as voiceApi from '../../services/api/voiceApi';

/**
 * 实时转写组件
 * 提供实时语音转文字功能
 */
const RealtimeTranscription = ({
  onTranscriptionComplete,
  onError,
  language = 'zh',
  style = {}
}) => {
  const { colors } = useTheme();

  // 状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [displayText, setDisplayText] = useState(''); // 用于打字机效果
  const [isTyping, setIsTyping] = useState(false); // 是否正在打字
  const [interimResults, setInterimResults] = useState([]);
  const [amplitude, setAmplitude] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, recording, processing, completed, error
  const [errorMessage, setErrorMessage] = useState('');
  const [animatedDots, setAnimatedDots] = useState(''); // 动画点

  // 引用
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const recordingPathRef = useRef('');
  const pollingIntervalRef = useRef(null);
  const durationTimerRef = useRef(null);
  const amplitudeTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const charIndexRef = useRef(0);
  const resultScrollRef = useRef(null);
  const dotsTimerRef = useRef(null);

  // 清理函数
  useEffect(() => {
    return () => {
      // 停止录音
      if (isRecording) {
        stopRecording();
      }

      // 清理计时器
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }

      if (amplitudeTimerRef.current) {
        clearInterval(amplitudeTimerRef.current);
      }

      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }

      if (dotsTimerRef.current) {
        clearInterval(dotsTimerRef.current);
      }

      // 结束会话
      if (sessionId) {
        voiceApi.finishRealtimeSession(sessionId).catch(() => {});
      }
    };
  }, [isRecording, sessionId]);

  // 动画点效果
  useEffect(() => {
    // 启动动画点定时器
    dotsTimerRef.current = setInterval(() => {
      const dots = '.'.repeat((Math.floor(Date.now() / 500) % 4));
      setAnimatedDots(dots);
    }, 500);

    return () => {
      if (dotsTimerRef.current) {
        clearInterval(dotsTimerRef.current);
      }
    };
  }, []);

  // 当文本更新时，滚动到底部
  useEffect(() => {
    if (resultScrollRef.current) {
      resultScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [displayText, transcribedText]);

  // 创建实时转写会话
  const createSession = async () => {
    try {
      setStatus('processing');
      setIsProcessing(true);

      const result = await voiceApi.createRealtimeSession(language);

      if (result.success && result.sessionId) {
        setSessionId(result.sessionId);
        return result.sessionId;
      } else {
        throw new Error(result.message || '创建实时转写会话失败');
      }
    } catch (error) {
      console.error('创建实时转写会话失败:', error);
      setErrorMessage(error.message || '创建实时转写会话失败');
      setStatus('error');
      if (onError) {
        onError(error);
      }
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      // 创建会话
      const newSessionId = await createSession();
      if (!newSessionId) {
        return;
      }

      // 设置录音路径
      const path = Platform.select({
        ios: `${RNFS.LibraryDirectoryPath}/recording.m4a`,
        android: `${RNFS.ExternalDirectoryPath}/recording_${Date.now()}.mp3`,
      });

      recordingPathRef.current = path;

      // 开始录音
      await audioRecorderPlayer.startRecorder(path);

      // 添加录音回调，获取音量信息
      audioRecorderPlayer.addRecordBackListener((e) => {
        // 计算振幅（0-1之间的值）
        const currentAmplitude = Math.min(1, e.currentMetering / 100);
        setAmplitude(currentAmplitude);

        // 处理音频数据
        processAudioChunk();
      });

      // 更新状态
      setIsRecording(true);
      setStatus('recording');
      setRecordingDuration(0);
      setTranscribedText('');
      setInterimResults([]);

      // 开始计时
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // 开始轮询结果
      startPollingResults(newSessionId);
    } catch (error) {
      console.error('开始录音失败:', error);
      setErrorMessage(error.message || '开始录音失败');
      setStatus('error');
      if (onError) {
        onError(error);
      }
    }
  };

  // 停止录音
  const stopRecording = async () => {
    try {
      // 停止录音
      if (isRecording) {
        await audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      }

      // 清理计时器
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      if (amplitudeTimerRef.current) {
        clearInterval(amplitudeTimerRef.current);
        amplitudeTimerRef.current = null;
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // 更新状态
      setIsRecording(false);
      setAmplitude(0);

      // 结束会话
      if (sessionId) {
        setStatus('processing');
        setIsProcessing(true);

        const result = await voiceApi.finishRealtimeSession(sessionId);

        if (result.success && result.finalResult) {
          // 更新最终文本
          if (result.finalResult.text) {
            setTranscribedText(result.finalResult.text);
          }

          // 通知完成
          if (onTranscriptionComplete) {
            onTranscriptionComplete({
              text: result.finalResult.text || transcribedText,
              transcriptionId: result.finalResult.transcription_id,
              duration: recordingDuration
            });
          }

          setStatus('completed');
        } else {
          // 如果没有最终结果，但有临时结果
          if (transcribedText) {
            if (onTranscriptionComplete) {
              onTranscriptionComplete({
                text: transcribedText,
                duration: recordingDuration
              });
            }

            setStatus('completed');
          } else {
            throw new Error(result.message || '获取最终转写结果失败');
          }
        }
      }
    } catch (error) {
      console.error('停止录音失败:', error);
      setErrorMessage(error.message || '停止录音失败');
      setStatus('error');
      if (onError) {
        onError(error);
      }
    } finally {
      setIsProcessing(false);
      setSessionId(null);
    }
  };

  // 处理音频数据
  const processAudioChunk = async () => {
    if (!isRecording || !sessionId || !recordingPathRef.current) {
      return;
    }

    try {
      // 读取最新的音频数据
      const audioData = await RNFS.readFile(recordingPathRef.current, 'base64');

      // 发送到服务器
      await voiceApi.addRealtimeAudioChunk(sessionId, audioData);
    } catch (error) {
      console.error('处理音频数据失败:', error);
    }
  };

  // 开始轮询结果
  const startPollingResults = (sid) => {
    // 清理旧的轮询
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // 创建新的轮询
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // 获取结果
        const result = await voiceApi.getRealtimeResults(sid);

        if (result.success && result.results && result.results.length > 0) {
          // 处理结果
          let newText = '';
          const newInterimResults = [...interimResults];

          for (const item of result.results) {
            if (item.type === 'interim') {
              // 添加临时结果
              newInterimResults.push(item);
              newText += item.text + ' ';
            } else if (item.type === 'final') {
              // 最终结果
              newText = item.text;
            }
          }

          // 更新状态
          if (newText && newText !== transcribedText) {
            setTranscribedText(newText);
            // 启动打字机效果
            startTypingEffect(newText);
          }

          if (newInterimResults.length > interimResults.length) {
            setInterimResults(newInterimResults);
          }
        }
      } catch (error) {
        console.error('获取转写结果失败:', error);
      }
    }, 1000);
  };

  // 格式化时间
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 打字机效果
  const startTypingEffect = (newText) => {
    // 如果当前正在打字，先停止
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    // 如果新文本是旧文本的延续，只打字新增的部分
    let startIndex = 0;
    if (newText.startsWith(displayText) && displayText.length > 0) {
      startIndex = displayText.length;
      setDisplayText(displayText);
    } else {
      // 完全新的文本，从头开始打字
      setDisplayText('');
    }

    charIndexRef.current = startIndex;
    setIsTyping(true);

    // 设置打字速度 - 根据文本长度动态调整
    const typingSpeed = Math.max(10, Math.min(50, 30 - newText.length / 20));

    // 开始打字效果
    typingTimerRef.current = setInterval(() => {
      if (charIndexRef.current < newText.length) {
        setDisplayText(prev => prev + newText.charAt(charIndexRef.current));
        charIndexRef.current++;
      } else {
        // 打字完成
        clearInterval(typingTimerRef.current);
        setIsTyping(false);
        setDisplayText(newText);
      }
    }, typingSpeed);
  };

  // 渲染状态指示器
  const renderStatusIndicator = () => {
    switch (status) {
      case 'recording':
        return (
          <View style={styles.statusContainer}>
            <Icon name="microphone" size={16} color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>
              正在录音 ({formatDuration(recordingDuration)})
            </Text>
          </View>
        );
      case 'processing':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color={colors.primary} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: colors.primary }]}>
              正在处理...
            </Text>
          </View>
        );
      case 'completed':
        return (
          <View style={styles.statusContainer}>
            <Icon name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>
              转写完成
            </Text>
          </View>
        );
      case 'error':
        return (
          <View style={styles.statusContainer}>
            <Icon name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.statusText, { color: colors.danger }]}>
              {errorMessage || '发生错误'}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* 状态指示器 */}
      {renderStatusIndicator()}

      {/* 波形显示 */}
      <AudioWaveform
        isRecording={isRecording}
        amplitude={amplitude}
        style={styles.waveform}
      />

      {/* 录音控制 */}
      <View style={styles.controlsContainer}>
        <RecordButton
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          isRecording={isRecording}
          disabled={isProcessing}
          size={70}
          showTimer={true}
          maxDuration={300} // 5分钟
        />
      </View>

      {/* 转写结果 */}
      {(transcribedText || displayText || isRecording || status === 'processing') && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>实时转写结果:</Text>
          <ScrollView
            ref={resultScrollRef}
            style={styles.resultScroll}
            contentContainerStyle={styles.resultContent}
          >
            {displayText || transcribedText ? (
              <Text style={[styles.resultText, { color: colors.text }]}>
                {displayText || transcribedText}
                {isTyping && <Text style={styles.cursor}>|</Text>}
              </Text>
            ) : (
              <View style={styles.placeholderContainer}>
                <Text style={[styles.placeholderText, { color: colors.text + '80' }]}>
                  {isRecording ? '正在聆听' : '处理中'}
                </Text>
                <Text style={[styles.dotsText, { color: colors.primary }]}>
                  {animatedDots}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    marginLeft: 6,
  },
  statusIcon: {
    marginRight: 6,
  },
  waveform: {
    height: 80,
    marginVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    overflow: 'hidden', // 确保波形不超出容器
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  resultScroll: {
    flex: 1,
  },
  resultContent: {
    paddingBottom: 16,
  },
  resultText: {
    fontSize: 16,
    lineHeight: 26,
    letterSpacing: 0.3,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  placeholderText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  dotsText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  cursor: {
    color: '#007AFF',
    fontWeight: 'bold',
  }
});

export default RealtimeTranscription;
