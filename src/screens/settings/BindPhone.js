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
import { Text } from '../../components/common/Typography';
import { Input, GradientButton } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import { userApi } from '../../services/api';
import { setUserInfo } from '../../redux/slices/authSlice';

const BindPhone = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const pageState = isLoading || isSendingCode ? 'busy' : 'ready';

  const handleSendCode = async () => {
    if (!phone || phone.length < 11) {
      setError('请输入有效的手机号');
      return;
    }
    try {
      setIsSendingCode(true);
      Haptics.lightFeedback();
      await userApi.sendVerificationCode({ phone, type: 'bind' });
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

  const handleBindPhone = async () => {
    if (!phone || phone.length < 11) {
      setError('请输入有效的手机号');
      return;
    }
    if (!code || code.length < 4) {
      setError('请输入有效的验证码');
      return;
    }
    try {
      setIsLoading(true);
      Haptics.mediumFeedback();
      await userApi.bindPhone({ phone, code });
      dispatch(setUserInfo({ ...user, phone }));
      navigation.goBack();
    } catch (err) {
      setError(err.message || '绑定手机号失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.page, { backgroundColor: '#F3F8FF' }]}
      testID={`state.settings.bindPhone.state.${pageState}`}
    >
      <View testID="state.settings.bindPhone.visibility.visible" />
      <View testID={`state.settings.bindPhone.sendingCode.visibility.${isSendingCode ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.bindPhone.countdown.visibility.${countdown > 0 ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.bindPhone.error.visibility.${error ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.bindPhone.current.visibility.${user?.phone ? 'visible' : 'hidden'}`} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" testID="list.settings.bindPhone.sections">
        <View style={[styles.header, styles.glassCard]}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.settings.bindPhone.back"
            style={styles.backButton}
          />
          <Text variant="h2" size="large">手机号绑定</Text>
        </View>

        <View style={[styles.contentCard, styles.glassCard]}>
          <Text variant="body" size="medium" color="hint" style={styles.description}>
            绑定手机号可提升账户安全性，并用于找回账户和接收通知。
          </Text>

          {user?.phone ? (
            <View style={[styles.currentInfo, { borderColor: 'rgba(76,141,255,0.22)' }]}>
              <Icon name="verified-user" size={18} color={colors.primary} />
              <Text variant="body" size="medium" style={styles.currentInfoText}>
                当前已绑定手机号：{user.phone}
              </Text>
            </View>
          ) : null}

          <Input
            label="手机号"
            placeholder="请输入手机号"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
            testID="input.settings.bindPhone.phone"
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
                testID="input.settings.bindPhone.code"
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: countdown > 0 ? '#B9CBE6' : colors.primary }]}
              onPress={handleSendCode}
              disabled={countdown > 0 || isSendingCode}
              testID="action.settings.bindPhone.sendCode"
            >
              {isSendingCode ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text variant="button" color="card">{countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? (
            <Text variant="caption" color="error" style={styles.errorText} testID="state.settings.bindPhone.errorText">
              {error}
            </Text>
          ) : null}

          <GradientButton
            title="绑定手机号"
            onPress={handleBindPhone}
            loading={isLoading}
            style={styles.submitButton}
            testID="action.settings.bindPhone.submit"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 16 },
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

export default BindPhone;
