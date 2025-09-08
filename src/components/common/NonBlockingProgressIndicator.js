/**
 * 非阻塞进度指示器
 * 专门用于大文件处理，避免UI阻塞
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const NonBlockingProgressIndicator = ({
  progress = 0,
  stage = 'preparing',
  message = '',
  totalChunks = 0,
  processedChunks = 0,
  isVisible = true,
  style = {},
  textStyle = {},
  progressBarStyle = {},
  showDetails = true,
  animated = true
}) => {
  const [localProgress, setLocalProgress] = useState(0);
  const [localMessage, setLocalMessage] = useState('');
  const [localStage, setLocalStage] = useState('');
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const messageAnim = useRef(new Animated.Value(1)).current;
  const stageAnim = useRef(new Animated.Value(1)).current;

  // 使用requestIdleCallback或setTimeout确保UI更新不阻塞
  const updateUI = (updates) => {
    const update = () => {
      if (updates.progress !== undefined) {
        setLocalProgress(updates.progress);
      }
      if (updates.message !== undefined) {
        setLocalMessage(updates.message);
      }
      if (updates.stage !== undefined) {
        setLocalStage(updates.stage);
      }
    };

    // 优先使用requestIdleCallback，然后是requestAnimationFrame，最后是setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(update, { timeout: 16 });
    } else if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(update);
    } else {
      setTimeout(update, 0);
    }
  };

  // 监听外部进度变化
  useEffect(() => {
    updateUI({ progress, message, stage });
  }, [progress, message, stage]);

  // 动画进度条
  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: localProgress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(localProgress);
    }
  }, [localProgress, animated, progressAnim]);

  // 消息变化动画
  useEffect(() => {
    if (animated && localMessage !== message) {
      messageAnim.setValue(0);
      Animated.timing(messageAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [localMessage, animated, messageAnim]);

  // 阶段变化动画
  useEffect(() => {
    if (animated && localStage !== stage) {
      stageAnim.setValue(0);
      Animated.timing(stageAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [localStage, animated, stageAnim]);

  if (!isVisible) {
    return null;
  }

  // 获取阶段颜色
  const getStageColor = (stage) => {
    switch (stage) {
      case 'preparing':
        return '#FF9500'; // 橙色
      case 'reading':
        return '#007AFF'; // 蓝色
      case 'processing':
        return '#34C759'; // 绿色
      case 'converting':
        return '#AF52DE'; // 紫色
      case 'uploading':
        return '#FF3B30'; // 红色
      case 'complete':
        return '#34C759'; // 绿色
      default:
        return '#007AFF'; // 默认蓝色
    }
  };

  // 获取阶段图标
  const getStageIcon = (stage) => {
    switch (stage) {
      case 'preparing':
        return '📋';
      case 'reading':
        return '📖';
      case 'processing':
        return '⚙️';
      case 'converting':
        return '🔄';
      case 'uploading':
        return '📤';
      case 'complete':
        return '✅';
      default:
        return '📄';
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* 阶段指示器 */}
      <View style={styles.stageContainer}>
        <Text style={styles.stageIcon}>{getStageIcon(localStage)}</Text>
        <Animated.Text 
          style={[
            styles.stageText,
            { 
              color: getStageColor(localStage),
              opacity: stageAnim,
              transform: [{ scale: stageAnim }]
            }
          ]}
        >
          {localStage.toUpperCase()}
        </Animated.Text>
      </View>

      {/* 进度条 */}
      <View style={[styles.progressContainer, progressBarStyle]}>
        <View style={styles.progressBackground}>
          <Animated.View 
            style={[
              styles.progressFill,
              { 
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%']
                }),
                backgroundColor: getStageColor(localStage)
              }
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(localProgress)}%</Text>
      </View>

      {/* 消息 */}
      <Animated.Text 
        style={[
          styles.messageText,
          textStyle,
          { 
            opacity: messageAnim,
            transform: [{ translateY: messageAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0]
            })}]
          }
        ]}
        numberOfLines={2}
      >
        {localMessage}
      </Animated.Text>

      {/* 详细信息 */}
      {showDetails && totalChunks > 0 && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsText}>
            处理进度: {processedChunks}/{totalChunks} 块
          </Text>
          <Text style={styles.detailsText}>
            完成度: {Math.round((processedChunks / totalChunks) * 100)}%
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    ...Platform.select({
      ios: {
        borderWidth: 0.5,
        borderColor: 'rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  stageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stageIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  stageText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBackground: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  detailsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});

export default NonBlockingProgressIndicator;
