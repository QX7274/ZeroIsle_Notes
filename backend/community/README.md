# 社区模块

本目录包含零屿笔记应用的社区功能相关服务，用于提供用户交流、分享笔记、点赞、评论等社交功能。

## 目录结构

- **models/**: 数据模型
  - **category.py**: 分类模型，内容分类
  - **comment.py**: 评论模型，用户评论
  - **follow.py**: 关注模型，用户关系
  - **like.py**: 点赞模型，内容互动
  - **notification.py**: 通知模型，用户通知
  - **post.py**: 帖子模型，用户发布内容
  - **tag.py**: 标签模型，内容标签
- **serializers/**: 序列化器
  - **category.py**: 分类序列化器
  - **comment.py**: 评论序列化器
  - **follow.py**: 关注序列化器
  - **like.py**: 点赞序列化器
  - **notification.py**: 通知序列化器
  - **post.py**: 帖子序列化器
  - **tag.py**: 标签序列化器
- **views/**: 视图
  - **category.py**: 分类视图
  - **comment.py**: 评论视图
  - **follow.py**: 关注视图
  - **like.py**: 点赞视图
  - **notification.py**: 通知视图
  - **post.py**: 帖子视图
  - **tag.py**: 标签视图
  - **activity.py**: 活动视图，用户活动流
  - **trending.py**: 热门视图，热门内容
  - **recommendation.py**: 推荐视图，内容推荐
- **services/**: 业务逻辑
  - **comment_service.py**: 评论服务
  - **follow_service.py**: 关注服务
  - **like_service.py**: 点赞服务
  - **notification_service.py**: 通知服务
  - **post_service.py**: 帖子服务
  - **activity_service.py**: 活动服务
  - **trending_service.py**: 热门服务
  - **recommendation_service.py**: 推荐服务
  - **moderation_service.py**: 内容审核服务
- **fixtures/**: 初始数据
  - **categories.json**: 分类数据
  - **tags.json**: 标签数据
- **utils/**: 工具函数
  - **content_utils.py**: 内容处理工具
  - **notification_utils.py**: 通知工具
  - **recommendation_utils.py**: 推荐算法工具
  - **trending_utils.py**: 热门算法工具

## 主要功能

### 内容发布与管理

社区模块提供内容发布与管理功能，支持以下特性：

- **帖子发布**: 发布文本、图片等内容
- **帖子编辑**: 编辑已发布的内容
- **帖子删除**: 删除不再需要的内容
- **内容分类**: 对内容进行分类
- **内容标签**: 为内容添加标签
- **内容格式化**: 支持富文本、Markdown等格式
- **内容审核**: 自动和人工审核内容

### 互动功能

社区模块提供互动功能，支持以下特性：

- **点赞**: 对内容进行点赞
- **评论**: 发表评论和回复
- **收藏**: 收藏感兴趣的内容
- **分享**: 分享内容到外部平台
- **举报**: 举报不当内容
- **投票**: 对内容进行投票
- **表情反应**: 使用表情表达反应

### 用户关系

社区模块提供用户关系功能，支持以下特性：

- **关注用户**: 关注感兴趣的用户
- **粉丝管理**: 查看和管理粉丝
- **用户屏蔽**: 屏蔽不想看到的用户
- **用户推荐**: 推荐可能感兴趣的用户
- **关系图谱**: 可视化用户关系网络
- **共同关注**: 查看与其他用户的共同关注
- **关注分组**: 将关注的用户分组管理

### 通知系统

社区模块提供通知系统，支持以下特性：

- **互动通知**: 点赞、评论、关注等互动的通知
- **内容更新**: 关注的用户或内容更新的通知
- **系统通知**: 系统公告和重要信息的通知
- **通知设置**: 自定义通知的接收方式和频率
- **通知管理**: 标记已读、删除通知等
- **通知汇总**: 定期汇总通知
- **实时通知**: 通过WebSocket实时推送通知

### 内容发现

社区模块提供内容发现功能，支持以下特性：

- **热门内容**: 展示热门和趋势内容
- **推荐内容**: 基于用户兴趣推荐内容
- **最新内容**: 展示最新发布的内容
- **相关内容**: 展示与当前内容相关的其他内容
- **话题探索**: 探索特定话题的内容
- **内容搜索**: 搜索社区内容
- **内容过滤**: 根据各种条件过滤内容

### 活动流

社区模块提供活动流功能，支持以下特性：

- **用户活动**: 显示用户的活动历史
- **关注活动**: 显示关注用户的活动
- **社区活动**: 显示整个社区的活动
- **活动过滤**: 根据活动类型过滤活动
- **活动通知**: 接收活动的通知
- **活动统计**: 统计活动数据
- **活动时间线**: 按时间顺序展示活动

## API端点

社区模块提供以下主要API端点：

- **帖子API**:
  - `GET /api/community/posts/`: 获取帖子列表
  - `POST /api/community/posts/`: 创建新帖子
  - `GET /api/community/posts/{id}/`: 获取特定帖子详情
  - `PUT /api/community/posts/{id}/`: 更新帖子
  - `DELETE /api/community/posts/{id}/`: 删除帖子
  - `GET /api/community/posts/trending/`: 获取热门帖子
  - `GET /api/community/posts/recommended/`: 获取推荐帖子
  - `GET /api/community/users/{id}/posts/`: 获取用户的帖子

- **评论API**:
  - `GET /api/community/posts/{id}/comments/`: 获取帖子评论
  - `POST /api/community/posts/{id}/comments/`: 发表评论
  - `GET /api/community/comments/{id}/`: 获取特定评论详情
  - `PUT /api/community/comments/{id}/`: 更新评论
  - `DELETE /api/community/comments/{id}/`: 删除评论
  - `POST /api/community/comments/{id}/reply/`: 回复评论

- **互动API**:
  - `POST /api/community/posts/{id}/like/`: 点赞帖子
  - `DELETE /api/community/posts/{id}/like/`: 取消点赞
  - `POST /api/community/posts/{id}/bookmark/`: 收藏帖子
  - `DELETE /api/community/posts/{id}/bookmark/`: 取消收藏
  - `POST /api/community/posts/{id}/report/`: 举报帖子
  - `POST /api/community/comments/{id}/like/`: 点赞评论
  - `DELETE /api/community/comments/{id}/like/`: 取消点赞评论

- **关注API**:
  - `POST /api/community/users/{id}/follow/`: 关注用户
  - `DELETE /api/community/users/{id}/follow/`: 取消关注
  - `GET /api/community/users/{id}/followers/`: 获取用户的粉丝
  - `GET /api/community/users/{id}/following/`: 获取用户关注的人
  - `GET /api/community/users/{id}/common-following/`: 获取共同关注
  - `POST /api/community/users/{id}/block/`: 屏蔽用户
  - `DELETE /api/community/users/{id}/block/`: 取消屏蔽

- **通知API**:
  - `GET /api/community/notifications/`: 获取通知列表
  - `GET /api/community/notifications/{id}/`: 获取特定通知详情
  - `PUT /api/community/notifications/{id}/read/`: 标记通知为已读
  - `PUT /api/community/notifications/read-all/`: 标记所有通知为已读
  - `DELETE /api/community/notifications/{id}/`: 删除通知
  - `GET /api/community/notifications/settings/`: 获取通知设置
  - `PUT /api/community/notifications/settings/`: 更新通知设置

- **活动API**:
  - `GET /api/community/activity/`: 获取活动流
  - `GET /api/community/activity/following/`: 获取关注用户的活动
  - `GET /api/community/activity/user/{id}/`: 获取特定用户的活动
  - `GET /api/community/activity/stats/`: 获取活动统计

## 数据模型

### 帖子模型 (Post)

```python
class Post(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    title = StringField(max_length=255, required=True)
    content = StringField(required=True)
    format = StringField(choices=['text', 'markdown', 'html'], default='markdown')
    category = ReferenceField('Category')
    tags = ListField(ReferenceField('Tag'))
    images = ListField(StringField())
    likes_count = IntField(default=0)
    comments_count = IntField(default=0)
    views_count = IntField(default=0)
    bookmarks_count = IntField(default=0)
    is_pinned = BooleanField(default=False)
    is_featured = BooleanField(default=False)
    is_hidden = BooleanField(default=False)
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
    metadata = DictField()
```

### 评论模型 (Comment)

```python
class Comment(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    post = ReferenceField(Post, required=True)
    parent = ReferenceField('self')
    content = StringField(required=True)
    likes_count = IntField(default=0)
    is_hidden = BooleanField(default=False)
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 关注模型 (Follow)

```python
class Follow(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    follower = ReferenceField(User, required=True)
    following = ReferenceField(User, required=True)
    created_at = DateTimeField(default=timezone.now)
    meta = {
        'indexes': [
            {'fields': ['follower', 'following'], 'unique': True}
        ]
    }
```

## 与其他模块的交互

社区模块与以下模块有交互：

- **用户模块**: 管理用户的社区权限和资料
- **笔记模块**: 将笔记分享到社区，或将社区内容保存为笔记
- **通知模块**: 发送社区活动的通知
- **搜索模块**: 提供社区内容的搜索功能
- **AI助手模块**: 分析社区内容，提供智能建议

## 配置说明

社区模块需要以下配置：

- **内容限制**: 帖子长度、图片大小等限制
- **互动设置**: 点赞、评论等互动功能的设置
- **通知设置**: 通知的默认设置
- **审核设置**: 内容审核的规则和流程
- **推荐设置**: 内容推荐算法的参数

## 注意事项

- **内容审核**: 实施有效的内容审核机制，防止不当内容
- **用户隐私**: 保护用户隐私，遵循相关法规
- **性能优化**: 优化大量内容和互动的处理性能
- **实时性**: 确保通知和活动流的实时性
- **冷启动**: 解决社区初期内容少的冷启动问题
- **用户体验**: 提供友好的界面和交互，促进用户参与
- **社区规范**: 制定和执行明确的社区规范，维护健康的社区环境
