# 数据模型

本目录包含零屿笔记应用的数据模型，使用Realm对象模型定义。这些模型定义了应用中的各种数据实体，包括笔记、分类、标签、提醒等。

## 文件结构

- **Note.js**: 笔记模型，定义笔记的结构和操作方法
- **Category.js**: 分类模型，定义分类的结构和操作方法
- **Tag.js**: 标签模型，定义标签的结构和操作方法
- **Reminder.js**: 提醒模型，定义提醒的结构和操作方法
- **User.js**: 用户模型，定义用户的结构和操作方法
- **KnowledgeNode.js**: 知识节点模型，定义知识图谱节点的结构和操作方法
- **KnowledgeEdge.js**: 知识边模型，定义知识图谱边的结构和操作方法
- **InfiniteCanvas.js**: 无限画布模型，定义无限画布的结构和操作方法
- **CanvasElement.js**: 画布元素模型，定义画布元素的结构和操作方法
- **SyncInfo.js**: 同步信息模型，定义同步状态的结构和操作方法
- **File.js**: 文件模型，定义文件的结构和操作方法
- **AIConversation.js**: AI对话模型，定义AI对话的结构和操作方法
- **AIMessage.js**: AI消息模型，定义AI消息的结构和操作方法
- **CommunityPost.js**: 社区帖子模型，定义社区帖子的结构和操作方法
- **CommunityComment.js**: 社区评论模型，定义社区评论的结构和操作方法
- **SearchHistory.js**: 搜索历史模型，定义搜索历史的结构和操作方法
- **SearchIndex.js**: 搜索索引模型，定义搜索索引的结构和操作方法
- **OfflineQueue.js**: 离线队列模型，定义离线操作队列的结构和操作方法
- **Setting.js**: 设置模型，定义应用设置的结构和操作方法

## 模型结构

每个模型文件都包含以下部分：

1. **模型定义**：使用Realm.Object定义模型的结构和属性
2. **静态方法**：提供对模型的CRUD操作和查询方法
3. **实例方法**：提供模型实例的操作方法

## 使用方法

### 模型定义

```javascript
// 模型定义示例 (Note.js)
export class Note extends Realm.Object {
  static schema = {
    name: 'Note',
    primaryKey: '_id',
    properties: {
      _id: 'objectId',
      user_id: 'string?',
      title: 'string',
      content: 'string',
      category_id: 'string?',
      is_deleted: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      deleted_at: 'date?',
      is_synced: { type: 'bool', default: false },
      last_sync_time: 'date?',
    }
  };
  
  // 静态方法和实例方法...
}
```

### 静态方法

静态方法用于对模型进行CRUD操作和查询：

```javascript
// 静态方法示例 (Note.js)
static create(realm, data) {
  if (!data.title) {
    throw new Error('笔记标题不能为空');
  }

  const now = new Date();
  return realm.create('Note', {
    _id: new Realm.BSON.ObjectId(),
    user_id: data.user_id,
    title: data.title,
    content: data.content || '',
    category_id: data.category_id,
    created_at: now,
    updated_at: now,
  });
}

static update(realm, id, data) {
  const note = realm.objectForPrimaryKey('Note', id);
  if (!note) {
    throw new Error(`未找到ID为${id}的笔记`);
  }

  realm.write(() => {
    if (data.title !== undefined) note.title = data.title;
    if (data.content !== undefined) note.content = data.content;
    if (data.category_id !== undefined) note.category_id = data.category_id;
    note.updated_at = new Date();
  });

  return note;
}

static findAll(realm, userId = null) {
  let query = 'is_deleted = false';
  if (userId) {
    query += ` AND user_id = "${userId}"`;
  }
  return realm.objects('Note').filtered(query).sorted('updated_at', true);
}
```

### 实例方法

实例方法用于对模型实例进行操作：

```javascript
// 实例方法示例
toJSON() {
  return {
    id: this._id.toString(),
    user_id: this.user_id,
    title: this.title,
    content: this.content,
    category_id: this.category_id,
    created_at: this.created_at.toISOString(),
    updated_at: this.updated_at.toISOString(),
  };
}
```

## 与服务的交互

模型通常通过服务层与应用的其他部分交互：

```javascript
// 服务层使用模型示例
import { realmService } from '../database/realmService';
import { Note } from '../../models/Note';

class NoteService {
  async createNote(noteData) {
    const realm = await realmService.waitForInit();
    let note;
    await realm.write(() => {
      note = Note.create(realm, noteData);
    });
    return note;
  }
  
  async getNotes(userId = null) {
    const realm = await realmService.waitForInit();
    const notes = Note.findAll(realm, userId);
    return Array.from(notes);
  }
}
```

## 注意事项

1. **事务**：所有修改Realm数据库的操作都必须在事务中执行
2. **主键**：每个模型都应该有一个主键，通常是`_id`字段
3. **关系**：Realm支持对象之间的关系，可以使用`linkingObjects`定义反向关系
4. **查询**：使用`filtered`方法进行查询，支持复杂的查询条件
5. **排序**：使用`sorted`方法对查询结果进行排序
6. **异步**：所有数据库操作都应该是异步的，使用`async/await`处理
