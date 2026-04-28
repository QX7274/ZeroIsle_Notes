/**
 * 网络错误提示组件
 * 为用户提供美观友好的网络错误提示
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

const NetworkErrorAlert = ({
  visible = false,
  error = null,
  onRetry,
  onDismiss,
  style = {},
}) => {
  const { colors } = useTheme();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    if (visible) {
      // 显示动画
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // 隐藏动画
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible || !error) {
    return null;
  }

  const getErrorIcon = (errorType) => {
    switch (errorType) {
      case 'network_error':
        return 'wifi-outline';
      case 'timeout_error':
        return 'time-outline';
      case 'server_error':
        return 'server-outline';
      case 'auth_error':
        return 'lock-closed-outline';
      case 'not_found_error':
        return 'document-outline';
      case 'validation_error':
        return 'checkmark-circle-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  const getErrorColor = (errorType) => {
    switch (errorType) {
      case 'network_error':
        return '#FF9500';
      case 'timeout_error':
        return '#FF9500';
      case 'server_error':
        return '#FF3B30';
      case 'auth_error':
        return '#FF9500';
      case 'not_found_error':
        return '#007AFF';
      case 'validation_error':
        return '#FF9500';
      default:
        return '#FF3B30';
    }
  };

  const getErrorTitle = (errorType) => {
    switch (errorType) {
      case 'network_error':
        return '网络连接问题';
      case 'timeout_error':
        return '请求超时';
      case 'server_error':
        return '服务暂时不可用';
      case 'auth_error':
        return '身份验证失败';
      case 'not_found_error':
        return '资源不存在';
      case 'validation_error':
        return '数据格式错误';
      default:
        return '未知错误';
    }
  };

  const getErrorMessage = (errorType) => {
    switch (errorType) {
      case 'network_error':
        return '请检查您的网络连接后重试';
      case 'timeout_error':
        return '服务器响应较慢，请稍后重试';
      case 'server_error':
        return '服务器正在维护中，请稍后重试';
      case 'auth_error':
        return '请重新登录后继续使用';
      case 'not_found_error':
        return '请求的内容不存在或已被删除';
      case 'validation_error':
        return '请检查输入的信息是否正确';
      default:
        return '发生了意外错误，请重试';
    }
  };

  const resolvedStatus = error?.status ?? error?.response?.status ?? null;
  const resolvedErrorType = error?.errorType || (
    resolvedStatus === 401 || resolvedStatus === 403
      ? 'auth_error'
      : resolvedStatus >= 500
        ? 'server_error'
        : 'unknown_error'
  );

  const iconName = getErrorIcon(resolvedErrorType);
  const iconColor = getErrorColor(resolvedErrorType);
  const title = getErrorTitle(resolvedErrorType);
  const message = error?.userMessage || error?.message || getErrorMessage(resolvedErrorType);

  const handleDismissPress = () => {
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  };

  const handleRetryPress = () => {
    if (typeof onRetry === 'function') {
      onRetry();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleDismissPress}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
            style,
          ]}
        >
          {/* 错误图标 */}
          <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
            <Icon name={iconName} size={32} color={iconColor} />
          </View>

          {/* 错误标题 */}
          <Text style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>

          {/* 错误消息 */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {/* 操作按钮 */}
          <View style={styles.buttonContainer}>
            {onRetry && (
              <TouchableOpacity
                style={[styles.button, styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={handleRetryPress}
                activeOpacity={0.8}
              >
                <Icon name="refresh" size={16} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                  重试
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.dismissButton, { borderColor: colors.border }]}
              onPress={handleDismissPress}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>
                确定
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: Math.min(screenWidth - 40, 400),
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
  },
  retryButton: {
    backgroundColor: '#007AFF',
  },
  dismissButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default NetworkErrorAlert;
