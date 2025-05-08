# 搜索服务

本目录包含零屿笔记应用的搜索相关服务，用于提供全文搜索和多模态搜索功能。

## 文件结构

- **searchService.js**: 搜索服务，提供全文搜索功能

## 主要功能

### 搜索服务 (searchService.js)

搜索服务提供以下主要功能：

- **全文搜索**: 在笔记内容中进行全文搜索
- **多模态搜索**: 支持文本、语音、图像等多种搜索方式
- **搜索索引**: 管理搜索索引，提高搜索效率
- **搜索过滤**: 根据分类、标签等条件过滤搜索结果
- **搜索排序**: 根据相关性、时间等条件排序搜索结果
- **搜索历史**: 记录和管理用户的搜索历史
- **搜索建议**: 提供智能搜索建议
- **离线搜索**: 支持在离线状态下搜索本地内容

## 搜索模式

搜索服务支持以下搜索模式：

- **文本搜索**: 使用文本关键词进行搜索
- **语音搜索**: 通过语音输入进行搜索
- **图像搜索**: 通过图像内容进行搜索
- **标签搜索**: 通过标签进行搜索
- **高级搜索**: 使用复杂查询条件进行搜索

## 搜索范围

搜索服务支持以下搜索范围：

- **笔记**: 搜索笔记内容和标题
- **知识图谱**: 搜索知识图谱节点和关系
- **思维导图**: 搜索思维导图节点和内容
- **文件**: 搜索导入的文件内容
- **社区**: 搜索社区内容
- **全部**: 搜索所有内容

## 搜索索引

搜索服务使用以下索引技术：

- **倒排索引**: 用于全文搜索
- **向量索引**: 用于语义搜索
- **图像特征索引**: 用于图像搜索
- **本地索引**: 存储在设备上的索引，支持离线搜索
- **远程索引**: 存储在服务器上的索引，支持更全面的搜索

## 与其他服务的交互

搜索服务与以下服务有交互：

- **API服务**: 与后端搜索API通信
- **AI服务**: 使用AI功能进行语义理解和多模态搜索
- **存储服务**: 存储搜索索引和历史
- **离线服务**: 支持离线搜索功能

## 使用方法

```javascript
import { searchService } from '../../services/search';

// 文本搜索
async function searchText(query, options = {}) {
  try {
    const results = await searchService.search(query, {
      mode: 'text',
      scope: options.scope || 'all',
      filters: options.filters || {},
      sort: options.sort || 'relevance',
      limit: options.limit || 20,
      offset: options.offset || 0
    });
    
    console.log('搜索结果:', results.length, '条');
    return results;
  } catch (error) {
    console.error('搜索失败:', error);
    return [];
  }
}

// 语音搜索
async function searchVoice(audioData, options = {}) {
  try {
    const results = await searchService.search(audioData, {
      mode: 'voice',
      scope: options.scope || 'all',
      filters: options.filters || {},
      sort: options.sort || 'relevance',
      limit: options.limit || 20,
      offset: options.offset || 0
    });
    
    console.log('语音搜索结果:', results.length, '条');
    return results;
  } catch (error) {
    console.error('语音搜索失败:', error);
    return [];
  }
}

// 图像搜索
async function searchImage(imageData, options = {}) {
  try {
    const results = await searchService.search(imageData, {
      mode: 'image',
      scope: options.scope || 'all',
      filters: options.filters || {},
      sort: options.sort || 'relevance',
      limit: options.limit || 20,
      offset: options.offset || 0
    });
    
    console.log('图像搜索结果:', results.length, '条');
    return results;
  } catch (error) {
    console.error('图像搜索失败:', error);
    return [];
  }
}

// 高级搜索
async function advancedSearch(query, filters, options = {}) {
  try {
    const results = await searchService.search(query, {
      mode: 'advanced',
      scope: options.scope || 'all',
      filters: filters,
      sort: options.sort || 'relevance',
      limit: options.limit || 20,
      offset: options.offset || 0
    });
    
    console.log('高级搜索结果:', results.length, '条');
    return results;
  } catch (error) {
    console.error('高级搜索失败:', error);
    return [];
  }
}

// 获取搜索建议
async function getSearchSuggestions(query) {
  try {
    const suggestions = await searchService.getSuggestions(query);
    console.log('搜索建议:', suggestions);
    return suggestions;
  } catch (error) {
    console.error('获取搜索建议失败:', error);
    return [];
  }
}

// 获取搜索历史
async function getSearchHistory() {
  try {
    const history = await searchService.getHistory();
    console.log('搜索历史:', history);
    return history;
  } catch (error) {
    console.error('获取搜索历史失败:', error);
    return [];
  }
}

// 清除搜索历史
async function clearSearchHistory() {
  try {
    await searchService.clearHistory();
    console.log('搜索历史已清除');
    return true;
  } catch (error) {
    console.error('清除搜索历史失败:', error);
    return false;
  }
}

// 重建搜索索引
async function rebuildSearchIndex() {
  try {
    await searchService.rebuildIndex();
    console.log('搜索索引已重建');
    return true;
  } catch (error) {
    console.error('重建搜索索引失败:', error);
    return false;
  }
}
```

## 搜索结果数据结构

搜索结果的基本数据结构如下：

```javascript
{
  items: [                    // 搜索结果项
    {
      id: String,             // 结果ID
      type: String,           // 结果类型（笔记/知识点/文件等）
      title: String,          // 结果标题
      snippet: String,        // 结果摘要，包含匹配的内容
      highlights: [           // 高亮信息
        {
          field: String,      // 高亮字段
          positions: [        // 高亮位置
            [start, end],     // 开始和结束位置
          ]
        }
      ],
      score: Number,          // 相关性得分
      metadata: Object,       // 元数据
      createdAt: Date,        // 创建时间
      updatedAt: Date         // 更新时间
    }
  ],
  total: Number,              // 结果总数
  query: String,              // 搜索查询
  mode: String,               // 搜索模式
  scope: String,              // 搜索范围
  filters: Object,            // 搜索过滤条件
  sort: String,               // 排序方式
  limit: Number,              // 结果限制
  offset: Number,             // 结果偏移
  took: Number                // 搜索耗时（毫秒）
}
```

## 注意事项

- 搜索操作可能是资源密集型的，应考虑性能优化
- 搜索索引应定期更新，确保搜索结果的准确性
- 多模态搜索可能需要网络连接，应处理离线情况
- 考虑搜索结果的隐私保护，确保只显示用户有权访问的内容
- 提供清晰的搜索反馈，如无结果时的提示和建议
- 优化搜索体验，如自动补全、搜索建议和历史记录
