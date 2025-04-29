/**
 * 登录屏幕
 * 提供统一的登录框：支持用户名/手机号/邮箱登录，以及第三方登录
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../../store/slices/authSlice';
import { Button, Input, Loading } from '../../components/common';
import { Text as Typography } from '../../components/common/Typography';

import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import authApi from '../../services/api/authApi';

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
  const [identifier, setIdentifier] = useState(''); // 统一的标识符：用户名/手机号/邮箱
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState('password'); // 'password', 'code'
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false); // 是否为注册模式
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false); // 密码可见性
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false); // 确认密码可见性
  const [hasSentCode, setHasSentCode] = useState(false); // 是否已发送过验证码

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

  // 判断标识符类型
  const getIdentifierType = (value) => {
    if (!value) return null;

    // 手机号格式：11位数字
    if (/^1\d{10}$/.test(value)) {
      return 'phone';
    }

    // 邮箱格式：包含@符号
    if (value.includes('@')) {
      return 'email';
    }

    // 默认为用户名
    return 'username';
  };

  // 倒计时定时器
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    console.log('handleSendCode 函数被调用');

    // 清除错误
    setError('');

    // 先开始倒计时，提供即时反馈
    setCountdown(60);

    // 标记已发送过验证码，用于显示"重新发送"文本
    setHasSentCode(true);

    try {
      console.log('发送验证码到:', identifier);

      // 如果后端API可用，则调用
      if (authApi && authApi.sendVerificationCode) {
        // 实际API调用
        authApi.sendVerificationCode(identifier, isRegister ? 'register' : 'login')
          .then(result => {
            console.log('验证码发送结果:', result);
          })
          .catch(error => {
            console.error('验证码发送API错误:', error);
          });
      }
    } catch (error) {
      console.error('验证码发送错误:', error);
      // 不影响用户体验，仍然显示倒计时
    }
  };

  // 登录或注册
  const handleSubmit = async () => {
    // 清除错误
    setError('');

    // 获取标识符类型
    const identifierType = getIdentifierType(identifier);

    // 表单验证
    if (!identifier) {
      setError('请输入用户名/手机号/邮箱');
      return;
    }

    // 添加全局错误处理
    if (!authApi) {
      setError('系统错误：认证服务未初始化，请联系管理员');
      console.error('authApi is undefined');
      return;
    }

    // 注册模式
    if (isRegister) {
      if (!password || password.length < 6) {
        setError('密码长度至少为6位');
        return;
      }

      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }

      // 验证码注册
      if (loginType === 'code') {
        if (identifierType !== 'phone') {
          setError('验证码注册仅支持手机号');
          return;
        }

        if (!code || code.length < 4) {
          setError('请输入正确的验证码');
          return;
        }

        try {
          const result = await authApi.registerWithPhone({
            phone: identifier,
            code,
            password
          });

          if (result.success) {
            dispatch(login(result.data));
            Alert.alert('注册成功', '欢迎加入零屿笔记！');
          } else {
            setError(result.message || '注册失败，请稍后重试');
          }
        } catch (error) {
          setError('注册失败，请稍后重试');
        }
      }
      // 密码注册
      else {
        try {
          let result;

          if (identifierType === 'email') {
            result = await authApi.registerWithEmail({
              email: identifier,
              password
            });
          } else {
            // 用户名注册
            result = await authApi.registerWithUsername({
              username: identifier,
              password
            });
          }

          if (result.success) {
            // 注册成功后，使用用户名和密码进行登录
            const loginResult = await authApi.login({
              username: identifier,
              password: password
            });

            if (loginResult.success) {
              // 使用正确的格式更新Redux状态
              dispatch({ type: 'auth/setUserInfo', payload: loginResult.data.user });
              dispatch({ type: 'auth/setAuthToken', payload: loginResult.data.access });
              dispatch({ type: 'auth/setAuthRefreshToken', payload: loginResult.data.refresh });
              Alert.alert('注册成功', '欢迎加入零屿笔记！');
            } else {
              // 如果登录失败，仍然显示注册成功，但提示用户手动登录
              Alert.alert('注册成功', '请使用您的用户名和密码登录');
              setIsRegister(false); // 切换到登录界面
            }
          } else {
            setError(result.message || '注册失败，请稍后重试');
          }
        } catch (error) {
          setError('注册失败，请稍后重试');
        }
      }
    }
    // 登录模式
    else {
      // 验证码登录
      if (loginType === 'code') {
        if (identifierType !== 'phone') {
          setError('验证码登录仅支持手机号');
          return;
        }

        if (!code || code.length < 4) {
          setError('请输入正确的验证码');
          return;
        }

        try {
          // 检查authApi是否已初始化
          if (!authApi || !authApi.loginWithCode) {
            setError('系统错误：验证码登录服务未初始化，请联系管理员');
            console.error('authApi.loginWithCode is undefined');
            return;
          }

          const result = await authApi.loginWithCode({
            phone: identifier,
            code
          });

          if (result && result.success) {
            // 直接更新Redux状态
            dispatch({ type: 'auth/setUserInfo', payload: result.data.user });
            dispatch({ type: 'auth/setAuthToken', payload: result.data.access });
            dispatch({ type: 'auth/setAuthRefreshToken', payload: result.data.refresh });
          } else {
            setError(result?.message || '登录失败，请检查验证码');
          }
        } catch (error) {
          console.error('验证码登录错误:', error);
          setError(error?.message || '登录失败，请稍后重试');
        }
      }
      // 密码登录
      else {
        if (!password || password.length < 6) {
          setError('密码长度至少为6位');
          return;
        }

        // 根据标识符类型调用不同的登录API
        const loginData = {};

        if (identifierType === 'email') {
          loginData.email = identifier;
        } else if (identifierType === 'phone') {
          loginData.phone = identifier;
        } else {
          loginData.username = identifier;
        }

        loginData.password = password;

        try {
          // 直接调用API而不是通过Redux
          const result = await authApi.login(loginData);

          if (result && result.success) {
            // 登录成功，更新Redux状态
            dispatch({ type: 'auth/setUserInfo', payload: result.data.user });
            dispatch({ type: 'auth/setAuthToken', payload: result.data.access });
            dispatch({ type: 'auth/setAuthRefreshToken', payload: result.data.refresh });
          } else {
            // 登录失败，显示错误信息
            setError(result?.message || '登录失败，请检查用户名和密码');
          }
        } catch (error) {
          console.error('登录错误:', error);
          setError(error?.message || '登录失败，请稍后重试');
        }
      }
    }
  };

  // 第三方登录
  const handleThirdPartyLogin = async (type) => {
    setError('');

    // 检查authApi是否已初始化
    if (!authApi) {
      setError('系统错误：认证服务未初始化，请联系管理员');
      console.error('authApi is undefined in handleThirdPartyLogin');
      return;
    }

    try {
      let result;

      if (type === 'wechat') {
        result = await authApi.wechatLogin('mock_code');
      } else if (type === 'qq') {
        result = await authApi.qqLogin('mock_code');
      }

      if (result && result.success) {
        // 登录成功，更新Redux状态
        dispatch({ type: 'auth/setUserInfo', payload: result.data.user });
        dispatch({ type: 'auth/setAuthToken', payload: result.data.access });
        dispatch({ type: 'auth/setAuthRefreshToken', payload: result.data.refresh });
      } else {
        setError(result?.message || `${type === 'wechat' ? '微信' : 'QQ'}登录失败`);
      }
    } catch (error) {
      console.error(`${type}登录错误:`, error);
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
        <View style={styles.formWrapper}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/login_logo.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
          <LinearGradient
            colors={['#6CB4EE', '#D6F0FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradientHeader]}
          >
            <View style={styles.formHeader}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  !isRegister && styles.activeTabButton
                ]}
                onPress={() => setIsRegister(false)}
              >
                <Typography
                  variant="body"
                  size="medium"
                  color={!isRegister ? 'white' : 'textSecondary'}
                  bold
                >
                  登录
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  isRegister && styles.activeTabButton
                ]}
                onPress={() => setIsRegister(true)}
              >
                <Typography
                  variant="body"
                  size="medium"
                  color={isRegister ? 'white' : 'textSecondary'}
                  bold
                >
                  注册
                </Typography>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={[
            styles.formContainer,
            {
              backgroundColor: colors.card,
              ...dimensions.SHADOW.MEDIUM
            }
          ]}>
          {error ? (
            <View style={styles.errorContainer}>
              <Typography
                variant="body"
                size="small"
                style={styles.errorText}
              >
                {error}
              </Typography>
            </View>
          ) : null}

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
                size="tiny"
                color={loginType === 'password' ? 'primary' : 'hint'}
                bold={loginType === 'password'}
              >
                密码{isRegister ? '注册' : '登录'}
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
                size="tiny"
                color={loginType === 'code' ? 'primary' : 'hint'}
                bold={loginType === 'code'}
              >
                验证码{isRegister ? '注册' : '登录'}
              </Typography>
            </TouchableOpacity>
          </View>

          {/* 统一的标识符输入框 */}
          <Input
            label={isRegister ? "设置用户名/手机号/邮箱" : "用户名/手机号/邮箱"}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={isRegister ? "请设置用户名/手机号/邮箱" : "请输入用户名/手机号/邮箱"}
            autoCapitalize="none"
            keyboardType={getIdentifierType(identifier) === 'email' ? 'email-address' :
                          getIdentifierType(identifier) === 'phone' ? 'phone-pad' : 'default'}
            size="small"
            inputStyle={styles.customInputField}
            labelStyle={styles.customInputLabel}
          />

          {/* 验证码输入框 - 验证码登录/注册时显示 */}
          {loginType === 'code' && (
            <View style={styles.codeInputContainer}>
              <View style={styles.codeInputWrapper}>
                <Text style={styles.codeInputLabel}>验证码</Text>
                <View style={styles.codeInputField}>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="请输入验证码"
                    keyboardType="number-pad"
                    style={styles.codeInputText}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  console.log('验证码按钮点击');
                  if (getIdentifierType(identifier) === 'phone' && countdown === 0) {
                    handleSendCode();
                  } else if (getIdentifierType(identifier) !== 'phone') {
                    setError('请输入正确的手机号');
                  }
                }}
                style={[
                  styles.codeButtonTouchable,
                  { opacity: countdown > 0 || getIdentifierType(identifier) !== 'phone' ? 0.5 : 1 }
                ]}
              >
                <LinearGradient
                  colors={['#1E90FF', '#87CEFA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.codeButtonGradient}
                >
                  <Text style={styles.codeButtonText}>
                    {countdown > 0 ? `${countdown}秒` : hasSentCode ? "重新发送" : "获取验证码"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* 密码输入框 - 密码登录/注册时显示 */}
          {loginType === 'password' && (
            <View style={styles.passwordInputWrapper}>
              <Text style={styles.customInputLabel}>密码</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="请输入密码"
                  secureTextEntry={!passwordVisible}
                  style={styles.passwordInputField}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.passwordVisibilityToggle}
                  onPress={() => setPasswordVisible(!passwordVisible)}
                >
                  <Text style={styles.passwordVisibilityText}>
                    {passwordVisible ? '隐藏' : '显示'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 确认密码输入框 - 注册模式下显示 */}
          {isRegister && loginType === 'password' && (
            <View style={styles.passwordInputWrapper}>
              <Text style={styles.customInputLabel}>确认密码</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="请再次输入密码"
                  secureTextEntry={!confirmPasswordVisible}
                  style={styles.passwordInputField}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.passwordVisibilityToggle}
                  onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                >
                  <Text style={styles.passwordVisibilityText}>
                    {confirmPasswordVisible ? '隐藏' : '显示'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <LinearGradient
            colors={['#1E90FF', '#87CEFA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Button
              title={isRegister ? "注册" : "登录"}
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              style={styles.submitButton}
              size="medium"
              fullWidth
            />
          </LinearGradient>

          {!isRegister && (
            <View style={styles.linkContainer}>
              <Button
                title="忘记密码？"
                type="text"
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.linkButton}
                size="small"
              />
            </View>
          )}

          {/* 第三方登录 */}
          <View style={styles.thirdPartyContainer}>
            <Text style={styles.thirdPartyTitle}>
              第三方账号登录
            </Text>
            <View style={styles.thirdPartyButtons}>
              <TouchableOpacity
                style={styles.thirdPartyButton}
                onPress={() => handleThirdPartyLogin('wechat')}
              >
                <Image
                  source={require('../../assets/images/wechat.png')}
                  style={styles.thirdPartyIcon}
                  resizeMode="contain"
                />
                <Text style={styles.thirdPartyText}>
                  微信
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.thirdPartyButton}
                onPress={() => handleThirdPartyLogin('qq')}
              >
                <Image
                  source={require('../../assets/images/QQ.png')}
                  style={styles.thirdPartyIcon}
                  resizeMode="contain"
                />
                <Text style={styles.thirdPartyText}>
                  QQ
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>

      {isLoading && <Loading type="fullscreen" text={isRegister ? "注册中..." : "登录中..."} />}
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
    padding: 16,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginTop: 0,
    backgroundColor: '#6CB4EE',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    height: 240,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  formWrapper: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  gradientHeader: {
    width: '100%',
    overflow: 'hidden',
    marginTop: -1, // 确保与logo容器无缝衔接
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  formContainer: {
    width: '100%',
    padding: 20,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  errorContainer: {
    backgroundColor: '#FFEBEB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFCCCC',
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
    color: '#E53935',
  },
  gradientButton: {
    marginTop: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitButton: {
    height: 45,
    backgroundColor: 'transparent',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 5,
    marginBottom: 5,
  },
  linkButton: {
    minWidth: 0,
  },
  // 登录方式选择器样式
  loginTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  loginTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
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
    justifyContent: 'space-between',
  },
  codeInputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  codeInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  codeInputField: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  codeInputText: {
    fontSize: 14,
    color: '#333',
  },
  codeButtonTouchable: {
    width: 100,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#6CB4EE',
  },
  codeButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeButtonText: {
    color: '#2A5A8C',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  // 第三方登录样式
  thirdPartyContainer: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 5,
    alignItems: 'center',
  },
  thirdPartyTitle: {
    marginBottom: 5,
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  thirdPartyButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  thirdPartyButton: {
    alignItems: 'center',
    marginHorizontal: 24,
  },
  thirdPartyIcon: {
    width: 28,
    height: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  thirdPartyText: {
    marginTop: 4,
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  // 自定义输入框样式
  customInputField: {
    height: 40,
    fontSize: 14,
  },
  customInputLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  // 密码输入框样式
  passwordInputWrapper: {
    width: '100%',
    marginBottom: 12,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  passwordInputField: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: '#333',
    padding: 0,
  },
  passwordVisibilityToggle: {
    paddingHorizontal: 8,
    height: 40,
    justifyContent: 'center',
  },
  passwordVisibilityText: {
    color: '#2A88D0',
    fontSize: 12,
  },
});

export default LoginScreen;