# 自定义钩子

本目录包含应用中使用的自定义React钩子（Custom Hooks）。

## 钩子列表

### useDebounce

防抖钩子，用于延迟执行函数，避免频繁触发。

```javascript
import { useDebounce } from '../hooks';

// 使用示例
const debouncedSearchTerm = useDebounce(searchTerm, 500);
```

### useThrottle

节流钩子，用于限制函数执行频率。

```javascript
import { useThrottle } from '../hooks';

// 使用示例
const throttledScrollPosition = useThrottle(scrollPosition, 200);
```

### useLocalStorage

本地存储钩子，用于在React组件中使用本地存储。

```javascript
import { useLocalStorage } from '../hooks';

// 使用示例
const [settings, setSettings, isLoading] = useLocalStorage('app_settings', defaultSettings);
```

### useNetworkStatus

网络状态钩子，用于监控网络连接状态。

```javascript
import { useNetworkStatus } from '../hooks';

// 使用示例
const { isConnected, connectionType, isInternetReachable } = useNetworkStatus();
```

### usePermissions

权限钩子，用于请求和检查应用权限。

```javascript
import { usePermissions } from '../hooks';

// 使用示例
const { status, requestPermission } = usePermissions('camera');
```

## 使用方法

可以通过以下方式导入钩子：

```javascript
// 导入单个钩子
import { useDebounce } from '../hooks';

// 或者导入多个钩子
import { useDebounce, useThrottle, useLocalStorage } from '../hooks';
```
