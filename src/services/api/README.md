# 零屿笔记 API 服务

本文档介绍了零屿笔记应用的 API 服务，包括各个模块的 API 调用方法和示例。

## 目录

- [认证 API](#认证-api)
- [笔记 API](#笔记-api)
- [知识图谱 API](#知识图谱-api)
- [AI 助手 API](#ai-助手-api)
- [提醒 API](#提醒-api)
- [语音 API](#语音-api)
- [搜索 API](#搜索-api)
- [社区 API](#社区-api)
- [画布 API](#画布-api)
- [代码 API](#代码-api)

## 使用方法

所有 API 服务都遵循统一的调用模式，返回格式如下：

```javascript
{
  success: true/false,  // 操作是否成功
  data: { ... },        // 成功时返回的数据
  message: '错误消息',   // 失败时返回的错误消息
  error: { ... }        // 失败时返回的错误对象
}
```

### 导入 API 服务

```javascript
// 导入单个 API 服务
import { authApi } from '../services/api';

// 或者导入所有 API 服务
import api from '../services/api';
```

## 认证 API

### 登录

```javascript
// 使用用户名和密码登录
const result = await authApi.login({
  username: 'user@example.com',
  password: 'password123'
});

if (result.success) {
  // 登录成功，获取用户信息和令牌
  const { user, access, refresh } = result.data;
  console.log('登录成功', user);
} else {
  // 登录失败，显示错误消息
  console.error('登录失败', result.message);
}
```

### 注册

```javascript
// 注册新用户
const result = await authApi.register({
  username: 'newuser',
  email: 'newuser@example.com',
  password: 'password123',
  confirm_password: 'password123'
});

if (result.success) {
  // 注册成功
  console.log('注册成功', result.data);
} else {
  // 注册失败
  console.error('注册失败', result.message);
}
```

### 获取用户资料

```javascript
const result = await authApi.getProfile();

if (result.success) {
  // 获取成功
  console.log('用户资料', result.data);
} else {
  // 获取失败
  console.error('获取用户资料失败', result.message);
}
```

### 更新用户资料

```javascript
const result = await authApi.updateProfile({
  nickname: '新昵称',
  avatar: '头像URL',
  bio: '个人简介'
});

if (result.success) {
  // 更新成功
  console.log('更新成功', result.data);
} else {
  // 更新失败
  console.error('更新失败', result.message);
}
```

### 登出

```javascript
const result = await authApi.logout();

if (result.success) {
  // 登出成功
  console.log('登出成功');
} else {
  // 登出失败
  console.error('登出失败', result.message);
}
```

## 笔记 API

### 获取所有笔记

```javascript
// 获取所有笔记
const result = await notesApi.getAllNotes();

// 带分页和筛选条件
const result = await notesApi.getAllNotes({
  page: 1,
  page_size: 10,
  category: 'work',
  tags: 'important,urgent',
  search: '关键词'
});

if (result.success) {
  // 获取成功
  const { results, count, next, previous } = result.data;
  console.log('笔记列表', results);
} else {
  // 获取失败
  console.error('获取笔记列表失败', result.message);
}
```

### 获取笔记详情

```javascript
const result = await notesApi.getNoteById('note-id');

if (result.success) {
  // 获取成功
  console.log('笔记详情', result.data);
} else {
  // 获取失败
  console.error('获取笔记详情失败', result.message);
}
```

### 创建笔记

```javascript
const result = await notesApi.createNote({
  title: '笔记标题',
  content: '笔记内容',
  category: '分类',
  tags: ['标签1', '标签2']
});

if (result.success) {
  // 创建成功
  console.log('创建成功', result.data);
} else {
  // 创建失败
  console.error('创建笔记失败', result.message);
}
```

### 更新笔记

```javascript
const result = await notesApi.updateNote('note-id', {
  title: '新标题',
  content: '新内容',
  category: '新分类',
  tags: ['新标签1', '新标签2']
});

if (result.success) {
  // 更新成功
  console.log('更新成功', result.data);
} else {
  // 更新失败
  console.error('更新笔记失败', result.message);
}
```

### 删除笔记

```javascript
const result = await notesApi.deleteNote('note-id');

if (result.success) {
  // 删除成功
  console.log('删除成功');
} else {
  // 删除失败
  console.error('删除笔记失败', result.message);
}
```

## 知识图谱 API

### 获取知识图谱

```javascript
const result = await knowledgeGraphApi.getKnowledgeGraph();

if (result.success) {
  // 获取成功
  const { nodes, edges } = result.data;
  console.log('节点', nodes);
  console.log('边', edges);
} else {
  // 获取失败
  console.error('获取知识图谱失败', result.message);
}
```

### 创建节点

```javascript
const result = await knowledgeGraphApi.createNode({
  name: '节点名称',
  type: 'concept',
  properties: {
    description: '节点描述',
    importance: 'high'
  }
});

if (result.success) {
  // 创建成功
  console.log('创建节点成功', result.data);
} else {
  // 创建失败
  console.error('创建节点失败', result.message);
}
```

### 创建边

```javascript
const result = await knowledgeGraphApi.createEdge({
  source_id: 'source-node-id',
  target_id: 'target-node-id',
  type: 'related',
  properties: {
    strength: 0.8,
    description: '关系描述'
  }
});

if (result.success) {
  // 创建成功
  console.log('创建边成功', result.data);
} else {
  // 创建失败
  console.error('创建边失败', result.message);
}
```

## AI 助手 API

### 发送聊天消息

```javascript
const result = await aiAssistantApi.sendChatMessage({
  message: '你好，请帮我总结这篇文章',
  context: '上下文信息',
  conversation_id: 'conversation-id'  // 可选，用于继续对话
});

if (result.success) {
  // 发送成功
  console.log('AI回复', result.data.response);
} else {
  // 发送失败
  console.error('发送消息失败', result.message);
}
```

### 总结文本

```javascript
const result = await aiAssistantApi.summarizeText({
  text: '需要总结的长文本',
  max_length: 200  // 可选，最大总结长度
});

if (result.success) {
  // 总结成功
  console.log('总结结果', result.data.summary);
} else {
  // 总结失败
  console.error('总结文本失败', result.message);
}
```

## 提醒 API

### 获取所有提醒

```javascript
const result = await reminderApi.getAllReminders();

if (result.success) {
  // 获取成功
  console.log('提醒列表', result.data);
} else {
  // 获取失败
  console.error('获取提醒列表失败', result.message);
}
```

### 创建提醒

```javascript
const result = await reminderApi.createReminder({
  title: '提醒标题',
  description: '提醒描述',
  due_date: '2023-12-31T12:00:00Z',
  priority: 'high',
  note_id: 'note-id'  // 可选，关联的笔记ID
});

if (result.success) {
  // 创建成功
  console.log('创建提醒成功', result.data);
} else {
  // 创建失败
  console.error('创建提醒失败', result.message);
}
```

## 语音 API

### 语音转文字

```javascript
// 使用音频文件
const audioFile = /* 音频文件对象 */;
const result = await voiceApi.transcribeAudio(audioFile);

// 使用 base64 编码的音频数据
const audioBase64 = /* base64 编码的音频数据 */;
const result = await voiceApi.transcribeAudio(audioBase64);

if (result.success) {
  // 转写成功
  console.log('转写结果', result.data.text);
} else {
  // 转写失败
  console.error('语音转文字失败', result.message);
}
```

### 生成会议纪要

```javascript
const result = await voiceApi.generateMeetingSummary('会议转写文本');

if (result.success) {
  // 生成成功
  console.log('会议纪要', result.data.summary);
} else {
  // 生成失败
  console.error('生成会议纪要失败', result.message);
}
```

## 搜索 API

### 基础搜索

```javascript
const result = await searchApi.search('搜索关键词');

if (result.success) {
  // 搜索成功
  console.log('搜索结果', result.data.results);
} else {
  // 搜索失败
  console.error('搜索失败', result.message);
}
```

### 高级搜索

```javascript
const result = await searchApi.advancedSearch({
  query: '搜索关键词',
  categories: ['工作', '学习'],
  tags: ['重要', '紧急'],
  date_from: '2023-01-01',
  date_to: '2023-12-31',
  sort_by: 'created_at',
  sort_order: 'desc'
});

if (result.success) {
  // 搜索成功
  console.log('搜索结果', result.data.results);
} else {
  // 搜索失败
  console.error('高级搜索失败', result.message);
}
```

## 社区 API

### 获取社区笔记

```javascript
const result = await communityApi.getCommunityNotes();

if (result.success) {
  // 获取成功
  console.log('社区笔记', result.data.results);
} else {
  // 获取失败
  console.error('获取社区笔记失败', result.message);
}
```

### 点赞笔记

```javascript
const result = await communityApi.toggleLike('note-id');

if (result.success) {
  // 操作成功
  console.log('点赞状态', result.data.liked);
  console.log('点赞数', result.data.likes_count);
} else {
  // 操作失败
  console.error('点赞操作失败', result.message);
}
```

## 画布 API

### 获取所有画布

```javascript
const result = await canvasApi.getAllCanvases();

if (result.success) {
  // 获取成功
  console.log('画布列表', result.data.results);
} else {
  // 获取失败
  console.error('获取画布列表失败', result.message);
}
```

### 创建画布

```javascript
const result = await canvasApi.createCanvas({
  title: '画布标题',
  description: '画布描述',
  width: 2000,
  height: 2000,
  background_color: '#ffffff'
});

if (result.success) {
  // 创建成功
  console.log('创建画布成功', result.data);
} else {
  // 创建失败
  console.error('创建画布失败', result.message);
}
```

## 代码 API

### 运行代码

```javascript
const result = await codeApi.runCode({
  code: 'console.log("Hello, World!");',
  language: 'javascript'
});

if (result.success) {
  // 运行成功
  console.log('运行结果', result.data.output);
  console.log('执行时间', result.data.execution_time);
} else {
  // 运行失败
  console.error('运行代码失败', result.message);
}
```

### 格式化代码

```javascript
const result = await codeApi.formatCode({
  code: 'function hello() { console.log("Hello"); }',
  language: 'javascript'
});

if (result.success) {
  // 格式化成功
  console.log('格式化结果', result.data.formatted_code);
} else {
  // 格式化失败
  console.error('格式化代码失败', result.message);
}
```

## 错误处理

所有 API 调用都会返回统一格式的结果对象，包含 `success` 字段表示操作是否成功。如果操作失败，可以通过 `message` 字段获取错误消息，通过 `error` 字段获取详细的错误信息。

```javascript
try {
  const result = await api.someMethod();
  
  if (result.success) {
    // 操作成功
    handleSuccess(result.data);
  } else {
    // 操作失败
    handleError(result.message);
  }
} catch (error) {
  // 网络错误或其他异常
  handleException(error);
}
```

## 注意事项

1. 所有 API 调用都需要在异步函数中使用 `await` 关键字，或者使用 `.then()` 和 `.catch()` 方法处理 Promise。
2. 认证相关的 API 调用会自动处理令牌的存储和使用，无需手动管理令牌。
3. 文件上传相关的 API 调用需要使用 FormData 对象，并设置正确的 Content-Type 头。
4. 分页数据会包含 `results`、`count`、`next` 和 `previous` 字段，可以使用这些字段实现分页功能。
