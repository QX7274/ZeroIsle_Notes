/**
 * 统一的加载指示器组件
 * 用于所有文档查看器，确保加载样式和体验的一致性
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const LoadingIndicator = ({ 
  message = '正在加载...', 
  subMessage = null,
  progress = null,
  size = 'large',
  style = {},
  overlay = false
}) => {
  const { colors } = useTheme();

  const containerStyle = [
    overlay ? styles.overlayContainer : styles.container,
    { backgroundColor: overlay ? 'rgba(255, 255, 255, 0.9)' : 'transparent' },
    style
  ];

  return (
    <View style={containerStyle}>
      <ActivityIndicator 
        size={size} 
        color={colors.primary} 
        style={styles.indicator}
      />
      
      <Text style={[styles.message, { color: colors.text }]}>
        {message}
      </Text>
      
      {subMessage && (
        <Text style={[styles.subMessage, { color: colors.textLight }]}>
          {subMessage}
        </Text>
      )}
      
      {progress !== null && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: colors.primary,
                  width: `${Math.max(0, Math.min(100, progress))}%`
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textLight }]}>
            {Math.round(progress)}%
          </Text>
        </View>
      )}
    </View>
  );
};

// 预定义的加载消息
export const LoadingMessages = {
  DOCUMENT: {
    LOADING: '正在加载文档...',
    PARSING: '正在解析文档...',
    RENDERING: '正在渲染文档...',
    FIRST_TIME: '首次加载可能需要较长时间'
  },
  PDF: {
    LOADING: '正在加载PDF文档...',
    PARSING: '正在解析PDF页面...',
    RENDERING: '正在渲染PDF内容...',
    FIRST_TIME: '大文件首次加载可能较慢'
  },
  WORD: {
    LOADING: '正在加载Word文档...',
    PARSING: '正在解析Word内容...',
    RENDERING: '正在渲染Word文档...',
    FIRST_TIME: '首次加载需要下载渲染库'
  },
  PPT: {
    LOADING: '正在加载PPT文档...',
    PARSING: '正在解析PPT结构...',
    RENDERING: '正在渲染PPT内容...',
    FIRST_TIME: '复杂PPT可能需要更长时间'
  },
  MARKDOWN: {
    LOADING: '正在加载Markdown文档...',
    PARSING: '正在解析Markdown语法...',
    RENDERING: '正在渲染Markdown内容...',
    FIRST_TIME: '正在准备编辑器'
  },
  CANVAS: {
    LOADING: '正在加载画布...',
    PARSING: '正在解析画布数据...',
    RENDERING: '正在渲染画布内容...',
    FIRST_TIME: '正在初始化绘图引擎'
  }
};

// 错误指示器组件
export const ErrorIndicator = ({ 
  message = '加载失败', 
  subMessage = null,
  onRetry = null,
  style = {}
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.errorIcon, { backgroundColor: colors.error + '20' }]}>
        <Text style={[styles.errorIconText, { color: colors.error }]}>!</Text>
      </View>
      
      <Text style={[styles.errorMessage, { color: colors.error }]}>
        {message}
      </Text>
      
      {subMessage && (
        <Text style={[styles.errorSubMessage, { color: colors.textLight }]}>
          {subMessage}
        </Text>
      )}
      
      {onRetry && (
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onRetry}
        >
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  indicator: {
    marginBottom: 16
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8
  },
  subMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16
  },
  progressContainer: {
    width: '80%',
    alignItems: 'center',
    marginTop: 16
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500'
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  errorIconText: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  errorMessage: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8
  },
  errorSubMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 8
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});

export default LoadingIndicator;
