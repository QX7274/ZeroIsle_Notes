/**
 * 加密模块的 polyfill
 * 提供基本的加密功能，用于在原生加密模块不可用时使用
 */
import { Platform } from 'react-native';

// 生成指定长度的随机字符串
const generateRandomString = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }
  return result;
};

// 生成随机字节数组
const getRandomBytes = (size) => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
};

// 简单的哈希函数
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
};

// 简单的加密函数
const encrypt = (text, key) => {
  if (!text) return '';
  
  const textBytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  
  const encrypted = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return Array.from(encrypted)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

// 简单的解密函数
const decrypt = (encryptedHex, key) => {
  if (!encryptedHex) return '';
  
  const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const keyBytes = new TextEncoder().encode(key);
  
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
};

// 创建一个安全的随机密钥
const generateSecureKey = () => {
  return generateRandomString(32);
};

// 导出加密模块
const CryptoPolyfill = {
  getRandomValues: (array) => {
    if (!(array instanceof Uint8Array)) {
      throw new Error('getRandomValues requires a Uint8Array');
    }
    
    const randomBytes = getRandomBytes(array.length);
    array.set(randomBytes);
    return array;
  },
  
  randomBytes: (size) => {
    return getRandomBytes(size);
  },
  
  randomUUID: () => {
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return template.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  
  hash: simpleHash,
  encrypt,
  decrypt,
  generateSecureKey
};

// 如果原生加密模块不可用，使用我们的 polyfill
if (Platform.OS === 'android') {
  try {
    // 尝试修复全局 crypto 对象
    if (!global.crypto || !global.crypto.getRandomValues) {
      console.log('应用加密模块 polyfill');
      
      if (!global.crypto) {
        global.crypto = {};
      }
      
      global.crypto.getRandomValues = CryptoPolyfill.getRandomValues;
      global.crypto.randomUUID = CryptoPolyfill.randomUUID;
      
      console.log('加密模块 polyfill 应用成功');
    }
  } catch (error) {
    console.warn('应用加密模块 polyfill 失败:', error);
  }
}

export default CryptoPolyfill;
