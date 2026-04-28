/**
 * TextDecoder和TextEncoder的polyfill
 * 解决React Native环境中TextDecoder不存在的问题
 */

// 检查是否需要polyfill
if (typeof TextDecoder === 'undefined') {
  try {
    // 尝试使用text-encoding库
    const textEncoding = require('text-encoding');
    global.TextDecoder = textEncoding.TextDecoder;
    global.TextEncoder = textEncoding.TextEncoder;
    console.log('TextEncoding polyfill: 使用text-encoding库');
  } catch (error) {
    console.warn('TextEncoding polyfill: text-encoding库不可用，使用简单实现');

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

// 确保Buffer可用
if (typeof Buffer === 'undefined') {
  try {
    global.Buffer = require('buffer').Buffer;
    console.log('TextEncoding polyfill: Buffer polyfill已加载');
  } catch (error) {
    console.warn('TextEncoding polyfill: Buffer polyfill不可用:', error);
  }
}

export default {
  TextDecoder: global.TextDecoder,
  TextEncoder: global.TextEncoder,
  Buffer: global.Buffer,
};
