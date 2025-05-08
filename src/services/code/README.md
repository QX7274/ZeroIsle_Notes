# 代码服务

本目录包含零屿笔记应用的代码相关服务，用于提供代码检测、补全、解释、格式化、运行等功能。

## 文件结构

- **codeService.js**: 代码服务，提供代码相关功能

## 主要功能

### 代码服务 (codeService.js)

代码服务提供以下主要功能：

- **代码检测**: 检测文本中的代码块和编程语言
- **代码补全**: 提供智能代码补全建议
- **代码解释**: 解释代码的功能和逻辑
- **代码格式化**: 格式化代码，提高可读性
- **代码运行**: 执行代码并返回结果
- **代码片段管理**: 管理用户保存的代码片段

## 代码检测功能

代码检测功能可以识别文本中的代码块并确定其编程语言，主要特点包括：

- 支持多种编程语言的检测（如Python、JavaScript、Java等）
- 提供语言检测的置信度
- 可以处理混合文本和代码的内容
- 支持代码块的提取和分离

## 代码补全功能

代码补全功能提供智能的代码补全建议，主要特点包括：

- 基于上下文的智能补全
- 支持多种编程语言
- 提供函数、变量、类等不同类型的补全
- 可以根据用户的编码习惯进行个性化补全

## 代码解释功能

代码解释功能可以解释代码的功能和逻辑，主要特点包括：

- 提供不同详细程度的解释（简单、中等、详细）
- 分析代码结构和组成部分
- 解释代码的执行流程和逻辑
- 识别潜在的问题和优化点

## 代码格式化功能

代码格式化功能可以格式化代码，提高可读性，主要特点包括：

- 支持多种编程语言的格式化
- 提供不同的格式化风格选项
- 保持代码的语义不变
- 可以自定义格式化规则

## 代码运行功能

代码运行功能可以执行代码并返回结果，主要特点包括：

- 支持多种编程语言的执行
- 提供安全的执行环境
- 可以设置执行超时和资源限制
- 支持输入数据和参数传递

## 代码片段管理功能

代码片段管理功能可以管理用户保存的代码片段，主要特点包括：

- 保存和组织代码片段
- 为代码片段添加标签和描述
- 搜索和筛选代码片段
- 分享代码片段

## 与其他服务的交互

代码服务与以下服务有交互：

- **API服务 (codeApi)**: 用于与后端代码服务通信
- **AI服务 (aiService)**: 用于提供智能代码补全和解释
- **分析服务 (analyticsService)**: 用于跟踪代码相关操作

## 使用方法

```javascript
import { codeService } from '../../services/code';

// 检测代码语言
async function detectCodeLanguage(text) {
  try {
    const result = await codeService.detectCode(text);
    console.log('检测到的语言:', result.language);
    console.log('置信度:', result.confidence);
    return result;
  } catch (error) {
    console.error('代码检测失败:', error);
    return null;
  }
}

// 获取代码补全建议
async function getCodeCompletions(code, language, position) {
  try {
    const completions = await codeService.completeCode(code, language, position);
    console.log('补全建议:', completions);
    return completions;
  } catch (error) {
    console.error('获取代码补全失败:', error);
    return [];
  }
}

// 解释代码
async function explainCode(code, language, detailLevel = 'medium') {
  try {
    const explanation = await codeService.explainCode(code, language, detailLevel);
    console.log('代码解释:', explanation);
    return explanation;
  } catch (error) {
    console.error('代码解释失败:', error);
    return null;
  }
}

// 格式化代码
async function formatCode(code, language, style = 'default') {
  try {
    const formattedCode = await codeService.formatCode(code, language, style);
    console.log('格式化后的代码:', formattedCode);
    return formattedCode;
  } catch (error) {
    console.error('代码格式化失败:', error);
    return code;
  }
}

// 运行代码
async function runCode(code, language, input = '') {
  try {
    const result = await codeService.runCode(code, language, input);
    console.log('运行结果:', result);
    return result;
  } catch (error) {
    console.error('代码运行失败:', error);
    return { error: error.message };
  }
}

// 保存代码片段
async function saveCodeSnippet(code, language, title, description = '', tags = []) {
  try {
    const snippetId = await codeService.saveSnippet({
      code,
      language,
      title,
      description,
      tags
    });
    console.log('代码片段已保存:', snippetId);
    return snippetId;
  } catch (error) {
    console.error('保存代码片段失败:', error);
    return null;
  }
}
```

## 注意事项

- 代码运行功能应在安全的环境中执行，避免恶意代码
- 代码补全和解释功能可能需要网络连接
- 对于大型代码文件，应考虑性能和资源限制
- 支持的编程语言可能有限，应检查语言兼容性
