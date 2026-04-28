# ZeroIsle_Notes 开发守则

## 项目概述
**零屿笔记** - 全栈笔记应用，React Native前端 + Django后端 + MongoDB云端 + Realm本地存储

**核心特性**: 笔记管理、AI助手、知识图谱、社区协作、语音识别、可视化画布

## 项目架构

### 前端 (src/)
- **screens/** - 页面（笔记、AI、画布、社区等）
- **components/** - 可复用组件
- **services/** - 业务逻辑（API、数据库、同步等）
- **redux/** - 状态管理
- **theme/** - UI主题配置

### 后端 (backend/)
- **ai_assistant/** - AI功能模块
- **notes/** - 笔记管理
- **knowledge_base/** - 知识库
- **community/** - 社区协作
- **users/** - 用户认证
- **common/** - 共用工具和中间件

### 数据库
- **Realm** - 本地离线存储（React Native）
- **MongoDB** - 云端数据存储
- **Redis** - 缓存和任务队列（生产环境）

## 代码规范

### 命名规范
- **后端**: snake_case (Python约定)
- **前端**: camelCase (JavaScript约定)
- **API端点**: kebab-case (RESTful约定)
- **数据库表**: snake_case

### 返回格式标准
**所有API必须返回统一格式**:
```javascript
{
  "code": 0,           // 0=成功，其他=错误码
  "message": "success",// 错误消息
  "data": {...}        // 实际数据
}
```

### 错误码规范
- **1xxx** - 认证/授权错误 (1001=未认证, 1002=权限不足)
- **2xxx** - 资源错误 (2001=资源不存在, 2002=资源冲突)
- **3xxx** - 业务逻辑错误
- **5xxx** - 服务器错误

### 注释规范
- **后端**: 使用docstring，说明函数目的、参数、返回值
- **前端**: 使用JSDoc，标注类型和用途
- **关键逻辑**: 添加行内注释解释"为什么"而非"做什么"

## 功能实现规范

### API开发流程
1. 在 `backend/common/error_codes.py` 定义错误码
2. 在 `backend/*/views.py` 实现视图，使用统一响应格式
3. 在 `backend/*/serializers.py` 定义数据序列化
4. 在 `src/services/api/*Api.js` 创建前端调用接口
5. 在 `src/services/api/apiClient.js` 统一处理错误

### 数据库操作规范
- **后端**: 使用Django ORM，避免原生SQL
- **前端**: 使用Realm SDK，遵循Realm Schema定义
- **同步**: 使用 `src/services/sync/syncService.js` 统一管理

### 状态管理规范
- **全局状态**: 使用Redux (src/redux/)
- **本地状态**: 使用React Hooks (useState)
- **异步操作**: 使用Redux Thunk或async/await

## 框架/库使用规范

### 后端依赖
- **Django** - Web框架，使用DRF (Django REST Framework)
- **Celery** - 异步任务队列
- **MongoDB** - 使用MongoEngine ORM
- **Redis** - 缓存和会话存储

### 前端依赖
- **React Native** - 移动应用框架
- **Redux** - 状态管理
- **React Navigation** - 路由管理
- **Axios** - HTTP客户端

### 禁止事项
- ❌ 不使用过时的API (如 `openai.ChatCompletion.create`)
- ❌ 不直接修改全局状态，必须通过Redux
- ❌ 不在组件中进行复杂业务逻辑，应提取到service
- ❌ 不使用硬编码的API端点，使用 `config/api.js`

## 工作流程规范

### 修复流程
1. **分析** - 理解问题根源和影响范围
2. **设计** - 制定修复方案，考虑向后兼容性
3. **实现** - 编写代码，遵循规范
4. **测试** - 单元测试、集成测试、端到端测试
5. **文档** - 更新API文档和迁移指南
6. **验收** - 确认修复效果和无副作用

### 跨模块修改规范
修改一个模块时，需要同步更新相关文件：
- 修改 `backend/ai_assistant/views.py` → 同步更新 `backend/ai_assistant/serializers.py`
- 修改 API返回格式 → 同步更新 `src/services/api/*Api.js`
- 修改数据库模型 → 创建迁移脚本，更新Realm Schema

## 关键文件交互规范

### API相关文件
- `backend/*/views.py` - API实现
- `backend/*/serializers.py` - 数据序列化
- `src/services/api/*Api.js` - 前端调用
- `src/services/api/apiClient.js` - HTTP客户端配置
- `src/config/api.js` - API端点配置

### 数据库相关文件
- `backend/*/models.py` - Django模型
- `src/services/database/realmModels.js` - Realm Schema
- `src/services/sync/syncService.js` - 同步逻辑

### AI功能相关文件
- `backend/ai_assistant/services/*.py` - 后端服务
- `src/services/ai/EnhancedAIService.js` - 前端统一接口
- `backend/ai_assistant/views/ai_process_views.py` - 统一处理视图

## AI决策规范

### 当遇到模糊情况时
1. **优先查看现有代码** - 遵循既有模式
2. **查阅分析报告** - 参考《功能完整性分析报告》
3. **向后兼容** - 保留旧接口，标记deprecated
4. **文档优先** - 更新文档而非硬编码

### 优先级判断
- **高优先级** ([object Object]全风险、功能缺失、数据不一致
- **中优先级** (🟡) - 代码质量、性能、用户体验
- **低优先级** (🟢) - UI细节、文档、代码风格

## 禁止事项清单

❌ **严禁**:
- 直接删除legacy API端点（应标记deprecated）
- 修改数据库Schema而不创建迁移脚本
- 在API中返回不同格式的响应
- 使用硬编码的API密钥或配置
- 在前端直接调用数据库，必须通过API
- 跳过权限检查
- 在生产环境使用调试代码

✅ **必须**:
- 所有API返回统一格式
- 所有错误都有明确的错误码
- 所有长任务都是异步的
- 所有用户输入都要验证和清理
- 所有数据库操作都要记录日志
- 所有修改都要更新相关文档

