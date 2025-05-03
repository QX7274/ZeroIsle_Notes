# 零屿笔记工具目录

本目录包含零屿笔记应用中使用的各种工具函数、常量和辅助类。

## 目录结构

### 工具函数

- **index.js**: 工具函数导出文件，集中导出所有工具函数
- **dateUtils.js**: 日期工具函数，提供日期格式化、相对时间等功能
- **validationUtils.js**: 验证工具函数，提供表单验证功能
- **expoCompatibility.js**: Expo兼容性工具，提供Expo组件的替代实现
- **mindMapLayoutUtils.js**: 思维导图布局工具，提供思维导图布局算法

### 常量 (`constants/`)

- **colors.js**: 颜色常量，定义应用中使用的颜色
- **dimensions.js**: 尺寸常量，定义应用中使用的尺寸
- **apiEndpoints.js**: API端点常量，定义API端点（已废弃，请使用 `src/config/api.js`）

## 使用方法

### 导入工具函数

```javascript
// 导入所有工具函数
import { storage, dateUtils, permissionUtils, validationUtils } from '../utils';

// 使用工具函数
const formattedDate = dateUtils.formatDate(new Date(), 'YYYY-MM-DD');
const isValidEmail = validationUtils.isEmail('example@example.com');

// 存储数据
await storage.set('key', { value: 'data' });
const data = await storage.get('key');
```

### 导入特定工具函数

```javascript
// 导入特定工具函数
import { formatDate, formatRelativeTime } from '../utils/dateUtils';

// 使用工具函数
const formattedDate = formatDate(new Date(), 'YYYY-MM-DD');
const relativeTime = formatRelativeTime(new Date(Date.now() - 3600000)); // "1小时前"
```

### 导入常量

```javascript
// 导入常量
import { COLORS } from '../utils/constants/colors';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../utils/constants/dimensions';

// 使用常量
const backgroundColor = COLORS.PRIMARY;
const halfScreenWidth = SCREEN_WIDTH / 2;
```

## 工具开发规范

1. 工具函数应该是纯函数，不依赖外部状态
2. 工具函数应该有清晰的命名和注释
3. 复杂工具函数应该有单元测试
4. 常量应该使用大写字母和下划线命名
5. 自定义Hook应该以use开头
6. 工具函数应该有明确的参数和返回值类型
7. 工具函数应该处理异常情况
8. 工具函数应该有合理的默认值
9. 工具函数应该有良好的性能
10. 工具函数应该有良好的可读性