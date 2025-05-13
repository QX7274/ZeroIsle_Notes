# 用户模块

本目录包含零屿笔记应用的用户认证和管理功能相关服务，用于处理用户注册、登录、身份验证和用户信息管理。

## 目录结构

- **mongodb_models.py**: MongoDB文档模型
  - **User**: 用户模型，核心用户数据
  - **UserProfile**: 用户资料模型，详细信息
  - **UserSettings**: 用户设置模型，个性化设置
  - **VerificationCode**: 验证码模型，验证码记录
- **auth.py**: 自定义认证后端
  - **MongoDBUserBackend**: MongoDB用户认证后端
- **serializers/**: 序列化器
  - **user.py**: 用户序列化器
  - **auth.py**: 认证序列化器，登录注册
  - **profile.py**: 资料序列化器
  - **settings.py**: 设置序列化器
  - **device.py**: 设备序列化器
  - **verification.py**: 验证码序列化器
  - **third_party.py**: 第三方账号序列化器
- **views/**: 视图
  - **auth.py**: 认证视图，登录注册
  - **user.py**: 用户视图，用户管理
  - **profile.py**: 资料视图，资料管理
  - **settings.py**: 设置视图，设置管理
  - **device.py**: 设备视图，设备管理
  - **verification.py**: 验证码视图，验证码管理
  - **third_party.py**: 第三方账号视图，社交登录
  - **mongo_auth.py**: MongoDB认证视图，使用MongoDB存储
  - **password_reset_api.py**: 密码重置API视图
- **services/**: 业务逻辑
  - **auth_service.py**: 认证服务，处理认证逻辑
  - **user_service.py**: 用户服务，处理用户管理
  - **email_service.py**: 邮件服务，发送邮件
  - **sms_service.py**: 短信服务，发送短信
  - **notification_service.py**: 通知服务，用户通知
  - **third_party_service.py**: 第三方服务，处理社交登录
- **tests/**: 测试
  - **test_models.py**: 模型测试
  - **test_views.py**: 视图测试
  - **test_services.py**: 服务测试
  - **test_serializers.py**: 序列化器测试

## 主要功能

### 用户认证

用户模块提供用户认证功能，支持以下特性：

- **用户注册**: 支持用户名、邮箱、手机号注册
- **用户登录**: 支持用户名、邮箱、手机号登录
- **密码管理**: 密码加密存储、修改和重置
- **JWT认证**: 使用JWT令牌进行身份验证
- **令牌刷新**: 支持令牌刷新，延长会话时间
- **会话管理**: 管理用户会话，支持多设备登录
- **登出功能**: 支持用户登出，清除会话

### 第三方登录

用户模块提供第三方登录功能，支持以下特性：

- **微信登录**: 支持微信账号登录
- **QQ登录**: 支持QQ账号登录
- **微博登录**: 支持微博账号登录
- **GitHub登录**: 支持GitHub账号登录
- **Google登录**: 支持Google账号登录
- **账号绑定**: 将第三方账号绑定到现有账号
- **账号解绑**: 解除第三方账号的绑定

### 用户资料

用户模块提供用户资料功能，支持以下特性：

- **基本资料**: 管理用户的基本资料（姓名、头像等）
- **详细资料**: 管理用户的详细资料（生日、性别等）
- **联系方式**: 管理用户的联系方式（邮箱、手机等）
- **资料验证**: 验证用户提供的资料（如邮箱验证）
- **头像管理**: 上传、裁剪和删除头像
- **资料隐私**: 控制资料的可见性

### 用户设置

用户模块提供用户设置功能，支持以下特性：

- **应用设置**: 管理应用的全局设置
- **通知设置**: 管理通知的接收方式和频率
- **隐私设置**: 管理隐私相关的设置
- **安全设置**: 管理账号安全相关的设置
- **同步设置**: 管理数据同步相关的设置
- **主题设置**: 管理应用的主题和外观

### 设备管理

用户模块提供设备管理功能，支持以下特性：

- **设备列表**: 查看已登录的设备列表
- **设备详情**: 查看设备的详细信息
- **设备登出**: 从特定设备登出
- **设备验证**: 验证新设备的登录
- **可疑活动**: 检测和通知可疑的登录活动
- **设备限制**: 限制同时登录的设备数量

### 验证码管理

用户模块提供验证码管理功能，支持以下特性：

- **邮箱验证码**: 发送和验证邮箱验证码
- **短信验证码**: 发送和验证短信验证码
- **验证码生成**: 生成安全的验证码
- **验证码过期**: 管理验证码的有效期
- **验证码限制**: 限制验证码的发送频率
- **验证码日志**: 记录验证码的发送和验证情况

## API端点

用户模块提供以下主要API端点：

- **认证API**:
  - `POST /api/auth/register/`: 用户注册
  - `POST /api/auth/login/`: 用户登录
  - `POST /api/auth/logout/`: 用户登出
  - `POST /api/auth/token/refresh/`: 刷新令牌
  - `POST /api/auth/password/change/`: 修改密码
  - `POST /api/auth/password/reset/`: 重置密码
  - `POST /api/auth/password/reset/confirm/`: 确认密码重置
  - `POST /api/auth/email/verify/`: 验证邮箱
  - `POST /api/auth/phone/verify/`: 验证手机号

- **第三方登录API**:
  - `POST /api/auth/third-party/wechat/`: 微信登录
  - `POST /api/auth/third-party/qq/`: QQ登录
  - `POST /api/auth/third-party/weibo/`: 微博登录
  - `POST /api/auth/third-party/github/`: GitHub登录
  - `POST /api/auth/third-party/google/`: Google登录
  - `POST /api/auth/third-party/bind/`: 绑定第三方账号
  - `POST /api/auth/third-party/unbind/`: 解绑第三方账号

- **用户API**:
  - `GET /api/users/me/`: 获取当前用户信息
  - `PUT /api/users/me/`: 更新当前用户信息
  - `GET /api/users/{id}/`: 获取特定用户信息
  - `PUT /api/users/{id}/`: 更新特定用户信息
  - `DELETE /api/users/{id}/`: 删除用户

- **资料API**:
  - `GET /api/users/profiles/me/`: 获取当前用户资料
  - `PUT /api/users/profiles/me/`: 更新当前用户资料
  - `POST /api/users/profiles/me/avatar/`: 上传头像
  - `DELETE /api/users/profiles/me/avatar/`: 删除头像

- **设置API**:
  - `GET /api/users/settings/`: 获取用户设置
  - `PUT /api/users/settings/`: 更新用户设置
  - `GET /api/users/settings/{category}/`: 获取特定类别的设置
  - `PUT /api/users/settings/{category}/`: 更新特定类别的设置

- **设备API**:
  - `GET /api/users/devices/`: 获取设备列表
  - `GET /api/users/devices/{id}/`: 获取特定设备详情
  - `DELETE /api/users/devices/{id}/`: 从特定设备登出
  - `POST /api/users/devices/logout-all/`: 从所有设备登出

- **验证码API**:
  - `POST /api/auth/verification-code/email/`: 发送邮箱验证码
  - `POST /api/auth/verification-code/sms/`: 发送短信验证码
  - `POST /api/auth/verification-code/verify/`: 验证验证码

## 数据模型

### 用户模型 (User)

```python
class User(Document):
    """
    用户文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='用户ID')
    username = StringField(max_length=150, required=True, unique=True, verbose_name='用户名')
    email = EmailField(sparse=True, required=False, verbose_name='邮箱地址')
    phone = StringField(max_length=20, sparse=True, verbose_name='手机号')
    password = StringField(required=True, verbose_name='密码哈希')
    first_name = StringField(max_length=30, default='', verbose_name='名')
    last_name = StringField(max_length=150, default='', verbose_name='姓')
    nickname = StringField(max_length=50, default='', verbose_name='昵称')
    avatar = URLField(verbose_name='头像URL')
    bio = StringField(max_length=500, verbose_name='个人简介')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    is_staff = BooleanField(default=False, verbose_name='是否员工')
    is_superuser = BooleanField(default=False, verbose_name='是否超级用户')
    is_verified = BooleanField(default=False, verbose_name='是否验证')
    last_login = DateTimeField(verbose_name='最后登录时间')
    last_login_ip = StringField(max_length=100, verbose_name='最后登录IP')
    date_joined = DateTimeField(default=timezone.now, verbose_name='注册时间')

    # MongoDB Realm相关字段
    realm_id = StringField(max_length=100, sparse=True, verbose_name='Realm ID')
    realm_api_key = StringField(max_length=100, sparse=True, verbose_name='Realm API Key')
    realm_app_id = StringField(max_length=100, sparse=True, verbose_name='Realm App ID')
    realm_sync_enabled = BooleanField(default=True, verbose_name='是否启用Realm同步')
    realm_last_sync_time = DateTimeField(verbose_name='最后同步时间')
```

### 用户资料模型 (UserProfile)

```python
class UserProfile(Document):
    """
    用户资料文档模型
    """
    user = ReferenceField(User, required=True, unique=True, verbose_name='用户')
    nickname = StringField(max_length=50, verbose_name='昵称')
    gender = StringField(max_length=10, choices=('male', 'female', 'other', 'unknown'), default='unknown', verbose_name='性别')
    birthday = DateTimeField(verbose_name='生日')
    location = StringField(max_length=100, verbose_name='位置')
    website = URLField(verbose_name='个人网站')
    social_links = DictField(verbose_name='社交链接')
    education = ListField(DictField(), verbose_name='教育经历')
    work = ListField(DictField(), verbose_name='工作经历')
    skills = ListField(StringField(), verbose_name='技能')
    interests = ListField(StringField(), verbose_name='兴趣')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
```

### 用户设置模型 (UserSettings)

```python
class UserSettings(Document):
    """
    用户设置文档模型
    """
    user = ReferenceField(User, required=True, unique=True, verbose_name='用户')
    theme = StringField(max_length=20, default='system', verbose_name='主题')
    font_size = StringField(max_length=20, default='medium', verbose_name='字体大小')
    language = StringField(max_length=10, default='zh-CN', verbose_name='语言')
    notification_enabled = BooleanField(default=True, verbose_name='是否启用通知')
    email_notification = BooleanField(default=True, verbose_name='是否启用邮件通知')
    auto_save = BooleanField(default=True, verbose_name='是否自动保存')
    auto_save_interval = IntField(default=60, verbose_name='自动保存间隔(秒)')
    offline_mode = BooleanField(default=False, verbose_name='是否启用离线模式')
    handwriting_recognition_mode = StringField(max_length=20, default='realtime', verbose_name='手写识别模式')
    ai_assistant_enabled = BooleanField(default=True, verbose_name='是否启用AI助手')
    ai_assistant_model = StringField(max_length=50, default='gpt-3.5-turbo', verbose_name='AI助手模型')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
```

### 验证码模型 (VerificationCode)

```python
class VerificationCode(Document):
    """
    验证码文档模型
    """
    user = ReferenceField(User, required=False, verbose_name='用户')
    email = EmailField(sparse=True, verbose_name='邮箱地址')
    phone = StringField(max_length=20, sparse=True, verbose_name='手机号')
    code = StringField(max_length=10, required=True, verbose_name='验证码')
    purpose = StringField(max_length=20, required=True, verbose_name='用途')
    expires_at = DateTimeField(required=True, verbose_name='过期时间')
    is_used = BooleanField(default=False, verbose_name='是否已使用')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
```

## 与其他模块的交互

用户模块与以下模块有交互：

- **笔记模块**: 管理用户的笔记访问权限
- **知识图谱模块**: 管理用户的知识图谱访问权限
- **社区模块**: 提供用户资料和权限信息
- **通知模块**: 发送用户相关的通知
- **存储模块**: 管理用户数据和文件的存储
- **MongoDB Realm**: 同步用户信息到本地存储

## 注意事项

- **数据安全**: 确保用户数据的安全存储和传输，特别是密码和个人信息
- **隐私保护**: 保护用户隐私，遵循相关法规
- **身份验证**: 实施强健的身份验证机制，防止未授权访问
- **密码策略**: 实施安全的密码策略，如最小长度、复杂度要求等
- **账号恢复**: 提供安全的账号恢复机制，如密码重置
- **登录限制**: 实施登录尝试限制，防止暴力破解
- **会话管理**: 妥善管理用户会话，包括超时和失效处理
- **第三方集成**: 安全地处理第三方登录集成
- **用户体验**: 提供流畅的注册和登录体验，减少摩擦
- **MongoDB同步**: 确保用户数据在MongoDB Atlas和MongoDB Realm之间正确同步
- **离线支持**: 支持离线访问用户数据，确保应用在无网络环境下仍能正常工作
