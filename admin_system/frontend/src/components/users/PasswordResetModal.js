import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Radio,
  Steps,
  Result,
  Typography,
  Space,
  Alert,
  message
} from 'antd';
import {
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  SendOutlined
} from '@ant-design/icons';
import {
  sendPasswordResetCode,
  verifyPasswordResetCode,
  completePasswordReset
} from '../../services/userService';

const { Text, Title } = Typography;
const { Step } = Steps;

const PasswordResetModal = ({ visible, onCancel, user }) => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [resetType, setResetType] = useState('email');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [contactInfo, setContactInfo] = useState('');

  // 重置状态
  const resetState = () => {
    setCurrentStep(0);
    setResetType('email');
    setLoading(false);
    setVerificationCode('');
    setVerificationId(null);
    setCountdown(0);
    setContactInfo('');
    form.resetFields();
  };

  // 关闭模态框
  const handleCancel = () => {
    resetState();
    onCancel();
  };

  // 开始倒计时
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prevCountdown) => {
        if (prevCountdown <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prevCountdown - 1;
      });
    }, 1000);
  };

  // 发送验证码
  const handleSendCode = async () => {
    try {
      setLoading(true);
      
      // 发送验证码
      const response = await sendPasswordResetCode(user.id, resetType);
      
      if (response.status === 'success') {
        message.success('验证码发送成功');
        
        // 设置联系信息
        if (resetType === 'email') {
          setContactInfo(response.email);
        } else {
          setContactInfo(response.phone);
        }
        
        // 开始倒计时
        startCountdown();
        
        // 在开发环境中，自动填充验证码
        if (process.env.NODE_ENV === 'development' && response.code) {
          setVerificationCode(response.code);
          form.setFieldsValue({ verificationCode: response.code });
        }
        
        // 进入下一步
        setCurrentStep(1);
      } else {
        message.error(response.message || '发送验证码失败');
      }
    } catch (error) {
      message.error('发送验证码失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    try {
      // 验证表单
      await form.validateFields(['verificationCode']);
      
      setLoading(true);
      
      // 验证验证码
      const response = await verifyPasswordResetCode(
        user.id,
        form.getFieldValue('verificationCode'),
        resetType
      );
      
      if (response.status === 'success') {
        message.success('验证码验证成功');
        
        // 保存验证ID
        setVerificationId(response.verification_id);
        
        // 进入下一步
        setCurrentStep(2);
      } else {
        message.error(response.message || '验证码验证失败');
      }
    } catch (error) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('验证验证码失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    try {
      // 验证表单
      await form.validateFields(['newPassword', 'confirmPassword']);
      
      // 检查密码是否一致
      const newPassword = form.getFieldValue('newPassword');
      const confirmPassword = form.getFieldValue('confirmPassword');
      
      if (newPassword !== confirmPassword) {
        message.error('两次输入的密码不一致');
        return;
      }
      
      setLoading(true);
      
      // 重置密码
      const response = await completePasswordReset(
        user.id,
        verificationId,
        newPassword
      );
      
      if (response.status === 'success') {
        message.success('密码重置成功');
        
        // 进入完成步骤
        setCurrentStep(3);
      } else {
        message.error(response.message || '密码重置失败');
      }
    } catch (error) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('重置密码失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 重新发送验证码
  const handleResendCode = async () => {
    if (countdown > 0) return;
    await handleSendCode();
  };

  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Form form={form} layout="vertical">
            <Alert
              message="密码重置说明"
              description="请选择通过邮箱或手机号发送验证码，用户验证成功后可以重置密码。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            
            <Form.Item
              name="resetType"
              label="重置方式"
              initialValue={resetType}
              rules={[{ required: true, message: '请选择重置方式' }]}
            >
              <Radio.Group
                onChange={(e) => setResetType(e.target.value)}
                value={resetType}
              >
                <Space direction="vertical">
                  <Radio value="email" disabled={!user.email}>
                    <Space>
                      <MailOutlined />
                      通过邮箱发送验证码
                      <Text type="secondary">
                        {user.email ? `(${user.email})` : '(未绑定邮箱)'}
                      </Text>
                    </Space>
                  </Radio>
                  <Radio value="phone" disabled={!user.phone}>
                    <Space>
                      <MobileOutlined />
                      通过手机号发送验证码
                      <Text type="secondary">
                        {user.phone ? `(${user.phone})` : '(未绑定手机号)'}
                      </Text>
                    </Space>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            
            {!user.email && !user.phone && (
              <Alert
                message="无法重置密码"
                description="该用户未绑定邮箱和手机号，无法通过验证码重置密码。"
                type="error"
                showIcon
                style={{ marginBottom: 24 }}
              />
            )}
          </Form>
        );
      
      case 1:
        return (
          <Form form={form} layout="vertical">
            <Alert
              message="验证码已发送"
              description={
                <span>
                  验证码已发送至{resetType === 'email' ? '邮箱' : '手机号'}：
                  <Text strong>{contactInfo}</Text>，
                  请查收并输入验证码。
                </span>
              }
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />
            
            <Form.Item
              name="verificationCode"
              label="验证码"
              rules={[
                { required: true, message: '请输入验证码' },
                { len: 6, message: '验证码长度应为6位' }
              ]}
            >
              <Input
                prefix={<KeyOutlined />}
                placeholder="请输入6位验证码"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                autoComplete="off"
              />
            </Form.Item>
            
            <Button
              type="link"
              disabled={countdown > 0}
              onClick={handleResendCode}
            >
              {countdown > 0 ? `重新发送(${countdown}s)` : '重新发送验证码'}
            </Button>
          </Form>
        );
      
      case 2:
        return (
          <Form form={form} layout="vertical">
            <Alert
              message="设置新密码"
              description="请设置新的密码，密码长度至少为8位，包含字母和数字。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 8, message: '密码长度至少为8位' },
                {
                  pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
                  message: '密码必须包含字母和数字'
                }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入新密码"
                autoComplete="new-password"
              />
            </Form.Item>
            
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请确认新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请确认新密码"
                autoComplete="new-password"
              />
            </Form.Item>
          </Form>
        );
      
      case 3:
        return (
          <Result
            status="success"
            title="密码重置成功"
            subTitle={`用户 ${user.username} 的密码已成功重置`}
            extra={[
              <Button type="primary" key="done" onClick={handleCancel}>
                完成
              </Button>
            ]}
          />
        );
      
      default:
        return null;
    }
  };

  // 渲染底部按钮
  const renderFooterButtons = () => {
    if (currentStep === 3) {
      return null; // 最后一步不显示底部按钮
    }

    return (
      <div style={{ textAlign: 'right' }}>
        {currentStep > 0 && (
          <Button
            style={{ marginRight: 8 }}
            onClick={() => setCurrentStep(currentStep - 1)}
            disabled={loading}
          >
            上一步
          </Button>
        )}
        
        {currentStep === 0 && (
          <Button
            type="primary"
            onClick={handleSendCode}
            loading={loading}
            disabled={!user.email && !user.phone}
          >
            <SendOutlined /> 发送验证码
          </Button>
        )}
        
        {currentStep === 1 && (
          <Button
            type="primary"
            onClick={handleVerifyCode}
            loading={loading}
            disabled={!verificationCode}
          >
            <CheckCircleOutlined /> 验证
          </Button>
        )}
        
        {currentStep === 2 && (
          <Button
            type="primary"
            onClick={handleResetPassword}
            loading={loading}
          >
            <LockOutlined /> 重置密码
          </Button>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={<Title level={4}>重置用户密码</Title>}
      open={visible}
      onCancel={handleCancel}
      footer={renderFooterButtons()}
      width={600}
      maskClosable={false}
      destroyOnClose
    >
      <div style={{ marginBottom: 24 }}>
        <Steps current={currentStep} size="small">
          <Step title="选择方式" />
          <Step title="验证身份" />
          <Step title="设置密码" />
          <Step title="完成" />
        </Steps>
      </div>
      
      {renderStepContent()}
    </Modal>
  );
};

export default PasswordResetModal;
