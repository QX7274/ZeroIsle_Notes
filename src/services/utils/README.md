# 工具服务

本目录包含零屿笔记应用的各种工具服务，提供通用功能和辅助功能。

## 文件结构

- **index.js**: 工具服务导出文件，集中导出所有工具服务
- **dateUtils.js**: 日期工具服务，提供日期处理功能
- **stringUtils.js**: 字符串工具服务，提供字符串处理功能
- **fileUtils.js**: 文件工具服务，提供文件处理功能
- **validationUtils.js**: 验证工具服务，提供数据验证功能
- **formatUtils.js**: 格式化工具服务，提供数据格式化功能
- **cryptoUtils.js**: 加密工具服务，提供数据加密和解密功能
- **logUtils.js**: 日志工具服务，提供日志记录功能
- **deviceUtils.js**: 设备工具服务，提供设备信息和功能

## 主要功能

### 日期工具服务 (dateUtils.js)

日期工具服务提供以下主要功能：

- **日期格式化**: 将日期格式化为各种格式
- **日期解析**: 解析各种格式的日期字符串
- **日期计算**: 计算日期差异、添加/减少时间等
- **日期比较**: 比较日期的先后顺序
- **日期验证**: 验证日期的有效性
- **时区处理**: 处理不同时区的日期转换

### 字符串工具服务 (stringUtils.js)

字符串工具服务提供以下主要功能：

- **字符串格式化**: 格式化字符串，替换占位符
- **字符串截断**: 截断过长的字符串，添加省略号
- **字符串转换**: 转换字符串大小写、驼峰命名等
- **字符串验证**: 验证字符串格式，如邮箱、URL等
- **字符串编码**: 编码和解码字符串，如Base64、URL编码等
- **字符串比较**: 比较字符串相似度

### 文件工具服务 (fileUtils.js)

文件工具服务提供以下主要功能：

- **文件类型检测**: 检测文件类型和MIME类型
- **文件大小格式化**: 格式化文件大小显示
- **文件名处理**: 获取文件名、扩展名等
- **文件路径处理**: 处理文件路径，如合并路径、获取相对路径等
- **文件URL处理**: 处理文件URL，如获取文件名、参数等

### 验证工具服务 (validationUtils.js)

验证工具服务提供以下主要功能：

- **数据验证**: 验证各种数据格式，如邮箱、手机号、URL等
- **表单验证**: 验证表单数据的有效性
- **参数验证**: 验证函数参数的有效性
- **类型检查**: 检查数据类型
- **自定义验证**: 支持自定义验证规则

### 格式化工具服务 (formatUtils.js)

格式化工具服务提供以下主要功能：

- **数字格式化**: 格式化数字，如添加千位分隔符、保留小数位等
- **日期格式化**: 格式化日期显示
- **文本格式化**: 格式化文本显示，如首字母大写、驼峰命名等
- **货币格式化**: 格式化货币显示
- **文件大小格式化**: 格式化文件大小显示

### 加密工具服务 (cryptoUtils.js)

加密工具服务提供以下主要功能：

- **数据加密**: 加密敏感数据
- **数据解密**: 解密加密数据
- **哈希计算**: 计算数据的哈希值
- **签名生成**: 生成数据签名
- **签名验证**: 验证数据签名

### 日志工具服务 (logUtils.js)

日志工具服务提供以下主要功能：

- **日志记录**: 记录应用日志
- **日志级别**: 支持不同级别的日志（调试、信息、警告、错误等）
- **日志格式化**: 格式化日志输出
- **日志存储**: 存储日志到文件或远程服务
- **日志过滤**: 根据级别或标签过滤日志

### 设备工具服务 (deviceUtils.js)

设备工具服务提供以下主要功能：

- **设备信息获取**: 获取设备型号、操作系统等信息
- **屏幕信息获取**: 获取屏幕尺寸、分辨率等信息
- **网络信息获取**: 获取网络类型、连接状态等信息
- **电池信息获取**: 获取电池电量、充电状态等信息
- **设备功能检测**: 检测设备是否支持某些功能

## 使用方法

```javascript
import { 
  dateUtils, 
  stringUtils, 
  fileUtils, 
  validationUtils, 
  formatUtils, 
  cryptoUtils, 
  logUtils, 
  deviceUtils 
} from '../../services/utils';

// 使用日期工具
const formattedDate = dateUtils.format(new Date(), 'YYYY-MM-DD');
console.log('格式化日期:', formattedDate);

const dateFromString = dateUtils.parse('2023-06-15', 'YYYY-MM-DD');
console.log('解析日期:', dateFromString);

const nextWeek = dateUtils.addDays(new Date(), 7);
console.log('一周后:', nextWeek);

// 使用字符串工具
const truncated = stringUtils.truncate('这是一段很长的文本，需要被截断', 10);
console.log('截断文本:', truncated);

const formatted = stringUtils.format('Hello, {name}!', { name: 'World' });
console.log('格式化文本:', formatted);

const camelCase = stringUtils.toCamelCase('hello-world');
console.log('驼峰命名:', camelCase);

// 使用文件工具
const mimeType = fileUtils.getMimeType('document.pdf');
console.log('MIME类型:', mimeType);

const formattedSize = fileUtils.formatSize(1024 * 1024);
console.log('格式化大小:', formattedSize);

const fileName = fileUtils.getFileName('/path/to/document.pdf');
console.log('文件名:', fileName);

// 使用验证工具
const isValidEmail = validationUtils.isEmail('user@example.com');
console.log('是否有效邮箱:', isValidEmail);

const isValidPhone = validationUtils.isPhone('13800138000');
console.log('是否有效手机号:', isValidPhone);

const isValidUrl = validationUtils.isUrl('https://example.com');
console.log('是否有效URL:', isValidUrl);

// 使用格式化工具
const formattedNumber = formatUtils.formatNumber(1234567.89);
console.log('格式化数字:', formattedNumber);

const formattedCurrency = formatUtils.formatCurrency(1234.56, 'CNY');
console.log('格式化货币:', formattedCurrency);

// 使用加密工具
const encrypted = cryptoUtils.encrypt('sensitive data', 'secret key');
console.log('加密数据:', encrypted);

const decrypted = cryptoUtils.decrypt(encrypted, 'secret key');
console.log('解密数据:', decrypted);

const hash = cryptoUtils.hash('data to hash');
console.log('哈希值:', hash);

// 使用日志工具
logUtils.debug('这是一条调试日志');
logUtils.info('这是一条信息日志');
logUtils.warn('这是一条警告日志');
logUtils.error('这是一条错误日志');

// 使用设备工具
const deviceInfo = deviceUtils.getDeviceInfo();
console.log('设备信息:', deviceInfo);

const screenInfo = deviceUtils.getScreenInfo();
console.log('屏幕信息:', screenInfo);

const networkInfo = deviceUtils.getNetworkInfo();
console.log('网络信息:', networkInfo);
```

## 注意事项

- 工具服务应该是纯函数，避免副作用
- 工具函数应该处理各种边界情况和错误
- 考虑性能优化，特别是对于频繁调用的工具函数
- 提供详细的文档和示例，方便其他开发者使用
- 保持工具函数的单一职责，避免过于复杂的功能
- 考虑跨平台兼容性，确保在不同环境下正常工作
