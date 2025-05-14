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
import {
  register,
  registerWithUsername,
  registerWithEmail,
  clearError
} from '../../redux/slices/authSlice';
import { Button, Input, Loading } from '../../components/common';
import { Text } from 'react-native';
import { authApi } from '../../services/api';
import NetInfo from '@react-native-community/netinfo';

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
  const [registerType, setRegisterType] = useState('username'); // 'username'|'phone'|'email'
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(true);

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

  // 监听网络状态
  useEffect(() => {
    // 初始检查网络状态
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
    });

    // 订阅网络状态变化
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
    setError('');

    // 检查网络连接
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      setError('注册失败：请连接网络后再尝试注册');
      Alert.alert('网络错误', '注册需要网络连接，请检查您的网络设置后重试。');
      return;
    }

    // 通用验证
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

    try {
      let result;

      // 根据注册类型调用不同API
      switch (registerType) {
        case 'username':
          result = await authApi.registerWithUsername({ username, password });
          break;
        case 'phone':
          if (!phone || phone.length < 11) {
            setError('请输入正确的手机号');
            return;
          }
          if (!code || code.length < 4) {
            setError('请输入验证码');
            return;
          }
          result = await authApi.registerWithPhone({ phone, code, password, username });
          break;
        case 'email':
          if (!email || !email.includes('@')) {
            setError('请输入正确的邮箱');
            return;
          }
          result = await authApi.registerWithEmail({ email, password, username });
          break;
        default:
          setError('请选择注册方式');
          return;
      }

      console.log('注册结果:', result);

      // 检查是否是离线模式下的响应
      if ((result && result.offline === true) || (result && result.data && result.data.offline === true)) {
        console.log('离线模式下的注册请求，显示网络错误');
        const errorMessage = result.message || result.data?.message || '注册失败：请连接网络后再尝试注册';
        setError(errorMessage);
        Alert.alert('网络错误', '注册需要网络连接，请检查您的网络设置后重试。');
        return;
      }

      // 检查响应是否明确表示失败
      if (result && result.success === false) {
        console.log('注册失败，显示错误信息:', result.message);
        setError(result.message || '注册失败，请稍后重试');
        return;
      }

      if (result && result.success) {
        // 检查是否有必要的数据
        if (!result.data || !result.data.user || !result.data.access || !result.data.refresh) {
          console.error('注册响应数据缺少必要字段:', result.data);
          setError('注册失败：服务器返回数据不完整');
          return;
        }

        // 注册成功，更新Redux状态
        try {
          dispatch({ type: 'auth/setUserInfo', payload: result.data.user });
          dispatch({ type: 'auth/setAuthToken', payload: result.data.access });
          dispatch({ type: 'auth/setAuthRefreshToken', payload: result.data.refresh });

          // 显式设置认证状态
          dispatch({ type: 'auth/setIsAuthenticated', payload: true });

          // 显示成功消息
          Alert.alert('注册成功', '欢迎加入零屿笔记！');

          // 注册成功后更新Redux状态，让AppNavigator自动切换到主页
          // 不需要手动导航，因为AppNavigator会根据isAuthenticated状态自动切换
          console.log('注册成功，Redux状态已更新，等待AppNavigator自动切换到主页');
        } catch (reduxError) {
          console.error('更新Redux状态失败:', reduxError);

          // 即使Redux更新失败，也尝试导航到主页
          Alert.alert('注册成功', '欢迎加入零屿笔记！但应用状态更新失败，可能需要重新登录。');

          try {
            // 不需要手动导航，因为AppNavigator会根据isAuthenticated状态自动切换
            console.log('注册成功，但Redux状态更新失败，尝试通过其他方式更新认证状态');
          } catch (navError) {
            console.error('导航失败:', navError);
            Alert.alert('导航错误', '无法导航到主页，请重启应用。');
          }
        }
      } else {
        // 注册失败，显示错误信息
        setError(result?.message || '注册失败，请稍后重试');
      }
    } catch (error) {
      console.error('注册过程中发生错误:', error);
      setError(error?.message || '注册失败，请稍后重试');
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
            source={require('../../assets/images/login_logo.png')}
            style={styles.logo}
            resizeMode="cover"
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
                registerType === 'username' && [
                  styles.activeRegisterType,
                  { borderBottomColor: colors.primary }
                ]
              ]}
              onPress={() => setRegisterType('username')}
            >
              <Text
                variant="body"
                size="medium"
                color={registerType === 'username' ? 'primary' : 'hint'}
                bold={registerType === 'username'}
              >
                用户名注册
              </Text>
            </TouchableOpacity>
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

          {/* 用户名输入框 - 所有注册方式都需要 */}
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
            gradient
            gradientColors={[colors.primary, colors.secondary]}
            gradientStart={{x: 0, y: 0}}
            gradientEnd={{x: 1, y: 0}}
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
    borderRadius: 25,
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
});

export default RegisterScreen;