/**
 * 现代化注册屏幕
 * 支持多种注册方式和渐变背景
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  StatusBar
} from 'react-native';
import { SPACING, BORDER_RADIUS, SHADOW } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { userApi } from '../../services/api';
import { storage } from '../../utils';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { validationUtils } from '../../utils';
import LinearGradient from 'react-native-linear-gradient';
import { Button, Input, Card } from '../../components/common';

const RegisterScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();
  const { width, height } = Dimensions.get('window');
  const dispatch = useDispatch();

  // 状态管理
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerType, setRegisterType] = useState('phone'); // 'phone' 或 'email'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // 渐变色
  const backgroundGradient = isDarkMode
    ? colors.gradients.secondary
    : ['#7F5AF0', '#4361EE'];

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

  // 注册不需要验证码，所以移除发送验证码的方法

  const handleRegister = async () => {
    setError('');
    setIsLoading(true);

    try {
      // 验证密码
      if (!validationUtils.isPassword(password)) {
        setError('密码长度至少为6位');
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        setIsLoading(false);
        return;
      }

      let response;

      // 手机号注册
      if (registerType === 'phone') {
        if (!validationUtils.isPhone(phone)) {
          setError('请输入正确的手机号');
          setIsLoading(false);
          return;
        }

        response = await userApi.register({
          phone,
          password,
          username: `user_${phone.substring(phone.length - 4)}` // 默认使用手机号后四位作为用户名
        });
      }
      // 邮箱注册
      else {
        if (!validationUtils.isEmail(email)) {
          setError('请输入正确的邮箱地址');
          setIsLoading(false);
          return;
        }

        response = await userApi.registerWithEmail({
          email,
          password,
          username: email.split('@')[0] // 默认使用邮箱前缀作为用户名
        });
      }

      await storage.set('token', response.token);
      await storage.set('user', response.user);
      dispatch({ type: 'LOGIN', payload: response.user });

      // 注册成功，显示成功动画
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 导航到主页面
        navigation.replace('Home');
      });

    } catch (error) {
      console.error('注册错误:', error);
      setError('注册失败，请稍后重试');
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 渐变背景 */}
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

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
          <Icon name="document-text-outline" size={60} color="#FFFFFF" />
        </View>
        <Text style={styles.logoText}>零屿笔记</Text>
        <Text style={styles.logoSubText}>创建您的账号，开始记录精彩</Text>
      </Animated.View>

      {/* 注册表单卡片 */}
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
          <Text style={[styles.title, { color: colors.text }]}>注册账号</Text>

          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcon name="error-outline" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* 注册方式选择器 */}
          <View style={styles.registerTypeContainer}>
            <TouchableOpacity
              style={[styles.registerTypeButton, registerType === 'phone' && styles.activeRegisterType]}
              onPress={() => setRegisterType('phone')}
            >
              <MaterialIcon
                name="smartphone"
                size={20}
                color={registerType === 'phone' ? colors.primary : colors.textSecondary}
                style={styles.registerTypeIcon}
              />
              <Text
                style={[
                  styles.registerTypeText,
                  registerType === 'phone' && styles.activeRegisterTypeText,
                  { color: registerType === 'phone' ? colors.primary : colors.textSecondary }
                ]}
              >
                手机号注册
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.registerTypeButton, registerType === 'email' && styles.activeRegisterType]}
              onPress={() => setRegisterType('email')}
            >
              <MaterialIcon
                name="email"
                size={20}
                color={registerType === 'email' ? colors.primary : colors.textSecondary}
                style={styles.registerTypeIcon}
              />
              <Text
                style={[
                  styles.registerTypeText,
                  registerType === 'email' && styles.activeRegisterTypeText,
                  { color: registerType === 'email' ? colors.primary : colors.textSecondary }
                ]}
              >
                邮箱注册
              </Text>
            </TouchableOpacity>
          </View>

          {/* 手机号注册表单 */}
          {registerType === 'phone' && (
            <Input
              label="手机号"
              value={phone}
              onChangeText={setPhone}
              placeholder="请输入手机号"
              leftIcon="phone-android"
              variant="outlined"
              floatingLabel
              keyboardType="phone-pad"
              maxLength={11}
            />
          )}

          {/* 邮箱注册表单 */}
          {registerType === 'email' && (
            <Input
              label="邮箱地址"
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

          {/* 密码输入框 - 两种注册方式都需要 */}
          <Input
            label="密码"
            value={password}
            onChangeText={setPassword}
            placeholder="请输入密码"
            leftIcon="lock"
            variant="outlined"
            floatingLabel
            secureTextEntry
            style={styles.inputMargin}
          />

          <Input
            label="确认密码"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="请再次输入密码"
            leftIcon="lock-check"
            variant="outlined"
            floatingLabel
            secureTextEntry
            style={styles.inputMargin}
          />

          <Button
            title="注册"
            onPress={handleRegister}
            loading={isLoading}
            disabled={isLoading}
            type="gradient"
            gradientType="primary"
            rounded
            style={styles.registerButton}
          />

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              已有账号？
            </Text>
            <Button
              title="立即登录"
              type="text"
              onPress={() => navigation.navigate('Login')}
              style={styles.loginButton}
            />
          </View>
        </Card>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // 基础容器样式
  container: {
    flex: 1,
  },

  // Logo相关样式
  logoContainer: {
    alignItems: 'center',
    marginTop: SPACING.XLARGE,
    marginBottom: SPACING.MEDIUM,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.MEDIUM,
    ...SHADOW.MEDIUM,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: SPACING.SMALL,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  logoSubText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    maxWidth: '80%',
  },

  // 表单相关样式
  formWrapper: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    paddingHorizontal: SPACING.LARGE,
    flex: 1,
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

  // 注册方式选择器样式
  registerTypeContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.LARGE,
    borderRadius: BORDER_RADIUS.MEDIUM,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 4,
  },
  registerTypeButton: {
    flex: 1,
    paddingVertical: SPACING.MEDIUM,
    paddingHorizontal: SPACING.SMALL,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.SMALL,
    marginHorizontal: 2,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerTypeIcon: {
    marginRight: SPACING.SMALL,
  },
  activeRegisterType: {
    backgroundColor: 'white',
    ...SHADOW.SMALL,
  },
  registerTypeText: {
    fontSize: 14,
  },
  activeRegisterTypeText: {
    fontWeight: '600',
  },

  // 输入框样式
  inputMargin: {
    marginBottom: SPACING.MEDIUM,
  },

  // 按钮样式
  registerButton: {
    marginTop: SPACING.LARGE,
    height: 50,
  },

  // 底部样式
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.LARGE,
  },
  footerText: {
    fontSize: 14,
  },
  loginButton: {
    minWidth: 0,
    marginLeft: SPACING.TINY,
  },
});

export default RegisterScreen;