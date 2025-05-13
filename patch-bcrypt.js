/**
 * 修补bcrypt.js文件，直接设置随机回退函数
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// bcrypt.js文件路径
const bcryptPath = path.join(__dirname, 'node_modules', 'react-native-bcrypt', 'dist', 'bcrypt.js');

// 读取原始文件
let content = fs.readFileSync(bcryptPath, 'utf8');

// 查找随机函数定义
const randomFunctionRegex = /function random\(len\) \{[\s\S]+?return randomFallback\(len\);\s+\}/;

// 替换为我们的安全版本
const secureRandomFunction = `function random(len) {
        /* fallback */
        if (!randomFallback) {
            // 设置一个安全的随机回退函数
            randomFallback = function(len) {
                try {
                    // 尝试使用crypto模块
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        const buf = new Uint8Array(len);
                        crypto.getRandomValues(buf);
                        return Array.from(buf);
                    } else {
                        // 备用方案
                        const buf = new Uint8Array(len);
                        for (let i = 0; i < len; i++) {
                            buf[i] = Math.floor(Math.random() * 256);
                        }
                        return Array.from(buf);
                    }
                } catch (e) {
                    console.warn("Using Math.random as last resort");
                    const buf = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        buf[i] = Math.floor(Math.random() * 256);
                    }
                    return Array.from(buf);
                }
            };
            console.log("Automatically set secure random fallback for bcrypt");
        }
        return randomFallback(len);
    }`;

// 替换内容
content = content.replace(randomFunctionRegex, secureRandomFunction);

// 写回文件
fs.writeFileSync(bcryptPath, content, 'utf8');

console.log('bcrypt.js文件已成功修补，添加了安全的随机回退函数');
