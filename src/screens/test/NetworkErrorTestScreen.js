/**
 * 网络错误处理测试页面
 * 用于测试网络错误弹窗功能
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import networkErrorService from '../../services/networkErrorService';

const NetworkErrorTestScreen = () => {
  const { colors } = useTheme();

  // 测试网络连接错误
  const testNetworkError = () => {
    const error = new Error('Network request failed');
    error.code = 'NETWORK_ERROR';
    
    networkErrorService.handleApiError(error, {
      context: '测试网络错误',
      customMessage: '这是一个测试网络错误，用于验证弹窗功能'
    });
  };

  // 测试超时错误
  const testTimeoutError = () => {
    const error = new Error('Request timeout');
    error.code = 'ECONNABORTED';
    
    networkErrorService.handleApiError(error, {
      context: '测试超时错误',
      customMessage: '这是一个测试超时错误，用于验证弹窗功能'
    });
  };

  // 测试服务器错误
  const testServerError = () => {
    const error = new Error('Internal Server Error');
    error.response = { status: 500 };
    
    networkErrorService.handleApiError(error, {
      context: '测试服务器错误',
      customMessage: '这是一个测试服务器错误，用于验证弹窗功能'
    });
  };

  // 测试真实的网络错误（模拟知识图谱API调用失败）
  const testRealNetworkError = () => {
    const error = new Error('Network Error');
    error.code = 'ERR_NETWORK';
    error.message = 'Network Error';
    
    networkErrorService.handleApiError(error, {
      context: '测试真实网络错误',
      customMessage: '模拟知识图谱API调用失败，用于验证弹窗功能'
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        网络错误处理测试
      </Text>
      
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        点击下面的按钮测试不同类型的网络错误弹窗
      </Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={testNetworkError}
      >
        <Text style={[styles.buttonText, { color: colors.card }]}>
          测试网络连接错误
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.accent }]}
        onPress={testTimeoutError}
      >
        <Text style={[styles.buttonText, { color: colors.card }]}>
          测试超时错误
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.error }]}
        onPress={testServerError}
      >
        <Text style={[styles.buttonText, { color: colors.card }]}>
          测试服务器错误
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#FF6B6B' }]}
        onPress={testRealNetworkError}
      >
        <Text style={[styles.buttonText, { color: colors.card }]}>
          测试真实网络错误
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NetworkErrorTestScreen;







