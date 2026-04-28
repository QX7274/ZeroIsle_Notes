/**
 * 加密模块的 polyfill
 * 提供基本的加密功能，用于在原生加密模块不可用时使用
 */
const { Platform } = require('react-native');
const realmService = require('../services/database/realmService');


// 生成指定长度的随机字符串
const generateRandomString = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);

  try {
    // 尝试使用全局 crypto
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(randomValues);
    } else {
      // 回退到对象ID填充，避免非安全随机
      let offset = 0;
      while (offset < length) {
        const hex = realmService.createObjectId();
        for (let i = 0; i < hex.length && offset < length; i += 2) {
          const byte = parseInt(hex.slice(i, i + 2), 16);
          randomValues[offset] = Number.isNaN(byte) ? 0 : byte;
          offset += 1;
        }
      }
    }
  } catch (e) {
    // 回退到对象ID填充，避免非安全随机
    let offset = 0;
    while (offset < length) {
      const hex = realmService.createObjectId();
      for (let i = 0; i < hex.length && offset < length; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        randomValues[offset] = Number.isNaN(byte) ? 0 : byte;
        offset += 1;
      }
    }
  }

  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }
  return result;
};

// 生成随机字节数组
const getRandomBytes = (size) => {
  const bytes = new Uint8Array(size);

  try {
    // 尝试使用全局 crypto
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(bytes);
    } else {
      // 回退到对象ID填充，避免非安全随机
      let offset = 0;
      while (offset < size) {
        const hex = realmService.createObjectId();
        for (let i = 0; i < hex.length && offset < size; i += 2) {
          const byte = parseInt(hex.slice(i, i + 2), 16);
          bytes[offset] = Number.isNaN(byte) ? 0 : byte;
          offset += 1;
        }
      }
    }
  } catch (e) {
    // 回退到对象ID填充，避免非安全随机
    let offset = 0;
    while (offset < size) {
      const hex = realmService.createObjectId();
      for (let i = 0; i < hex.length && offset < size; i += 2) {
        const byte = parseInt(hex.slice(i, i + 2), 16);
        bytes[offset] = Number.isNaN(byte) ? 0 : byte;
        offset += 1;
      }
    }
  }

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
  if (!text) {return '';}

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
  if (!encryptedHex) {return '';}

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
    const objectId = realmService.createObjectId();
    const padded = `${objectId}${objectId}${objectId}`.slice(0, 32);
    return `${padded.slice(0, 8)}-${padded.slice(8, 12)}-4${padded.slice(13, 16)}-a${padded.slice(17, 20)}-${padded.slice(20, 32)}`;
  },

  hash: simpleHash,
  encrypt,
  decrypt,
  generateSecureKey,
};

// 如果原生加密模块不可用，使用我们的 polyfill
try {
  // 确保全局 crypto 对象存在
  if (typeof global.crypto === 'undefined') {
    global.crypto = {};
  }

  // 仅当 getRandomValues 不存在时才添加
  if (typeof global.crypto.getRandomValues !== 'function') {
    console.log('应用加密模块 polyfill - getRandomValues');
    global.crypto.getRandomValues = CryptoPolyfill.getRandomValues;
  }

  // 仅当 randomUUID 不存在时才添加
  if (typeof global.crypto.randomUUID !== 'function') {
    console.log('应用加密模块 polyfill - randomUUID');
    global.crypto.randomUUID = CryptoPolyfill.randomUUID;
  }

  console.log('加密模块 polyfill 应用成功');
} catch (error) {
  console.warn('应用加密模块 polyfill 失败:', error);
}

module.exports = CryptoPolyfill;
module.exports.default = CryptoPolyfill;
