# 零屿笔记管理系统后端

零屿笔记管理系统后端是基于Django和Django REST Framework开发的RESTful API服务，为管理系统提供数据支持。

## 技术栈

- Django 5.2
- Django REST Framework 3.16.0
- JWT认证
- MongoDB

## 安装与运行

### 安装依赖

```bash
# 进入后端目录
cd admin_system/backend

# 安装依赖
pip install -r requirements.txt
```

### 初始化数据库

```bash
# 创建数据库迁移
python manage.py makemigrations

# 应用迁移
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser
```

### 运行开发服务器

```bash
# 启动开发服务器
python manage.py runserver
```

服务器将在 http://localhost:8000 上运行。

## API文档

API文档可通过以下URL访问：

```
http://localhost:8000/api/docs/
```

## 主要API端点

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

## 目录结构

```
backend/
├── admin_backend/        # 项目配置
│   ├── settings.py       # 项目设置
│   ├── urls.py           # 主URL配置
│   └── ...
├── auth_api/             # 认证模块
├── users/                # 用户管理模块
├── content/              # 内容管理模块
├── settings_api/         # 系统设置模块
├── logs/                 # 日志模块
├── manage.py             # Django管理脚本
└── requirements.txt      # 依赖列表
```
