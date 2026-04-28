/**
 * 语音播放组件
 * 提供语音播放功能，支持播放、暂停、继续和停止
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Slider,
  Platform,
} from 'react-native';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { analyticsService } from '../../services/analytics/analyticsService';

/**
 * 语音播放组件
 * @param {string} source - 音频文件路径
 * @param {function} onPlayComplete - 播放完成回调
 * @param {function} onPlayStart - 播放开始回调
 * @param {function} onPlayPause - 播放暂停回调
 * @param {function} onPlayResume - 播放继续回调
 * @param {function} onPlayStop - 播放停止回调
 * @param {boolean} autoPlay - 是否自动播放
 * @param {boolean} showFileName - 是否显示文件名
 * @param {boolean} compact - 是否使用紧凑模式
 * @param {object} style - 自定义样式
 */
const VoicePlayer = ({
  source,
  onPlayComplete,
  onPlayStart,
  onPlayPause,
  onPlayResume,
  onPlayStop,
  autoPlay = false,
  showFileName = true,
  compact = false,
  style,
}) => {
  // 使用主题
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playTime, setPlayTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');
  const [playSeconds, setPlaySeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [fileName, setFileName] = useState('');
  const [fileExists, setFileExists] = useState(false);

  // 引用
  const audioPlayer = useRef(null);

  // 初始化AudioRecorderPlayer
  useEffect(() => {
    try {
      audioPlayer.current = new AudioRecorderPlayer();
      console.log('VoicePlayer: AudioRecorderPlayer初始化成功');
    } catch (error) {
      console.warn('VoicePlayer: AudioRecorderPlayer初始化失败:', error);
    }
  }, []);

  // 组件挂载时检查文件
  useEffect(() => {
    checkFile();

    // 组件卸载时清理
    return () => {
      if (isPlaying) {
        stopPlayer();
      }
    };
  }, [source]);

  // 自动播放
  useEffect(() => {
    if (autoPlay && fileExists && !isPlaying) {
      startPlayer();
    }
  }, [fileExists, autoPlay]);

  // 检查文件是否存在
  const checkFile = async () => {
    if (!source) {
      setFileExists(false);
      return;
    }

    try {
      const exists = await RNFS.exists(source);
      setFileExists(exists);

      if (exists) {
        // 获取文件名
        const fileName = source.split('/').pop();
        setFileName(fileName);

        // 获取音频时长
        const info = await audioPlayer.current.getInfo(source);
        if (info && info.duration) {
          setDurationSeconds(info.duration / 1000);
          setDuration(audioPlayer.current.mmssss(info.duration));
        }
      }
    } catch (error) {
      console.error('检查音频文件失败:', error);
      setFileExists(false);
    }
  };

  // 开始播放
  const startPlayer = async () => {
    if (!fileExists) {return;}

    try {
      // 开始播放
      await audioPlayer.current.startPlayer(source);

      // 设置播放状态
      setIsPlaying(true);
      setIsPaused(false);

      // 监听播放进度
      audioPlayer.current.addPlayBackListener((e) => {
        setPlaySeconds(e.currentPosition / 1000);
        setPlayTime(audioPlayer.current.mmssss(e.currentPosition));

        // 播放完成
        if (e.currentPosition >= e.duration) {
          stopPlayer();

          // 调用完成回调
          if (onPlayComplete) {
            onPlayComplete();
          }
        }
      });

      // 调用回调
      if (onPlayStart) {
        onPlayStart();
      }

      // 记录分析事件
      analyticsService.trackVoiceAction('start_playback', {
        duration: durationSeconds,
      });
    } catch (error) {
      console.error('开始播放失败:', error);
    }
  };

  // 暂停播放
  const pausePlayer = async () => {
    if (!isPlaying || isPaused) {return;}

    try {
      await audioPlayer.current.pausePlayer();
      setIsPaused(true);

      // 调用回调
      if (onPlayPause) {
        onPlayPause();
      }

      // 记录分析事件
      analyticsService.trackVoiceAction('pause_playback');
    } catch (error) {
      console.error('暂停播放失败:', error);
    }
  };

  // 继续播放
  const resumePlayer = async () => {
    if (!isPlaying || !isPaused) {return;}

    try {
      await audioPlayer.current.resumePlayer();
      setIsPaused(false);

      // 调用回调
      if (onPlayResume) {
        onPlayResume();
      }

      // 记录分析事件
      analyticsService.trackVoiceAction('resume_playback');
    } catch (error) {
      console.error('继续播放失败:', error);
    }
  };

  // 停止播放
  const stopPlayer = async () => {
    if (!isPlaying) {return;}

    try {
      await audioPlayer.current.stopPlayer();
      audioPlayer.current.removePlayBackListener();

      // 重置状态
      setIsPlaying(false);
      setIsPaused(false);
      setPlayTime('00:00');
      setPlaySeconds(0);

      // 调用回调
      if (onPlayStop) {
        onPlayStop();
      }

      // 记录分析事件
      analyticsService.trackVoiceAction('stop_playback');
    } catch (error) {
      console.error('停止播放失败:', error);
    }
  };

  // 跳转到指定位置
  const seekToPosition = async (seconds) => {
    if (!isPlaying) {return;}

    try {
      await audioPlayer.current.seekToPlayer(seconds * 1000);
    } catch (error) {
      console.error('跳转播放位置失败:', error);
    }
  };

  // 格式化时间显示
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染紧凑模式
  if (compact) {
    return (
      <View
        style={[
          styles.compactContainer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          style,
        ]}
      >
        {/* 播放按钮 */}
        <TouchableOpacity
          style={[
            styles.compactButton,
            {
              backgroundColor: isPlaying
                ? isPaused
                  ? `${colors.warning}20`
                  : `${colors.primary}20`
                : `${colors.primary}10`,
            },
          ]}
          onPress={
            isPlaying
              ? isPaused
                ? resumePlayer
                : pausePlayer
              : startPlayer
          }
          disabled={!fileExists}
        >
          <Icon
            name={
              isPlaying
                ? isPaused
                  ? 'play-arrow'
                  : 'pause'
                : 'play-arrow'
            }
            size={20}
            color={
              isPlaying
                ? isPaused
                  ? colors.warning
                  : colors.primary
                : colors.primary
            }
          />
        </TouchableOpacity>

        {/* 进度条 */}
        <View style={styles.compactProgressContainer}>
          <Slider
            style={styles.compactSlider}
            minimumValue={0}
            maximumValue={durationSeconds > 0 ? durationSeconds : 1}
            value={playSeconds}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={`${colors.border}`}
            thumbTintColor={colors.primary}
            onSlidingComplete={seekToPosition}
            disabled={!isPlaying}
          />

          <View style={styles.compactTimeContainer}>
            <Text
              variant="caption"
              style={{ color: colors.textSecondary, fontSize: 10 }}
            >
              {formatTime(playSeconds)}
            </Text>
            <Text
              variant="caption"
              style={{ color: colors.textSecondary, fontSize: 10 }}
            >
              {formatTime(durationSeconds)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // 渲染完整模式
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {/* 文件名 */}
      {showFileName && fileName && (
        <Text
          variant="body"
          size="small"
          style={{
            color: colors.textSecondary,
            marginBottom: 8,
          }}
        >
          {fileName}
        </Text>
      )}

      {/* 播放控制 */}
      <View style={styles.controlsContainer}>
        {/* 播放/暂停按钮 */}
        <TouchableOpacity
          style={[
            styles.playButton,
            {
              backgroundColor: isPlaying
                ? isPaused
                  ? `${colors.warning}20`
                  : `${colors.primary}20`
                : `${colors.primary}10`,
              borderColor: isPlaying
                ? isPaused
                  ? colors.warning
                  : colors.primary
                : colors.primary,
            },
          ]}
          onPress={
            isPlaying
              ? isPaused
                ? resumePlayer
                : pausePlayer
              : startPlayer
          }
          disabled={!fileExists}
        >
          <Icon
            name={
              isPlaying
                ? isPaused
                  ? 'play-arrow'
                  : 'pause'
                : 'play-arrow'
            }
            size={24}
            color={
              isPlaying
                ? isPaused
                  ? colors.warning
                  : colors.primary
                : colors.primary
            }
          />
        </TouchableOpacity>

        {/* 停止按钮 */}
        {isPlaying && (
          <TouchableOpacity
            style={[
              styles.stopButton,
              {
                backgroundColor: `${colors.error}20`,
                borderColor: colors.error,
              },
            ]}
            onPress={stopPlayer}
          >
            <Icon name="stop" size={20} color={colors.error} />
          </TouchableOpacity>
        )}

        {/* 进度和时间 */}
        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={durationSeconds > 0 ? durationSeconds : 1}
            value={playSeconds}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={`${colors.border}`}
            thumbTintColor={colors.primary}
            onSlidingComplete={seekToPosition}
            disabled={!isPlaying}
          />

          <View style={styles.timeContainer}>
            <Text
              variant="caption"
              style={{ color: colors.textSecondary }}
            >
              {formatTime(playSeconds)}
            </Text>
            <Text
              variant="caption"
              style={{ color: colors.textSecondary }}
            >
              {formatTime(durationSeconds)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
  },
  progressContainer: {
    flex: 1,
    marginLeft: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
  },
  compactButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactProgressContainer: {
    flex: 1,
    marginLeft: 8,
  },
  compactSlider: {
    width: '100%',
    height: 20,
  },
  compactTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
});

export default VoicePlayer;
