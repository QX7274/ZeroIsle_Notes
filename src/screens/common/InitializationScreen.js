/**
 * 初始化屏幕
 * 用于显示应用启动过程中的状态
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';

const InitializationScreen = () => {
  const [status, setStatus] = useState('正在初始化...');
  const [logs, setLogs] = useState([]);
  const [isReady, setIsReady] = useState(false);

  // 获取Redux状态
  const reduxState = useSelector(state => state);

  // 获取主题
  let theme;
  try {
    theme = useTheme().theme;
  } catch (error) {
    console.log('初始化屏幕: 主题加载失败', error);
    theme = {
      colors: {
        background: '#FFFFFF',
        text: '#000000',
        primary: '#007AFF',
      },
    };
  }

  // 添加日志
  const addLog = (message) => {
    setLogs(prevLogs => [...prevLogs, { id: Date.now(), message }]);
  };

  // 检查应用状态
  useEffect(() => {
    // 检查Redux状态
    if (reduxState) {
      addLog('Redux状态已加载');

      // 检查Redux状态结构
      const stateKeys = Object.keys(reduxState);
      addLog(`Redux状态包含: ${stateKeys.join(', ')}`);

      // 检查认证状态
      if (reduxState.auth) {
        const { isAuthenticated, isLoading } = reduxState.auth;
        addLog(`认证状态: ${isAuthenticated ? '已认证' : '未认证'}`);
        addLog(`加载状态: ${isLoading ? '加载中' : '已加载'}`);
      }

      setStatus('应用初始化完成');
      setIsReady(true);
    } else {
      addLog('Redux状态未加载');
      setStatus('等待Redux状态...');
    }
  }, [reduxState]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>应用初始化</Text>
      <Text style={[styles.status, { color: theme.colors.primary }]}>{status}</Text>

      <ActivityIndicator
        size="large"
        color={theme.colors.primary}
        style={styles.loader}
      />

      <View style={styles.logsContainer}>
        <Text style={[styles.logsTitle, { color: theme.colors.text }]}>初始化日志:</Text>
        {logs.map(log => (
          <Text key={log.id} style={[styles.logItem, { color: theme.colors.text }]}>
            • {log.message}
          </Text>
        ))}
      </View>

      {isReady && (
        <Text style={[styles.readyText, { color: theme.colors.primary }]}>
          应用已准备就绪，即将进入主界面...
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    fontSize: 18,
    marginBottom: 20,
  },
  loader: {
    marginVertical: 20,
  },
  logsContainer: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    maxHeight: 300,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logItem: {
    fontSize: 14,
    marginBottom: 5,
  },
  readyText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default InitializationScreen;
