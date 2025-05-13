# MongoDB Realm 查询文档

本文档详细描述了 ZeroIsle Notes 应用中使用的 MongoDB Realm 查询方法。

## 查询方法概述

ZeroIsle Notes 应用使用以下优化的查询方法：

1. **findDocuments**: 查询多个文档
2. **findOneDocument**: 查询单个文档
3. **findDocumentById**: 根据 ID 查询文档
4. **createDocument**: 创建文档
5. **updateDocument**: 更新文档
6. **deleteDocument**: 删除文档
7. **buildRealmQuery**: 构建 Realm 查询字符串

## 查询方法详情

### findDocuments

查询多个文档，支持过滤、排序、分页等操作。

```javascript
/**
 * 查找文档
 * @param {string} schemaName 模式名称
 * @param {Object} filter 过滤条件
 * @param {Object} options 选项
 * @returns {Promise<Array>} 文档数组
 */
async function findDocuments(schemaName, filter = {}, options = {})
```

#### 参数

- **schemaName**: 模式名称，如 'Note', 'Category' 等
- **filter**: 过滤条件，支持 MongoDB 风格的查询操作符
- **options**: 查询选项
  - **sort**: 排序条件，如 `{ updated_at: -1 }`
  - **limit**: 限制返回的文档数量
  - **skip**: 跳过的文档数量

#### 示例

```javascript
// 查询所有未删除的笔记，按更新时间降序排序
const notes = await findDocuments('Note', 
  { is_deleted: false }, 
  { sort: { updated_at: -1 } }
);

// 查询特定分类的笔记，分页查询
const categoryNotes = await findDocuments('Note', 
  { category_id: 'category123', is_deleted: false }, 
  { sort: { updated_at: -1 }, limit: 10, skip: 0 }
);

// 使用高级过滤条件
const filteredNotes = await findDocuments('Note', {
  title: { $contains: '搜索关键词' },
  created_at: { $gt: new Date('2023-01-01') },
  is_deleted: false
});
```

### findOneDocument

查询单个文档，返回第一个匹配的文档。

```javascript
/**
 * 查找单个文档
 * @param {string} schemaName 模式名称
 * @param {Object} filter 过滤条件
 * @returns {Promise<Object|null>} 文档或null
 */
async function findOneDocument(schemaName, filter = {})
```

#### 参数

- **schemaName**: 模式名称
- **filter**: 过滤条件

#### 示例

```javascript
// 查询特定标题的笔记
const note = await findOneDocument('Note', { title: '重要笔记' });

// 查询特定用户的最新笔记
const latestNote = await findOneDocument('Note', 
  { user_id: 'user123', is_deleted: false }, 
  { sort: { updated_at: -1 } }
);
```

### findDocumentById

根据 ID 查询文档，这是查询单个文档的最高效方式。

```javascript
/**
 * 根据ID查找文档
 * @param {string} schemaName 模式名称
 * @param {string} id 文档ID
 * @returns {Promise<Object|null>} 文档或null
 */
async function findDocumentById(schemaName, id)
```

#### 参数

- **schemaName**: 模式名称
- **id**: 文档 ID

#### 示例

```javascript
// 查询特定ID的笔记
const note = await findDocumentById('Note', 'note123');
```

### createDocument

创建新文档。

```javascript
/**
 * 创建文档
 * @param {string} schemaName 模式名称
 * @param {Object} data 文档数据
 * @returns {Promise<Object>} 创建的文档
 */
async function createDocument(schemaName, data)
```

#### 参数

- **schemaName**: 模式名称
- **data**: 文档数据

#### 示例

```javascript
// 创建新笔记
const note = await createDocument('Note', {
  title: '新笔记',
  content: '笔记内容',
  created_at: new Date(),
  updated_at: new Date(),
  is_deleted: false,
  is_synced: false,
});
```

### updateDocument

更新文档。

```javascript
/**
 * 更新文档
 * @param {string} schemaName 模式名称
 * @param {string} id 文档ID
 * @param {Object} data 更新数据
 * @returns {Promise<Object|null>} 更新后的文档或null
 */
async function updateDocument(schemaName, id, data)
```

#### 参数

- **schemaName**: 模式名称
- **id**: 文档 ID
- **data**: 更新数据

#### 示例

```javascript
// 更新笔记
const updatedNote = await updateDocument('Note', 'note123', {
  title: '更新的标题',
  content: '更新的内容',
  updated_at: new Date(),
});

// 标记笔记为已删除
const deletedNote = await updateDocument('Note', 'note123', {
  is_deleted: true,
  deleted_at: new Date(),
  updated_at: new Date(),
});
```

### deleteDocument

删除文档。

```javascript
/**
 * 删除文档
 * @param {string} schemaName 模式名称
 * @param {string} id 文档ID
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteDocument(schemaName, id)
```

#### 参数

- **schemaName**: 模式名称
- **id**: 文档 ID

#### 示例

```javascript
// 永久删除笔记
const success = await deleteDocument('Note', 'note123');
```

### buildRealmQuery

构建 Realm 查询字符串，通常不需要直接调用此方法。

```javascript
/**
 * 构建 Realm 查询字符串
 * @param {Object} filter 过滤条件
 * @returns {Object} 查询字符串和参数
 */
function buildRealmQuery(filter = {})
```

#### 参数

- **filter**: 过滤条件

#### 返回值

- **queryString**: 查询字符串
- **queryParams**: 查询参数

#### 支持的查询操作符

- **$eq**: 等于
- **$ne**: 不等于
- **$gt**: 大于
- **$gte**: 大于等于
- **$lt**: 小于
- **$lte**: 小于等于
- **$in**: 在数组中
- **$nin**: 不在数组中
- **$contains**: 包含字符串
- **$beginsWith**: 以字符串开头
- **$endsWith**: 以字符串结尾

#### 示例

```javascript
// 构建查询字符串
const { queryString, queryParams } = buildRealmQuery({
  title: { $contains: '搜索' },
  created_at: { $gt: new Date('2023-01-01') },
  is_deleted: false,
  category_id: { $in: ['cat1', 'cat2'] }
});

// 输出:
// queryString: "title CONTAINS[c] $0 AND created_at > $1 AND is_deleted == false AND (category_id == $2 OR category_id == $3)"
// queryParams: ['搜索', Date('2023-01-01'), 'cat1', 'cat2']
```

## 性能优化技巧

### 使用索引

确保为经常查询的字段添加索引，特别是在大型集合中。

```javascript
// 在模型定义中添加索引
{
  name: 'Note',
  primaryKey: '_id',
  properties: {
    // ...属性定义
  },
  indexes: [
    'is_deleted',
    'user_id',
    'category_id',
    'is_synced'
  ]
}
```

### 使用投影查询

只获取需要的字段，减少数据传输和内存使用。

```javascript
// 只获取笔记的标题和更新时间
const noteTitles = await findDocuments('Note', 
  { is_deleted: false }, 
  { projection: ['_id', 'title', 'updated_at'] }
);
```

### 批量操作

使用批量操作减少数据库事务数量。

```javascript
// 批量更新笔记
const realm = await realmService.getRealm();
realm.write(() => {
  notes.forEach(note => {
    const obj = realm.objectForPrimaryKey('Note', note._id);
    if (obj) {
      obj.is_synced = true;
    }
  });
});
```

### 使用事务

将多个操作包装在一个事务中，确保原子性。

```javascript
// 在一个事务中创建笔记和附件
const realm = await realmService.getRealm();
realm.write(() => {
  const note = realm.create('Note', {
    _id: new Realm.BSON.ObjectId(),
    title: '带附件的笔记',
    // ...其他属性
  });
  
  realm.create('Attachment', {
    _id: new Realm.BSON.ObjectId(),
    name: '附件.jpg',
    note_id: note._id.toString(),
    // ...其他属性
  });
});
```
