# 常量定义

本目录包含零屿笔记应用的全局常量定义，用于统一管理应用中使用的各种常量值，确保代码的一致性和可维护性。

## 文件结构

- **actionTypes.js**: Redux action类型常量，定义所有Redux action的类型
- **apiEndpoints.js**: API端点常量，定义所有API请求的URL
- **colors.js**: 颜色常量，定义应用中使用的所有颜色
- **config.js**: 配置常量，定义应用的全局配置
- **errorCodes.js**: 错误代码常量，定义应用中使用的错误代码
- **fileTypes.js**: 文件类型常量，定义应用支持的文件类型
- **navigationRoutes.js**: 导航路由常量，定义应用的导航路由
- **permissions.js**: 权限常量，定义应用中的权限类型
- **statusCodes.js**: 状态码常量，定义API响应的状态码
- **storageKeys.js**: 存储键常量，定义本地存储使用的键名
- **timeouts.js**: 超时常量，定义各种操作的超时时间
- **urls.js**: URL常量，定义应用中使用的外部URL

## 主要功能

### Redux Action类型常量 (actionTypes.js)

Redux action类型常量定义了所有Redux action的类型，包括：

- **认证相关**: 登录、注册、登出等
- **笔记相关**: 创建、更新、删除笔记等
- **UI相关**: 主题切换、字体大小调整等
- **知识图谱相关**: 创建、更新、删除节点和关系等
- **思维导图相关**: 创建、更新、删除导图等
- **社区相关**: 发帖、评论、点赞等
- **搜索相关**: 搜索、过滤、排序等
- **标签相关**: 创建、更新、删除标签等
- **群组相关**: 创建、更新、删除群组等
- **AI助手相关**: 发送消息、接收回复等
- **提醒相关**: 创建、更新、删除提醒等
- **设置相关**: 更新设置、重置设置等

### API端点常量 (apiEndpoints.js)

API端点常量定义了所有API请求的URL，包括：

- **认证API**: 登录、注册、刷新令牌等
- **用户API**: 获取、更新用户信息等
- **笔记API**: 创建、获取、更新、删除笔记等
- **知识图谱API**: 操作知识图谱节点和关系等
- **思维导图API**: 操作思维导图等
- **社区API**: 发帖、评论、点赞等
- **搜索API**: 搜索内容等
- **标签API**: 操作标签等
- **群组API**: 操作群组和成员等
- **AI助手API**: 与AI助手交互等
- **提醒API**: 操作提醒等
- **设置API**: 操作用户设置等

### 颜色常量 (colors.js)

颜色常量定义了应用中使用的所有颜色，包括：

- **主题颜色**: 主色调、辅助色等
- **功能颜色**: 成功、警告、错误等
- **中性颜色**: 背景、文本、边框等
- **语义颜色**: 具有特定含义的颜色
- **渐变颜色**: 渐变色定义

### 配置常量 (config.js)

配置常量定义了应用的全局配置，包括：

- **API配置**: API基础URL、超时设置等
- **应用配置**: 版本号、构建信息等
- **功能开关**: 功能的启用/禁用状态
- **默认设置**: 应用的默认设置
- **限制设置**: 各种操作的限制（如文件大小限制）

### 错误代码常量 (errorCodes.js)

错误代码常量定义了应用中使用的错误代码，包括：

- **网络错误**: 网络连接、超时等错误
- **认证错误**: 登录失败、令牌过期等错误
- **权限错误**: 权限不足等错误
- **数据错误**: 数据格式、验证等错误
- **业务错误**: 特定业务逻辑错误

### 文件类型常量 (fileTypes.js)

文件类型常量定义了应用支持的文件类型，包括：

- **文档类型**: PDF、Word、Excel等
- **图片类型**: JPEG、PNG、GIF等
- **音频类型**: MP3、WAV、AAC等
- **视频类型**: MP4、AVI、MOV等
- **其他类型**: ZIP、TXT等

### 导航路由常量 (navigationRoutes.js)

导航路由常量定义了应用的导航路由，包括：

- **认证路由**: 登录、注册、忘记密码等
- **主要路由**: 首页、笔记、知识图谱等
- **设置路由**: 个人设置、应用设置等
- **社区路由**: 社区首页、帖子详情等
- **嵌套路由**: 各种嵌套路由定义

### 权限常量 (permissions.js)

权限常量定义了应用中的权限类型，包括：

- **用户权限**: 普通用户、高级用户等
- **内容权限**: 查看、编辑、删除等
- **功能权限**: 特定功能的使用权限
- **管理权限**: 管理员权限等

### 状态码常量 (statusCodes.js)

状态码常量定义了API响应的状态码，包括：

- **成功状态码**: 200、201等
- **重定向状态码**: 301、302等
- **客户端错误状态码**: 400、401、403、404等
- **服务器错误状态码**: 500、502、503等
- **自定义状态码**: 应用特定的状态码

### 存储键常量 (storageKeys.js)

存储键常量定义了本地存储使用的键名，包括：

- **认证相关**: 令牌、用户信息等
- **设置相关**: 主题、字体大小等
- **缓存相关**: 缓存数据的键名
- **状态相关**: 应用状态的键名
- **历史相关**: 搜索历史、浏览历史等

### 超时常量 (timeouts.js)

超时常量定义了各种操作的超时时间，包括：

- **API超时**: API请求的超时时间
- **动画超时**: 动画效果的持续时间
- **自动保存超时**: 自动保存的间隔时间
- **会话超时**: 用户会话的超时时间
- **重试超时**: 操作失败后的重试间隔

### URL常量 (urls.js)

URL常量定义了应用中使用的外部URL，包括：

- **帮助文档**: 帮助文档的URL
- **隐私政策**: 隐私政策的URL
- **用户协议**: 用户协议的URL
- **反馈页面**: 用户反馈的URL
- **社交媒体**: 社交媒体链接

## 使用方法

```javascript
import { COLORS } from '../constants/colors';
import { API_ENDPOINTS } from '../constants/apiEndpoints';
import { ACTION_TYPES } from '../constants/actionTypes';
import { ROUTES } from '../constants/navigationRoutes';
import { STORAGE_KEYS } from '../constants/storageKeys';

// 使用颜色常量
const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.BACKGROUND,
    borderColor: COLORS.BORDER
  },
  text: {
    color: COLORS.TEXT.PRIMARY
  },
  button: {
    backgroundColor: COLORS.PRIMARY
  },
  errorText: {
    color: COLORS.ERROR
  }
});

// 使用API端点常量
async function fetchNotes() {
  try {
    const response = await axios.get(API_ENDPOINTS.NOTES.GET_ALL);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return [];
  }
}

// 使用Action类型常量
function notesReducer(state = initialState, action) {
  switch (action.type) {
    case ACTION_TYPES.NOTES.FETCH_SUCCESS:
      return {
        ...state,
        notes: action.payload,
        isLoading: false
      };
    case ACTION_TYPES.NOTES.FETCH_FAILURE:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    default:
      return state;
  }
}

// 使用导航路由常量
function navigateToNoteDetail(navigation, noteId) {
  navigation.navigate(ROUTES.NOTES.DETAIL, { noteId });
}

// 使用存储键常量
function saveUserToken(token) {
  AsyncStorage.setItem(STORAGE_KEYS.AUTH.TOKEN, token);
}
```

## 注意事项

- 常量名应使用全大写，单词间用下划线分隔
- 相关常量应分组管理，提高可读性
- 避免硬编码值，尽量使用常量
- 常量文件应该只包含常量定义，不应包含逻辑
- 更新常量时应考虑向后兼容性
