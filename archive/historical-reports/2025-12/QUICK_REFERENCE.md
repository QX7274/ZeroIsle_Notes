# 零屿笔记 - 快速参考指南

## 🚀 快速启动

### 前端启动

```bash
# 1. 安装依赖
yarn install-deps-yarn

# 2. 启动Metro服务器
yarn start

# 3. 启动应用(新终端)
yarn android      # Android
yarn ios          # iOS (macOS only)
```

### 后端启动

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动服务
python manage.py runserver

# 4. 启动Celery(新终端)
celery -A backend worker -l info
```

### 数据库启动

```bash
# MongoDB
mongod --dbpath=./data/db

# Neo4j
neo4j start

# Redis
redis-server
```

---

## 📁 关键文件位置

### 前端关键路径

| 功能 | 路径 |
|------|------|
| 笔记编辑 | `src/screens/notes/NoteEditor.js` |
| AI对话 | `src/screens/ai/ChatScreen.js` |
| 知识图谱 | `src/screens/knowledge/KnowledgeGraph.js` |
| Redux配置 | `src/redux/store.js` |
| API服务 | `src/services/api/index.js` |
| 导航配置 | `src/navigation/RootNavigator.js` |
| 主题配置 | `src/theme/theme.js` |
| 常量定义 | `src/constants/` |

### 后端关键路径

| 功能 | 路径 |
|------|------|
| 笔记模型 | `backend/notes/models.py` |
| 笔记API | `backend/notes/views.py` |
| AI服务 | `backend/ai_assistant/services/` |
| 知识图谱 | `backend/knowledge_graph/services/` |
| 用户认证 | `backend/users/backends.py` |
| 设置配置 | `backend/backend/settings/` |
| URL路由 | `backend/backend/urls.py` |
| Celery任务 | `backend/backend/celery.py` |

---

## 🔧 常用命令

### 前端命令

```bash
# 清除缓存
yarn clear-cache

# 代码检查
yarn lint

# 运行测试
yarn test

# 构建应用
yarn build

# 打补丁
yarn patch-bcrypt
```

### 后端命令

```bash
# 创建迁移
python manage.py makemigrations

# 应用迁移
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser

# 收集静态文件
python manage.py collectstatic

# 运行测试
python manage.py test

# 进入Shell
python manage.py shell
```

### 数据库命令

```bash
# MongoDB - 连接数据库
mongosh

# Neo4j - 打开浏览器
http://localhost:7474

# Redis - 连接CLI
redis-cli
```

---

## [object Object]端点速查表

### 笔记API

```
GET    /api/notes/                    # 获取笔记列表
POST   /api/notes/                    # 创建笔记
GET    /api/notes/{id}/               # 获取笔记详情
PUT    /api/notes/{id}/               # 更新笔记
DELETE /api/notes/{id}/               # 删除笔记
GET    /api/notes/{id}/versions/      # 获取版本历史
POST   /api/notes/{id}/share/         # 分享笔记
```

### AI API

```
POST   /api/ai/chat/                  # 发送消息
GET    /api/ai/conversations/         # 获取对话列表
POST   /api/ai/translate/             # 翻译文本
POST   /api/ai/summarize/             # 生成摘要
POST   /api/ai/image-analysis/        # 分析图像
```

### 知识图谱API

```
GET    /api/knowledge-graph/nodes/    # 获取节点
POST   /api/knowledge-graph/nodes/    # 创建节点
GET    /api/knowledge-graph/edges/    # 获取关系
POST   /api/knowledge-graph/edges/    # 创建关系
GET    /api/knowledge-graph/search/   # 搜索图谱
```

### 用户API

```
POST   /api/auth/login/               # 登录
POST   /api/auth/register/            # 注册
POST   /api/auth/logout/              # 登出
GET    /api/users/profile/            # 获取个人资料
PUT    /api/users/profile/            # 更新个人资料
POST   /api/auth/refresh/             # 刷新令牌
```

---

## 🗂️ 项目结构速查

### 前端结构

```
src/
├── components/          # UI组件
│   ├── common/         # 通用组件
│   ├── notes/          # 笔记组件
│   ├── ai/             # AI组件
│   └── ...
├── screens/            # 屏幕页面
│   ├── notes/
│   ├── ai/
│   ├── knowledge/
│   └── ...
├── services/           # 业务服务
│   ├── api/            # API调用
│   ├── database/       # 数据库操作
│   ├── auth/           # 认证服务
│   └── ...
├── redux/              # 状态管理
│   ├── slices/
│   └── store.js
├── navigation/         # 导航配置
├── utils/              # 工具函数
├── constants/          # 常量定义
├── theme/              # 主题配置
└── App.js              # 应用入口
```

### 后端结构

```
backend/
├── backend/            # Django配置
│   ├── settings/       # 环境设置
│   ├── urls.py         # URL路由
│   └── wsgi.py
├── notes/              # 笔记模块
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   └── services.py
├── ai_assistant/       # AI模块
│   ├── models.py
│   ├── views.py
│   └── services/
├── knowledge_graph/    # 知识图谱模块
├── users/              # 用户模块
├── community/          # 社区模块
├── manage.py           # 管理脚本
└── requirements.txt    # 依赖列表
```

---

## 🔐 环境变量配置

### 前端 (.env)

```env
API_BASE_URL=http://localhost:8000
API_TIMEOUT=30000
ENABLE_DEBUG=true
LOG_LEVEL=info
```

### 后端 (.env)

```env
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1

# 数据库
MONGODB_URI=mongodb://localhost:27017/zeroislenotes
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379/0

# OpenAI
OPENAI_API_KEY=your-api-key

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRATION=3600
```

---

## 🧪 测试命令

### 前端测试

```bash
# 运行所有测试
yarn test

# 监听模式
yarn test --watch

# 覆盖率报告
yarn test --coverage
```

### 后端测试

```bash
# 运行所有测试
python manage.py test

# 运行特定应用测试
python manage.py test notes

# 运行特定测试类
python manage.py test notes.tests.NoteTestCase

# 显示详细输出
python manage.py test --verbosity=2

# 覆盖率报告
coverage run --source='.' manage.py test
coverage report
```

---

## 📱 调试工具

### 前端调试

```bash
# React Native Debugger
# 1. 安装: npm install -g react-native-debugger
# 2. 启动应用
# 3. 按 Ctrl+M (Android) 或 Cmd+D (iOS)
# 4. 选择 "Debug JS Remotely"

# Redux DevTools
# 在Redux中间件中配置
# 可在浏览器中查看状态变化

# React Native Flipper
# 用于网络、数据库、日志调试
```

### 后端调试

```bash
# Django Debug Toolbar
# 在开发环境中显示请求详情

# Django Shell
python manage.py shell

# 数据库查询日志
# 在settings中启用SQL日志

# Celery监控
celery -A backend events
# 或使用Flower
pip install flower
celery -A backend flower
```

---

## 🌐 本地访问地址

| 服务 | 地址 |
|------|------|
| 应用 | http://localhost:8081 (Metro) |
| 后端API | http://localhost:8000 |
| Django Admin | http://localhost:8000/admin |
| Neo4j浏览器 | http://localhost:7474 |
| Flower监控 | http://localhost:5555 |
| API文档 | http://localhost:8000/api/docs |

---

## 📚 文档导航

### 必读文档

1. **项目概览**
   - `README.md` - 项目总体介绍
   - `PROJECT_ANALYSIS.md` - 项目分析报告

2. **开发指南**
   - `Info/开发者总体指南.md` - 开发指南
   - `Info/前端开发手册.md` - 前端开发
   - `backend/README.md` - 后端开发

3. **技术文档**
   - `Info/技术选型.md` - 技术栈说明
   - `TECH_STACK_ANALYSIS.md` - 技术栈详解
   - `docs/ARCHITECTURE.md` - 架构设计

4. **部署文档**
   - `Info/安装和部署指南.md` - 部署指南
   - `Info/开发模式使用说明.md` - 开发模式

### 功能文档

- `Info/功能模块详细说明.md` - 功能说明
- `Info/后端模型详解.md` - 数据模型
- `docs/mongodb-sync.md` - 同步机制
- `docs/offline-sync.md` - 离线支持

---

## 🆘 常见问题

### 前端问题

**Q: Metro服务器无法启动**
```bash
# 清除缓存
yarn clear-cache

# 重新启动
yarn start
```

**Q: 模块找不到**
```bash
# 重新安装依赖
rm -rf node_modules
yarn install-deps-yarn
```

**Q: 应用崩溃**
```bash
# 查看日志
adb logcat (Android)
# 或在Xcode中查看输出
```

### 后端问题

**Q: 数据库连接失败**
```bash
# 检查MongoDB
mongosh

# 检查Neo4j
http://localhost:7474

# 检查Redis
redis-cli ping
```

**Q: API返回401错误**
```bash
# 检查JWT令牌
# 确保令牌未过期
# 检查Authorization头
```

**Q: Celery任务未执行**
```bash
# 检查Celery worker
celery -A backend inspect active

# 查看任务队列
celery -A backend inspect reserved
```

---

## 💡 最佳实践

### 前端开发

1. **组件开发**
   - 使用函数式组件和Hooks
   - 保持组件单一职责
   - 使用TypeScript类型检查

2. **状态管理**
   - 使用Redux Toolkit管理全局状态
   - 使用Context管理主题等局部状态
   - 避免过度使用Redux

3. **性能优化**
   - 使用React.memo避免不必要渲染
   - 使用useCallback缓存函数
   - 使用useMemo缓存计算结果

### 后端开发

1. **API设计**
   - 遵循RESTful规范
   - 使用适当的HTTP状态码
   - 提供清晰的错误信息

2. **数据库**
   - 使用索引优化查询
   - 避免N+1查询问题
   - 使用事务保证数据一致性

3. **异步处理**
   - 使用Celery处理耗时操作
   - 使用缓存减少数据库查询
   - 实现重试机制

---

## 🔗 有用链接

- **项目主页**: https://web-self-iota.vercel.app/
- **GitHub**: https://github.com/QX7274/ZeroIsle_Notes
- **React Native文档**: https://reactnative.dev
- **Django文档**: https://docs.djangoproject.com
- **MongoDB文档**: https://docs.mongodb.com
- **Neo4j文档**: https://neo4j.com/docs

---

**最后更新**: 2025-12-01  
**版本**: 1.0

