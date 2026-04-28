export const validationUtils = {
  // 验证手机号
  isPhone: (phone) => {
    return /^1[3-9]\d{9}$/.test(phone);
  },

  // 验证验证码
  isVerificationCode: (code) => {
    return /^\d{6}$/.test(code);
  },

  // 验证密码
  isPassword: (password) => {
    return password.length >= 6;
  },

  // 验证邮箱
  isEmail: (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  // 验证用户名
  isUsername: (username) => {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  },
};
