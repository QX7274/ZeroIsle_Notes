/**
 * 启动屏幕组件
 * 在应用程序加载时显示
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Animated } from 'react-native';

const SplashScreen = ({ message = '应用加载中...', onFinish }) => {
  // 添加动画效果
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // 启动淡入动画
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // 如果提供了onFinish回调，在3秒后调用
    if (onFinish) {
      const timer = setTimeout(() => {
        // 启动淡出动画
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          // 动画完成后调用onFinish
          onFinish();
        });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [fadeAnim, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.logoContainer}>
        {<Image source={require('../../assets/images/logo.png')} style={styles.logo} /> }
      </View>
      <Text style={styles.title}>零屿笔记</Text>
      <Text style={styles.subtitle}>AI驱动</Text>
      <Text style={styles.subtitle}>从零开始构建您的知识岛屿</Text>
      <ActivityIndicator size="large" color="#4361EE" style={styles.loader} />
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
    marginBottom: 30,
    textAlign: 'center',
  },
  loader: {
    marginBottom: 20,
  },
  message: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
  },
});

export default SplashScreen;
