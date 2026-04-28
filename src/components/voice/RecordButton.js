import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Text,
  Vibration,
  AccessibilityInfo,
  Platform,
  PixelRatio,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext'; // Correct import
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Haptics, ImpactFeedbackStyle, NotificationFeedbackType } from '../../utils/expoCompatibility';
import { SPACING, RADIUS, ELEVATION, SIZE, ANIMATION, BORDER } from '../../theme/tokens';

/**
 * 录音按钮组件 - 增强版
 * 提供动画效果和状态指示，支持多种反馈方式
 * 优化版本：更现代的UI和交互体验，增强的可访问性支持
 * Refactored with Design Tokens
 */
const RecordButton = ({
  onStartRecording,
  onStopRecording,
  isRecording = false,
  size = 70, // Default size, might be overridden by props but we strive to use tokens internally where possible
  disabled = false,
  style = {},
  showTimer = true,
  maxDuration = 60, // 最大录音时长（秒）
  pulsate = true, // 是否显示脉动效果
  vibrate = true, // 是否启用振动反馈
  showVolumeIndicator = true, // 是否显示音量指示器
  volume = 0, // 当前音量（0-1）
  onLongPress = null, // 长按回调
  onPressIn = null, // 按下回调
  onPressOut = null, // 释放回调
  accessibilityLabel = '录音按钮', // 可访问性标签
  accessibilityHint = '点击开始录音，再次点击停止录音', // 可访问性提示
  showRemainingTime = true, // 是否显示剩余时间
  countdownThreshold = 10, // 倒计时阈值（秒）
  hapticFeedback = true, // 是否启用触觉反馈
  buttonColor = null, // 自定义按钮颜色
  pulseColor = null, // 自定义脉冲颜色
  iconName = null, // 自定义图标名称
  iconSize = null, // 自定义图标大小
  iconColor = '#ffffff', // 自定义图标颜色
  timerPosition = 'top', // 计时器位置：top 或 bottom
  showRecordingLabel = true, // 是否显示"录音中..."标签
  recordingLabelText = '录音中...', // 自定义录音标签文本
}) => {
  const { theme } = useTheme();
  // Ensure correct color references
  const colors = theme.colors || theme;

  const [recordingTime, setRecordingTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [countingDown, setCountingDown] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacityAnim = useRef(new Animated.Value(0.5)).current;
  const volumeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);
  const longPressRef = useRef(null);

  // 获取屏幕像素密度
  const pixelRatio = PixelRatio.get();

  // 根据屏幕密度调整大小
  const adjustedSize = pixelRatio < 2 ? size * 0.9 : size;

  // 确定实际使用的颜色
  const actualButtonColor = buttonColor || (isRecording ? (colors.error || '#ff3b30') : (colors.primary || '#007AFF'));
  const actualPulseColor = pulseColor || (colors.primary || '#007AFF');
  const actualIconName = iconName || (isRecording ? 'stop' : 'microphone');
  const actualIconSize = iconSize || adjustedSize / 2.2;

  // 检查屏幕阅读器状态
  useEffect(() => {
    const checkScreenReader = async () => {
      const isEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(isEnabled);
    };

    checkScreenReader();

    // 监听屏幕阅读器状态变化
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      checkScreenReader
    );

    return () => {
      // 清理监听器
      subscription.remove();
    };
  }, []);

  // 处理录音状态变化 - 增强版
  useEffect(() => {
    if (isRecording) {
      // 开始录音
      startPulseAnimation();
      setTimerActive(true);
      setCountingDown(false);

      // 提供多种反馈
      if (vibrate && !isScreenReaderEnabled) {
        // 使用更复杂的振动模式表示开始
        Vibration.vibrate([0, 100, 50, 50]);
      }

      // 触觉反馈 - 仅在支持的设备上
      if (hapticFeedback && Platform.OS === 'ios') {
        try {
          Haptics.impactAsync(ImpactFeedbackStyle.Medium);
        } catch (error) {
          // 忽略不支持的设备错误
        }
      }

      // 屏幕阅读器通知
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('开始录音');
      }
    } else {
      // 停止录音
      stopPulseAnimation();
      setTimerActive(false);
      setRecordingTime(0);
      setCountingDown(false);

      // 提供反馈
      if (vibrate && !isScreenReaderEnabled) {
        // 使用不同的振动模式表示结束
        Vibration.vibrate([0, 70, 40, 70]);
      }

      // 触觉反馈
      if (hapticFeedback && Platform.OS === 'ios') {
        try {
          Haptics.notificationAsync(NotificationFeedbackType.Success);
        } catch (error) {
          // 忽略不支持的设备错误
        }
      }

      // 屏幕阅读器通知
      if (isScreenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility('录音已停止');
      }
    }

    // 清理函数
    return () => {
      // 清理动画和计时器
      pulseAnim.stopAnimation();
      pulseOpacityAnim.stopAnimation();
      volumeAnim.stopAnimation();

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
      }
    };
  }, [isRecording, vibrate, hapticFeedback, isScreenReaderEnabled]);

  // 处理计时器 - 增强版
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          const timeRemaining = maxDuration - newTime;

          // 如果达到最大时长，自动停止录音
          if (newTime >= maxDuration) {
            // 提供多种反馈
            if (vibrate && !isScreenReaderEnabled) {
              Vibration.vibrate([0, 100, 100, 100, 100, 100]); // 更强烈的振动提示
            }

            if (hapticFeedback && Platform.OS === 'ios') {
              try {
                Haptics.notificationAsync(NotificationFeedbackType.Warning);
              } catch (error) {
                // 忽略不支持的设备错误
              }
            }

            // 屏幕阅读器通知
            if (isScreenReaderEnabled) {
              AccessibilityInfo.announceForAccessibility('已达到最大录音时长，录音已停止');
            }

            onStopRecording();
          }
          // 进入倒计时阈值
          else if (timeRemaining <= countdownThreshold && !countingDown) {
            setCountingDown(true);

            // 屏幕阅读器通知
            if (isScreenReaderEnabled) {
              AccessibilityInfo.announceForAccessibility(`还剩${timeRemaining}秒录音时间`);
            }
          }
          // 倒计时中的反馈
          else if (timeRemaining <= countdownThreshold) {
            // 每2秒提供一次反馈
            if (timeRemaining % 2 === 0) {
              // 振动反馈 - 随着时间减少振动强度增加
              if (vibrate && !isScreenReaderEnabled) {
                const intensity = Math.min(100, 50 + (countdownThreshold - timeRemaining) * 5);
                Vibration.vibrate(intensity);
              }

              // 触觉反馈
              if (hapticFeedback && Platform.OS === 'ios' && timeRemaining <= 5) {
                try {
                  Haptics.impactAsync(ImpactFeedbackStyle.Light);
                } catch (error) {
                  // 忽略不支持的设备错误
                }
              }
            }
          }

          return newTime;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerActive, maxDuration, onStopRecording, vibrate, hapticFeedback, isScreenReaderEnabled, countdownThreshold, countingDown]);

  // 处理音量变化
  useEffect(() => {
    if (showVolumeIndicator && isRecording) {
      // 平滑动画到新的音量值
      Animated.spring(volumeAnim, {
        toValue: volume,
        useNativeDriver: false, // height/backgroundColor not supported by native driver
        friction: 7,
        tension: 40,
      }).start();
    }
  }, [volume, showVolumeIndicator, isRecording, volumeAnim]);

  // 按下按钮处理 - 增强版
  const handlePressIn = () => {
    // 按钮缩小动画
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 7,
      tension: 40,
    }).start();

    // 触觉反馈
    if (hapticFeedback && Platform.OS === 'ios' && !disabled) {
      try {
        Haptics.impactAsync(ImpactFeedbackStyle.Light);
      } catch (error) {
        // 忽略不支持的设备错误
      }
    }

    // 设置长按定时器
    if (onLongPress && !disabled) {
      longPressRef.current = setTimeout(() => {
        // 触发长按回调
        onLongPress();

        // 长按触觉反馈
        if (hapticFeedback && Platform.OS === 'ios') {
          try {
            Haptics.impactAsync(ImpactFeedbackStyle.Heavy);
          } catch (error) {
            // 忽略不支持的设备错误
          }
        }

        // 清除定时器引用
        longPressRef.current = null;
      }, 800); // 800ms长按阈值
    }

    // 调用外部onPressIn回调
    if (onPressIn) {
      onPressIn();
    }
  };

  // 释放按钮处理 - 增强版
  const handlePressOut = () => {
    // 按钮恢复动画
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 40,
    }).start();

    // 清除长按定时器
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }

    // 调用外部onPressOut回调
    if (onPressOut) {
      onPressOut();
    }
  };

  // 开始脉动动画 - 增强版
  const startPulseAnimation = () => {
    if (!pulsate) {return;}

    // 创建更自然的呼吸效果
    const breatheAnimation = () => {
      // 创建更复杂的动画序列，模拟呼吸效果
      Animated.sequence([
        // 扩张阶段 - 缓慢扩张
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 1200,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1), // 自定义贝塞尔曲线
          useNativeDriver: true,
        }),
        // 短暂停留
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // 收缩阶段 - 较快收缩
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          useNativeDriver: true,
        }),
        // 短暂停留
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          breatheAnimation(); // 循环动画
        }
      });
    };

    // 创建更自然的透明度变化
    const opacityAnimation = () => {
      // 透明度变化与呼吸效果同步，但有轻微偏移
      Animated.sequence([
        Animated.timing(pulseOpacityAnim, {
          toValue: 0.2,
          duration: 1300, // 比呼吸动画稍长
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacityAnim, {
          toValue: 0.5,
          duration: 1200,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          opacityAnimation(); // 循环动画
        }
      });
    };

    // 启动两个动画
    breatheAnimation();
    opacityAnimation();
  };

  // 停止脉动动画 - 增强版
  const stopPulseAnimation = () => {
    // 停止当前正在进行的动画
    pulseAnim.stopAnimation();
    pulseOpacityAnim.stopAnimation();

    // 创建平滑的淡出效果
    Animated.parallel([
      // 使用弹簧动画使圆圈回到原始大小
      Animated.spring(pulseAnim, {
        toValue: 1,
        friction: 8,  // 增加摩擦力使动画更平滑
        tension: 40,  // 适中的张力
        useNativeDriver: true,
      }),
      // 使用缓动函数使透明度平滑淡出
      Animated.timing(pulseOpacityAnim, {
        toValue: 0,
        duration: 400,  // 稍微延长淡出时间
        easing: Easing.bezier(0.0, 0.0, 0.2, 1),  // 平滑的淡出曲线
        useNativeDriver: true,
      }),
    ]).start();
  };

  // 格式化时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算剩余时间百分比
  const remainingTimePercent = ((maxDuration - recordingTime) / maxDuration) * 100;

  // 计算进度条颜色
  const getProgressColor = () => {
    if (remainingTimePercent < 20) {
      return colors.error || '#ff3b30';
    } else if (remainingTimePercent < 40) {
      return colors.warning || '#ff9500';
    } else {
      return colors.primary || '#007AFF';
    }
  };

  // 渲染音量指示器
  const renderVolumeIndicator = () => {
    if (!showVolumeIndicator || !isRecording) {return null;}

    // 计算音量条数量
    const numBars = 8;
    const bars = [];

    // 创建音量条
    for (let i = 0; i < numBars; i++) {
      // 计算条高
      const barHeight = 4 + (i * 2);

      // 计算条透明度 - 使用动画值
      const opacity = volumeAnim.interpolate({
        inputRange: [i / numBars, (i + 1) / numBars],
        outputRange: [0.3, 1],
        extrapolate: 'clamp',
      });

      // 计算条颜色 - 从绿色到红色
      const backgroundColor = volumeAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [colors.primary || '#007AFF', colors.warning || '#ff9500', colors.error || '#ff3b30'],
        extrapolate: 'clamp',
      });

      bars.push(
        <Animated.View
          key={i}
          style={[
            styles.volumeBar,
            {
              height: barHeight,
              opacity,
              backgroundColor,
            },
          ]}
        />
      );
    }

    return (
      <View style={styles.volumeContainer}>
        {bars}
      </View>
    );
  };

  // 渲染计时器
  const renderTimer = () => {
    if (!showTimer || !isRecording) {return null;}

    // 计算计时器位置样式
    const timerPositionStyle = timerPosition === 'bottom'
      ? { bottom: -60, top: 'auto' }
      : { top: -60, bottom: 'auto' };

    // 计算剩余时间文本
    const remainingTimeText = showRemainingTime
      ? `剩余: ${formatTime(maxDuration - recordingTime)}`
      : `最大时长: ${formatTime(maxDuration)}`;

    // 计算倒计时样式
    const countdownStyle = countingDown
      ? { color: remainingTimePercent < 20 ? (colors.error || '#ff3b30') : (colors.warning || '#ff9500') }
      : {};

    return (
      <View style={[styles.timerContainer, timerPositionStyle]}>
        <Text style={[styles.timer, { color: colors.text }, countdownStyle]}>
          {formatTime(recordingTime)}
        </Text>
        <View style={[styles.progressBarContainer, { backgroundColor: colors.border || '#e0e0e0' }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${remainingTimePercent}%`,
                backgroundColor: getProgressColor(),
              },
            ]}
          />
        </View>
        <Text style={[styles.maxDuration, { color: colors.textSecondary || '#666' }, countdownStyle]}>
          {remainingTimeText}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* 计时器 */}
      {renderTimer()}

      {/* 脉动圆圈 */}
      <Animated.View
        style={[
          styles.pulseCircle,
          {
            width: adjustedSize * 1.8,
            height: adjustedSize * 1.8,
            borderRadius: adjustedSize * 1.8 / 2,
            backgroundColor: isRecording ? actualPulseColor : 'transparent',
            transform: [{ scale: pulseAnim }],
            opacity: pulseOpacityAnim,
          },
        ]}
      />

      {/* 内部阴影 */}
      {isRecording && (
        <View
          style={[
            styles.innerShadow,
            {
              width: adjustedSize * 1.2,
              height: adjustedSize * 1.2,
              borderRadius: adjustedSize * 1.2 / 2,
            },
          ]}
        />
      )}

      {/* 音量指示器 */}
      {renderVolumeIndicator()}

      {/* 按钮 */}
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => {
            if (isRecording) {
              onStopRecording();
            } else {
              onStartRecording();
            }
          }}
          disabled={disabled}
          style={[
            styles.button,
            {
              width: adjustedSize,
              height: adjustedSize,
              borderRadius: adjustedSize / 2,
              backgroundColor: actualButtonColor,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          accessible={true}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityRole="button"
          accessibilityState={{
            disabled: disabled,
            checked: isRecording,
          }}
        >
          <Icon
            name={actualIconName}
            size={actualIconSize}
            color={iconColor}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* 录音状态文本 */}
      {isRecording && showRecordingLabel && (
        <Text
          style={[styles.recordingStatus, { color: colors.error || '#ff3b30' }]}
          accessible={true}
          accessibilityLabel={`${recordingLabelText} 已录制${formatTime(recordingTime)}`}
          accessibilityRole="text"
        >
          {recordingLabelText}
        </Text>
      )}

      {/* 倒计时提示 - 仅在倒计时状态下显示 */}
      {isRecording && countingDown && (
        <Text
          style={[
            styles.countdownText,
            {
              color: remainingTimePercent < 20 ? (colors.error || '#ff3b30') : (colors.warning || '#ff9500'),
            },
          ]}
          accessible={true}
          accessibilityLabel={`还剩${maxDuration - recordingTime}秒`}
          accessibilityRole="text"
        >
          还剩 {maxDuration - recordingTime} 秒
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    minHeight: 120, // 确保有足够的空间显示所有元素
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    ...ELEVATION.md,
  },
  pulseCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  innerShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.05)',
    ...ELEVATION.xs,
    zIndex: 1,
  },
  timerContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: '100%',
    zIndex: 3,
  },
  timer: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  maxDuration: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '80%',
    height: 6,
    borderRadius: RADIUS.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: RADIUS.xs,
  },
  recordingStatus: {
    marginTop: SPACING.ms,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  // 新增样式
  volumeContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 20,
    width: '60%',
    zIndex: 2,
    top: -30,
  },
  volumeBar: {
    width: 4,
    marginHorizontal: 1,
    borderRadius: RADIUS.xs,
  },
  countdownText: {
    position: 'absolute',
    bottom: -30,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
});

export default RecordButton;
