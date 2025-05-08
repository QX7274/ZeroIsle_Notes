# 测试模块

本目录包含零屿笔记应用的测试相关文件，用于测试应用的各个功能和API交互。

## 文件结构

- **index.js**: 测试模块导出文件，集中导出所有测试函数
- **test_api.js**: API测试文件，用于测试基础API功能
- **test_ai_assistant_api.js**: AI助手API测试文件，用于测试AI助手相关API
- **test_knowledge_graph_api.js**: 知识图谱API测试文件，用于测试知识图谱相关API
- **test_notes_api.js**: 笔记API测试文件，用于测试笔记相关API
- **test_reminder_api.js**: 提醒API测试文件，用于测试提醒相关API
- **test_search_api.js**: 搜索API测试文件，用于测试搜索相关API

## 主要功能

### 测试模块导出 (index.js)

测试模块导出文件提供以下主要功能：

- **导出测试函数**: 集中导出所有测试函数，方便引用
- **提供运行所有测试的函数**: 提供runAllTests函数，用于运行所有测试

### API测试 (test_api.js)

API测试文件用于测试基础API功能，包括：

- **测试API连接**: 测试与后端API的连接
- **测试认证流程**: 测试登录、注册、刷新令牌等认证流程
- **测试基础CRUD操作**: 测试创建、读取、更新、删除等基础操作

### AI助手API测试 (test_ai_assistant_api.js)

AI助手API测试文件用于测试AI助手相关API，包括：

- **测试聊天功能**: 测试发送聊天消息和接收回复
- **测试内容生成**: 测试生成文本内容
- **测试语音识别**: 测试语音转文字功能
- **测试图像分析**: 测试图像分析功能

### 知识图谱API测试 (test_knowledge_graph_api.js)

知识图谱API测试文件用于测试知识图谱相关API，包括：

- **测试节点操作**: 测试创建、读取、更新、删除知识节点
- **测试边操作**: 测试创建、读取、更新、删除知识边
- **测试图谱分析**: 测试知识图谱分析功能
- **测试路径查找**: 测试节点之间的路径查找功能

### 笔记API测试 (test_notes_api.js)

笔记API测试文件用于测试笔记相关API，包括：

- **测试笔记操作**: 测试创建、读取、更新、删除笔记
- **测试分类操作**: 测试创建、读取、更新、删除分类
- **测试标签操作**: 测试创建、读取、更新、删除标签
- **测试导入导出**: 测试笔记的导入和导出功能

### 提醒API测试 (test_reminder_api.js)

提醒API测试文件用于测试提醒相关API，包括：

- **测试提醒操作**: 测试创建、读取、更新、删除提醒
- **测试提醒触发**: 测试提醒的触发和通知
- **测试重复提醒**: 测试重复提醒的设置和触发

### 搜索API测试 (test_search_api.js)

搜索API测试文件用于测试搜索相关API，包括：

- **测试全文搜索**: 测试笔记内容的全文搜索
- **测试标签搜索**: 测试按标签搜索笔记
- **测试分类搜索**: 测试按分类搜索笔记
- **测试高级搜索**: 测试组合条件的高级搜索

## 测试方法

测试模块使用以下测试方法：

- **单元测试**: 测试单个函数和组件的功能
- **集成测试**: 测试多个组件和服务的交互
- **API测试**: 测试与后端API的交互
- **UI测试**: 测试用户界面和交互

## 与其他模块的交互

测试模块与以下模块有交互：

- **API服务**: 测试与后端API的交互
- **Redux状态**: 测试状态管理和更新
- **组件**: 测试组件的渲染和交互

## 使用方法

```javascript
import { runAllTests, testNotesApi, testSearchApi } from './tests';

// 运行所有测试
async function runTests() {
  console.log('开始运行所有测试...');
  await runAllTests();
  console.log('所有测试完成');
}

// 运行特定测试
async function runSpecificTest() {
  console.log('开始测试笔记API...');
  await testNotesApi();
  console.log('笔记API测试完成');
  
  console.log('开始测试搜索API...');
  await testSearchApi();
  console.log('搜索API测试完成');
}

// 在开发环境中运行测试
if (__DEV__) {
  // runTests();
  // 或者运行特定测试
  // runSpecificTest();
}
```

## 测试示例

以下是一个测试笔记API的示例：

```javascript
// test_notes_api.js
import notesApi from '../services/api/notesApi';

// 测试创建笔记
async function testCreateNote() {
  console.log('测试创建笔记...');
  const noteData = {
    title: '测试笔记',
    content: '这是一个测试笔记的内容',
    categoryId: null,
    tags: ['测试', 'API']
  };
  
  try {
    const response = await notesApi.createNote(noteData);
    console.log('创建笔记响应:', response);
    
    if (response && response.id) {
      console.log('✅ 创建笔记测试通过');
      return response.id;
    } else {
      console.log('❌ 创建笔记测试失败: 未返回笔记ID');
      return null;
    }
  } catch (error) {
    console.error('❌ 创建笔记测试失败:', error);
    return null;
  }
}

// 测试获取笔记
async function testGetNote(noteId) {
  if (!noteId) {
    console.log('❌ 获取笔记测试跳过: 没有有效的笔记ID');
    return null;
  }
  
  console.log(`测试获取笔记 (ID: ${noteId})...`);
  
  try {
    const response = await notesApi.getNote(noteId);
    console.log('获取笔记响应:', response);
    
    if (response && response.id === noteId) {
      console.log('✅ 获取笔记测试通过');
      return response;
    } else {
      console.log('❌ 获取笔记测试失败: 返回的笔记ID不匹配');
      return null;
    }
  } catch (error) {
    console.error('❌ 获取笔记测试失败:', error);
    return null;
  }
}

// 导出测试函数
export default async function testNotesApi() {
  console.log('===== 开始测试笔记API =====');
  
  // 创建测试笔记
  const noteId = await testCreateNote();
  
  // 获取测试笔记
  const note = await testGetNote(noteId);
  
  // 更多测试...
  
  console.log('===== 笔记API测试完成 =====');
}
```

## 注意事项

- 测试应在开发环境中运行，避免影响生产数据
- 测试应创建独立的测试数据，并在测试完成后清理
- 测试应处理各种错误情况，确保应用的健壮性
- 考虑使用模拟数据和服务，减少对实际API的依赖
- 定期运行测试，确保应用的稳定性
