# MongoDB Realm 使用指南

## 简介

本项目使用MongoDB Realm作为统一的数据存储解决方案，替代了之前的MongoDB、SQLite和AsyncStorage。MongoDB Realm提供了以下优势：

- **离线优先**：数据首先存储在本地，然后在有网络连接时同步到云端
- **实时同步**：自动处理数据同步，无需手动编写同步逻辑
- **跨平台**：支持iOS、Android和Web平台
- **安全性**：内置用户认证和数据访问控制
- **性能**：高效的本地数据库，支持复杂查询和索引

## 项目结构

### 数据模型

数据模型定义在`src/models/`目录下，包括：

- `Note.js`：笔记模型
- `Category.js`：分类模型
- `Tag.js`：标签模型
- `Reminder.js`：提醒模型
- `User.js`：用户模型
- `KnowledgeNode.js`和`KnowledgeEdge.js`：知识图谱模型
- `InfiniteCanvas.js`和`CanvasElement.js`：无限画布模型
- `SyncInfo.js`：同步信息模型

### 服务

Realm相关服务定义在以下文件中：

- `src/services/database/realmService.js`：Realm数据库服务，负责数据库初始化和基本操作
- `src/services/storage/realmStorageService.js`：Realm存储服务，替代AsyncStorage
- `src/services/notes/realmNoteService.js`：笔记服务，提供笔记相关的CRUD操作
- `src/services/categories/realmCategoryService.js`：分类服务，提供分类相关的CRUD操作
- `src/services/app/initService.js`：应用初始化服务，负责初始化Realm数据库和其他服务

## 使用方法

### 初始化

在应用启动时，通过`initService`初始化Realm数据库和相关服务：

```javascript
import { initService } from './services/app/initService';

// 在应用启动时初始化
await initService.init();
```

### 数据操作

#### 笔记操作

```javascript
import { realmNoteService } from './services/notes';

// 获取所有笔记
const notes = await realmNoteService.getNotes();

// 创建笔记
const newNote = await realmNoteService.createNote({
  title: '新笔记',
  content: '笔记内容',
  category_id: '分类ID',
  tags: ['标签1', '标签2'],
});

// 更新笔记
await realmNoteService.updateNote(noteId, {
  title: '更新的标题',
  content: '更新的内容',
});

// 删除笔记
await realmNoteService.deleteNote(noteId);
```

#### 分类操作

```javascript
import { realmCategoryService } from './services/categories';

// 获取所有分类
const categories = await realmCategoryService.getCategories();

// 创建分类
const newCategory = await realmCategoryService.createCategory({
  name: '新分类',
  description: '分类描述',
});

// 更新分类
await realmCategoryService.updateCategory(categoryId, {
  name: '更新的名称',
  description: '更新的描述',
});

// 删除分类
await realmCategoryService.deleteCategory(categoryId);
```

#### 存储操作

```javascript
import { realmStorageService } from './services/storage';

// 存储数据
await realmStorageService.set('key', 'value');

// 获取数据
const value = await realmStorageService.get('key');

// 删除数据
await realmStorageService.remove('key');
```

### 事件监听

各服务提供了事件机制，可以监听数据变更：

```javascript
import { NOTE_EVENTS } from './services/notes/realmNoteService';
import EventEmitter from './utils/eventEmitter';

// 监听笔记创建事件
EventEmitter.addListener(NOTE_EVENTS.CREATED, (note) => {
  console.log('笔记已创建:', note);
});

// 监听笔记更新事件
EventEmitter.addListener(NOTE_EVENTS.UPDATED, (note) => {
  console.log('笔记已更新:', note);
});
```

## 数据同步

MongoDB Realm支持自动数据同步，但需要配置MongoDB Realm App。目前项目使用本地优先的存储策略，数据首先保存在本地，然后在有网络连接时同步到云端。

要启用完整的数据同步功能，需要：

1. 创建MongoDB Atlas集群
2. 创建MongoDB Realm应用
3. 配置同步规则和权限
4. 更新应用配置，连接到MongoDB Realm应用

## 注意事项

1. 所有数据操作都是异步的，需要使用`async/await`或Promise处理
2. 在使用数据服务前，确保已经初始化完成
3. 数据模型的更改需要处理迁移逻辑
4. 大量数据操作应该在事务中执行，以提高性能和可靠性

## 故障排除

如果遇到数据库相关问题，可以尝试以下方法：

1. 检查Realm数据库是否正确初始化
2. 查看日志中是否有数据库错误
3. 尝试重新初始化数据库
4. 如果数据库损坏，可能需要删除数据库文件并重新创建

## 参考资料

- [MongoDB Realm文档](https://www.mongodb.com/docs/realm-sdks/react/)
- [Realm JavaScript SDK](https://www.mongodb.com/docs/realm-sdks/js/)
- [Realm React Native SDK](https://www.mongodb.com/docs/realm-sdks/react-native/)
