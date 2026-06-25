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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import { Input, GradientButton } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import { userApi } from '../../services/api';
import { setUserInfo } from '../../redux/slices/authSlice';

const BindEmail = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const pageState = isLoading || isSendingCode ? 'busy' : 'ready';

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    try {
      setIsSendingCode(true);
      Haptics.lightFeedback();
      await userApi.sendVerificationCode({ email, type: 'bind' });
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
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
      await userApi.bindEmail({ email, code });
      dispatch(setUserInfo({ ...user, email }));
      navigation.goBack();
    } catch (err) {
      setError(err.message || '绑定邮箱失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: '#F3F8FF' }]} testID={`state.settings.bindEmail.state.${pageState}`}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View testID="state.settings.bindEmail.visibility.visible" />
        <View testID={`state.settings.bindEmail.sendingCode.visibility.${isSendingCode ? 'visible' : 'hidden'}`} />
        <View testID={`state.settings.bindEmail.countdown.visibility.${countdown > 0 ? 'visible' : 'hidden'}`} />
        <View testID={`state.settings.bindEmail.error.visibility.${error ? 'visible' : 'hidden'}`} />
        <View testID={`state.settings.bindEmail.current.visibility.${user?.email ? 'visible' : 'hidden'}`} />

        <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, styles.glassCard]}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.settings.bindEmail.back"
            style={styles.backButton}
          />
          <Text variant="h2" size="large" style={styles.pageTitle}>邮箱绑定</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" testID="list.settings.bindEmail.sections">
          <View style={[styles.contentCard, styles.glassCard]}>
            <Text variant="body" size="medium" color="hint" style={styles.description}>
              绑定邮箱可提升账户安全性，并用于接收通知和找回密码。
            </Text>

          {user?.email ? (
            <View style={[styles.currentInfo, { borderColor: 'rgba(76,141,255,0.22)' }]}>
              <Icon name="verified-user" size={18} color={colors.primary} />
              <Text variant="body" size="medium" style={styles.currentInfoText}>
                当前已绑定邮箱：{user.email}
              </Text>
            </View>
          ) : null}

          <Input
            label="邮箱地址"
            placeholder="请输入邮箱地址"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            testID="input.settings.bindEmail.email"
          />

          <View style={styles.codeRow}>
            <View style={styles.codeInput}>
              <Input
                label="验证码"
                placeholder="请输入验证码"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                testID="input.settings.bindEmail.code"
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: countdown > 0 ? '#B9CBE6' : colors.primary }]}
              onPress={handleSendCode}
              disabled={countdown > 0 || isSendingCode}
              testID="action.settings.bindEmail.sendCode"
            >
              {isSendingCode ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text variant="button" color="card">{countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? (
            <Text variant="caption" color="error" style={styles.errorText} testID="state.settings.bindEmail.errorText">
              {error}
            </Text>
          ) : null}

            <GradientButton
              title="绑定邮箱"
              onPress={handleBindEmail}
              loading={isLoading}
              style={styles.submitButton}
              testID="action.settings.bindEmail.submit"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 16 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pageTitle: {
    flex: 1,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    borderRadius: 16,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  header: {
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contentCard: {
    padding: 14,
  },
  description: {
    marginBottom: 16,
    lineHeight: 20,
  },
  currentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  currentInfoText: {
    marginLeft: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 2,
  },
  codeInput: {
    flex: 1,
    marginRight: 10,
  },
  sendBtn: {
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 10,
  },
  submitButton: {
    marginTop: 14,
  },
});

export default BindEmail;
