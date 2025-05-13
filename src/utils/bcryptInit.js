/**
 * bcrypt初始化文件
 * 设置bcrypt的随机回退函数，解决"Math.random is not cryptographically secure"警告
 */

import bcrypt from 'react-native-bcrypt';
import CryptoJS from 'crypto-js';

// 使用CryptoJS生成加密安全的随机数
const secureRandom = (len) => {
  try {
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

// 备用随机数生成方法
const fallbackRandom = (len) => {
  const buf = new Uint8Array(len);
  
  // 尝试使用crypto API（如果可用）
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
      return crypto.getRandomValues(buf);
    } catch (e) {
      console.warn('crypto.getRandomValues失败，使用Math.random:', e);
    }
  }
  
  // 最后的备用方案：使用Math.random
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  
  return buf;
};

// 设置bcrypt的随机回退函数
try {
  bcrypt.setRandomFallback(secureRandom);
  console.log('成功设置bcrypt的安全随机回退函数');
} catch (error) {
  console.error('设置bcrypt随机回退函数失败:', error);
}

export default bcrypt;
