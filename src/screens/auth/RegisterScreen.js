/**
 * 注册屏幕
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { userApi } from '../../services/api';
import { storage } from '../../utils';
import Icon from 'react-native-vector-icons/Ionicons';
import { validationUtils } from '../../utils';

const RegisterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerType, setRegisterType] = useState('phone'); // 'phone' 或 'email'
  const [error, setError] = useState('');

  // 注册不需要验证码，所以移除发送验证码的方法

  const handleRegister = async () => {
    // 验证密码
    if (!validationUtils.isPassword(password)) {
      setError('密码长度至少为6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      let response;

      // 手机号注册
      if (registerType === 'phone') {
        if (!validationUtils.isPhone(phone)) {
          setError('请输入正确的手机号');
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
      // 导航到主页面
    } catch (error) {
      setError('注册失败，请稍后重试');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.logoContainer}>
        <Icon name="document-text-outline" size={80} color={colors.primary} />
        <Text style={[styles.logoText, { color: colors.text }]}>
          ZeroIsle Notes
        </Text>
      </View>

      <View style={styles.formContainer}>
        {/* 注册方式选择器 */}
        <View style={styles.registerTypeContainer}>
          <TouchableOpacity
            style={[styles.registerTypeButton, registerType === 'phone' && styles.activeRegisterType]}
            onPress={() => setRegisterType('phone')}
          >
            <Text style={[styles.registerTypeText, registerType === 'phone' && styles.activeRegisterTypeText]}>手机号注册</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.registerTypeButton, registerType === 'email' && styles.activeRegisterType]}
            onPress={() => setRegisterType('email')}
          >
            <Text style={[styles.registerTypeText, registerType === 'email' && styles.activeRegisterTypeText]}>邮箱注册</Text>
          </TouchableOpacity>
        </View>

        {/* 手机号注册表单 */}
        {registerType === 'phone' && (
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="手机号"
            placeholderTextColor={colors.text + '80'}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
          />
        )}

        {/* 邮箱注册表单 */}
        {registerType === 'email' && (
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="邮箱地址"
            placeholderTextColor={colors.text + '80'}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        )}

        {/* 密码输入框 - 两种注册方式都需要 */}
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="密码"
          placeholderTextColor={colors.text + '80'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="确认密码"
          placeholderTextColor={colors.text + '80'}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        {error ? (
          <Text style={[styles.errorText, { color: colors.notification }]}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.registerButton, { backgroundColor: colors.primary }]}
          onPress={handleRegister}
        >
          <Text style={styles.registerButtonText}>注册</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={[styles.footerText, { color: colors.primary }]}>
            已有账号？立即登录
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  // 注册方式选择器样式
  registerTypeContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 5,
    overflow: 'hidden',
  },
  registerTypeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeRegisterType: {
    borderBottomColor: '#007AFF',
  },
  registerTypeText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  activeRegisterTypeText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16
  },
  codeContainer: {
    flexDirection: 'row',
    marginBottom: 16
  },
  codeInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 8
  },
  codeButton: {
    width: 100,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  codeButtonText: {
    color: '#FFFFFF',
    fontSize: 14
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16
  },
  registerButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  footer: {
    alignItems: 'center',
    marginTop: 16
  },
  footerText: {
    fontSize: 14
  }
});

export default RegisterScreen;