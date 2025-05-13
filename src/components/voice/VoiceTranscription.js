/**
 * 语音转写组件
 * 提供语音转写功能，支持实时转写和文件转写
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';
import { voiceService } from '../../services/voice/voiceService';
import { analyticsService } from '../../services/analytics/analyticsService';

/**
 * 语音转写组件
 * @param {function} onTranscriptionComplete - 转写完成回调，参数为转写文本
 * @param {function} onTranscriptionStart - 转写开始回调
 * @param {function} onTranscriptionCancel - 转写取消回调
 * @param {string} initialAudioPath - 初始音频文件路径
 * @param {string} initialTranscription - 初始转写文本
 * @param {boolean} showRecorder - 是否显示录音器
 * @param {boolean} showPlayer - 是否显示播放器
 * @param {boolean} autoTranscribe - 是否自动转写
 * @param {boolean} realtime - 是否实时转写
 * @param {object} style - 自定义样式
 */
const VoiceTranscription = ({
  onTranscriptionComplete,
  onTranscriptionStart,
  onTranscriptionCancel,
  initialAudioPath,
  initialTranscription,
  showRecorder = true,
  showPlayer = true,
  autoTranscribe = false,
  realtime = false,
  style,
}) => {
  // 使用主题
  const { theme } = useTheme();
  const { colors } = theme;
  
  // 状态
  const [audioPath, setAudioPath] = useState(initialAudioPath || '');
  const [transcription, setTranscription] = useState(initialTranscription || '');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // 引用
  const scrollViewRef = useRef(null);
  const realtimeSession = useRef(null);
  
  // 组件挂载时检查初始音频
  useEffect(() => {
    if (initialAudioPath && autoTranscribe && !initialTranscription) {
      transcribeAudio(initialAudioPath);
    }
    
    // 组件卸载时清理
    return () => {
      if (realtimeSession.current) {
        stopRealtimeTranscription();
      }
    };
  }, []);
  
  // 当转写文本变化时，滚动到底部
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcription]);
  
  // 处理录音完成
  const handleRecordingComplete = (filePath) => {
    setAudioPath(filePath);
    setIsRecording(false);
    
    // 自动转写
    if (autoTranscribe) {
      transcribeAudio(filePath);
    }
  };
  
  // 处理录音开始
  const handleRecordingStart = () => {
    setIsRecording(true);
    setTranscription('');
    setError(null);
    
    // 实时转写
    if (realtime) {
      startRealtimeTranscription();
    }
  };
  
  // 处理录音取消
  const handleRecordingCancel = () => {
    setIsRecording(false);
    
    // 停止实时转写
    if (realtime && realtimeSession.current) {
      stopRealtimeTranscription();
    }
    
    // 调用取消回调
    if (onTranscriptionCancel) {
      onTranscriptionCancel();
    }
  };
  
  // 开始实时转写
  const startRealtimeTranscription = async () => {
    try {
      setIsTranscribing(true);
      setError(null);
      
      // 调用开始回调
      if (onTranscriptionStart) {
        onTranscriptionStart();
      }
      
      // 创建实时转写会话
      realtimeSession.current = await voiceService.startRealtimeTranscription({
        onPartialResult: (result) => {
          if (result && result.text) {
            setTranscription((prev) => {
              // 如果是新段落，添加换行符
              if (prev && !prev.endsWith('\n') && !prev.endsWith(' ')) {
                return `${prev} ${result.text}`;
              }
              return `${prev}${result.text}`;
            });
          }
        },
        onError: (err) => {
          setError(`实时转写错误: ${err.message || '未知错误'}`);
          setIsTranscribing(false);
        },
      });
      
      // 记录分析事件
      analyticsService.trackVoiceAction('start_realtime_transcription');
    } catch (error) {
      console.error('开始实时转写失败:', error);
      setError(`开始实时转写失败: ${error.message || '未知错误'}`);
      setIsTranscribing(false);
    }
  };
  
  // 停止实时转写
  const stopRealtimeTranscription = async () => {
    if (!realtimeSession.current) return;
    
    try {
      // 停止实时转写会话
      const finalResult = await voiceService.stopRealtimeTranscription(realtimeSession.current);
      realtimeSession.current = null;
      
      // 更新最终转写结果
      if (finalResult && finalResult.text) {
        setTranscription(finalResult.text);
        
        // 调用完成回调
        if (onTranscriptionComplete) {
          onTranscriptionComplete(finalResult.text);
        }
      }
      
      setIsTranscribing(false);
      
      // 记录分析事件
      analyticsService.trackVoiceAction('stop_realtime_transcription', {
        transcriptionLength: finalResult?.text?.length || 0,
      });
    } catch (error) {
      console.error('停止实时转写失败:', error);
      setError(`停止实时转写失败: ${error.message || '未知错误'}`);
      setIsTranscribing(false);
    }
  };
  
  // 转写音频文件
  const transcribeAudio = async (filePath) => {
    if (!filePath) {
      setError('没有可用的音频文件');
      return;
    }
    
    try {
      setIsTranscribing(true);
      setError(null);
      setProgress(0);
      
      // 调用开始回调
      if (onTranscriptionStart) {
        onTranscriptionStart();
      }
      
      // 转写音频文件
      const result = await voiceService.transcribeAudio(filePath, {
        onProgress: (p) => setProgress(p),
      });
      
      // 更新转写结果
      if (result && result.text) {
        setTranscription(result.text);
        
        // 调用完成回调
        if (onTranscriptionComplete) {
          onTranscriptionComplete(result.text);
        }
      } else {
        setError('转写结果为空');
      }
      
      // 记录分析事件
      analyticsService.trackVoiceAction('complete_transcription', {
        transcriptionLength: result?.text?.length || 0,
        duration: result?.duration || 0,
      });
    } catch (error) {
      console.error('转写音频失败:', error);
      setError(`转写音频失败: ${error.message || '未知错误'}`);
    } finally {
      setIsTranscribing(false);
      setProgress(0);
    }
  };
  
  // 复制转写文本
  const copyTranscription = () => {
    if (!transcription) return;
    
    try {
      Clipboard.setString(transcription);
      Alert.alert('成功', '转写文本已复制到剪贴板');
      
      // 记录分析事件
      analyticsService.trackVoiceAction('copy_transcription', {
        transcriptionLength: transcription.length,
      });
    } catch (error) {
      console.error('复制转写文本失败:', error);
      Alert.alert('错误', '复制转写文本失败');
    }
  };
  
  // 清除转写文本
  const clearTranscription = () => {
    setTranscription('');
    setError(null);
    
    // 记录分析事件
    analyticsService.trackVoiceAction('clear_transcription');
  };
  
  return (
    <View style={[styles.container, style]}>
      {/* 录音器 */}
      {showRecorder && (
        <VoiceRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingStart={handleRecordingStart}
          onRecordingCancel={handleRecordingCancel}
          style={styles.recorder}
        />
      )}
      
      {/* 播放器 */}
      {showPlayer && audioPath && (
        <VoicePlayer
          source={audioPath}
          style={styles.player}
        />
      )}
      
      {/* 转写控制 */}
      {!realtime && audioPath && !isRecording && (
        <View style={styles.transcribeControls}>
          <TouchableOpacity
            style={[
              styles.transcribeButton,
              {
                backgroundColor: isTranscribing
                  ? `${colors.warning}20`
                  : `${colors.primary}20`,
                borderColor: isTranscribing
                  ? colors.warning
                  : colors.primary,
              },
            ]}
            onPress={() => transcribeAudio(audioPath)}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <>
                <Icon name="mic" size={20} color={colors.primary} />
                <Text
                  variant="body"
                  size="small"
                  style={{
                    color: colors.primary,
                    marginLeft: 8,
                  }}
                >
                  转写音频
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          {isTranscribing && progress > 0 && (
            <Text
              variant="caption"
              style={{
                color: colors.textSecondary,
                marginLeft: 8,
              }}
            >
              {Math.round(progress * 100)}%
            </Text>
          )}
        </View>
      )}
      
      {/* 转写结果 */}
      <View
        style={[
          styles.transcriptionContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.transcriptionHeader}>
          <Text
            variant="body"
            size="medium"
            style={{
              color: colors.text,
              fontWeight: '500',
            }}
          >
            转写结果
          </Text>
          
          <View style={styles.transcriptionActions}>
            {transcription && (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={copyTranscription}
                >
                  <Icon name="content-copy" size={20} color={colors.primary} />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={clearTranscription}
                >
                  <Icon name="clear" size={20} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        
        <ScrollView
          ref={scrollViewRef}
          style={styles.transcriptionScroll}
          contentContainerStyle={styles.transcriptionContent}
        >
          {isTranscribing && !transcription ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                variant="body"
                size="medium"
                style={{
                  color: colors.textSecondary,
                  marginTop: 12,
                  textAlign: 'center',
                }}
              >
                正在转写...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="error-outline" size={32} color={colors.error} />
              <Text
                variant="body"
                size="medium"
                style={{
                  color: colors.error,
                  marginTop: 8,
                  textAlign: 'center',
                }}
              >
                {error}
              </Text>
            </View>
          ) : transcription ? (
            <Text
              variant="body"
              size="medium"
              style={{
                color: colors.text,
                lineHeight: 24,
              }}
            >
              {transcription}
            </Text>
          ) : (
            <Text
              variant="body"
              size="medium"
              style={{
                color: colors.textSecondary,
                textAlign: 'center',
              }}
            >
              {isRecording && realtime
                ? '正在实时转写...'
                : '录制或选择音频以开始转写'}
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  recorder: {
    marginBottom: 16,
  },
  player: {
    marginBottom: 16,
  },
  transcribeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  transcribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  transcriptionContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  transcriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  transcriptionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  transcriptionScroll: {
    maxHeight: 200,
  },
  transcriptionContent: {
    padding: 16,
    minHeight: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default VoiceTranscription;
