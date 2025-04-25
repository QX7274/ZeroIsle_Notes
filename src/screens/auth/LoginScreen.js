/**
 * 登录屏幕
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, loginWithPhone, thirdPartyLogin, clearError, sendVerificationCode } from '../../redux/slices/authSlice';
import { selectIsLoading, selectError } from '../../redux/slices/authSlice';
import { Button, Input, Loading, Toast } from '../../components/common';
// 移除直接引用colors常量
// import { colors } from '../../utils/constants/colors';
import { SPACING } from '../../utils/constants/dimensions';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../../context/ThemeContext';
import { userApi } from '../../services/api';
import { storage } from '../../utils';
import { validationUtils } from '../../utils';

const LoginScreen = ({ navigation }) => {
  const { colors } = useTheme();
  // 确保有默认的borderRadius值，避免undefined错误
  const borderRadius = 8; // 添加默认的圆角值
  const dispatch = useDispatch();
  const isLoading = useSelector(state => state.auth.isLoading);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState('code'); // 'code', 'password' 或 'email'
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const reduxError = useSelector(state => state.auth.error);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!validationUtils.isPhone(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    try {
      // 发送登录用途的验证码
      await userApi.sendVerificationCode({
        phone,
        purpose: 'login'
      });
      setCountdown(60);
      setError('');
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        setError('发送验证码失败，请稍后重试');
      }
    }
  };

  const handleLogin = async () => {
    try {
      let response;

      // 验证码登录
      if (loginType === 'code') {
        if (!validationUtils.isPhone(phone)) {
          setError('请输入正确的手机号');
          return;
        }
        if (!validationUtils.isVerificationCode(code)) {
          setError('请输入正确的验证码');
          return;
        }
        response = await userApi.loginWithCode({ phone, code });
      }
      // 手机号+密码登录
      else if (loginType === 'password') {
        if (!validationUtils.isPhone(phone)) {
          setError('请输入正确的手机号');
          return;
        }
        if (!validationUtils.isPassword(password)) {
          setError('密码长度至少为6位');
          return;
        }
        response = await userApi.loginWithPassword({ phone, password });
      }
      // 邮箱+密码登录
      else if (loginType === 'email') {
        if (!validationUtils.isEmail(email)) {
          setError('请输入正确的邮箱地址');
          return;
        }
        if (!validationUtils.isPassword(password)) {
          setError('密码长度至少为6位');
          return;
        }
        response = await userApi.loginWithEmail({ email, password });
      }

      await storage.set('token', response.token);
      await storage.set('user', response.user);
      dispatch({ type: 'LOGIN', payload: response.user });
      // 导航到主页面
    } catch (error) {
      setError('登录失败，请检查输入信息');
    }
  };

  const handleThirdPartyLogin = async (type) => {
    try {
      let response;
      if (type === 'wechat') {
        response = await userApi.loginWithWeChat();
      } else if (type === 'qq') {
        response = await userApi.loginWithQQ();
      }

      await storage.set('token', response.token);
      await storage.set('user', response.user);
      dispatch({ type: 'LOGIN', payload: response.user });
      // 导航到主页面
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
          <Text style={styles.appName}>零屿笔记</Text>
          <Text style={styles.slogan}>AI驱动，从零开始构建您的知识岛屿</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>登录</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* 登录方式选择器 */}
          <View style={styles.loginTypeSelector}>
            <TouchableOpacity
              style={[styles.loginTypeButton, loginType === 'code' && styles.activeLoginType]}
              onPress={() => setLoginType('code')}
            >
              <Text style={[styles.loginTypeText, loginType === 'code' && styles.activeLoginTypeText]}>验证码登录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.loginTypeButton, loginType === 'password' && styles.activeLoginType]}
              onPress={() => setLoginType('password')}
            >
              <Text style={[styles.loginTypeText, loginType === 'password' && styles.activeLoginTypeText]}>手机号登录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.loginTypeButton, loginType === 'email' && styles.activeLoginType]}
              onPress={() => setLoginType('email')}
            >
              <Text style={[styles.loginTypeText, loginType === 'email' && styles.activeLoginTypeText]}>邮箱登录</Text>
            </TouchableOpacity>
          </View>

          {/* 手机号输入框 - 验证码和手机号登录时显示 */}
          {(loginType === 'code' || loginType === 'password') && (
            <Input
              label="手机号"
              value={phone}
              onChangeText={setPhone}
              placeholder="请输入手机号"
              error={error}
              keyboardType="phone-pad"
            />
          )}

          {/* 邮箱输入框 - 邮箱登录时显示 */}
          {loginType === 'email' && (
            <Input
              label="邮箱"
              value={email}
              onChangeText={setEmail}
              placeholder="请输入邮箱地址"
              error={error}
              keyboardType="email-address"
              autoCapitalize="none"
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
                error={error}
                keyboardType="number-pad"
                style={styles.codeInput}
              />
              <Button
                title={countdown > 0 ? `${countdown}秒` : "获取验证码"}
                onPress={handleSendCode}
                disabled={countdown > 0 || !validationUtils.isPhone(phone)}
                type="outline"
                style={styles.codeButton}
              />
            </View>
          )}

          {/* 密码输入框 - 手机号密码和邮箱密码登录时显示 */}
          {(loginType === 'password' || loginType === 'email') && (
            <Input
              label="密码"
              value={password}
              onChangeText={setPassword}
              placeholder="请输入密码"
              secureTextEntry
              error={error}
            />
          )}

          <Button
            title="登录"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            style={styles.loginButton}
          />

          <View style={styles.linkContainer}>
            <Button
              title="忘记密码？"
              type="text"
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.linkButton}
            />
            <Button
              title="注册账号"
              type="text"
              onPress={() => navigation.navigate('Register')}
              style={styles.linkButton}
            />
          </View>

          {/* 第三方登录 */}
          <View style={styles.thirdPartyContainer}>
            <Text style={styles.thirdPartyTitle}>第三方账号登录</Text>
            <View style={styles.thirdPartyButtons}>
              <TouchableOpacity
                style={styles.thirdPartyButton}
                onPress={() => handleThirdPartyLogin('wechat')}
              >
                <Icon name="wechat" size={28} color="#07C160" />
                <Text style={styles.thirdPartyText}>微信</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thirdPartyButton}
                onPress={() => handleThirdPartyLogin('qq')}
              >
                <Icon name="qq" size={28} color="#12B7F5" />
                <Text style={styles.thirdPartyText}>QQ</Text>
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
    padding: SPACING.LARGE,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XLARGE,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: SPACING.MEDIUM,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF', // 使用固定颜色值替代colors.primary
    marginBottom: SPACING.SMALL,
  },
  slogan: {
    fontSize: 14,
    color: '#8E8E93', // 使用固定颜色值替代colors.textSecondary
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000', // 使用固定颜色值替代colors.text
    marginBottom: SPACING.LARGE,
  },
  errorText: {
    color: '#FF3B30', // 使用固定颜色值替代colors.error
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: SPACING.MEDIUM,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.LARGE,
  },
  linkButton: {
    minWidth: 0,
  },
  // 登录方式选择器样式
  loginTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.LARGE,
  },
  loginTypeButton: {
    flex: 1,
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.SMALL,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
  },
  activeLoginType: {
    borderBottomColor: '#007AFF', // 使用固定颜色值替代colors.primary
  },
  loginTypeText: {
    fontSize: 14,
    color: '#8E8E93', // 使用固定颜色值替代colors.textSecondary
  },
  activeLoginTypeText: {
    color: '#007AFF', // 使用固定颜色值替代colors.primary
    fontWeight: '500',
  },
  // 验证码输入框样式
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  codeInput: {
    flex: 1,
    marginRight: SPACING.SMALL,
  },
  codeButton: {
    width: 100,
    height: 48,
  },
  // 第三方登录样式
  thirdPartyContainer: {
    marginTop: SPACING.XLARGE,
    alignItems: 'center',
  },
  thirdPartyTitle: {
    fontSize: 14,
    color: '#8E8E93', // 使用固定颜色值替代colors.textSecondary
    marginBottom: SPACING.MEDIUM,
  },
  thirdPartyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  thirdPartyButton: {
    alignItems: 'center',
    marginHorizontal: SPACING.LARGE,
  },
  thirdPartyText: {
    marginTop: SPACING.SMALL,
    fontSize: 12,
    color: '#8E8E93', // 使用固定颜色值替代colors.textSecondary
  },
});

export default LoginScreen;