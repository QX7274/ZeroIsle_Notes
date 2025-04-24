# 服务目录

这个目录包含应用的API服务和其他外部服务集成。

## 服务分类

- **api/**：后端API服务
  - **apiClient.js**：API客户端配置
  - **authApi.js**：认证相关API
  - **notesApi.js**：笔记相关API
  - **knowledgeGraphApi.js**：知识图谱相关API
  - **communityApi.js**：社区相关API
- **ai/**：AI服务集成
  - **handwritingRecognition.js**：手写识别服务
  - **voiceRecognition.js**：语音识别服务
  - **textAnalysis.js**：文本分析服务

## API服务原则

1. 使用Axios或Fetch进行HTTP请求
2. 统一处理请求和响应拦截
3. 统一处理错误
4. 实现请求缓存和重试机制
5. 支持取消请求
6. 支持请求队列和并发控制