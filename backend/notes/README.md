# 笔记模块

本目录包含零屿笔记应用的笔记核心功能相关服务，用于管理笔记的创建、编辑、组织和同步。

## 目录结构

- **mongodb_models.py**: MongoDB文档模型定义
  - 使用MongoEngine ODM定义MongoDB文档模型
  - 包含笔记、分类、标签等模型定义
- **serializers/**: 序列化器
  - **note.py**: 笔记序列化器
  - **note_category.py**: 笔记分类序列化器
  - **note_tag.py**: 笔记标签序列化器
  - **note_version.py**: 笔记版本序列化器
  - **attachment.py**: 附件序列化器
  - **favorite.py**: 收藏序列化器
  - **share.py**: 分享序列化器
- **views/**: 视图
  - **note.py**: 笔记视图，CRUD操作
  - **note_category.py**: 笔记分类视图
  - **note_tag.py**: 笔记标签视图
  - **note_version.py**: 笔记版本视图
  - **attachment.py**: 附件视图
  - **favorite.py**: 收藏视图
  - **share.py**: 分享视图
  - **sync.py**: 同步视图，处理同步请求
  - **import_export.py**: 导入导出视图
- **services/**: 业务逻辑
  - **note_service.py**: 笔记服务，核心业务逻辑
  - **export_service.py**: 导出服务，导出不同格式
  - **import_service.py**: 导入服务，导入不同格式
  - **sync_service.py**: 同步服务，处理同步逻辑
  - **version_service.py**: 版本服务，管理版本历史
  - **attachment_service.py**: 附件服务，处理附件
  - **share_service.py**: 分享服务，处理分享逻辑
- **tests/**: 测试
  - **test_models.py**: 模型测试
  - **test_views.py**: 视图测试
  - **test_services.py**: 服务测试
  - **test_serializers.py**: 序列化器测试

## 主要功能

### 笔记管理

笔记模块提供笔记管理功能，支持以下特性：

- **笔记创建**: 创建新的笔记，支持多种格式（文本、Markdown、富文本等）
- **笔记编辑**: 编辑现有笔记的内容和属性
- **笔记删除**: 删除不再需要的笔记（支持软删除和彻底删除）
- **笔记查询**: 查询和筛选笔记，支持多种条件
- **笔记排序**: 按不同条件排序笔记（创建时间、更新时间、标题等）
- **笔记统计**: 提供笔记相关的统计信息（数量、大小等）
- **笔记预览**: 生成笔记的预览内容

### 分类和标签

笔记模块提供分类和标签功能，支持以下特性：

- **分类管理**: 创建、编辑、删除和查询笔记分类
- **分类层级**: 支持多级分类结构
- **标签管理**: 创建、编辑、删除和查询笔记标签
- **标签推荐**: 根据笔记内容推荐相关标签
- **自动分类**: 根据笔记内容自动分配分类
- **批量操作**: 批量为笔记添加或移除标签/分类

### 版本控制

笔记模块提供版本控制功能，支持以下特性：

- **版本历史**: 记录笔记的修改历史
- **版本比较**: 比较不同版本之间的差异
- **版本恢复**: 恢复到之前的版本
- **自动保存**: 定期自动保存笔记内容
- **版本注释**: 为版本添加注释，说明修改内容
- **版本清理**: 清理过旧或不需要的版本

### 附件管理

笔记模块提供附件管理功能，支持以下特性：

- **附件上传**: 上传文件作为笔记附件
- **附件下载**: 下载笔记附件
- **附件预览**: 预览支持的附件类型（图片、PDF等）
- **附件删除**: 删除不再需要的附件
- **附件重命名**: 重命名附件
- **附件限制**: 控制附件大小和类型

### 导入导出

笔记模块提供导入导出功能，支持以下特性：

- **导出格式**: 支持多种导出格式（Markdown、PDF、HTML、纯文本等）
- **导入格式**: 支持多种导入格式（Markdown、Word、HTML等）
- **批量导出**: 批量导出多个笔记
- **选择性导出**: 选择性导出笔记内容（是否包含附件、版本历史等）
- **导入解析**: 解析导入文件，提取内容和结构
- **导入冲突处理**: 处理导入时的冲突（如重复笔记）

### 同步功能

笔记模块提供同步功能，支持以下特性：

- **增量同步**: 只同步变更的部分，减少数据传输
- **冲突解决**: 处理多设备编辑导致的冲突
- **离线支持**: 支持离线编辑，网络恢复后自动同步
- **同步状态**: 跟踪笔记的同步状态
- **选择性同步**: 选择需要同步的笔记
- **同步历史**: 记录同步历史，便于追踪问题

### 分享和协作

笔记模块提供分享和协作功能，支持以下特性：

- **笔记分享**: 将笔记分享给其他用户
- **权限控制**: 控制分享笔记的权限（只读、可编辑等）
- **链接分享**: 生成分享链接，可设置密码和过期时间
- **协作编辑**: 支持多用户同时编辑笔记
- **评论功能**: 在分享的笔记上添加评论
- **分享记录**: 跟踪笔记的分享记录

## API端点

笔记模块提供以下主要API端点：

- **笔记API**:
  - `GET /api/notes/`: 获取笔记列表
  - `POST /api/notes/`: 创建新笔记
  - `GET /api/notes/{id}/`: 获取特定笔记详情
  - `PUT /api/notes/{id}/`: 更新笔记
  - `DELETE /api/notes/{id}/`: 删除笔记
  - `GET /api/notes/stats/`: 获取笔记统计信息
  - `GET /api/notes/search/`: 搜索笔记

- **分类API**:
  - `GET /api/notes/categories/`: 获取分类列表
  - `POST /api/notes/categories/`: 创建新分类
  - `GET /api/notes/categories/{id}/`: 获取特定分类详情
  - `PUT /api/notes/categories/{id}/`: 更新分类
  - `DELETE /api/notes/categories/{id}/`: 删除分类
  - `GET /api/notes/categories/{id}/notes/`: 获取分类下的笔记

- **标签API**:
  - `GET /api/notes/tags/`: 获取标签列表
  - `POST /api/notes/tags/`: 创建新标签
  - `GET /api/notes/tags/{id}/`: 获取特定标签详情
  - `PUT /api/notes/tags/{id}/`: 更新标签
  - `DELETE /api/notes/tags/{id}/`: 删除标签
  - `GET /api/notes/tags/{id}/notes/`: 获取标签下的笔记
  - `POST /api/notes/tags/recommend/`: 获取推荐标签

- **版本API**:
  - `GET /api/notes/{id}/versions/`: 获取笔记版本历史
  - `GET /api/notes/{id}/versions/{version_id}/`: 获取特定版本详情
  - `POST /api/notes/{id}/versions/{version_id}/restore/`: 恢复到特定版本
  - `GET /api/notes/{id}/versions/compare/`: 比较两个版本的差异

- **附件API**:
  - `GET /api/notes/{id}/attachments/`: 获取笔记附件列表
  - `POST /api/notes/{id}/attachments/`: 上传附件
  - `GET /api/notes/{id}/attachments/{attachment_id}/`: 获取特定附件详情
  - `DELETE /api/notes/{id}/attachments/{attachment_id}/`: 删除附件
  - `GET /api/notes/{id}/attachments/{attachment_id}/download/`: 下载附件
  - `GET /api/notes/{id}/attachments/{attachment_id}/preview/`: 预览附件

- **导入导出API**:
  - `POST /api/notes/export/`: 导出笔记
  - `POST /api/notes/import/`: 导入笔记
  - `GET /api/notes/export/formats/`: 获取支持的导出格式
  - `GET /api/notes/import/formats/`: 获取支持的导入格式

- **同步API**:
  - `POST /api/notes/sync/`: 同步笔记
  - `GET /api/notes/sync/status/`: 获取同步状态
  - `POST /api/notes/sync/resolve-conflicts/`: 解决同步冲突

- **分享API**:
  - `POST /api/notes/{id}/share/`: 分享笔记
  - `GET /api/notes/shared/`: 获取分享的笔记列表
  - `GET /api/notes/shared/{share_id}/`: 获取分享笔记详情
  - `DELETE /api/notes/{id}/share/{share_id}/`: 取消分享
  - `POST /api/notes/shared/{share_id}/comment/`: 评论分享的笔记

## 数据模型

笔记模块使用MongoDB作为数据库，使用MongoEngine ODM定义文档模型。主要模型包括：

### 笔记模型 (Note)

```python
class Note(Document):
    """
    笔记文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='笔记ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    is_encrypted = BooleanField(default=False, verbose_name='是否加密')
    encryption_key = StringField(max_length=255, verbose_name='加密密钥')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    view_count = IntField(default=0, verbose_name='查看次数')
    last_viewed_at = DateTimeField(verbose_name='最后查看时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    # MongoDB Realm相关字段
    realm_id = StringField(max_length=100, sparse=True, verbose_name='Realm ID')
    realm_partition = StringField(max_length=100, sparse=True, verbose_name='Realm Partition')
    realm_sync_status = StringField(max_length=20, choices=('pending', 'synced', 'error'), default='pending', verbose_name='Realm同步状态')
    realm_last_sync_time = DateTimeField(verbose_name='最后同步时间')
    realm_error_message = StringField(verbose_name='同步错误信息')
```

### 分类模型 (Category)

```python
class Category(Document):
    """
    分类文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分类ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=100, required=True, verbose_name='分类名称')
    description = StringField(max_length=500, verbose_name='分类描述')
    color = StringField(max_length=20, default='#2196F3', verbose_name='分类颜色')
    icon = StringField(max_length=50, verbose_name='分类图标')
    parent = ReferenceField('self', verbose_name='父分类')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
```

### 标签模型 (Tag)

```python
class Tag(Document):
    """
    标签文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='标签ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=50, required=True, verbose_name='标签名称')
    color = StringField(max_length=20, default='#2196F3', verbose_name='标签颜色')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
```

其他模型包括：
- NoteVersion (笔记版本)
- NoteAttachment (笔记附件)
- NoteShare (笔记分享)
- NoteReminder (笔记提醒)
- NoteBackup (笔记备份)
- NoteSync (笔记同步)
- NoteComment (笔记评论)
- NoteCollaboration (笔记协作)
- NoteTemplate (笔记模板)
- Handwriting (手写笔记)
- Annotation (PDF注释)
- DrawingPath (绘图路径)
- OCRModel (OCR模型)
- WhisperModel (Whisper模型)
- Notification (通知)

## 与其他模块的交互

笔记模块与以下模块有交互：

- **用户模块**: 管理笔记的所有权和访问权限
- **搜索模块**: 提供笔记内容的搜索功能
- **知识图谱模块**: 将笔记内容整合到知识图谱中
- **AI助手模块**: 利用AI能力分析和处理笔记内容
- **提醒模块**: 为笔记设置提醒和截止日期
- **存储模块**: 管理笔记内容和附件的存储

## 注意事项

- **性能优化**: 大型笔记和附件可能面临性能挑战，需要优化加载和渲染
- **数据安全**: 确保笔记内容的安全存储和传输
- **同步冲突**: 妥善处理多设备同步时的冲突
- **版本控制**: 合理管理版本历史，避免存储过多历史版本
- **附件限制**: 设置合理的附件大小和类型限制
- **导入导出兼容性**: 确保不同格式之间的导入导出兼容性
- **用户体验**: 提供流畅的编辑和组织体验
