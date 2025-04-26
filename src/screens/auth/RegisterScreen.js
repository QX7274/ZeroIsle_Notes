/**
 * 注册屏幕
 * 提供手机号和邮箱两种注册方式
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { register, clearError } from '../../store/slices/authSlice';
import { Button, Input, Loading } from '../../components/common';
import { Text } from '../../components/common/Typography';
import { authApi } from '../../services/api';

const RegisterScreen = ({ navigation }) => {
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
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerType, setRegisterType] = useState('phone'); // 'phone' 或 'email'
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
      const result = await authApi.sendVerificationCode(phone, 'register');

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

  // 注册
  const handleRegister = async () => {
    // 清除错误
    setError('');

    // 表单验证
    if (!username) {
      setError('请输入用户名');
      return;
    }

    if (!password || password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    // 手机号注册
    if (registerType === 'phone') {
      if (!phone || phone.length < 11) {
        setError('请输入正确的手机号');
        return;
      }

      if (!code || code.length < 4) {
        setError('请输入正确的验证码');
        return;
      }

      try {
        const result = await authApi.registerWithPhone({
          username,
          phone,
          code,
          password
        });

        if (result.success) {
          // 注册成功，自动登录
          dispatch(register(result.data));
          Alert.alert('注册成功', '欢迎加入零屿笔记！');
        } else {
          setError(result.message || '注册失败，请稍后重试');
        }
      } catch (error) {
        setError('注册失败，请稍后重试');
      }
    }
    // 邮箱注册
    else {
      if (!email || !email.includes('@')) {
        setError('请输入正确的邮箱地址');
        return;
      }

      try {
        const result = await authApi.registerWithEmail({
          username,
          email,
          password
        });

        if (result.success) {
          // 注册成功，自动登录
          dispatch(register(result.data));
          Alert.alert('注册成功', '欢迎加入零屿笔记！');
        } else {
          setError(result.message || '注册失败，请稍后重试');
        }
      } catch (error) {
        setError('注册失败，请稍后重试');
      }
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
          <Text
            variant="heading"
            level="h2"
            color="primary"
            center
            style={styles.appName}
          >
            零屿笔记
          </Text>
          <Text
            variant="body"
            size="medium"
            color="hint"
            center
            style={styles.slogan}
          >
            AI驱动，从零开始构建您的知识岛屿
          </Text>
        </View>

        <View style={[
          styles.formContainer,
          {
            backgroundColor: colors.card,
            borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
            ...dimensions.SHADOW.MEDIUM
          }
        ]}>
          <Text
            variant="heading"
            level="h3"
            style={styles.title}
          >
            注册
          </Text>

          {error && (
            <Text
              variant="body"
              size="medium"
              color="error"
              center
              style={styles.errorText}
            >
              {error}
            </Text>
          )}

          {/* 注册方式选择器 */}
          <View style={styles.registerTypeSelector}>
            <TouchableOpacity
              style={[
                styles.registerTypeButton,
                registerType === 'phone' && [
                  styles.activeRegisterType,
                  { borderBottomColor: colors.primary }
                ]
              ]}
              onPress={() => setRegisterType('phone')}
            >
              <Text
                variant="body"
                size="medium"
                color={registerType === 'phone' ? 'primary' : 'hint'}
                bold={registerType === 'phone'}
              >
                手机号注册
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.registerTypeButton,
                registerType === 'email' && [
                  styles.activeRegisterType,
                  { borderBottomColor: colors.primary }
                ]
              ]}
              onPress={() => setRegisterType('email')}
            >
              <Text
                variant="body"
                size="medium"
                color={registerType === 'email' ? 'primary' : 'hint'}
                bold={registerType === 'email'}
              >
                邮箱注册
              </Text>
            </TouchableOpacity>
          </View>

          {/* 用户名输入框 - 两种注册方式都需要 */}
          <Input
            label="用户名"
            value={username}
            onChangeText={setUsername}
            placeholder="请输入用户名"
            autoCapitalize="none"
            size="large"
          />

          {/* 手机号注册表单 */}
          {registerType === 'phone' && (
            <>
              <Input
                label="手机号"
                value={phone}
                onChangeText={setPhone}
                placeholder="请输入手机号"
                keyboardType="phone-pad"
                size="large"
              />

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
            </>
          )}

          {/* 邮箱注册表单 */}
          {registerType === 'email' && (
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

          {/* 密码输入框 - 两种注册方式都需要 */}
          <Input
            label="密码"
            value={password}
            onChangeText={setPassword}
            placeholder="请输入密码"
            secureTextEntry
            size="large"
          />

          <Input
            label="确认密码"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="请再次输入密码"
            secureTextEntry
            size="large"
          />

          <Button
            title="注册"
            onPress={handleRegister}
            loading={isLoading}
            disabled={isLoading}
            style={styles.registerButton}
            size="large"
            fullWidth
          />

          <View style={styles.footer}>
            <Button
              title="已有账号？立即登录"
              type="text"
              onPress={() => navigation.navigate('Login')}
              size="small"
            />
          </View>
        </View>
      </ScrollView>

      {isLoading && <Loading type="fullscreen" text="注册中..." />}
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
  // 注册方式选择器样式
  registerTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  registerTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
  },
  activeRegisterType: {
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
  registerButton: {
    marginTop: 24,
    height: 50,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
});

export default RegisterScreen;