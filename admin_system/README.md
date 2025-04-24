# 零屿笔记管理系统

零屿笔记管理系统是一个独立的管理工具，用于管理零屿笔记应用的用户、内容和系统设置。它提供了一个功能完善的Web管理界面，方便管理员进行各种操作。

## 系统架构

管理系统由以下两个主要部分组成：

1. **后端 (Backend)**：基于Django和Django REST Framework的RESTful API服务
2. **Web前端 (Frontend)**：基于React和Ant Design的Web管理界面

## 功能特性

- 用户管理：查看、编辑、禁用用户账号
- 内容管理：管理笔记、分类、标签等内容
- 系统设置：配置系统参数、功能开关等
- 数据统计：用户增长、内容创建等数据分析
- 操作日志：记录管理员的操作历史
- 系统公告：发布和管理系统公告

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
- Django：Web服务框架
- Django REST Framework：RESTful API框架
- MongoDB：数据库（通过mongoengine连接）
- JWT：身份验证（通过djangorestframework-simplejwt实现）

### Web前端
- React：UI库
- Ant Design：组件库
- React Router：路由管理
- Axios：HTTP客户端
- ECharts：数据可视化


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

### API文档

API文档可在开发环境中访问：

```
http://localhost:8000/api/docs/
```

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

## 贡献指南

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开一个 Pull Request

## 许可证

[MIT](LICENSE)
