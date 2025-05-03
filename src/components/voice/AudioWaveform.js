import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * 音频波形组件
 * 显示音频录制或播放时的波形
 * 优化版本：更生动的动画和渐变效果
 */
const AudioWaveform = ({
  isRecording = false,
  isPlaying = false,
  amplitude = 0,
  duration = 0,
  currentTime = 0,
  barCount = 60,
  minHeight = 3,
  maxHeight = 50,
  barWidth = 3,
  barGap = 2,
  style = {},
  gradientColors = null,
  mirrorWave = true, // 是否镜像波形（上下对称）
  rounded = true // 是否使用圆角
}) => {
  const { colors } = useTheme();
  const [bars, setBars] = useState([]);
  const animatedValues = useRef([]);
  const animatedHeights = useRef([]);
  const containerWidth = Dimensions.get('window').width - 40; // 减去边距
  const actualBarCount = Math.min(barCount, Math.floor(containerWidth / (barWidth + barGap)));

  // 默认渐变颜色
  const defaultGradientColors = useMemo(() => {
    return gradientColors || [
      colors.primary + 'CC', // 主色带透明度
      colors.primary,
      colors.primary + '99' // 主色带透明度
    ];
  }, [colors.primary, gradientColors]);

  // 初始化动画值
  useEffect(() => {
    animatedValues.current = Array(actualBarCount).fill().map(() => new Animated.Value(0));
    animatedHeights.current = Array(actualBarCount).fill().map(() => new Animated.Value(minHeight));

    // 初始化柱状图数据
    const initialBars = Array(actualBarCount).fill().map(() => ({
      height: minHeight,
      opacity: 0.3
    }));
    setBars(initialBars);
  }, [actualBarCount, minHeight]);

  // 处理录音状态变化
  useEffect(() => {
    if (isRecording) {
      // 开始波形动画
      startWaveformAnimation();
    } else {
      // 重置波形
      resetWaveform();
    }

    return () => {
      // 清理动画
      animatedValues.current.forEach(anim => anim.stopAnimation());
      animatedHeights.current.forEach(anim => anim.stopAnimation());
    };
  }, [isRecording]);

  // 处理播放状态变化
  useEffect(() => {
    if (isPlaying) {
      // 开始播放波形动画
      startPlaybackAnimation();
    } else {
      // 暂停播放波形动画
      pausePlaybackAnimation();
    }
  }, [isPlaying, currentTime, duration]);

  // 处理振幅变化
  useEffect(() => {
    if (isRecording && amplitude > 0) {
      updateWaveformWithAmplitude(amplitude);
    }
  }, [amplitude, isRecording]);

  // 开始波形动画 - 增强版
  const startWaveformAnimation = () => {
    // 随机生成初始波形 - 使用更自然的分布
    const randomBars = Array(actualBarCount).fill().map((_, index) => {
      // 创建中间高两边低的自然分布
      const positionFactor = 1 - 0.4 * Math.abs((index - actualBarCount / 2) / (actualBarCount / 2));

      // 添加一些随机性
      const randomFactor = 0.7 + Math.random() * 0.6;

      // 计算高度和不透明度
      const height = minHeight + (positionFactor * randomFactor * 15);
      const opacity = 0.4 + (positionFactor * 0.6);

      return { height, opacity };
    });

    setBars(randomBars);

    // 为每个柱状图设置动画 - 使用更平滑的动画
    animatedValues.current.forEach((anim, index) => {
      // 使用不同的动画持续时间，创造更自然的效果
      // 中间的柱子动画更快，两边的更慢
      const positionFactor = 1 - 0.3 * Math.abs((index - actualBarCount / 2) / (actualBarCount / 2));
      const duration1 = 500 + (1 - positionFactor) * 800 + Math.random() * 400;
      const duration2 = 500 + (1 - positionFactor) * 800 + Math.random() * 400;

      // 使用交错的动画开始时间，创造波浪效果
      const delay = Math.abs(index - actualBarCount / 2) * 20;

      // 延迟启动动画，创造波浪效果
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: duration1,
              easing: Easing.inOut(Easing.sine),
              useNativeDriver: true
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: duration2,
              easing: Easing.inOut(Easing.sine),
              useNativeDriver: true
            })
          ])
        ).start();
      }, delay);
    });
  };

  // 根据振幅更新波形 - 增强版
  const updateWaveformWithAmplitude = (amp) => {
    // 将振幅值（通常为0-1）映射到高度范围，使用非线性映射使小振幅更明显
    const mappedHeight = minHeight + (maxHeight - minHeight) * Math.pow(Math.min(1, amp), 0.7);

    // 创建波浪效果的偏移量数组 - 使波形看起来像是在流动
    const waveOffsets = [];
    for (let i = 0; i < actualBarCount; i++) {
      // 使用正弦函数创建波浪效果
      const phase = (Date.now() / 1000) % (2 * Math.PI); // 随时间变化的相位
      const offset = Math.sin(phase + i * 0.2) * 0.2 + 1; // 波动范围为0.8-1.2
      waveOffsets.push(offset);
    }

    // 更新每个柱状图的高度
    animatedHeights.current.forEach((anim, index) => {
      // 创建波浪效果：中间的柱子高一些，两边的低一些
      const positionFactor = 1 - 0.3 * Math.abs((index - actualBarCount / 2) / (actualBarCount / 2));

      // 添加一些随机性，使波形看起来更自然，但不要太随机
      const randomFactor = 0.85 + Math.random() * 0.3;

      // 应用波浪偏移
      const waveOffset = waveOffsets[index];

      // 结合位置因子、随机因子和波浪偏移
      const targetHeight = Math.max(
        minHeight,
        mappedHeight * randomFactor * positionFactor * waveOffset
      );

      // 使用弹簧动画使过渡更自然，调整参数使动画更流畅
      Animated.spring(anim, {
        toValue: targetHeight,
        friction: 6,  // 降低摩擦力，使动画更流畅
        tension: 50,  // 增加张力，使动画更快速响应
        useNativeDriver: false
      }).start();
    });
  };

  // 开始播放波形动画
  const startPlaybackAnimation = () => {
    if (duration <= 0) return;

    // 计算播放进度
    const progress = currentTime / duration;
    const activeBarCount = Math.floor(actualBarCount * progress);

    // 更新柱状图状态
    const newBars = Array(actualBarCount).fill().map((_, index) => {
      if (index < activeBarCount) {
        // 已播放部分 - 更活跃的波形
        return {
          height: minHeight + Math.random() * (maxHeight - minHeight),
          opacity: 1
        };
      } else {
        // 未播放部分 - 较静态的波形
        return {
          height: minHeight + Math.random() * 10,
          opacity: 0.4
        };
      }
    });

    setBars(newBars);
  };

  // 暂停播放波形动画
  const pausePlaybackAnimation = () => {
    // 可以保持当前状态，或者做一些视觉上的调整
    // 例如降低所有柱子的不透明度
    animatedValues.current.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true
      }).start();
    });
  };

  // 重置波形
  const resetWaveform = () => {
    // 停止所有动画
    animatedValues.current.forEach(anim => anim.stopAnimation());

    // 平滑过渡到初始状态
    animatedHeights.current.forEach(anim => {
      Animated.timing(anim, {
        toValue: minHeight,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      }).start();
    });

    // 重置柱状图数据
    const resetBars = Array(actualBarCount).fill().map(() => ({
      height: minHeight,
      opacity: 0.3
    }));
    setBars(resetBars);
  };

  // 渲染单个波形柱
  const renderBar = (heightAnim, index, isBottom = false) => {
    // 计算不透明度动画值
    const opacity = animatedValues.current[index].interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.4, 0.7, 1]
    });

    // 计算柱子高度
    const height = isBottom ? heightAnim : heightAnim;

    return (
      <Animated.View
        key={`bar-${index}${isBottom ? '-bottom' : ''}`}
        style={[
          styles.barContainer,
          {
            width: barWidth,
            marginHorizontal: barGap / 2,
            opacity: opacity,
            height: height,
            transform: [{ scaleY: isBottom ? -1 : 1 }] // 镜像效果
          }
        ]}
      >
        <LinearGradient
          colors={defaultGradientColors}
          style={[
            styles.bar,
            {
              width: '100%',
              height: '100%',
              borderRadius: rounded ? 50 : 0
            }
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.waveformContainer}>
        {/* 上半部分波形 */}
        <View style={styles.waveSection}>
          {animatedHeights.current.map((heightAnim, index) =>
            renderBar(heightAnim, index)
          )}
        </View>

        {/* 下半部分波形（镜像） */}
        {mirrorWave && (
          <View style={styles.waveSection}>
            {animatedHeights.current.map((heightAnim, index) =>
              renderBar(heightAnim, index, true)
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  waveformContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  waveSection: {
    flexDirection: 'row',
    alignItems: 'flex-end', // 底部对齐
    height: '50%',
    width: '100%',
    justifyContent: 'center',
  },
  barContainer: {
    alignSelf: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    height: '100%',
  }
});

export default AudioWaveform;
