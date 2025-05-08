# 笔记服务

本目录包含零屿笔记应用的笔记相关服务，用于提供笔记内容分析、自动标签生成和笔记编辑工具栏等功能。

## 文件结构

- **noteAIService.js**: 笔记AI服务，提供笔记内容分析、自动标签生成等功能
- **noteToolbarService.js**: 笔记工具栏服务，提供笔记编辑工具栏功能

## 主要功能

### 笔记AI服务 (noteAIService.js)

笔记AI服务提供以下主要功能：

- **内容分析**: 分析笔记内容，提取关键信息
- **自动标签生成**: 根据笔记内容自动生成标签
- **自动分类建议**: 根据笔记内容建议合适的分类
- **相关笔记推荐**: 推荐与当前笔记相关的其他笔记
- **内容摘要生成**: 自动生成笔记内容的摘要
- **智能补全**: 提供智能文本补全建议
- **语法检查**: 检查笔记内容的语法和拼写错误

### 笔记工具栏服务 (noteToolbarService.js)

笔记工具栏服务提供以下主要功能：

- **工具栏配置**: 配置笔记编辑器工具栏
- **工具栏操作**: 处理工具栏按钮点击事件
- **格式化操作**: 提供文本格式化功能（加粗、斜体、下划线等）
- **插入操作**: 提供插入功能（图片、链接、表格等）
- **列表操作**: 提供列表功能（有序列表、无序列表、任务列表）
- **样式操作**: 提供样式设置功能（字体、颜色、对齐等）
- **自定义工具**: 支持添加自定义工具到工具栏

## 笔记内容分析

笔记AI服务使用以下技术进行笔记内容分析：

- **自然语言处理 (NLP)**: 分析文本内容和语义
- **关键词提取**: 提取笔记中的关键词和术语
- **实体识别**: 识别笔记中的人物、地点、组织等实体
- **主题建模**: 识别笔记的主要主题和话题
- **情感分析**: 分析笔记内容的情感倾向

## 自动标签生成

自动标签生成功能基于以下步骤：

1. **内容分析**: 分析笔记内容，提取关键信息
2. **关键词提取**: 从笔记中提取重要关键词
3. **标签匹配**: 将关键词与现有标签库匹配
4. **标签排序**: 根据相关性对标签进行排序
5. **标签建议**: 向用户提供标签建议

## 工具栏配置

笔记工具栏支持以下配置选项：

- **工具选择**: 选择要显示的工具按钮
- **工具排序**: 设置工具按钮的显示顺序
- **工具分组**: 将相关工具分组显示
- **自定义工具**: 添加自定义工具到工具栏
- **快捷键设置**: 为工具操作设置快捷键

## 与其他服务的交互

笔记服务与以下服务有交互：

- **AI服务**: 使用AI功能进行内容分析和标签生成
- **API服务**: 与后端API通信，获取和更新笔记数据
- **存储服务**: 存储笔记内容和设置
- **编辑器服务**: 与富文本编辑器集成，提供编辑功能

## 使用方法

```javascript
import { noteAIService, noteToolbarService } from '../../services/note';

// 分析笔记内容
async function analyzeNoteContent(noteContent) {
  try {
    const analysis = await noteAIService.analyzeContent(noteContent);
    console.log('笔记分析结果:', analysis);
    return analysis;
  } catch (error) {
    console.error('笔记分析失败:', error);
    return null;
  }
}

// 生成自动标签
async function generateTags(noteContent) {
  try {
    const tags = await noteAIService.generateTags(noteContent);
    console.log('生成的标签:', tags);
    return tags;
  } catch (error) {
    console.error('标签生成失败:', error);
    return [];
  }
}

// 获取分类建议
async function getCategoryRecommendations(noteContent) {
  try {
    const categories = await noteAIService.recommendCategories(noteContent);
    console.log('建议的分类:', categories);
    return categories;
  } catch (error) {
    console.error('分类建议失败:', error);
    return [];
  }
}

// 生成内容摘要
async function generateSummary(noteContent, maxLength = 100) {
  try {
    const summary = await noteAIService.generateSummary(noteContent, maxLength);
    console.log('生成的摘要:', summary);
    return summary;
  } catch (error) {
    console.error('摘要生成失败:', error);
    return '';
  }
}

// 获取相关笔记推荐
async function getRelatedNotes(noteId) {
  try {
    const relatedNotes = await noteAIService.getRelatedNotes(noteId);
    console.log('相关笔记:', relatedNotes);
    return relatedNotes;
  } catch (error) {
    console.error('获取相关笔记失败:', error);
    return [];
  }
}

// 配置工具栏
function configureToolbar(editorId, options) {
  try {
    const toolbar = noteToolbarService.configureToolbar(editorId, options);
    console.log('工具栏配置成功');
    return toolbar;
  } catch (error) {
    console.error('工具栏配置失败:', error);
    return null;
  }
}

// 执行工具栏操作
function executeToolbarAction(editorId, actionName, value) {
  try {
    noteToolbarService.executeAction(editorId, actionName, value);
    console.log('工具栏操作执行成功:', actionName);
    return true;
  } catch (error) {
    console.error('工具栏操作执行失败:', error);
    return false;
  }
}

// 添加自定义工具
function addCustomTool(editorId, tool) {
  try {
    noteToolbarService.addCustomTool(editorId, tool);
    console.log('自定义工具添加成功:', tool.name);
    return true;
  } catch (error) {
    console.error('自定义工具添加失败:', error);
    return false;
  }
}
```

## 注意事项

- 笔记AI服务可能需要网络连接，应处理离线情况
- 内容分析和标签生成可能需要较长时间，应提供加载状态反馈
- 自动生成的标签和分类建议可能不完全准确，应允许用户修改
- 工具栏配置应考虑不同屏幕尺寸和设备类型
- 考虑提供离线模式下的基本功能，减少对网络的依赖
