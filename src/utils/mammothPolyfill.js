/**
 * mammoth库的React Native兼容性polyfill
 * 解决"Cannot read property 'prototype' of undefined"等错误
 */

// 确保process对象存在
if (typeof global.process === 'undefined') {
  global.process = {
    env: {},
    platform: 'react-native',
    version: '',
    versions: {},
    nextTick: (fn) => setTimeout(fn, 0)
  };
}

// 确保Buffer可用
if (typeof global.Buffer === 'undefined') {
  try {
    global.Buffer = require('buffer').Buffer;
  } catch (error) {
    console.warn('mammothPolyfill: Buffer polyfill不可用:', error);
  }
}

// 确保stream模块可用
if (typeof global.stream === 'undefined') {
  try {
    global.stream = require('stream-browserify');
  } catch (error) {
    console.warn('mammothPolyfill: stream polyfill不可用:', error);
  }
}

// 确保util模块可用
if (typeof global.util === 'undefined') {
  try {
    global.util = require('util');
  } catch (error) {
    console.warn('mammothPolyfill: util polyfill不可用:', error);
  }
}

// 确保events模块可用
if (typeof global.events === 'undefined') {
  try {
    global.events = require('events');
  } catch (error) {
    console.warn('mammothPolyfill: events polyfill不可用:', error);
  }
}

// 确保path模块可用
if (typeof global.path === 'undefined') {
  try {
    global.path = require('path-browserify');
  } catch (error) {
    console.warn('mammothPolyfill: path polyfill不可用:', error);
  }
}

// 确保fs模块可用（模拟）
if (typeof global.fs === 'undefined') {
  global.fs = {
    readFileSync: () => {
      throw new Error('fs.readFileSync not available in React Native');
    },
    existsSync: () => {
      throw new Error('fs.existsSync not available in React Native');
    }
  };
}

// 确保crypto模块可用（模拟）
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }
  };
}

// 确保TextDecoder和TextEncoder可用
if (typeof global.TextDecoder === 'undefined') {
  try {
    const textEncoding = require('text-encoding');
    global.TextDecoder = textEncoding.TextDecoder;
    global.TextEncoder = textEncoding.TextEncoder;
  } catch (error) {
    console.warn('mammothPolyfill: text-encoding polyfill不可用:', error);
    
    // 简单的TextDecoder实现
    global.TextDecoder = class TextDecoder {
      constructor(encoding = 'utf-8') {
        this.encoding = encoding;
      }
      
      decode(input) {
        if (input instanceof ArrayBuffer) {
          input = new Uint8Array(input);
        }
        
        if (input instanceof Uint8Array) {
          return String.fromCharCode.apply(null, input);
        }
        
        return String(input);
      }
    };
    
    // 简单的TextEncoder实现
    global.TextEncoder = class TextEncoder {
      constructor() {
        this.encoding = 'utf-8';
      }
      
      encode(input) {
        const string = String(input);
        const bytes = new Uint8Array(string.length);
        for (let i = 0; i < string.length; i++) {
          bytes[i] = string.charCodeAt(i);
        }
        return bytes;
      }
    };
  }
}

// 确保URL和URLSearchParams可用
if (typeof global.URL === 'undefined') {
  global.URL = require('url').URL;
}

if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = require('url').URLSearchParams;
}

console.log('mammothPolyfill: 所有必要的polyfill已加载');

export default {
  process: global.process,
  Buffer: global.Buffer,
  stream: global.stream,
  util: global.util,
  events: global.events,
  path: global.path,
  fs: global.fs,
  crypto: global.crypto,
  TextDecoder: global.TextDecoder,
  TextEncoder: global.TextEncoder,
  URL: global.URL,
  URLSearchParams: global.URLSearchParams
};
