/**
 * 邮箱绑定页面
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from 'react-native';
import { Input, GradientButton } from '../../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import { userApi } from '../../services/api';

const BindEmail = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');

  // 发送验证码
  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }

    try {
      setIsSendingCode(true);
      Haptics.lightFeedback();

      // 调用发送验证码API
      await userApi.sendVerificationCode({ email, type: 'bind' });

      // 开始倒计时
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

      setError('');
    } catch (err) {
      setError(err.message || '发送验证码失败，请稍后重试');
    } finally {
      setIsSendingCode(false);
    }
  };

  // 绑定邮箱
  const handleBindEmail = async () => {
    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }

    if (!code || code.length < 4) {
      setError('请输入有效的验证码');
      return;
    }

    try {
      setIsLoading(true);
      Haptics.mediumFeedback();

      // 调用绑定邮箱API
      const response = await userApi.bindEmail({ email, code });

      // 更新用户信息
      dispatch({ type: 'UPDATE_USER', payload: { email } });

      // 返回上一页
      navigation.goBack();
    } catch (err) {
      setError(err.message || '绑定邮箱失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text
            variant="h2"
            size="large"
            style={styles.headerTitle}
          >
            邮箱绑定
          </Text>
        </View>

        <View style={styles.content}>
          <Text
            variant="body"
            size="medium"
            color="textSecondary"
            style={styles.description}
          >
            绑定邮箱可以提高账号安全性，并用于接收重要通知和找回密码
          </Text>

          {user?.email && (
            <View style={[styles.currentInfo, { backgroundColor: colors.card }]}>
              <Icon name="info" size={20} color={colors.primary} />
              <Text
                variant="body"
                size="medium"
                style={styles.currentInfoText}
              >
                当前已绑定邮箱: {user.email}
              </Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Input
                label="邮箱地址"
                placeholder="请输入邮箱地址"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.codeContainer}>
              <View style={styles.codeInput}>
                <Input
                  label="验证码"
                  placeholder="请输入验证码"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.sendCodeButton,
                  { backgroundColor: countdown > 0 ? colors.border : colors.primary },
                ]}
                onPress={handleSendCode}
                disabled={countdown > 0 || isSendingCode}
              >
                {isSendingCode ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    variant="button"
                    color="card"
                  >
                    {countdown > 0 ? `${countdown}秒` : '获取验证码'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {error ? (
              <Text
                variant="caption"
                color="error"
                style={styles.errorText}
              >
                {error}
              </Text>
            ) : null}

            <GradientButton
              title="绑定邮箱"
              onPress={handleBindEmail}
              loading={isLoading}
              style={styles.submitButton}
            />
          </View>
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  description: {
    marginBottom: 24,
  },
  currentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  currentInfoText: {
    marginLeft: 8,
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  codeInput: {
    flex: 1,
    marginRight: 12,
  },
  sendCodeButton: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 8,
  },
});

export default BindEmail;
