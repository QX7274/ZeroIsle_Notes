/**
 * bcrypt初始化文件
 * 设置bcrypt的随机回退函数，解决随机源不安全警告
 */
import realmService from '../services/database/realmService';



// 备用随机数生成方法
const fallbackRandom = (len) => {
  const buf = new Uint8Array(len);

  // 尝试使用crypto API（如果可用）
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
      return crypto.getRandomValues(buf);
    } catch (e) {
      console.warn('crypto.getRandomValues失败，使用对象ID回退:', e);
    }
  }

  // 最后的备用方案：使用对象ID填充（避免非安全随机）
  let offset = 0;
  while (offset < buf.length) {
    const hex = realmService.createObjectId();
    for (let i = 0; i < hex.length && offset < buf.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      buf[offset] = Number.isNaN(byte) ? 0 : byte;
      offset += 1;
    }
  }

  return buf;
};

// 使用CryptoJS生成加密安全的随机数
const secureRandom = (len) => {
  try {
    // 延迟导入CryptoJS，避免初始化时出错
    const CryptoJS = require('crypto-js');

    // 使用CryptoJS的随机数生成器
    const randomWords = CryptoJS.lib.WordArray.random(len);
    const bytes = new Uint8Array(len);

    // 将WordArray转换为Uint8Array
    const words = randomWords.words;
    const sigBytes = randomWords.sigBytes;

    for (let i = 0; i < len; i++) {
      if (i < sigBytes) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        bytes[i] = byte;
      } else {
        bytes[i] = 0;
      }
    }

    return bytes;
  } catch (error) {
    console.warn('使用CryptoJS生成随机数失败，回退到备用方法:', error);
    return fallbackRandom(len);
  }
};

// 设置bcrypt的随机回退函数
const initializeBcrypt = () => {
  try {
    // 延迟导入bcrypt，避免初始化时出错
    const bcrypt = require('react-native-bcrypt');

    // 检查bcrypt是否可用
    if (bcrypt && typeof bcrypt.setRandomFallback === 'function') {
      bcrypt.setRandomFallback(secureRandom);
      console.log('成功设置bcrypt的安全随机回退函数');
      return bcrypt;
    } else {
      console.warn('bcrypt.setRandomFallback方法不可用');
      return bcrypt;
    }
  } catch (error) {
    console.error('设置bcrypt随机回退函数失败:', error);
    // 返回null，让调用者处理
    return null;
  }
};

// 导出一个获取bcrypt的函数，而不是直接导出bcrypt
let bcryptInstance = null;

const getBcrypt = () => {
  if (!bcryptInstance) {
    bcryptInstance = initializeBcrypt();
  }
  return bcryptInstance;
};

// 默认导出
module.exports = {
  getBcrypt,
  initializeBcrypt,
  default: {
    getBcrypt,
    initializeBcrypt,
  },
};
