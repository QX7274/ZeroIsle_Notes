# 搜索功能增强文档

## 概述

本文档介绍了搜索模块的增强功能，包括文本搜索、语音搜索、图像搜索和知识图谱搜索。

## 功能特性

### 1. 多模态搜索支持

- **文本搜索**：传统的关键词搜索，支持全文检索和向量搜索
- **语音搜索**：通过语音输入进行搜索，支持多种语音识别引擎
- **图像搜索**：通过图像内容进行搜索，支持OCR和图像理解
- **知识图谱搜索**：基于知识图谱的关联搜索

### 2. 智能搜索功能

- **向量搜索**：使用语义向量进行相似度搜索
- **混合搜索**：结合关键词搜索和向量搜索
- **搜索建议**：智能搜索建议和自动补全
- **搜索历史**：记录和管理搜索历史

## API端点

### 文本搜索

#### 基础搜索
```
GET /api/search/query/?q=关键词&page=1&page_size=20
```

#### 高级搜索
```
POST /api/search/text/
```

请求参数：
```json
{
  "query": "搜索关键词",
  "options": {
    "type": ["note", "document", "canvas"],  // 内容类型过滤
    "public": true,  // 是否只搜索公开内容
    "page": 1,
    "page_size": 20,
    "use_vector": true  // 是否使用向量搜索
  }
}
```

响应：
```json
{
  "results": [
    {
      "id": "结果ID",
      "title": "标题",
      "content": "内容摘要",
      "type": "note",
      "score": 0.95,
      "created_at": "2025-11-11T16:00:00Z",
      "updated_at": "2025-11-11T16:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "has_next": true,
  "has_previous": false
}
```

### 语音搜索

```
POST /api/search/voice/
```

详细说明请参考 [语音识别增强文档](../voice_recognition/README_ENHANCED.md)

### 图像搜索

```
POST /api/search/image/
```

请求参数：
```json
{
  "image": "图像文件（multipart/form-data）",
  "image_base64": "Base64编码的图像数据（可选）",
  "task": "describe",  // describe, extract_text, identify_objects, analyze, search
  "prompt": "自定义提示词（可选）",
  "options": {
    "type": ["note", "document"],
    "public": true,
    "page": 1,
    "page_size": 20,
    "use_vector": true
  }
}
```

响应：
```json
{
  "image_analysis": {
    "task": "describe",
    "result": "图像描述内容",
    "description": "图像描述内容"
  },
  "search_query": "提取的搜索关键词",
  "results": [...],
  "total": 10,
  "page": 1,
  "page_size": 20
}
```

### 知识图谱搜索

```
POST /api/search/knowledge-graph/
```

请求参数：
```json
{
  "query": "搜索关键词",
  "options": {
    "max_results": 20,
    "include_edges": true  // 是否包含关系边
  }
}
```

响应：
```json
{
  "nodes": [
    {
      "id": "节点ID",
      "label": "节点标签",
      "type": "节点类型",
      "properties": {}
    }
  ],
  "edges": [
    {
      "source": "源节点ID",
      "target": "目标节点ID",
      "type": "关系类型",
      "properties": {}
    }
  ],
  "total": 10
}
```

### 搜索建议

```
GET /api/search/suggestions/?prefix=关键&limit=10
```

响应：
```json
{
  "suggestions": [
    {
      "text": "关键词1",
      "frequency": 10,
      "is_global": true
    },
    {
      "text": "关键词2",
      "frequency": 5,
      "is_global": false
    }
  ]
}
```

### 搜索历史

#### 获取搜索历史
```
GET /api/search/history/?limit=20
```

响应：
```json
{
  "history": [
    {
      "id": "历史ID",
      "query": "搜索关键词",
      "search_type": "text",  // text, voice, image, knowledge_graph
      "result_count": 10,
      "created_at": "2025-11-11T16:00:00Z"
    }
  ]
}
```

#### 清除搜索历史
```
POST /api/search/clear-history/
```

响应：
```json
{
  "deleted": 50
}
```

### 最近搜索

```
GET /api/search/recent/?limit=10
```

### 热门搜索

```
GET /api/search/popular/?limit=10
```

## 搜索过滤器

### 内容类型过滤

支持的内容类型：
- `note`: 笔记
- `document`: 文档
- `canvas`: 画布
- `mind_map`: 思维导图
- `code`: 代码片段
- `knowledge_base`: 知识库

示例：
```json
{
  "query": "Python",
  "options": {
    "type": ["note", "code"]
  }
}
```

### 公开性过滤

```json
{
  "query": "教程",
  "options": {
    "public": true  // 只搜索公开内容
  }
}
```

### 时间范围过滤

```json
{
  "query": "报告",
  "options": {
    "date_from": "2025-01-01",
    "date_to": "2025-12-31"
  }
}
```

### 标签过滤

```json
{
  "query": "项目",
  "options": {
    "tags": ["工作", "重要"]
  }
}
```

## 向量搜索

### 启用向量搜索

```json
{
  "query": "机器学习算法",
  "options": {
    "use_vector": true,
    "vector_weight": 0.7  // 向量搜索权重（0-1）
  }
}
```

### 向量搜索原理

1. **文本向量化**：将搜索查询转换为向量表示
2. **相似度计算**：计算查询向量与文档向量的相似度
3. **结果排序**：根据相似度分数排序结果
4. **混合排序**：结合关键词匹配分数和向量相似度分数

### 向量搜索优势

- 语义理解：理解查询的语义含义
- 同义词匹配：自动匹配同义词和相关概念
- 多语言支持：跨语言搜索
- 模糊匹配：容错性更强

## 使用示例

### JavaScript/TypeScript 示例

```typescript
import axios from 'axios';

// 1. 文本搜索
async function textSearch(query: string) {
  const response = await axios.post('/api/search/text/', {
    query: query,
    options: {
      type: ['note', 'document'],
      use_vector: true,
      page: 1,
      page_size: 20
    }
  }, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.data;
}

// 2. 语音搜索
async function voiceSearch(audioBlob: Blob) {
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      const base64Audio = reader.result.split(',')[1];
      
      const response = await axios.post('/api/search/voice/', {
        audio_base64: base64Audio,
        language: 'zh',
        engine: 'whisper',
        options: {
          page: 1,
          page_size: 20
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      resolve(response.data);
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
}

// 3. 图像搜索
async function imageSearch(imageFile: File, task: string = 'describe') {
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      const base64Image = reader.result.split(',')[1];
      
      const response = await axios.post('/api/search/image/', {
        image_base64: base64Image,
        task: task,
        options: {
          page: 1,
          page_size: 20
        }
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      resolve(response.data);
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

// 4. 获取搜索建议
async function getSearchSuggestions(prefix: string) {
  const response = await axios.get('/api/search/suggestions/', {
    params: {
      prefix: prefix,
      limit: 10
    },
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.data.suggestions;
}

// 5. 获取搜索历史
async function getSearchHistory() {
  const response = await axios.get('/api/search/history/', {
    params: {
      limit: 20
    },
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.data.history;
}
```

### React Native 示例

```typescript
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';

// 录音并搜索
async function recordAndSearch() {
  // 请求录音权限
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('需要麦克风权限');
    return;
  }
  
  // 开始录音
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
  await recording.startAsync();
  
  // 录音3秒
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 停止录音
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  
  // 读取音频文件
  const response = await fetch(uri);
  const blob = await response.blob();
  
  // 转换为Base64
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = async () => {
    const base64Audio = reader.result.split(',')[1];
    
    // 发送搜索请求
    const searchResult = await voiceSearch(base64Audio);
    console.log('搜索结果:', searchResult);
  };
}

// 选择图片并搜索
async function pickImageAndSearch() {
  // 请求相册权限
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('需要相册权限');
    return;
  }
  
  // 选择图片
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    base64: true
  });
  
  if (!result.cancelled && result.base64) {
    // 发送搜索请求
    const searchResult = await imageSearchWithBase64(result.base64);
    console.log('搜索结果:', searchResult);
  }
}
```

## 性能优化

### 搜索缓存

系统会自动缓存常见搜索结果，提高响应速度。

### 分页加载

使用分页参数避免一次加载过多结果：

```json
{
  "query": "关键词",
  "options": {
    "page": 1,
    "page_size": 20  // 建议20-50之间
  }
}
```

### 异步处理

对于耗时的搜索操作（如图像分析），可以使用异步模式：

```json
{
  "query": "关键词",
  "options": {
    "async": true  // 异步处理
  }
}
```

## 最佳实践

1. **合理使用向量搜索**：对于语义搜索场景启用向量搜索，对于精确匹配场景使用关键词搜索
2. **设置合适的分页大小**：根据设备性能和网络状况调整
3. **利用搜索建议**：提供更好的用户体验
4. **记录搜索历史**：方便用户快速访问历史搜索
5. **使用过滤器**：缩小搜索范围，提高准确性

## 故障排除

### 搜索结果为空
- 检查搜索关键词是否正确
- 尝试使用不同的搜索类型
- 检查过滤条件是否过于严格

### 语音搜索失败
- 检查麦克风权限
- 确保音频质量良好
- 尝试不同的识别引擎

### 图像搜索失败
- 检查图像文件格式
- 确保图像清晰可读
- 尝试不同的分析任务

## 更新日志

### v2.0.0 (2025-11-11)
- ✨ 新增多模态搜索支持
- ✨ 新增向量搜索功能
- ✨ 新增搜索建议和历史
- 🔧 优化搜索性能
- 📝 完善API文档

