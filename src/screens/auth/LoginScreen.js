/**
 * 现代化登录屏幕
 * 支持多种登录方式和渐变背景
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, loginWithPhone, thirdPartyLogin, clearError, sendVerificationCode } from '../../redux/slices/authSlice';
import { selectIsLoading, selectError } from '../../redux/slices/authSlice';
import { Button, Input, Loading, Toast, Card } from '../../components/common';
import { SPACING, BORDER_RADIUS, SHADOW } from '../../utils/constants/dimensions';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { userApi } from '../../services/api';
import { storage } from '../../utils';
import { validationUtils } from '../../utils';
import LinearGradient from 'react-native-linear-gradient';

const LoginScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();
  const { width, height } = Dimensions.get('window');
  const dispatch = useDispatch();
  const isLoading = useSelector(state => state.auth.isLoading);

  // 状态管理
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState('code'); // 'code', 'password' 或 'email'
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const reduxError = useSelector(state => state.auth.error);

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // 渐变色
  const backgroundGradient = isDarkMode
    ? colors.gradients.header
    : ['#4361EE', '#4CC9F0'];

  // 处理倒计时
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // 处理动画效果
  useEffect(() => {
    // 设置状态栏
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }

    // 启动动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* 渐变背景 */}
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 动画Logo容器 */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.logoCircle}>
            <Image
              source={require('../../../android/app/src/main/playstore.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.appName, { color: '#FFFFFF' }]}>零屿笔记</Text>
          <Text style={[styles.slogan, { color: 'rgba(255, 255, 255, 0.8)' }]}>
            AI驱动，从零开始构建您的知识岛屿
          </Text>
        </Animated.View>

        {/* 登录表单卡片 */}
        <Animated.View
          style={[
            styles.formWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Card
            elevation="large"
            style={styles.formCard}
          >
            <Text style={[styles.title, { color: colors.text }]}>登录</Text>

            {error && (
              <View style={styles.errorContainer}>
                <MaterialIcon name="error-outline" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

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
                leftIcon="phone-android"
                variant="outlined"
                floatingLabel
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
                leftIcon="email"
                variant="outlined"
                floatingLabel
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
                  leftIcon="sms"
                  variant="outlined"
                  floatingLabel
                  keyboardType="number-pad"
                  style={styles.codeInput}
                />
                <Button
                  title={countdown > 0 ? `${countdown}秒` : "获取验证码"}
                  onPress={handleSendCode}
                  disabled={countdown > 0 || !validationUtils.isPhone(phone)}
                  type="outline"
                  rounded
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
                leftIcon="lock"
                variant="outlined"
                floatingLabel
                secureTextEntry
              />
            )}

            <Button
              title="登录"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              type="gradient"
              gradientType="primary"
              rounded
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
              <Text style={[styles.thirdPartyTitle, { color: colors.textSecondary }]}>第三方账号登录</Text>
              <View style={styles.thirdPartyButtons}>
                <TouchableOpacity
                  style={styles.thirdPartyButton}
                  onPress={() => handleThirdPartyLogin('wechat')}
                >
                  <View style={[styles.socialIconCircle, { backgroundColor: 'rgba(7, 193, 96, 0.1)' }]}>
                    <Icon name="wechat" size={24} color="#07C160" />
                  </View>
                  <Text style={[styles.thirdPartyText, { color: colors.textSecondary }]}>微信</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.thirdPartyButton}
                  onPress={() => handleThirdPartyLogin('qq')}
                >
                  <View style={[styles.socialIconCircle, { backgroundColor: 'rgba(18, 183, 245, 0.1)' }]}>
                    <Icon name="qq" size={24} color="#12B7F5" />
                  </View>
                  <Text style={[styles.thirdPartyText, { color: colors.textSecondary }]}>QQ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>

      {isLoading && <Loading type="fullscreen" text="登录中..." />}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // 基础容器样式
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.LARGE,
  },

  // Logo相关样式
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XLARGE,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.MEDIUM,
    ...SHADOW.MEDIUM,
  },
  logo: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: SPACING.SMALL,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  slogan: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 22,
  },

  // 表单相关样式
  formWrapper: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: SPACING.MEDIUM,
  },
  formCard: {
    padding: SPACING.LARGE,
    borderRadius: BORDER_RADIUS.LARGE,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.LARGE,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: SPACING.MEDIUM,
    borderRadius: BORDER_RADIUS.MEDIUM,
    marginBottom: SPACING.MEDIUM,
  },
  errorText: {
    marginLeft: SPACING.SMALL,
    fontSize: 14,
  },
  loginButton: {
    marginTop: SPACING.LARGE,
    height: 50,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.MEDIUM,
  },
  linkButton: {
    minWidth: 0,
  },

  // 登录方式选择器样式
  loginTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.LARGE,
    borderRadius: BORDER_RADIUS.MEDIUM,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 4,
  },
  loginTypeButton: {
    flex: 1,
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.SMALL,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.SMALL,
    marginHorizontal: 2,
  },
  activeLoginType: {
    backgroundColor: 'white',
    ...SHADOW.SMALL,
  },
  loginTypeText: {
    fontSize: 14,
  },
  activeLoginTypeText: {
    fontWeight: '600',
  },

  // 验证码输入框样式
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.MEDIUM,
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
    marginBottom: SPACING.MEDIUM,
    position: 'relative',
  },
  thirdPartyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  thirdPartyButton: {
    alignItems: 'center',
    marginHorizontal: SPACING.LARGE,
  },
  socialIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.SMALL,
  },
  thirdPartyText: {
    fontSize: 12,
  },
});

export default LoginScreen;