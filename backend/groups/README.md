# 群组模块

本目录包含零屿笔记应用的群组功能相关服务，用于支持用户创建和加入群组，进行协作笔记编辑、文件共享和实时交流。

## 目录结构

- **models.py**: 数据模型
  - **Group**: 群组模型，存储群组基本信息
  - **GroupMember**: 群组成员模型，管理成员关系和权限
  - **GroupInvitation**: 群组邀请模型，处理邀请流程
  - **SharedScreen**: 共享屏幕模型，管理屏幕共享会话
- **serializers.py**: 序列化器
  - **GroupSerializer**: 群组序列化器
  - **GroupDetailSerializer**: 群组详情序列化器
  - **GroupMemberSerializer**: 群组成员序列化器
  - **GroupInvitationSerializer**: 群组邀请序列化器
  - **SharedScreenSerializer**: 共享屏幕序列化器
- **views.py**: 视图
  - **GroupViewSet**: 群组视图集，处理群组CRUD操作
  - **GroupInvitationViewSet**: 群组邀请视图集，处理邀请操作
  - **SharedScreenViewSet**: 共享屏幕视图集，处理屏幕共享
- **urls.py**: URL配置，定义API路由
- **consumers.py**: WebSocket消费者，处理实时通信
- **routing.py**: WebSocket路由配置
- **permissions.py**: 自定义权限类，控制访问权限
- **apps.py**: 应用配置

## 主要功能

### 群组管理

群组模块提供群组管理功能，支持以下特性：

- **群组创建**: 创建新的群组，设置名称和描述
- **群组编辑**: 编辑现有群组的信息和设置
- **群组删除**: 删除不再需要的群组
- **群组查询**: 查询和筛选群组
- **群组详情**: 获取群组的详细信息
- **群组统计**: 获取群组的统计信息（成员数量等）
- **群组设置**: 管理群组的各种设置

### 成员管理

群组模块提供成员管理功能，支持以下特性：

- **成员添加**: 添加新成员到群组
- **成员移除**: 从群组中移除成员
- **角色管理**: 设置和管理成员角色（管理员、普通成员）
- **权限控制**: 基于角色的权限控制
- **成员查询**: 查询和筛选群组成员
- **成员详情**: 获取成员的详细信息
- **活跃状态**: 跟踪成员的活跃状态

### 邀请系统

群组模块提供邀请系统，支持以下特性：

- **邀请发送**: 向用户发送加入群组的邀请
- **邀请接受**: 接受群组邀请
- **邀请拒绝**: 拒绝群组邀请
- **邀请过期**: 处理过期的邀请
- **邀请查询**: 查询和筛选收到的邀请
- **邀请撤销**: 撤销已发送的邀请
- **批量邀请**: 批量邀请多个用户

### 加入码系统

群组模块提供加入码系统，支持以下特性：

- **加入码生成**: 生成用于加入群组的短码
- **加入码验证**: 验证加入码的有效性
- **加入码过期**: 设置加入码的过期时间
- **通过加入码加入**: 使用加入码加入群组
- **加入码刷新**: 刷新或重新生成加入码
- **加入码禁用**: 禁用现有的加入码
- **加入码权限**: 控制谁可以生成加入码

### 屏幕共享

群组模块提供屏幕共享功能，支持以下特性：

- **共享创建**: 创建新的屏幕共享会话
- **共享加入**: 加入现有的屏幕共享会话
- **共享结束**: 结束屏幕共享会话
- **共享状态**: 跟踪共享会话的状态
- **WebRTC集成**: 与WebRTC技术集成，实现实时屏幕共享
- **权限控制**: 控制谁可以共享和查看屏幕
- **聊天集成**: 与实时聊天功能集成

### 实时通信

群组模块提供实时通信功能，支持以下特性：

- **WebSocket连接**: 建立WebSocket连接，实现实时通信
- **信令服务**: 为WebRTC提供信令服务
- **消息广播**: 向群组成员广播消息
- **状态同步**: 同步群组和成员状态
- **在线状态**: 跟踪成员的在线状态
- **连接管理**: 管理WebSocket连接的生命周期
- **认证集成**: 与用户认证系统集成

## API端点

群组模块提供以下主要API端点：

- **群组API**:
  - `GET /api/groups/`: 获取群组列表
  - `POST /api/groups/`: 创建新群组
  - `GET /api/groups/{id}/`: 获取特定群组详情
  - `PUT /api/groups/{id}/`: 更新群组
  - `DELETE /api/groups/{id}/`: 删除群组
  - `POST /api/groups/{id}/generate_join_code/`: 生成加入码
  - `POST /api/groups/join_by_code/`: 通过加入码加入群组
  - `POST /api/groups/{id}/invite/`: 邀请用户加入群组
  - `GET /api/groups/{id}/members/`: 获取群组成员列表

- **邀请API**:
  - `GET /api/invitations/`: 获取邀请列表
  - `GET /api/invitations/{id}/`: 获取特定邀请详情
  - `POST /api/invitations/{id}/accept/`: 接受邀请
  - `POST /api/invitations/{id}/reject/`: 拒绝邀请

- **共享屏幕API**:
  - `GET /api/shared-screens/`: 获取共享屏幕列表
  - `POST /api/shared-screens/`: 创建新共享屏幕
  - `GET /api/shared-screens/{id}/`: 获取特定共享屏幕详情
  - `PUT /api/shared-screens/{id}/`: 更新共享屏幕
  - `DELETE /api/shared-screens/{id}/`: 删除共享屏幕
  - `POST /api/shared-screens/{id}/end/`: 结束共享屏幕
  - `GET /api/shared-screens/{id}/join/`: 加入共享屏幕

## WebSocket端点

群组模块提供以下WebSocket端点：

- **WebRTC信令**:
  - `ws/webrtc/{room_id}/`: WebRTC信令服务，用于屏幕共享

## 数据模型

### 群组模型 (Group)

```python
class Group(models.Model):
    """群组模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='群组ID')
    name = models.CharField(max_length=100, verbose_name='群组名称')
    description = models.TextField(blank=True, null=True, verbose_name='群组描述')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_groups', verbose_name='创建者')
    join_code = models.CharField(max_length=4, blank=True, null=True, verbose_name='加入码')
    join_code_expires_at = models.DateTimeField(blank=True, null=True, verbose_name='加入码过期时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')
```

### 群组成员模型 (GroupMember)

```python
class GroupMember(models.Model):
    """群组成员模型"""
    ROLE_CHOICES = (
        ('admin', '管理员'),
        ('member', '成员'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='成员ID')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members', verbose_name='群组')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships', verbose_name='用户')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member', verbose_name='角色')
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='加入时间')
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')
```

### 群组邀请模型 (GroupInvitation)

```python
class GroupInvitation(models.Model):
    """群组邀请模型"""
    STATUS_CHOICES = (
        ('pending', '待处理'),
        ('accepted', '已接受'),
        ('rejected', '已拒绝'),
        ('expired', '已过期'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='邀请ID')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='invitations', verbose_name='群组')
    inviter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invitations', verbose_name='邀请人')
    invitee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_invitations', verbose_name='被邀请人')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    expires_at = models.DateTimeField(verbose_name='过期时间')
    responded_at = models.DateTimeField(blank=True, null=True, verbose_name='响应时间')
```

## 与其他模块的交互

群组模块与以下模块有交互：

- **用户模块**: 获取用户信息，管理用户权限
- **笔记模块**: 共享笔记，协作编辑
- **通知模块**: 发送群组相关通知
- **文件模块**: 共享文件和资源
- **聊天模块**: 群组内实时聊天
- **活动模块**: 记录群组活动
- **搜索模块**: 搜索群组和成员

## 注意事项

- **权限控制**: 确保只有有权限的用户可以执行特定操作
- **实时性能**: 优化WebSocket通信，确保实时功能的性能
- **并发处理**: 妥善处理多用户并发操作的情况
- **数据一致性**: 确保群组数据的一致性，特别是在成员变更时
- **安全性**: 防止未授权访问和操作
- **可扩展性**: 设计可扩展的架构，支持大量群组和成员
- **用户体验**: 提供流畅的群组交互体验
