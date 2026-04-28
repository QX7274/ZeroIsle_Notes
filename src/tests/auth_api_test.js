/**
 * 用户认证API测试
 * 测试用户注册和登录功能
 */

import { authApi } from '../services/api/authApi';

/**
 * 测试用户名注册
 */
async function testUsernameRegister() {
  console.log('===== 测试用户名注册 =====');
  try {
    const userData = {
      username: `test_user_${Date.now()}`,
      password: 'Test@123456',
      confirm_password: 'Test@123456',
    };

    console.log('注册数据:', userData);
    const result = await authApi.register(userData);

    if (result.success) {
      console.log('注册成功:', result.data.user);
      return result.data;
    } else {
      console.error('注册失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('注册异常:', error);
    return null;
  }
}

/**
 * 测试邮箱注册
 */
async function testEmailRegister() {
  console.log('===== 测试邮箱注册 =====');
  try {
    const userData = {
      email: `test_${Date.now()}@example.com`,
      password: 'Test@123456',
      confirm_password: 'Test@123456',
    };

    console.log('注册数据:', userData);
    const result = await authApi.registerWithEmail(userData);

    if (result.success) {
      console.log('注册成功:', result.data.user);
      return result.data;
    } else {
      console.error('注册失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('注册异常:', error);
    return null;
  }
}

/**
 * 测试手机号注册
 */
async function testPhoneRegister() {
  console.log('===== 测试手机号注册 =====');
  try {
    // 获取验证码
    const phoneSuffix = String(Date.now()).slice(-4).padStart(4, '0');
    const phone = `1380013${phoneSuffix}`;
    console.log('发送验证码到手机:', phone);

    await authApi.sendVerificationCode(phone, 'register');

    // 在开发环境中，验证码固定为1234
    const userData = {
      phone,
      code: '1234',
      password: 'Test@123456',
      confirm_password: 'Test@123456',
    };

    console.log('注册数据:', userData);
    const result = await authApi.registerWithPhone(userData);

    if (result.success) {
      console.log('注册成功:', result.data.user);
      return result.data;
    } else {
      console.error('注册失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('注册异常:', error);
    return null;
  }
}

/**
 * 测试用户名登录
 */
async function testUsernameLogin(username, password = 'Test@123456') {
  console.log('===== 测试用户名登录 =====');
  try {
    const loginData = {
      username,
      password,
    };

    console.log('登录数据:', loginData);
    const result = await authApi.login(loginData);

    if (result.success) {
      console.log('登录成功:', result.data.user);
      return result.data;
    } else {
      console.error('登录失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('登录异常:', error);
    return null;
  }
}

/**
 * 测试邮箱登录
 */
async function testEmailLogin(email, password = 'Test@123456') {
  console.log('===== 测试邮箱登录 =====');
  try {
    const loginData = {
      email,
      password,
    };

    console.log('登录数据:', loginData);
    const result = await authApi.login(loginData);

    if (result.success) {
      console.log('登录成功:', result.data.user);
      return result.data;
    } else {
      console.error('登录失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('登录异常:', error);
    return null;
  }
}

/**
 * 测试手机号登录
 */
async function testPhoneLogin(phone, password = 'Test@123456') {
  console.log('===== 测试手机号登录 =====');
  try {
    const loginData = {
      phone,
      password,
    };

    console.log('登录数据:', loginData);
    const result = await authApi.login(loginData);

    if (result.success) {
      console.log('登录成功:', result.data.user);
      return result.data;
    } else {
      console.error('登录失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('登录异常:', error);
    return null;
  }
}

/**
 * 测试验证码登录
 */
async function testCodeLogin(phone) {
  console.log('===== 测试验证码登录 =====');
  try {
    // 获取验证码
    console.log('发送验证码到手机:', phone);
    await authApi.sendVerificationCode(phone, 'login');

    // 在开发环境中，验证码固定为1234
    const loginData = {
      phone,
      code: '1234',
    };

    console.log('登录数据:', loginData);
    const result = await authApi.loginWithCode(loginData);

    if (result.success) {
      console.log('登录成功:', result.data.user);
      return result.data;
    } else {
      console.error('登录失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('登录异常:', error);
    return null;
  }
}

/**
 * 测试绑定邮箱
 */
async function testBindEmail(token, email) {
  console.log('===== 测试绑定邮箱 =====');
  try {
    const bindData = {
      email,
      password: 'Test@123456',
    };

    console.log('绑定数据:', bindData);
    const result = await authApi.bindEmail(bindData, token);

    if (result.success) {
      console.log('绑定成功:', result.data.user);
      return result.data;
    } else {
      console.error('绑定失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('绑定异常:', error);
    return null;
  }
}

/**
 * 测试绑定手机号
 */
async function testBindPhone(token, phone) {
  console.log('===== 测试绑定手机号 =====');
  try {
    // 获取验证码
    console.log('发送验证码到手机:', phone);
    await authApi.sendVerificationCode(phone, 'bind');

    // 在开发环境中，验证码固定为1234
    const bindData = {
      phone,
      code: '1234',
      password: 'Test@123456',
    };

    console.log('绑定数据:', bindData);
    const result = await authApi.bindPhone(bindData, token);

    if (result.success) {
      console.log('绑定成功:', result.data.user);
      return result.data;
    } else {
      console.error('绑定失败:', result.message);
      return null;
    }
  } catch (error) {
    console.error('绑定异常:', error);
    return null;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  try {
    // 测试注册
    const usernameUser = await testUsernameRegister();
    const emailUser = await testEmailRegister();
    const phoneUser = await testPhoneRegister();

    if (usernameUser) {
      // 测试用户名登录
      await testUsernameLogin(usernameUser.user.username);

      // 测试绑定邮箱
      const email = `bind_${Date.now()}@example.com`;
      await testBindEmail(usernameUser.access, email);

      // 测试邮箱登录
      await testEmailLogin(email);

      // 测试绑定手机号
      const phoneSuffix = String(Date.now()).slice(-4).padStart(4, '0');
      const phone = `1380013${phoneSuffix}`;
      await testBindPhone(usernameUser.access, phone);

      // 测试手机号登录
      await testPhoneLogin(phone);

      // 测试验证码登录
      await testCodeLogin(phone);
    }

    if (emailUser) {
      // 测试邮箱登录
      await testEmailLogin(emailUser.user.email);
    }

    if (phoneUser) {
      // 测试手机号登录
      await testPhoneLogin(phoneUser.user.phone);

      // 测试验证码登录
      await testCodeLogin(phoneUser.user.phone);
    }

    console.log('===== 所有测试完成 =====');
  } catch (error) {
    console.error('测试异常:', error);
  }
}

// 导出测试函数
export {
  testUsernameRegister,
  testEmailRegister,
  testPhoneRegister,
  testUsernameLogin,
  testEmailLogin,
  testPhoneLogin,
  testCodeLogin,
  testBindEmail,
  testBindPhone,
  runAllTests,
};
