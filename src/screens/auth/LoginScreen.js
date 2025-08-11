/**
 * 登录屏幕
 * 提供统一的登录框：支持用户名/手机号/邮箱登录，以及第三方登录
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, TextInput, ActivityIndicator, Animated } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../../redux/slices/authSlice';
import { Button, Input, Loading } from '../../components/common';
import { useTheme } from '../../context/ThemeContext';
import authApi from '../../services/api/authApi';

// 导入LinearGradient组件
let LinearGradient;
try {
  LinearGradient = require('react-native-linear-gradient').default;
} catch (error) {
  console.warn('无法导入LinearGradient组件，将使用普通View替代');
}

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
  const indicatorPosition = useRef(new Animated.Value(0)).current; // 登录方式指示器位置动画值
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

  // 处理登录类型切换动画
  useEffect(() => {
    Animated.timing(indicatorPosition, {
      toValue: loginType === 'password' ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [loginType, indicatorPosition]);



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

    // 不再需要获取标识符类型，根据登录方式决定

    // 表单验证
    if (!identifier) {
      if (loginType === 'password') {
        setError('请输入用户名/手机号/邮箱');
      } else {
        setError('请输入手机号');
      }
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
        // 强制将标识符视为手机号
        if (!/^1\d{10}$/.test(identifier)) {
          setError('请输入正确的手机号');
          return;
        }

        if (!code || code.length < 4) {
          setError('请输入正确的手机验证码');
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

            // 同步用户信息到Realm数据库
            try {
              // 使用Realm存储服务保存用户信息
              const { realmStorageService } = require('../../services/storage/realmStorageService');
              await realmStorageService.setItem('user_info', result.data.user);
              console.log('手机验证码注册用户信息已保存到Realm数据库');
            } catch (syncError) {
              console.error('保存手机验证码注册用户信息失败:', syncError);
              // 继续处理，不阻止注册流程
            }

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
          // 密码注册时，统一使用用户名
          const result = await authApi.registerWithUsername({
            username: identifier,
            password
          });

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

              // 同步用户信息到Realm数据库
              try {
                // 使用Realm存储服务保存用户信息
                const { realmStorageService } = require('../../services/storage/realmStorageService');
                await realmStorageService.setItem('user_info', loginResult.data.user);
                console.log('注册用户信息已保存到Realm数据库');
              } catch (syncError) {
                console.error('保存注册用户信息失败:', syncError);
                // 继续处理，不阻止注册流程
              }

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
        // 强制将标识符视为手机号
        if (!/^1\d{10}$/.test(identifier)) {
          setError('请输入正确的手机号');
          return;
        }

        if (!code || code.length < 4) {
          setError('请输入正确的手机验证码');
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

            // 同步用户信息到Realm数据库
            try {
              // 使用Realm存储服务保存用户信息
              const { realmStorageService } = require('../../services/storage/realmStorageService');
              await realmStorageService.setItem('user_info', result.data.user);
              console.log('验证码登录用户信息已保存到Realm数据库');
            } catch (syncError) {
              console.error('保存验证码登录用户信息失败:', syncError);
              // 继续处理，不阻止登录流程
            }
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

        // 密码登录时，统一使用用户名
        const loginData = {
          username: identifier
        };

        loginData.password = password;

        try {
          console.log('开始登录请求，登录数据:', loginData);

          // 直接调用API而不是通过Redux
          const result = await authApi.login(loginData);

          console.log('登录请求结果:', result);

          if (result && result.success && result.data) {
            console.log('登录成功，用户数据:', result.data.user);

            try {
              // 登录成功，更新Redux状态
              dispatch({ type: 'auth/setUserInfo', payload: result.data.user });
              dispatch({ type: 'auth/setAuthToken', payload: result.data.access });
              dispatch({ type: 'auth/setAuthRefreshToken', payload: result.data.refresh });

              // 显式设置认证状态
              dispatch({ type: 'auth/setIsAuthenticated', payload: true });

              // 同步用户信息到Realm数据库
              try {
                // 使用Realm存储服务保存用户信息
                const { realmStorageService } = require('../../services/storage/realmStorageService');
                await realmStorageService.setItem('user_info', result.data.user);
                console.log('用户信息已保存到Realm数据库');
              } catch (syncError) {
                console.error('保存用户信息失败:', syncError);
                // 继续处理，不阻止登录流程
              }

              // 显示成功消息
              Alert.alert('登录成功', '欢迎回到零屿笔记！');

              // 登录成功后更新Redux状态，让AppNavigator自动切换到主页
              // 不需要手动导航，因为AppNavigator会根据isAuthenticated状态自动切换
              console.log('登录成功，Redux状态已更新，等待AppNavigator自动切换到主页');
            } catch (reduxError) {
              console.error('更新Redux状态失败:', reduxError);

              // 即使Redux更新失败，也尝试导航到主页
              Alert.alert('登录成功', '欢迎回到零屿笔记！但应用状态更新失败，可能需要重新登录。');

              try {
                // 不需要手动导航，因为AppNavigator会根据isAuthenticated状态自动切换
                console.log('登录成功，但Redux状态更新失败，尝试通过其他方式更新认证状态');
              } catch (navError) {
                console.error('导航失败:', navError);
                Alert.alert('导航错误', '无法导航到主页，请重启应用。');
              }
            }
          } else {
            // 登录失败，显示错误信息
            console.error('登录失败:', result);
            setError(result?.message || '登录失败，请检查用户名和密码');
          }
        } catch (error) {
          console.error('登录错误:', error);
          console.error('错误详情:', error.response?.data || error.message);
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
      let loginMethod;
      let serviceName;

      if (type === 'wechat') {
        loginMethod = authApi.thirdPartyLogin || authApi.wechatLogin;
        serviceName = '微信';
      } else if (type === 'qq') {
        loginMethod = authApi.thirdPartyLogin || authApi.qqLogin;
        serviceName = 'QQ';
      }

      if (!loginMethod) {
        setError(`${serviceName}登录服务未初始化，请联系管理员`);
        console.error(`${type} login method is not available`);
        return;
      }

      // 调用第三方登录方法
      result = await loginMethod('mock_code', type);

      if (result && result.success) {
        // 登录成功，更新Redux状态
        dispatch({ type: 'auth/setUserInfo', payload: result.data.user });
        dispatch({ type: 'auth/setAuthToken', payload: result.data.access });
        dispatch({ type: 'auth/setAuthRefreshToken', payload: result.data.refresh });

        // 同步用户信息到Realm数据库
        try {
          // 使用Realm存储服务保存用户信息
          const { realmStorageService } = require('../../services/storage/realmStorageService');
          await realmStorageService.setItem('user_info', result.data.user);
          console.log(`${serviceName}登录用户信息已保存到Realm数据库`);
        } catch (storageError) {
          console.error(`保存${serviceName}登录用户信息失败:`, storageError);
          // 继续处理，不阻止登录流程
        }
      } else {
        setError(result?.message || `${serviceName}登录失败`);
      }
    } catch (error) {
      console.error(`第三方登录错误:`, error);
      setError(`第三方登录失败，请重试`);
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
          {LinearGradient ? (
            <LinearGradient
              colors={['#6CB4EE', '#D6F0FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.gradientHeader]}
            >
              <View style={styles.formHeader}>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPress={() => setIsRegister(false)}
                >
                  <Text
                    style={{
                      color: !isRegister ? 'white' : colors.textSecondary,
                      fontSize: 16,
                      fontWeight: 'bold'
                    }}
                  >
                    登录
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPress={() => setIsRegister(true)}
                >
                  <Text
                    style={{
                      color: isRegister ? 'white' : colors.textSecondary,
                      fontSize: 16,
                      fontWeight: 'bold'
                    }}
                  >
                    注册
                  </Text>
                </TouchableOpacity>


              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.gradientHeader, { backgroundColor: '#6CB4EE' }]}>
              <View style={styles.formHeader}>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPress={() => setIsRegister(false)}
                >
                  <Text
                    style={{
                      color: !isRegister ? 'white' : colors.textSecondary,
                      fontSize: 16,
                      fontWeight: 'bold'
                    }}
                  >
                    登录
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPress={() => setIsRegister(true)}
                >
                  <Text
                    style={{
                      color: isRegister ? 'white' : colors.textSecondary,
                      fontSize: 16,
                      fontWeight: 'bold'
                    }}
                  >
                    注册
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={[
            styles.formContainer,
            {
              backgroundColor: colors.card,
              ...dimensions.SHADOW.MEDIUM
            }
          ]}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text
                style={[styles.errorText, { fontSize: 14 }]}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* 登录方式选择器 */}
          <View style={styles.loginTypeSelector}>
            <TouchableOpacity
              style={[
                styles.loginTypeButton,
                loginType === 'password' && styles.activeLoginType
              ]}
              onPress={() => setLoginType('password')}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: loginType === 'password' ? colors.primary : colors.hint || '#999',
                  fontWeight: loginType === 'password' ? 'bold' : 'normal'
                }}
              >
                密码{isRegister ? '注册' : '登录'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.loginTypeButton,
                loginType === 'code' && styles.activeLoginType
              ]}
              onPress={() => setLoginType('code')}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: loginType === 'code' ? colors.primary : colors.hint || '#999',
                  fontWeight: loginType === 'code' ? 'bold' : 'normal'
                }}
              >
                验证码{isRegister ? '注册' : '登录'}
              </Text>
            </TouchableOpacity>

            {/* 添加可移动的指示器 */}
            <Animated.View
              style={[
                styles.tabIndicator,
                {
                  left: indicatorPosition.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '50%']
                  }),
                  borderBottomColor: colors.primary
                }
              ]}
            />
          </View>

          {/* 统一的标识符输入框 */}
          <Input
            label={loginType === 'password' ? "用户" : "手机号"}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={loginType === 'password' ?
                        (isRegister ? "请设置用户名/手机号/邮箱" : "请输入用户名/手机号/邮箱") :
                        "请输入手机号"}
            autoCapitalize="none"
            keyboardType={loginType === 'code' || getIdentifierType(identifier) === 'phone' ? 'phone-pad' :
                          getIdentifierType(identifier) === 'email' ? 'email-address' : 'default'}
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
                    placeholder="请输入手机验证码"
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
                  if (/^1\d{10}$/.test(identifier) && countdown === 0) {
                    handleSendCode();
                  } else if (!/^1\d{10}$/.test(identifier)) {
                    setError('请输入正确的手机号');
                  }
                }}
                style={[
                  styles.codeButtonTouchable,
                  { opacity: countdown > 0 || !/^1\d{10}$/.test(identifier) ? 0.5 : 1 }
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

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.gradientButtonContainer}
          >
            <LinearGradient
              colors={['#1E90FF', '#87CEFA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.gradientButtonText}>
                  {isRegister ? "注册" : "登录"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

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
    height: 45, // 增加高度
    paddingVertical: 2, // 增加内部空间
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'relative',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
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
  gradientButtonContainer: {
    marginTop: 5,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientButton: {
    height: 45,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  gradientButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
    position: 'relative',
  },
  loginTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
    position: 'relative',
    zIndex: 1,
  },
  activeLoginType: {
    // 不再使用边框作为指示器
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '46%', // 略小于50%，考虑到marginHorizontal
    borderBottomWidth: 2,
    height: 2, // 确保有高度
    marginHorizontal: '2%', // 与按钮的marginHorizontal对应
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