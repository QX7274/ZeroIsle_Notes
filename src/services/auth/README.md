# 认证服务

本目录包含零屿笔记应用的认证相关服务，用于处理用户登录、注册、身份验证和第三方登录等功能。

## 文件结构

- **thirdPartyAuth.js**: 第三方认证服务，提供微信、QQ等第三方平台的登录和绑定功能

## 主要功能

### 第三方认证服务 (thirdPartyAuth.js)

第三方认证服务提供以下主要功能：

- **微信登录**: 通过微信账号登录应用
- **QQ登录**: 通过QQ账号登录应用
- **账号绑定**: 将现有账号与第三方平台账号绑定
- **账号解绑**: 解除现有账号与第三方平台账号的绑定

## 认证流程

### 微信登录流程

1. 调用微信SDK进行授权，获取授权码
2. 将授权码发送到后端API进行验证
3. 后端验证成功后返回用户信息和认证令牌
4. 前端存储认证令牌和用户信息
5. 完成登录流程，导航到主界面

### QQ登录流程

1. 调用QQ SDK进行授权，获取授权码
2. 将授权码发送到后端API进行验证
3. 后端验证成功后返回用户信息和认证令牌
4. 前端存储认证令牌和用户信息
5. 完成登录流程，导航到主界面

### 账号绑定流程

1. 用户在已登录状态下选择绑定第三方账号
2. 调用相应平台SDK进行授权，获取授权码
3. 将授权码发送到后端API进行绑定
4. 后端绑定成功后返回更新的用户信息
5. 前端更新存储的用户信息
6. 完成绑定流程，显示绑定成功提示

## 与其他服务的交互

认证服务与以下服务有交互：

- **API服务 (userApi)**: 用于与后端认证API通信
- **存储服务 (storageService)**: 用于存储认证令牌和用户信息

## 使用方法

```javascript
import { thirdPartyAuth } from '../../services/auth';

// 微信登录
async function handleWeChatLogin() {
  try {
    const success = await thirdPartyAuth.loginWithWeChat();
    if (success) {
      // 登录成功，导航到主界面
      navigation.navigate('Main');
    } else {
      // 登录失败，显示错误信息
      Alert.alert('登录失败', '微信登录失败，请重试');
    }
  } catch (error) {
    console.error('微信登录错误:', error);
    Alert.alert('登录错误', error.message || '登录过程中发生错误');
  }
}

// QQ登录
async function handleQQLogin() {
  try {
    const success = await thirdPartyAuth.loginWithQQ();
    if (success) {
      // 登录成功，导航到主界面
      navigation.navigate('Main');
    } else {
      // 登录失败，显示错误信息
      Alert.alert('登录失败', 'QQ登录失败，请重试');
    }
  } catch (error) {
    console.error('QQ登录错误:', error);
    Alert.alert('登录错误', error.message || '登录过程中发生错误');
  }
}

// 绑定微信账号
async function handleBindWeChat() {
  try {
    const success = await thirdPartyAuth.bindWeChat();
    if (success) {
      // 绑定成功，显示成功提示
      Alert.alert('绑定成功', '微信账号绑定成功');
    } else {
      // 绑定失败，显示错误信息
      Alert.alert('绑定失败', '微信账号绑定失败，请重试');
    }
  } catch (error) {
    console.error('微信绑定错误:', error);
    Alert.alert('绑定错误', error.message || '绑定过程中发生错误');
  }
}

// 解绑微信账号
async function handleUnbindWeChat() {
  try {
    const success = await thirdPartyAuth.unbindWeChat();
    if (success) {
      // 解绑成功，显示成功提示
      Alert.alert('解绑成功', '微信账号解绑成功');
    } else {
      // 解绑失败，显示错误信息
      Alert.alert('解绑失败', '微信账号解绑失败，请重试');
    }
  } catch (error) {
    console.error('微信解绑错误:', error);
    Alert.alert('解绑错误', error.message || '解绑过程中发生错误');
  }
}
```

## 平台支持

认证服务支持以下平台的第三方登录：

- **微信**: 支持微信登录和账号绑定
- **QQ**: 支持QQ登录和账号绑定

## 注意事项

- 使用第三方登录前需要在相应平台注册应用并获取AppID
- iOS和Android平台可能需要不同的配置和设置
- 第三方登录可能受到网络状况和平台服务可用性的影响
- 应提供备选的登录方式，以防第三方登录失败
