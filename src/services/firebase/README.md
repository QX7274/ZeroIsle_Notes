# Firebase服务

本目录包含零屿笔记应用的Firebase相关服务，用于集成Firebase提供的云服务，如认证、数据库、存储、消息推送等。

## 文件结构

- **firebaseService.js**: Firebase服务，提供Firebase功能的集成和管理
- **firebaseAuth.js**: Firebase认证服务，提供用户认证功能
- **firebaseDatabase.js**: Firebase数据库服务，提供实时数据库功能
- **firebaseStorage.js**: Firebase存储服务，提供云存储功能
- **firebaseMessaging.js**: Firebase消息服务，提供推送通知功能
- **firebaseAnalytics.js**: Firebase分析服务，提供用户行为分析功能

## 主要功能

### Firebase服务 (firebaseService.js)

Firebase服务提供以下主要功能：

- **Firebase初始化**: 初始化Firebase SDK和配置
- **服务管理**: 管理和协调各个Firebase服务
- **错误处理**: 处理Firebase操作中的错误和异常

### Firebase认证服务 (firebaseAuth.js)

Firebase认证服务提供以下主要功能：

- **用户注册**: 创建新用户账号
- **用户登录**: 使用邮箱/密码、手机号或第三方账号登录
- **用户登出**: 退出当前用户账号
- **密码重置**: 发送密码重置邮件
- **用户信息**: 获取和更新用户信息
- **认证状态**: 监听用户认证状态变化

### Firebase数据库服务 (firebaseDatabase.js)

Firebase数据库服务提供以下主要功能：

- **数据读写**: 读取和写入数据库数据
- **数据监听**: 监听数据变化并实时更新
- **数据查询**: 按条件查询数据
- **数据索引**: 管理数据索引，提高查询效率
- **离线支持**: 在离线状态下继续工作，网络恢复后自动同步

### Firebase存储服务 (firebaseStorage.js)

Firebase存储服务提供以下主要功能：

- **文件上传**: 上传文件到云存储
- **文件下载**: 从云存储下载文件
- **文件删除**: 删除云存储中的文件
- **文件元数据**: 管理文件元数据
- **上传进度**: 监控文件上传进度
- **下载URL**: 获取文件的下载URL

### Firebase消息服务 (firebaseMessaging.js)

Firebase消息服务提供以下主要功能：

- **推送通知**: 发送和接收推送通知
- **主题订阅**: 订阅和取消订阅消息主题
- **消息处理**: 处理前台和后台消息
- **通知权限**: 请求和检查通知权限
- **设备令牌**: 管理设备令牌

### Firebase分析服务 (firebaseAnalytics.js)

Firebase分析服务提供以下主要功能：

- **事件跟踪**: 跟踪用户事件和行为
- **用户属性**: 设置和获取用户属性
- **转化跟踪**: 跟踪用户转化和目标完成
- **会话管理**: 管理用户会话
- **自定义指标**: 创建和跟踪自定义指标

## 与其他服务的交互

Firebase服务与以下服务有交互：

- **认证服务**: 集成Firebase认证与应用认证系统
- **存储服务**: 集成Firebase存储与应用存储系统
- **通知服务**: 集成Firebase消息与应用通知系统
- **分析服务**: 集成Firebase分析与应用分析系统

## 使用方法

```javascript
import { 
  firebaseAuth, 
  firebaseDatabase, 
  firebaseStorage, 
  firebaseMessaging, 
  firebaseAnalytics 
} from '../../services/firebase';

// 用户注册
async function registerUser(email, password) {
  try {
    const user = await firebaseAuth.createUser(email, password);
    console.log('用户注册成功:', user);
    return user;
  } catch (error) {
    console.error('用户注册失败:', error);
    return null;
  }
}

// 用户登录
async function loginUser(email, password) {
  try {
    const user = await firebaseAuth.signIn(email, password);
    console.log('用户登录成功:', user);
    return user;
  } catch (error) {
    console.error('用户登录失败:', error);
    return null;
  }
}

// 读取数据
async function readData(path) {
  try {
    const data = await firebaseDatabase.get(path);
    console.log('数据读取成功:', data);
    return data;
  } catch (error) {
    console.error('数据读取失败:', error);
    return null;
  }
}

// 写入数据
async function writeData(path, data) {
  try {
    await firebaseDatabase.set(path, data);
    console.log('数据写入成功');
    return true;
  } catch (error) {
    console.error('数据写入失败:', error);
    return false;
  }
}

// 上传文件
async function uploadFile(localPath, remotePath) {
  try {
    const downloadUrl = await firebaseStorage.uploadFile(localPath, remotePath, {
      onProgress: (progress) => {
        console.log('上传进度:', progress);
      }
    });
    console.log('文件上传成功:', downloadUrl);
    return downloadUrl;
  } catch (error) {
    console.error('文件上传失败:', error);
    return null;
  }
}

// 下载文件
async function downloadFile(remotePath, localPath) {
  try {
    await firebaseStorage.downloadFile(remotePath, localPath, {
      onProgress: (progress) => {
        console.log('下载进度:', progress);
      }
    });
    console.log('文件下载成功');
    return true;
  } catch (error) {
    console.error('文件下载失败:', error);
    return false;
  }
}

// 发送推送通知
async function sendNotification(userId, title, body, data = {}) {
  try {
    await firebaseMessaging.sendToUser(userId, {
      notification: { title, body },
      data
    });
    console.log('通知发送成功');
    return true;
  } catch (error) {
    console.error('通知发送失败:', error);
    return false;
  }
}

// 跟踪事件
function trackEvent(eventName, params = {}) {
  try {
    firebaseAnalytics.logEvent(eventName, params);
    console.log('事件跟踪成功:', eventName);
    return true;
  } catch (error) {
    console.error('事件跟踪失败:', error);
    return false;
  }
}
```

## 注意事项

- Firebase服务需要适当的配置和初始化，包括添加配置文件和安装必要的依赖
- 应注意Firebase服务的使用限制和计费情况，避免超出免费额度
- 处理用户认证状态变化，确保在用户登录状态改变时更新UI和应用状态
- 实现适当的错误处理和重试机制，提高应用的稳定性
- 考虑离线支持和数据同步策略，提供良好的离线体验
- 遵循Firebase的安全最佳实践，包括设置适当的安全规则和权限
