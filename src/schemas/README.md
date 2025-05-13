# 数据库模式定义

本目录包含零屿笔记应用的数据库模式定义，用于MongoDB和Realm数据库。这些模式定义了应用中各种数据实体的结构和关系。

## 概述

数据库模式是数据库中表、集合或文档的结构定义。在零屿笔记应用中，我们使用MongoDB作为云数据库，使用Realm作为本地数据库，因此需要为这两种数据库定义相应的模式。

## 文件结构

- **index.js**: 导出所有模式定义
- **noteSchema.js**: 笔记模式定义
- **categorySchema.js**: 分类模式定义
- **tagSchema.js**: 标签模式定义
- **reminderSchema.js**: 提醒模式定义
- **userSchema.js**: 用户模式定义
- **knowledgeNodeSchema.js**: 知识节点模式定义
- **knowledgeEdgeSchema.js**: 知识边模式定义
- **infiniteCanvasSchema.js**: 无限画布模式定义
- **canvasElementSchema.js**: 画布元素模式定义
- **syncInfoSchema.js**: 同步信息模式定义
- **fileSchema.js**: 文件模式定义
- **aiConversationSchema.js**: AI对话模式定义
- **aiMessageSchema.js**: AI消息模式定义
- **communityPostSchema.js**: 社区帖子模式定义
- **communityCommentSchema.js**: 社区评论模式定义
- **searchHistorySchema.js**: 搜索历史模式定义
- **searchIndexSchema.js**: 搜索索引模式定义
- **offlineQueueSchema.js**: 离线队列模式定义
- **settingSchema.js**: 设置模式定义
- **mindMapSchema.js**: 思维导图模式定义
- **mindMapNodeSchema.js**: 思维导图节点模式定义

## 模式定义示例

### Realm模式定义

```javascript
// noteSchema.js
export const NoteSchema = {
  name: 'Note',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    user_id: 'string?',
    title: 'string',
    content: 'string',
    category_id: 'string?',
    tags: 'string[]',
    is_deleted: { type: 'bool', default: false },
    is_favorite: { type: 'bool', default: false },
    is_archived: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: 'date',
    updated_at: 'date',
    deleted_at: 'date?',
    server_id: 'string?',
  }
};
```

### MongoDB模式定义

```javascript
// noteSchema.js (MongoDB版本)
import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  tags: [{ type: String }],
  is_deleted: { type: Boolean, default: false },
  is_favorite: { type: Boolean, default: false },
  is_archived: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// 添加索引
NoteSchema.index({ user_id: 1, is_deleted: 1 });
NoteSchema.index({ user_id: 1, is_favorite: 1 });
NoteSchema.index({ user_id: 1, category_id: 1 });
NoteSchema.index({ user_id: 1, updated_at: -1 });
NoteSchema.index({ title: 'text', content: 'text', tags: 'text' });

export default mongoose.model('Note', NoteSchema);
```

## 使用方法

### 在Realm中使用模式

```javascript
// 导入模式定义
import { NoteSchema, CategorySchema, TagSchema } from '../schemas';
import Realm from 'realm';

// 初始化Realm
const realm = await Realm.open({
  schema: [NoteSchema, CategorySchema, TagSchema],
  schemaVersion: 1,
});

// 创建笔记
realm.write(() => {
  realm.create('Note', {
    _id: 'note_' + Date.now(),
    title: '新笔记',
    content: '笔记内容',
    created_at: new Date(),
    updated_at: new Date(),
  });
});

// 查询笔记
const notes = realm.objects('Note').filtered('is_deleted = false');
```

### 在MongoDB中使用模式

```javascript
// 导入模型
import Note from '../schemas/noteSchema';
import mongoose from 'mongoose';

// 连接MongoDB
await mongoose.connect('mongodb://localhost:27017/zeroislenotes');

// 创建笔记
const note = new Note({
  title: '新笔记',
  content: '笔记内容',
  user_id: '60d5ec9af682fbd12a0b4b1e',
});

await note.save();

// 查询笔记
const notes = await Note.find({ user_id: '60d5ec9af682fbd12a0b4b1e', is_deleted: false })
  .sort({ updated_at: -1 })
  .limit(10);
```

## 模式迁移

当模式结构发生变化时，需要进行模式迁移：

### Realm模式迁移

```javascript
const realm = await Realm.open({
  schema: [NoteSchema, CategorySchema, TagSchema],
  schemaVersion: 2,
  migration: (oldRealm, newRealm) => {
    // 只有当旧版本的模式需要迁移时才执行
    if (oldRealm.schemaVersion < 2) {
      const oldObjects = oldRealm.objects('Note');
      const newObjects = newRealm.objects('Note');
      
      // 遍历旧对象并更新新对象
      for (let i = 0; i < oldObjects.length; i++) {
        newObjects[i].is_favorite = false; // 添加新字段
      }
    }
  },
});
```

### MongoDB模式迁移

MongoDB的模式迁移通常通过以下方式实现：

1. 使用MongoDB的更新操作符更新文档
2. 使用mongoose-migrate或类似工具进行迁移
3. 编写自定义迁移脚本

```javascript
// 示例：为所有笔记添加is_favorite字段
await Note.updateMany(
  { is_favorite: { $exists: false } },
  { $set: { is_favorite: false } }
);
```

## 最佳实践

1. **版本控制**：为模式定义添加版本号，便于迁移
2. **默认值**：为字段提供合理的默认值，避免空值问题
3. **验证**：添加字段验证，确保数据完整性
4. **索引**：为常用查询字段添加索引，提高查询性能
5. **关系**：合理设计实体之间的关系，避免过度嵌套
6. **命名一致性**：保持字段命名的一致性，使用下划线命名法
7. **文档化**：为模式添加详细的注释和文档
8. **模块化**：将相关模式放在同一个文件中，便于管理
9. **测试**：为模式编写单元测试，确保正确性
10. **安全性**：不要在模式中存储敏感信息，如密码明文
