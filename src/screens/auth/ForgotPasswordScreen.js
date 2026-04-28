/**
 * 忘记密码屏幕
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Button, Input, Loading } from '../../components/common';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import authApi from '../../services/api/authApi';
import { Haptics } from '../../utils/haptics';

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors } = useTheme();

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(1); // 1: 选择方式, 2: 输入验证码, 3: 设置新密码, 4: 完成
  const [resetType, setResetType] = useState('email'); // 'email' 或 'phone'

  // 表单状态
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // UI状态
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verificationId, setVerificationId] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  // 倒计时效果
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // 验证邮箱
  const validateEmail = () => {
    let isValid = true;
    if (!email.trim()) {
      setEmailError('请输入邮箱地址');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('请输入有效的邮箱地址');
      isValid = false;
    } else {
      setEmailError('');
    }
    return isValid;
  };

  // 验证手机号
  const validatePhone = () => {
    let isValid = true;
    if (!phone.trim()) {
      setPhoneError('请输入手机号');
      isValid = false;
    } else if (!/^1[3-9]\d{9}$/.test(phone)) {
      setPhoneError('请输入有效的手机号');
      isValid = false;
    } else {
      setPhoneError('');
    }
    return isValid;
  };

  // 验证验证码
  const validateCode = () => {
    let isValid = true;
    if (!verificationCode.trim()) {
      setCodeError('请输入验证码');
      isValid = false;
    } else if (verificationCode.length !== 6) {
      setCodeError('验证码应为6位数字');
      isValid = false;
    } else {
      setCodeError('');
    }
    return isValid;
  };

  // 验证密码
  const validatePassword = () => {
    let isValid = true;
    if (!newPassword) {
      setPasswordError('请输入新密码');
      isValid = false;
    } else if (newPassword.length < 8) {
      setPasswordError('密码长度至少为8位');
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      isValid = false;
    } else {
      setPasswordError('');
    }
    return isValid;
  };

  // 发送验证码
  const handleSendCode = async () => {
    // 清除之前的错误
    setError('');

    // 根据重置类型验证输入
    let isValid = false;
    if (resetType === 'email') {
      isValid = validateEmail();
    } else {
      isValid = validatePhone();
    }

    if (!isValid) {
      return;
    }

    try {
      setIsLoading(true);
      Haptics.lightFeedback();

      // 准备请求数据
      const requestData = {
        type: 'reset_password',
      };

      // 根据重置类型设置请求参数
      if (resetType === 'email') {
        requestData.email = email;
        setContactInfo(email);
      } else {
        requestData.phone = phone;
        setContactInfo(phone);
      }

      // 调用发送验证码API
      const response = await authApi.sendVerificationCode(requestData);

      if (response.success) {
        // 开始倒计时
        setCountdown(60);

        // 进入下一步
        setCurrentStep(2);
        setSuccess(true);
      } else {
        setError(response.message || '发送验证码失败，请稍后重试');
      }
    } catch (err) {
      setError(err.message || '发送验证码失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    // 清除之前的错误
    setError('');

    // 验证验证码
    if (!validateCode()) {
      return;
    }

    try {
      setIsLoading(true);
      Haptics.lightFeedback();

      // 准备请求数据
      const requestData = {
        code: verificationCode,
      };

      // 根据重置类型设置请求参数
      if (resetType === 'email') {
        requestData.email = email;
      } else {
        requestData.phone = phone;
      }

      // 调用验证验证码API
      const response = await authApi.verifyResetCode(requestData);

      if (response.success) {
        // 保存验证ID
        setVerificationId(response.data.verification_id);

        // 进入下一步
        setCurrentStep(3);
      } else {
        setError(response.message || '验证码验证失败，请检查后重试');
      }
    } catch (err) {
      setError(err.message || '验证码验证失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    // 清除之前的错误
    setError('');

    // 验证密码
    if (!validatePassword()) {
      return;
    }

    try {
      setIsLoading(true);
      Haptics.lightFeedback();

      // 准备请求数据
      const requestData = {
        verification_id: verificationId,
        new_password: newPassword,
      };

      // 根据重置类型设置请求参数
      if (resetType === 'email') {
        requestData.email = email;
      } else {
        requestData.phone = phone;
      }

      // 调用重置密码API
      const response = await authApi.resetPassword(requestData);

      if (response.success) {
        // 进入完成步骤
        setCurrentStep(4);
        setSuccess(true);
      } else {
        setError(response.message || '重置密码失败，请稍后重试');
      }
    } catch (err) {
      setError(err.message || '重置密码失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 重新发送验证码
  const handleResendCode = async () => {
    if (countdown > 0) {return;}
    await handleSendCode();
  };

  // 跳转到登录页面
  const navigateToLogin = () => {
    navigation.navigate('Login');
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
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.title}>找回密码</Text>

          {/* 步骤指示器 */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, currentStep >= 1 && styles.activeStepDot]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, currentStep >= 2 && styles.activeStepDot]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, currentStep >= 3 && styles.activeStepDot]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, currentStep >= 4 && styles.activeStepDot]} />
          </View>

          {/* 错误信息 */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* 步骤1: 选择重置方式 */}
          {currentStep === 1 && (
            <>
              <Text style={styles.description}>
                请选择密码重置方式，并输入相应的信息
              </Text>

              <View style={styles.resetTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.resetTypeButton,
                    resetType === 'email' && styles.resetTypeButtonActive,
                  ]}
                  onPress={() => setResetType('email')}
                >
                  <Text
                    style={[
                      styles.resetTypeText,
                      resetType === 'email' && styles.resetTypeTextActive,
                    ]}
                  >
                    邮箱验证
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.resetTypeButton,
                    resetType === 'phone' && styles.resetTypeButtonActive,
                  ]}
                  onPress={() => setResetType('phone')}
                >
                  <Text
                    style={[
                      styles.resetTypeText,
                      resetType === 'phone' && styles.resetTypeTextActive,
                    ]}
                  >
                    手机验证
                  </Text>
                </TouchableOpacity>
              </View>

              {resetType === 'email' ? (
                <Input
                  label="邮箱地址"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="请输入邮箱地址"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={emailError}
                />
              ) : (
                <Input
                  label="手机号码"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="请输入手机号码"
                  keyboardType="phone-pad"
                  maxLength={11}
                  error={phoneError}
                />
              )}

              <Button
                title="发送验证码"
                onPress={handleSendCode}
                loading={isLoading}
                disabled={isLoading}
                style={styles.actionButton}
              />
            </>
          )}

          {/* 步骤2: 输入验证码 */}
          {currentStep === 2 && (
            <>
              <Text style={styles.description}>
                验证码已发送至您的{resetType === 'email' ? '邮箱' : '手机'}: {contactInfo}
              </Text>

              <Input
                label="验证码"
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="请输入6位验证码"
                keyboardType="number-pad"
                maxLength={6}
                error={codeError}
              />

              <Button
                title={countdown > 0 ? `重新发送(${countdown}s)` : '重新发送验证码'}
                onPress={handleResendCode}
                type="text"
                disabled={countdown > 0}
                style={styles.resendButton}
              />

              <Button
                title="验证"
                onPress={handleVerifyCode}
                loading={isLoading}
                disabled={isLoading || !verificationCode}
                style={styles.actionButton}
              />

              <Button
                title={`返回修改${resetType === 'email' ? '邮箱' : '手机号'}`}
                type="text"
                onPress={() => setCurrentStep(1)}
                style={styles.backButton}
              />
            </>
          )}

          {/* 步骤3: 设置新密码 */}
          {currentStep === 3 && (
            <>
              <Text style={styles.description}>
                请设置您的新密码
              </Text>

              <Input
                label="新密码"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="请输入新密码"
                secureTextEntry
                error={passwordError}
              />

              <Input
                label="确认密码"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="请再次输入新密码"
                secureTextEntry
                error={passwordError ? '' : null}
              />

              <Button
                title="重置密码"
                onPress={handleResetPassword}
                loading={isLoading}
                disabled={isLoading}
                style={styles.actionButton}
              />

              <Button
                title="返回上一步"
                type="text"
                onPress={() => setCurrentStep(2)}
                style={styles.backButton}
              />
            </>
          )}

          {/* 步骤4: 完成 */}
          {currentStep === 4 && (
            <>
              <Text style={styles.successText}>
                密码重置成功！
              </Text>

              <Text style={styles.description}>
                您的密码已成功重置，现在可以使用新密码登录了。
              </Text>

              <Button
                title="返回登录"
                onPress={navigateToLogin}
                style={styles.actionButton}
              />
            </>
          )}

          {/* 返回登录链接 (仅在步骤1显示) */}
          {currentStep === 1 && (
            <View style={styles.linkContainer}>
              <Button
                title="返回登录"
                type="text"
                onPress={navigateToLogin}
                style={styles.linkButton}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {isLoading && <Loading type="fullscreen" text="发送中..." />}
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
    padding: SPACING.LARGE,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XLARGE,
  },
  logo: {
    width: 400,
    height: 200,
    marginBottom: SPACING.MEDIUM,
  },

  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000', // 使用固定颜色值
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#8E8E93', // 使用固定颜色值
    marginBottom: SPACING.LARGE,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF3B30', // 使用固定颜色值
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
  },
  successText: {
    color: '#34C759', // 使用固定颜色值
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButton: {
    marginTop: SPACING.MEDIUM,
  },
  resendButton: {
    marginTop: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
  },
  backButton: {
    marginTop: SPACING.MEDIUM,
  },
  linkContainer: {
    alignItems: 'center',
    marginTop: SPACING.MEDIUM,
  },
  linkButton: {
    minWidth: 0,
  },

  // 重置类型选择样式
  resetTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.LARGE,
  },
  resetTypeButton: {
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    marginHorizontal: SPACING.SMALL,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  resetTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  resetTypeText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  resetTypeTextActive: {
    color: '#FFFFFF',
  },

  // 步骤指示器样式
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.LARGE,
    paddingHorizontal: SPACING.XLARGE,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
  },
  activeStepDot: {
    backgroundColor: '#007AFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
});

export default ForgotPasswordScreen;
