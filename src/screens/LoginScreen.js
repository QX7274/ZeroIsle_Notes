import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { login } from '../store/slices/authSlice';
import { thirdPartyAuthService } from '../services/thirdPartyAuth';
import Icon from 'react-native-vector-icons/Ionicons';

const LoginScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loginType, setLoginType] = useState('password'); // 'password' 或 'code'
  const [countdown, setCountdown] = useState(0);

  const handleLogin = async () => {
    try {
      if (loginType === 'password') {
        if (!phone || !password) {
          Alert.alert('错误', '请输入手机号和密码');
          return;
        }
        await dispatch(login({ phone, password })).unwrap();
      } else {
        if (!phone || !verificationCode) {
          Alert.alert('错误', '请输入手机号和验证码');
          return;
        }
        await dispatch(login({ phone, code: verificationCode })).unwrap();
      }
    } catch (error) {
      Alert.alert('错误', error.message || '登录失败');
    }
  };

  const handleSendCode = async () => {
    try {
      if (!phone) {
        Alert.alert('错误', '请输入手机号');
        return;
      }
      // 调用发送验证码接口
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      Alert.alert('错误', '发送验证码失败');
    }
  };

  const handleWeChatLogin = async () => {
    try {
      await thirdPartyAuthService.loginWithWeChat();
    } catch (error) {
      Alert.alert('错误', '微信登录失败');
    }
  };

  const handleQQLogin = async () => {
    try {
      await thirdPartyAuthService.loginWithQQ();
    } catch (error) {
      Alert.alert('错误', 'QQ登录失败');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>登录</Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="请输入手机号"
            placeholderTextColor={theme.textSecondary}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {loginType === 'password' ? (
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="请输入密码"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          ) : (
            <View style={styles.codeContainer}>
              <TextInput
                style={[styles.codeInput, { color: theme.text, borderColor: theme.border }]}
                placeholder="请输入验证码"
                placeholderTextColor={theme.textSecondary}
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.codeButton, { backgroundColor: countdown > 0 ? theme.disabled : theme.primary }]}
                onPress={handleSendCode}
                disabled={countdown > 0}
              >
                <Text style={styles.codeButtonText}>
                  {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setLoginType(loginType === 'password' ? 'code' : 'password')}
          >
            <Text style={{ color: theme.primary }}>
              {loginType === 'password' ? '使用验证码登录' : '使用密码登录'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: theme.primary }]}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>登录</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>其他登录方式</Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        </View>

        <View style={styles.thirdPartyContainer}>
          <TouchableOpacity
            style={[styles.thirdPartyButton, { backgroundColor: theme.wechat }]}
            onPress={handleWeChatLogin}
          >
            <Icon name="logo-wechat" size={24} color="#fff" />
            <Text style={styles.thirdPartyButtonText}>微信登录</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.thirdPartyButton, { backgroundColor: theme.qq }]}
            onPress={handleQQLogin}
          >
            <Icon name="logo-qq" size={24} color="#fff" />
            <Text style={styles.thirdPartyButtonText}>QQ登录</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={{ color: theme.primary }}>注册账号</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={{ color: theme.primary }}>忘记密码</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  codeContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  codeInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginRight: 10,
    fontSize: 16,
  },
  codeButton: {
    width: 120,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  switchButton: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  loginButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 14,
  },
  thirdPartyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  thirdPartyButton: {
    width: 120,
    height: 50,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thirdPartyButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
});

export default LoginScreen; 