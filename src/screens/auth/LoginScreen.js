/**
 * 登录屏幕
 * 提供多种登录方式：手机号+验证码、手机号+密码、邮箱+密码、第三方登录
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../../store/slices/authSlice';
import { Button, Input, Loading } from '../../components/common';
import { Text as Typography } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../../context/ThemeContext';
import { authApi } from '../../services/api';

const LoginScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  const dispatch = useDispatch();

  // 从Redux获取状态
  const isLoading = useSelector(state => {
    // 兼容新旧Redux结构
    if (state.auth) {
      return state.auth.isLoading;
    }
    return state.user?.isLoading || false;
  });

  const reduxError = useSelector(state => {
    // 兼容新旧Redux结构
    if (state.auth) {
      return state.auth.error;
    }
    return state.user?.error || null;
  });

  // 本地状态
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState('password'); // 'password', 'code', 'email'
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  // 清除Redux错误
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // 处理Redux错误
  useEffect(() => {
    if (reduxError) {
      setError(reduxError);
    }
  }, [reduxError]);

  // 验证码倒计时
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || phone.length < 11) {
      setError('请输入正确的手机号');
      return;
    }

    setError('');

    try {
      const result = await authApi.sendVerificationCode(phone);

      if (result.success) {
        setCountdown(60);
        Alert.alert('提示', '验证码已发送，请注意查收');
      } else {
        setError(result.message || '发送验证码失败，请稍后重试');
      }
    } catch (error) {
      setError('发送验证码失败，请稍后重试');
    }
  };

  // 登录
  const handleLogin = async () => {
    // 清除错误
    setError('');

    // 表单验证
    if (loginType === 'password') {
      if (!username) {
        setError('请输入用户名');
        return;
      }
      if (!password || password.length < 6) {
        setError('密码长度至少为6位');
        return;
      }

      // 调用登录API
      dispatch(login({
        username,
        password
      }));
    }
    else if (loginType === 'email') {
      if (!email || !email.includes('@')) {
        setError('请输入正确的邮箱地址');
        return;
      }
      if (!password || password.length < 6) {
        setError('密码长度至少为6位');
        return;
      }

      // 调用登录API
      dispatch(login({
        email,
        password
      }));
    }
    else if (loginType === 'code') {
      if (!phone || phone.length < 11) {
        setError('请输入正确的手机号');
        return;
      }
      if (!code || code.length < 4) {
        setError('请输入正确的验证码');
        return;
      }

      try {
        const result = await authApi.loginWithCode({
          phone,
          code
        });

        if (result.success) {
          // 登录成功，更新Redux状态
          dispatch(login(result.data));
        } else {
          setError(result.message || '登录失败，请检查验证码');
        }
      } catch (error) {
        setError('登录失败，请稍后重试');
      }
    }
  };

  // 第三方登录
  const handleThirdPartyLogin = async (type) => {
    setError('');

    try {
      let result;

      if (type === 'wechat') {
        result = await authApi.wechatLogin('mock_code');
      } else if (type === 'qq') {
        result = await authApi.qqLogin('mock_code');
      }

      if (result.success) {
        // 登录成功，更新Redux状态
        dispatch(login(result.data));
      } else {
        setError(result.message || `${type === 'wechat' ? '微信' : 'QQ'}登录失败`);
      }
    } catch (error) {
      setError(`${type === 'wechat' ? '微信' : 'QQ'}登录失败，请重试`);
    }
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
            source={require('../../../android/app/src/main/playstore.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Typography
            variant="heading"
            level="h2"
            color="primary"
            center
            style={styles.appName}
          >
            零屿笔记
          </Typography>
          <Typography
            variant="body"
            size="medium"
            color="hint"
            center
            style={styles.slogan}
          >
            AI驱动，从零开始构建您的知识岛屿
          </Typography>
        </View>

        <View style={[
          styles.formContainer,
          {
            backgroundColor: colors.card,
            borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
            ...dimensions.SHADOW.MEDIUM
          }
        ]}>
          <Typography
            variant="heading"
            level="h3"
            style={styles.title}
          >
            登录
          </Typography>

          {error && (
            <Typography
              variant="body"
              size="medium"
              color="error"
              center
              style={styles.errorText}
            >
              {error}
            </Typography>
          )}

          {/* 登录方式选择器 */}
          <View style={styles.loginTypeSelector}>
            <TouchableOpacity
              style={[
                styles.loginTypeButton,
                loginType === 'password' && [
                  styles.activeLoginType,
                  { borderBottomColor: colors.primary }
                ]
              ]}
              onPress={() => setLoginType('password')}
            >
              <Typography
                variant="body"
                size="medium"
                color={loginType === 'password' ? 'primary' : 'hint'}
                bold={loginType === 'password'}
              >
                账号登录
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.loginTypeButton,
                loginType === 'code' && [
                  styles.activeLoginType,
                  { borderBottomColor: colors.primary }
                ]
              ]}
              onPress={() => setLoginType('code')}
            >
              <Typography
                variant="body"
                size="medium"
                color={loginType === 'code' ? 'primary' : 'hint'}
                bold={loginType === 'code'}
              >
                验证码登录
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.loginTypeButton,
                loginType === 'email' && [
                  styles.activeLoginType,
                  { borderBottomColor: colors.primary }
                ]
              ]}
              onPress={() => setLoginType('email')}
            >
              <Typography
                variant="body"
                size="medium"
                color={loginType === 'email' ? 'primary' : 'hint'}
                bold={loginType === 'email'}
              >
                邮箱登录
              </Typography>
            </TouchableOpacity>
          </View>

          {/* 用户名输入框 - 账号密码登录时显示 */}
          {loginType === 'password' && (
            <Input
              label="用户名"
              value={username}
              onChangeText={setUsername}
              placeholder="请输入用户名"
              autoCapitalize="none"
              size="large"
            />
          )}

          {/* 手机号输入框 - 验证码登录时显示 */}
          {loginType === 'code' && (
            <Input
              label="手机号"
              value={phone}
              onChangeText={setPhone}
              placeholder="请输入手机号"
              keyboardType="phone-pad"
              size="large"
            />
          )}

          {/* 邮箱输入框 - 邮箱登录时显示 */}
          {loginType === 'email' && (
            <Input
              label="邮箱"
              value={email}
              onChangeText={setEmail}
              placeholder="请输入邮箱地址"
              keyboardType="email-address"
              autoCapitalize="none"
              size="large"
            />
          )}

          {/* 验证码输入框 - 验证码登录时显示 */}
          {loginType === 'code' && (
            <View style={styles.codeInputContainer}>
              <Input
                label="验证码"
                value={code}
                onChangeText={setCode}
                placeholder="请输入验证码"
                keyboardType="number-pad"
                style={styles.codeInput}
                size="large"
              />
              <Button
                title={countdown > 0 ? `${countdown}秒` : "获取验证码"}
                onPress={handleSendCode}
                disabled={countdown > 0 || !phone || phone.length < 11}
                type="outline"
                style={styles.codeButton}
                size="medium"
              />
            </View>
          )}

          {/* 密码输入框 - 账号密码和邮箱密码登录时显示 */}
          {(loginType === 'password' || loginType === 'email') && (
            <Input
              label="密码"
              value={password}
              onChangeText={setPassword}
              placeholder="请输入密码"
              secureTextEntry
              size="large"
            />
          )}

          <Button
            title="登录"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            style={styles.loginButton}
            size="large"
            fullWidth
          />

          <View style={styles.linkContainer}>
            <Button
              title="忘记密码？"
              type="text"
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.linkButton}
              size="small"
            />
            <Button
              title="注册账号"
              type="text"
              onPress={() => navigation.navigate('Register')}
              style={styles.linkButton}
              size="small"
            />
          </View>

          {/* 第三方登录 */}
          <View style={styles.thirdPartyContainer}>
            <Typography
              variant="body"
              size="small"
              color="hint"
              center
              style={styles.thirdPartyTitle}
            >
              第三方账号登录
            </Typography>
            <View style={styles.thirdPartyButtons}>
              <TouchableOpacity
                style={styles.thirdPartyButton}
                onPress={() => handleThirdPartyLogin('wechat')}
              >
                <Icon name="wechat" size={28} color="#07C160" />
                <Typography
                  variant="body"
                  size="small"
                  color="hint"
                  center
                  style={styles.thirdPartyText}
                >
                  微信
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thirdPartyButton}
                onPress={() => handleThirdPartyLogin('qq')}
              >
                <Icon name="qq" size={28} color="#12B7F5" />
                <Typography
                  variant="body"
                  size="small"
                  color="hint"
                  center
                  style={styles.thirdPartyText}
                >
                  QQ
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {isLoading && <Loading type="fullscreen" text="登录中..." />}
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
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appName: {
    marginBottom: 8,
  },
  slogan: {
    marginBottom: 24,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 24,
    borderRadius: 12,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  errorText: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 24,
    height: 50,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  linkButton: {
    minWidth: 0,
  },
  // 登录方式选择器样式
  loginTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  loginTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
  },
  activeLoginType: {
    // borderBottomColor 在组件中动态设置
  },
  // 验证码输入框样式
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  codeInput: {
    flex: 1,
    marginRight: 8,
  },
  codeButton: {
    width: 100,
    marginTop: 24,
  },
  // 第三方登录样式
  thirdPartyContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  thirdPartyTitle: {
    marginBottom: 16,
  },
  thirdPartyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  thirdPartyButton: {
    alignItems: 'center',
    marginHorizontal: 24,
  },
  thirdPartyText: {
    marginTop: 8,
  },
});

export default LoginScreen;