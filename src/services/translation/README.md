# 翻译服务

本目录包含零屿笔记应用的翻译相关服务，用于提供文本翻译和多语言支持功能。

## 文件结构

- **translationService.js**: 翻译服务，提供文本翻译功能

## 主要功能

### 翻译服务 (translationService.js)

翻译服务提供以下主要功能：

- **文本翻译**: 将文本从一种语言翻译为另一种语言
- **语言检测**: 自动检测文本的语言
- **批量翻译**: 批量翻译多个文本片段
- **翻译历史**: 记录和管理翻译历史
- **离线翻译**: 支持在离线状态下进行基本翻译
- **专业领域翻译**: 支持特定领域的专业翻译
- **翻译质量控制**: 提供不同质量级别的翻译选项

## 支持的语言

翻译服务支持以下主要语言：

- **中文**: 简体中文、繁体中文
- **英语**: 美式英语、英式英语
- **日语**: 日本语
- **韩语**: 韩国语
- **法语**: 法国语
- **德语**: 德国语
- **西班牙语**: 西班牙语
- **俄语**: 俄罗斯语
- **阿拉伯语**: 阿拉伯语
- **葡萄牙语**: 葡萄牙语
- **意大利语**: 意大利语
- **荷兰语**: 荷兰语
- **其他语言**: 支持更多语言，具体取决于所使用的翻译API

## 翻译引擎

翻译服务可以使用以下翻译引擎：

- **在线翻译API**: 使用第三方翻译API进行高质量翻译
- **本地翻译模型**: 使用设备上的轻量级翻译模型进行离线翻译
- **混合模式**: 根据网络状态和翻译需求选择合适的翻译引擎

## 与其他服务的交互

翻译服务与以下服务有交互：

- **API服务**: 与后端翻译API通信
- **AI服务**: 使用AI功能进行语言检测和翻译
- **存储服务**: 存储翻译历史和设置
- **离线服务**: 支持离线翻译功能

## 使用方法

```javascript
import { translationService } from '../../services/translation';

// 翻译文本
async function translateText(text, targetLanguage, sourceLanguage = null) {
  try {
    const result = await translationService.translate(text, targetLanguage, sourceLanguage);
    console.log('翻译结果:', result);
    return result;
  } catch (error) {
    console.error('翻译失败:', error);
    return null;
  }
}

// 检测语言
async function detectLanguage(text) {
  try {
    const language = await translationService.detectLanguage(text);
    console.log('检测到的语言:', language);
    return language;
  } catch (error) {
    console.error('语言检测失败:', error);
    return null;
  }
}

// 批量翻译
async function batchTranslate(texts, targetLanguage, sourceLanguage = null) {
  try {
    const results = await translationService.batchTranslate(texts, targetLanguage, sourceLanguage);
    console.log('批量翻译结果:', results);
    return results;
  } catch (error) {
    console.error('批量翻译失败:', error);
    return [];
  }
}

// 获取支持的语言
async function getSupportedLanguages() {
  try {
    const languages = await translationService.getSupportedLanguages();
    console.log('支持的语言:', languages);
    return languages;
  } catch (error) {
    console.error('获取支持的语言失败:', error);
    return [];
  }
}

// 获取翻译历史
async function getTranslationHistory() {
  try {
    const history = await translationService.getHistory();
    console.log('翻译历史:', history);
    return history;
  } catch (error) {
    console.error('获取翻译历史失败:', error);
    return [];
  }
}

// 清除翻译历史
async function clearTranslationHistory() {
  try {
    await translationService.clearHistory();
    console.log('翻译历史已清除');
    return true;
  } catch (error) {
    console.error('清除翻译历史失败:', error);
    return false;
  }
}

// 设置翻译引擎
async function setTranslationEngine(engine) {
  try {
    await translationService.setEngine(engine);
    console.log('翻译引擎已设置为:', engine);
    return true;
  } catch (error) {
    console.error('设置翻译引擎失败:', error);
    return false;
  }
}

// 翻译笔记内容
async function translateNote(noteId, targetLanguage) {
  try {
    const translatedNote = await translationService.translateNote(noteId, targetLanguage);
    console.log('笔记翻译成功:', translatedNote);
    return translatedNote;
  } catch (error) {
    console.error('笔记翻译失败:', error);
    return null;
  }
}
```

## 翻译结果数据结构

翻译结果的基本数据结构如下：

```javascript
{
  originalText: String,       // 原始文本
  translatedText: String,     // 翻译后的文本
  sourceLanguage: String,     // 源语言代码
  targetLanguage: String,     // 目标语言代码
  confidence: Number,         // 翻译置信度（0-1）
  engine: String,             // 使用的翻译引擎
  timestamp: Date,            // 翻译时间
  metadata: {                 // 元数据
    quality: String,          // 翻译质量
    domain: String,           // 专业领域
    alternatives: [           // 备选翻译
      {
        text: String,         // 备选文本
        confidence: Number    // 置信度
      }
    ]
  }
}
```

## 注意事项

- 翻译服务可能需要网络连接，应处理离线情况
- 翻译API可能有使用限制和费用，应合理管理API调用
- 翻译结果可能不完全准确，特别是对于专业术语和复杂表达
- 考虑用户隐私，避免将敏感内容发送到第三方翻译服务
- 提供翻译反馈机制，允许用户报告不准确的翻译
- 优化翻译体验，如自动检测语言、记住用户偏好等
