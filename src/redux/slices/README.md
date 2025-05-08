# Redux Slices

本目录包含零屿笔记应用的Redux Toolkit切片文件，用于管理应用的各个功能模块的状态。

## 文件结构

- **authSlice.js**: 认证相关状态，管理用户登录、注册和认证信息
- **notesSlice.js**: 笔记相关状态，管理笔记的创建、编辑、删除和查询
- **uiSlice.js**: UI相关状态，管理主题、字体大小、抽屉状态等UI配置
- **knowledgeGraphSlice.js**: 知识图谱相关状态，管理知识节点和关系
- **mindMapSlice.js**: 思维导图相关状态，管理思维导图的节点和连接
- **communitySlice.js**: 社区相关状态，管理帖子、评论和互动
- **searchSlice.js**: 搜索相关状态，管理搜索结果和历史
- **tagsSlice.js**: 标签相关状态，管理标签的创建、编辑和删除
- **groupsSlice.js**: 群组相关状态，管理群组和成员
- **aiAssistantSlice.js**: AI助手相关状态，管理对话历史和设置
- **reminderSlice.js**: 提醒相关状态，管理提醒的创建、编辑和删除
- **settingsSlice.js**: 设置相关状态，管理应用设置和用户偏好

## 主要功能

### 认证切片 (authSlice.js)

认证切片管理用户认证相关的状态，包括：

- **用户登录**: 处理用户登录请求和响应
- **用户注册**: 处理用户注册请求和响应
- **令牌管理**: 存储和刷新认证令牌
- **用户信息**: 存储当前登录用户的信息
- **认证状态**: 跟踪用户的认证状态
- **错误处理**: 管理认证过程中的错误

### 笔记切片 (notesSlice.js)

笔记切片管理笔记相关的状态，包括：

- **笔记列表**: 存储用户的笔记列表
- **笔记操作**: 处理笔记的创建、编辑、删除
- **笔记分类**: 管理笔记的分类
- **笔记标签**: 管理笔记的标签
- **笔记同步**: 处理在线和离线笔记的同步
- **笔记导入导出**: 处理笔记的导入和导出

### UI切片 (uiSlice.js)

UI切片管理用户界面相关的状态，包括：

- **主题设置**: 管理应用的主题（亮色/暗色）
- **字体大小**: 管理应用的字体大小
- **抽屉状态**: 管理侧边抽屉的开关状态
- **加载状态**: 管理全局加载状态
- **提示消息**: 管理全局提示消息
- **模态框**: 管理全局模态框
- **网络状态**: 跟踪网络连接状态

### 知识图谱切片 (knowledgeGraphSlice.js)

知识图谱切片管理知识图谱相关的状态，包括：

- **节点管理**: 存储和管理知识节点
- **关系管理**: 存储和管理节点之间的关系
- **图谱操作**: 处理图谱的创建、编辑、删除
- **图谱布局**: 管理图谱的布局和显示
- **节点分析**: 处理节点的分析和推荐

### 思维导图切片 (mindMapSlice.js)

思维导图切片管理思维导图相关的状态，包括：

- **导图列表**: 存储用户的思维导图列表
- **导图操作**: 处理导图的创建、编辑、删除
- **节点管理**: 存储和管理导图节点
- **连接管理**: 存储和管理节点之间的连接
- **导图布局**: 管理导图的布局和显示

### 社区切片 (communitySlice.js)

社区切片管理社区相关的状态，包括：

- **帖子列表**: 存储社区帖子列表
- **帖子操作**: 处理帖子的创建、编辑、删除
- **评论管理**: 存储和管理帖子评论
- **互动功能**: 管理点赞、收藏等互动
- **用户关系**: 管理关注和粉丝关系

### 搜索切片 (searchSlice.js)

搜索切片管理搜索相关的状态，包括：

- **搜索结果**: 存储搜索结果
- **搜索历史**: 管理用户的搜索历史
- **搜索建议**: 提供搜索建议
- **搜索过滤**: 管理搜索过滤条件
- **搜索模式**: 管理不同的搜索模式（文本、语音、图像）

### 标签切片 (tagsSlice.js)

标签切片管理标签相关的状态，包括：

- **标签列表**: 存储用户的标签列表
- **标签操作**: 处理标签的创建、编辑、删除
- **标签关系**: 管理标签之间的关系
- **标签统计**: 统计标签的使用情况

### 群组切片 (groupsSlice.js)

群组切片管理群组相关的状态，包括：

- **群组列表**: 存储用户的群组列表
- **群组操作**: 处理群组的创建、编辑、删除
- **成员管理**: 管理群组成员
- **权限管理**: 管理群组权限
- **群组内容**: 管理群组共享的内容

### AI助手切片 (aiAssistantSlice.js)

AI助手切片管理AI助手相关的状态，包括：

- **对话历史**: 存储与AI助手的对话历史
- **AI设置**: 管理AI助手的设置
- **模型选择**: 管理使用的AI模型
- **语音设置**: 管理语音输入和输出设置
- **处理结果**: 存储AI处理的结果

### 提醒切片 (reminderSlice.js)

提醒切片管理提醒相关的状态，包括：

- **提醒列表**: 存储用户的提醒列表
- **提醒操作**: 处理提醒的创建、编辑、删除
- **提醒状态**: 管理提醒的完成状态
- **重复提醒**: 管理重复提醒的设置
- **提醒同步**: 处理在线和离线提醒的同步

### 设置切片 (settingsSlice.js)

设置切片管理应用设置和用户偏好，包括：

- **应用设置**: 管理应用的全局设置
- **用户偏好**: 管理用户的个人偏好
- **隐私设置**: 管理隐私相关设置
- **通知设置**: 管理通知相关设置
- **同步设置**: 管理数据同步设置

## 使用方法

```javascript
import { useSelector, useDispatch } from 'react-redux';
import { login, logout } from '../redux/slices/authSlice';
import { createNote, updateNote, deleteNote } from '../redux/slices/notesSlice';
import { setTheme, setFontSize } from '../redux/slices/uiSlice';

function MyComponent() {
  const dispatch = useDispatch();
  
  // 从状态中获取数据
  const { isAuthenticated, user } = useSelector(state => state.auth);
  const { notes, isLoading } = useSelector(state => state.notes);
  const { theme, fontSize } = useSelector(state => state.ui);
  
  // 触发登录操作
  const handleLogin = async (credentials) => {
    try {
      await dispatch(login(credentials)).unwrap();
      // 登录成功
    } catch (error) {
      // 处理错误
    }
  };
  
  // 创建笔记
  const handleCreateNote = async (noteData) => {
    try {
      const newNote = await dispatch(createNote(noteData)).unwrap();
      // 笔记创建成功
      return newNote;
    } catch (error) {
      // 处理错误
      return null;
    }
  };
  
  // 切换主题
  const handleThemeChange = (newTheme) => {
    dispatch(setTheme(newTheme));
  };
  
  return (
    // 组件JSX
  );
}
```

## 注意事项

- 使用Redux Toolkit的createAsyncThunk处理异步操作
- 使用unwrap()方法处理异步操作的结果和错误
- 避免在组件中直接修改状态，始终通过dispatch action
- 使用选择器（selectors）获取状态，提高性能和可维护性
- 保持状态的扁平化，避免深层嵌套
- 使用规范化数据结构存储实体数据
