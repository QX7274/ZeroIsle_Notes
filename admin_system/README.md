# 零屿笔记管理系统

零屿笔记管理系统是一个独立的管理工具，用于管理零屿笔记应用的用户、内容和系统设置。它提供了一个功能完善、界面美观的Web管理界面，方便管理员进行各种操作。

## 系统架构

管理系统由以下两个主要部分组成：

1. **后端 (Backend)**：基于Django和Django REST Framework的RESTful API服务
2. **Web前端 (Frontend)**：基于React和Ant Design的Web管理界面

## 功能特性

- **仪表盘**：系统概览和实时数据统计，包括用户增长、内容分布和系统状态监控
- **用户管理**：查看、编辑、禁用用户账号，管理用户权限和角色
- **内容管理**：管理笔记、分类、标签等内容，支持批量操作和内容审核
- **系统设置**：配置系统参数、功能开关、安全设置、管理员管理、系统公告和备份恢复
- **数据同步**：与主应用进行数据同步，支持增量同步和全量同步
- **数据统计**：用户增长、内容创建等数据分析，支持多种图表展示
- **操作日志**：记录管理员的操作历史，支持筛选和导出
- **系统公告**：发布和管理系统公告，支持定时发布和过期设置

## 安装与运行

### 后端

```bash
# 进入后端目录
cd admin_system/backend

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python manage.py makemigrations
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser

# 启动开发服务器
python manage.py runserver
```

### Web前端

```bash
# 进入前端目录
cd admin_system/frontend

# 安装依赖
yarn

# 启动开发服务器
yarn start
```



## 技术栈

### 后端
- **Django**：Web服务框架
- **Django REST Framework**：RESTful API框架
- **MongoDB**：数据库（通过mongoengine连接）
- **JWT**：身份验证（通过djangorestframework-simplejwt实现）
- **Celery**：异步任务队列（用于备份、报表生成等）
- **Redis**：缓存和消息队列

### Web前端
- **React**：UI库
- **Ant Design**：组件库
- **React Router**：路由管理
- **Axios**：HTTP客户端
- **ECharts**：数据可视化
- **Day.js**：日期处理
- **CSS-in-JS**：样式管理


## 目录结构

```
admin_system/
├── backend/                # 后端代码
│   ├── admin_backend/      # 项目配置
│   │   ├── settings.py     # 项目设置
│   │   ├── urls.py         # 主URL配置
│   │   └── ...
│   ├── auth_api/           # 认证模块
│   ├── users/              # 用户管理模块
│   ├── content/            # 内容管理模块
│   ├── settings_api/       # 系统设置模块
│   ├── logs/               # 日志模块
│   ├── sync/               # 数据同步模块
│   ├── manage.py           # Django管理脚本
│   └── requirements.txt    # 依赖列表
├── frontend/               # Web前端代码
│   ├── public/             # 静态资源
│   ├── src/                # 源代码
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API服务
│   │   ├── utils/          # 工具函数
│   │   ├── styles/         # 样式文件
│   │   ├── App.js          # 主应用组件
│   │   └── index.js        # 入口文件
│   └── package.json        # 依赖配置
```

## 开发指南

### 设计原则

1. **简洁直观**：界面设计简洁明了，操作直观易懂
2. **响应式设计**：适配不同尺寸的屏幕和设备
3. **一致性**：保持视觉和交互的一致性
4. **性能优化**：减少加载时间，优化用户体验
5. **安全性**：保护敏感数据，防止未授权访问

### API文档

API文档可在开发环境中访问：

```
http://localhost:8000/api/docs/
```

### 前端开发规范

1. 组件化开发，遵循单一职责原则
2. 使用TypeScript进行类型检查
3. 使用ESLint和Prettier保持代码风格一致
4. 编写单元测试和集成测试

### 主要API端点

- 认证相关: `/api/auth/`
  - 登录: `/api/auth/login/`
  - 登出: `/api/auth/logout/`
  - 检查认证状态: `/api/auth/check/`
  - 修改密码: `/api/auth/password/`

- 用户管理: `/api/users/`
  - 用户资料: `/api/users/profiles/`
  - 用户统计: `/api/users/profiles/stats/`

- 内容管理: `/api/content/`
  - 笔记分类: `/api/content/categories/`
  - 标签: `/api/content/tags/`
  - 内容举报: `/api/content/reports/`

- 系统设置: `/api/settings/`
  - 系统配置: `/api/settings/system/`
  - 系统公告: `/api/settings/announcements/`

- 日志管理: `/api/logs/`
  - 操作日志: `/api/logs/operations/`
  - 系统日志: `/api/logs/system/`

- 数据同步: `/api/sync/`
  - 同步记录: `/api/sync/records/`
  - 同步配置: `/api/sync/configs/`
  - 执行同步: `/api/sync/records/execute/`
  - 同步状态: `/api/sync/records/status/`

## 最近更新

### 2023年6月更新
- 全新的仪表盘设计，提供更直观的数据展示
- 优化系统设置界面，增强用户体验
- 改进主题和样式系统，支持自定义主题
- 完善API接口，提高前后端交互效率
- 增强系统安全性，优化权限管理
- 新增数据同步功能，支持与主应用数据同步
- 优化MongoDB连接和数据访问，提高性能

## 贡献指南

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

