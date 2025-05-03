# 零屿笔记配置目录

本目录包含零屿笔记应用的配置文件，包括API配置、主题配置、语言配置等。

## 文件说明

### index.js

主配置文件，包含API地址、主题、语言等常量。

```javascript
// API配置
export const API_URL = __DEV__ 
  ? 'http://10.0.2.2:8000/api'  // Android模拟器访问本机地址
  : 'https://api.zeroislenotes.com/api'; // 生产环境地址

export const API_VERSION = 'v1';
export const API_TIMEOUT = 15000;

// 主题配置
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};
```

### api.js

API端点配置文件，定义API基础URL和各个模块的端点。

```javascript
// 从主配置文件导入API配置
import { API_URL, API_VERSION, API_TIMEOUT } from './index';

// 根据环境选择API基础URL
export const API_BASE_URL = API_URL + '/' + API_VERSION;

// API端点
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/auth/login/',
    REGISTER: '/auth/register/',
    // ...
  },
  // 笔记相关
  NOTES: {
    BASE: '/notes/',
    DETAIL: (id) => `/notes/${id}/`,
    // ...
  },
  // ...
};
```

## 使用方法

### 导入配置

```javascript
// 导入主配置
import { API_URL, THEME, LANGUAGES } from '../config';

// 导入API端点
import { API_ENDPOINTS } from '../config/api';

// 使用配置
console.log(API_URL);
console.log(THEME.LIGHT);
console.log(API_ENDPOINTS.AUTH.LOGIN);
```

## 注意事项

1. 不要在配置文件中包含敏感信息，如API密钥、密码等
2. 不要在配置文件中包含业务逻辑
3. 不要在配置文件中包含UI组件
4. 不要在配置文件中包含状态管理
5. 不要在配置文件中包含副作用
6. 不要在配置文件中包含异步操作
7. 不要在配置文件中包含DOM操作
8. 不要在配置文件中包含网络请求
9. 不要在配置文件中包含文件操作
10. 不要在配置文件中包含数据库操作
