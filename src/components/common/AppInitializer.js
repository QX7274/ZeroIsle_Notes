/**
 * 应用初始化组件
 * 在应用启动时进行必要的初始化工作
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import simpleAuth from '../../services/auth/simpleAuth';
import { filterValidColors } from '../../utils/colorUtils';

const AppInitializer = ({ children }) => {
  const { colors } = useTheme();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('正在初始化应用...');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setInitStatus('正在初始化认证...');
      
      // 初始化认证服务
      await simpleAuth.initialize();
      
      setInitStatus('正在检查配置...');
      
      // 修复颜色配置
      if (colors) {
        // 确保颜色对象中没有undefined值
        Object.keys(colors).forEach(key => {
          if (colors[key] === undefined) {
            console.warn(`发现undefined颜色值: ${key}`);
          }
        });
      }
      
      setInitStatus('初始化完成');
      
      // 延迟一下让用户看到完成状态
      setTimeout(() => {
        setIsInitializing(false);
      }, 500);

    } catch (error) {
      console.error('AppInitializer: 初始化失败:', error);
      setInitStatus('初始化完成');
      
      // 即使失败也要继续，不阻塞应用启动
      setTimeout(() => {
        setIsInitializing(false);
      }, 1000);
    }
  };

  if (isInitializing) {
    return (
      <View style={[styles.container, { backgroundColor: colors?.background || '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={colors?.primary || '#007AFF'} />
        <Text style={[styles.statusText, { color: colors?.text || '#000000' }]}>
          {initStatus}
        </Text>
      </View>
    );
  }

  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default AppInitializer;
