# MongoDB Realm 模型文档

本文档详细描述了 ZeroIsle Notes 应用中使用的 MongoDB Realm 模型。

## 模型概述

ZeroIsle Notes 应用使用以下 Realm 模型：

1. **Note**: 笔记模型
2. **Attachment**: 附件模型
3. **Category**: 分类模型
4. **Tag**: 标签模型
5. **Reminder**: 提醒模型
6. **AIChat**: AI 聊天模型
7. **AIChatMessage**: AI 聊天消息模型
8. **KnowledgeGraph**: 知识图谱模型
9. **KnowledgeNode**: 知识节点模型
10. **KnowledgeEdge**: 知识边模型
11. **SyncInfo**: 同步信息模型
12. **StorageItem**: 存储项模型

## 模型详情

### Note 模型

笔记是应用的核心数据模型，存储用户创建的笔记内容。

```javascript
{
  name: 'Note',
  primaryKey: '_id',
  properties: {
    _id: 'objectId',              // 主键
    title: 'string',              // 笔记标题
    content: 'string?',           // 笔记内容
    created_at: 'date',           // 创建时间
    updated_at: 'date',           // 更新时间
    is_deleted: { type: 'bool', default: false }, // 是否删除
    is_synced: { type: 'bool', default: false },  // 是否同步
    deleted_at: 'date?',          // 删除时间
    user_id: 'string?',           // 用户ID
    category_id: 'string?',       // 分类ID
    tags: 'string[]',             // 标签ID数组
    attachments: 'Attachment[]',  // 附件数组
    color: 'string?',             // 笔记颜色
    is_pinned: { type: 'bool', default: false },  // 是否置顶
    is_archived: { type: 'bool', default: false }, // 是否归档
    is_locked: { type: 'bool', default: false },   // 是否锁定
    password: 'string?',          // 密码
    metadata: 'string?',          // 元数据（JSON字符串）
  }
}
```

#### 索引
- `_id`: 主键索引
- `is_deleted`: 用于快速查询未删除的笔记
- `is_synced`: 用于快速查询未同步的笔记
- `user_id`: 用于按用户查询笔记
- `category_id`: 用于按分类查询笔记

#### 关系
- 一对多关系：一个笔记可以有多个附件
- 多对多关系：一个笔记可以有多个标签

### Attachment 模型

附件模型存储笔记中的附件信息，如图片、文件等。

```javascript
{
  name: 'Attachment',
  primaryKey: '_id',
  properties: {
    _id: 'objectId',              // 主键
    name: 'string',               // 附件名称
    type: 'string',               // 附件类型
    url: 'string?',               // 附件URL
    local_path: 'string?',        // 本地路径
    size: 'int?',                 // 附件大小
    created_at: 'date',           // 创建时间
    updated_at: 'date',           // 更新时间
    is_deleted: { type: 'bool', default: false }, // 是否删除
    is_synced: { type: 'bool', default: false },  // 是否同步
    note_id: 'string?',           // 笔记ID
    user_id: 'string?',           // 用户ID
    metadata: 'string?',          // 元数据（JSON字符串）
  }
}
```

#### 索引
- `_id`: 主键索引
- `note_id`: 用于按笔记查询附件
- `is_synced`: 用于快速查询未同步的附件

### Category 模型

分类模型存储笔记的分类信息。

```javascript
{
  name: 'Category',
  primaryKey: '_id',
  properties: {
    _id: 'objectId',              // 主键
    name: 'string',               // 分类名称
    color: 'string?',             // 分类颜色
    icon: 'string?',              // 分类图标
    created_at: 'date',           // 创建时间
    updated_at: 'date',           // 更新时间
    is_deleted: { type: 'bool', default: false }, // 是否删除
    is_synced: { type: 'bool', default: false },  // 是否同步
    user_id: 'string?',           // 用户ID
    parent_id: 'string?',         // 父分类ID
    order: 'int?',                // 排序
  }
}
```

#### 索引
- `_id`: 主键索引
- `user_id`: 用于按用户查询分类
- `parent_id`: 用于查询子分类

### Tag 模型

标签模型存储笔记的标签信息。

```javascript
{
  name: 'Tag',
  primaryKey: '_id',
  properties: {
    _id: 'objectId',              // 主键
    name: 'string',               // 标签名称
    color: 'string?',             // 标签颜色
    created_at: 'date',           // 创建时间
    updated_at: 'date',           // 更新时间
    is_deleted: { type: 'bool', default: false }, // 是否删除
    is_synced: { type: 'bool', default: false },  // 是否同步
    user_id: 'string?',           // 用户ID
  }
}
```

#### 索引
- `_id`: 主键索引
- `user_id`: 用于按用户查询标签
- `name`: 用于按名称查询标签

### 其他模型

其他模型的详细信息请参考 `src/services/database/realmModels.js` 文件。

## 模型关系图

```
┌───────────┐     ┌───────────┐     ┌───────────┐
│   User    │     │  Category │     │    Tag    │
└─────┬─────┘     └─────┬─────┘     └─────┬─────┘
      │                 │                 │
      │                 │                 │
      │                 │                 │
      │                 ▼                 │
      │           ┌───────────┐           │
      └──────────►│   Note    │◄──────────┘
                  └─────┬─────┘
                        │
                        │
                        ▼
                  ┌───────────┐
                  │Attachment │
                  └───────────┘
```

## 使用示例

### 创建笔记

```javascript
const note = await createDocument('Note', {
  title: '新笔记',
  content: '笔记内容',
  created_at: new Date(),
  updated_at: new Date(),
  is_deleted: false,
  is_synced: false,
});
```

### 查询笔记

```javascript
// 查询所有未删除的笔记
const notes = await findDocuments('Note', { is_deleted: false });

// 查询特定分类的笔记
const categoryNotes = await findDocuments('Note', { 
  category_id: 'category123',
  is_deleted: false 
});

// 查询包含特定标签的笔记
const tagNotes = await findDocuments('Note', { 
  tags: { $in: ['tag123'] },
  is_deleted: false 
});
```

### 更新笔记

```javascript
const updatedNote = await updateDocument('Note', 'note123', {
  title: '更新的标题',
  content: '更新的内容',
  updated_at: new Date(),
  is_synced: false,
});
```

### 删除笔记

```javascript
// 软删除
const deletedNote = await updateDocument('Note', 'note123', {
  is_deleted: true,
  deleted_at: new Date(),
  updated_at: new Date(),
  is_synced: false,
});

// 永久删除
const success = await deleteDocument('Note', 'note123');
```
