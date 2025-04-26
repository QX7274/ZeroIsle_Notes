/**
 * 忘记密码屏幕
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Input, Loading } from '../../components/common';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 表单验证
  const validateForm = () => {
    let isValid = true;

    // 验证邮箱
    if (!email.trim()) {
      setEmailError('请输入邮箱地址');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('请输入有效的邮箱地址');
      isValid = false;
    } else {
      setEmailError('');
    }

    return isValid;
  };

  // 处理重置密码请求
  const handleResetPassword = () => {
    // 清除之前的错误
    setError('');
    setSuccess(false);

    // 验证表单
    if (validateForm()) {
      setIsLoading(true);

      // 模拟API请求
      setTimeout(() => {
        setIsLoading(false);
        setSuccess(true);
        // 实际项目中应该调用API
        // authApi.resetPassword(email).then().catch()
      }, 1500);
    }
  };

  // 跳转到登录页面
  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/login_logo.png')}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>找回密码</Text>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : success ? (
            <Text style={styles.successText}>重置密码链接已发送到您的邮箱，请查收</Text>
          ) : (
            <Text style={styles.description}>
              请输入您注册时使用的邮箱地址，我们将向您发送重置密码的链接
            </Text>
          )}

          <Input
            label="邮箱地址"
            value={email}
            onChangeText={setEmail}
            placeholder="请输入邮箱地址"
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
            disabled={success}
          />

          <Button
            title={success ? "重新发送" : "发送重置链接"}
            onPress={handleResetPassword}
            loading={isLoading}
            disabled={isLoading || (success && !email)}
            style={styles.resetButton}
          />

          <View style={styles.linkContainer}>
            <Button
              title="返回登录"
              type="text"
              onPress={navigateToLogin}
              style={styles.linkButton}
            />
          </View>
        </View>
      </ScrollView>

      {isLoading && <Loading type="fullscreen" text="发送中..." />}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.LARGE,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XLARGE,
  },
  logo: {
    width: 400,
    height: 200,
    marginBottom: SPACING.MEDIUM,
  },

  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000', // 使用固定颜色值
    marginBottom: SPACING.MEDIUM,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93', // 使用固定颜色值
    marginBottom: SPACING.LARGE,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF3B30', // 使用固定颜色值
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
  },
  successText: {
    color: '#34C759', // 使用固定颜色值
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
  },
  resetButton: {
    marginTop: SPACING.MEDIUM,
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: SPACING.MEDIUM,
  },
  linkButton: {
    minWidth: 0,
  },
});

export default ForgotPasswordScreen;