/**
 * 启动屏幕组件
 * 在应用程序加载时显示
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';

const SplashScreen = ({ message = '应用加载中...' }) => {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {<Image source={require('../../assets/images/logo.png')} style={styles.logo} /> }
      </View>
      <Text style={styles.title}>零屿笔记</Text>
      <Text style={styles.subtitle}>AI驱动</Text>
      <Text style={styles.subtitle}>从零开始构建您的知识岛屿</Text>
      <ActivityIndicator size="large" color="#4361EE" style={styles.loader} />
      <Text style={styles.message}>{message}</Text>
    </View>
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
