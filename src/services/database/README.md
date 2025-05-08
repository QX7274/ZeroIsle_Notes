# 数据库服务

本目录包含零屿笔记应用的数据库相关服务，用于管理本地SQLite数据库、数据同步和数据操作。

## 文件结构

- **index.js**: 数据库服务导出文件，集中导出所有数据库相关服务
- **sqliteService.js**: SQLite数据库服务，提供数据库初始化和操作功能
- **syncService.js**: 同步服务，提供本地数据与服务器数据的同步功能
- **dataService.js**: 数据服务，提供高级数据操作和查询功能

## 主要功能

### SQLite数据库服务 (sqliteService.js)

SQLite数据库服务提供以下主要功能：

- **数据库初始化**: 初始化SQLite数据库，创建必要的表和索引
- **数据库升级**: 处理数据库版本升级和结构变更
- **数据库操作**: 提供基本的CRUD（创建、读取、更新、删除）操作
- **事务管理**: 支持数据库事务，确保数据一致性
- **查询执行**: 执行SQL查询和获取结果
- **错误处理**: 处理数据库操作中的错误和异常

### 同步服务 (syncService.js)

同步服务提供以下主要功能：

- **数据同步**: 在本地数据库和服务器之间同步数据
- **冲突解决**: 处理数据同步过程中的冲突
- **离线队列**: 管理离线状态下的数据操作队列
- **同步状态管理**: 跟踪各表的同步状态和时间
- **增量同步**: 支持增量同步，减少数据传输
- **同步策略**: 提供不同的同步策略（如自动同步、手动同步等）

### 数据服务 (dataService.js)

数据服务提供以下主要功能：

- **高级数据操作**: 提供高级的数据操作和查询功能
- **数据关系管理**: 处理数据之间的关系和关联
- **数据验证**: 验证数据的有效性和完整性
- **数据转换**: 在不同数据格式之间进行转换
- **批量操作**: 支持批量数据操作，提高效率
- **查询构建**: 提供查询构建器，简化复杂查询的构建

## 数据库表结构

数据库包含以下主要表：

- **users**: 用户信息表
- **notes**: 笔记表
- **categories**: 分类表
- **tags**: 标签表
- **note_tags**: 笔记-标签关联表
- **reminders**: 提醒表
- **settings**: 设置表
- **sync_info**: 同步信息表
- **offline_queue**: 离线操作队列表
- **files**: 文件信息表
- **knowledge_nodes**: 知识节点表
- **knowledge_edges**: 知识边表
- **knowledge_graphs**: 知识图谱表
- **ai_conversations**: AI对话表
- **ai_messages**: AI消息表
- **community_posts**: 社区帖子表
- **community_comments**: 社区评论表
- **search_history**: 搜索历史表
- **search_index**: 搜索索引表

## 同步机制

同步服务使用以下机制进行数据同步：

- **时间戳同步**: 使用最后修改时间进行增量同步
- **版本控制**: 使用版本号解决冲突
- **离线队列**: 在离线状态下将操作存入队列，在网络恢复后执行
- **批量同步**: 批量处理同步操作，减少网络请求
- **优先级同步**: 根据数据重要性设置同步优先级
- **自动重试**: 同步失败时自动重试

## 与其他服务的交互

数据库服务与以下服务有交互：

- **API服务**: 用于与后端服务器通信
- **网络服务**: 检测网络状态，决定同步策略
- **存储服务**: 管理数据库文件和备份
- **分析服务**: 跟踪数据库操作和性能

## 使用方法

```javascript
import { sqliteService, syncService, dataService, TABLES } from '../../services/database';

// 初始化数据库
async function initializeDatabase() {
  try {
    await sqliteService.initialize();
    console.log('数据库初始化成功');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return false;
  }
}

// 执行查询
async function executeQuery(query, params = []) {
  try {
    const result = await sqliteService.executeQuery(query, params);
    console.log('查询执行成功:', result);
    return result;
  } catch (error) {
    console.error('查询执行失败:', error);
    return null;
  }
}

// 获取笔记列表
async function getNotes(categoryId = null) {
  try {
    let query = `SELECT * FROM ${TABLES.NOTES} WHERE user_id = ?`;
    const params = [userId];
    
    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const notes = await sqliteService.executeQuery(query, params);
    console.log('获取笔记成功:', notes.length, '条笔记');
    return notes;
  } catch (error) {
    console.error('获取笔记失败:', error);
    return [];
  }
}

// 同步数据
async function syncData() {
  try {
    const result = await syncService.syncAll();
    console.log('数据同步成功:', result);
    return result;
  } catch (error) {
    console.error('数据同步失败:', error);
    return { success: false, error };
  }
}

// 使用数据服务获取带标签的笔记
async function getNotesWithTags(userId) {
  try {
    const notesWithTags = await dataService.getNotesWithTags(userId);
    console.log('获取带标签的笔记成功:', notesWithTags.length, '条笔记');
    return notesWithTags;
  } catch (error) {
    console.error('获取带标签的笔记失败:', error);
    return [];
  }
}

// 在事务中执行多个操作
async function createNoteWithTags(noteData, tags) {
  try {
    const result = await sqliteService.executeTransaction(async (tx) => {
      // 创建笔记
      const noteId = await tx.executeQuery(
        `INSERT INTO ${TABLES.NOTES} (title, content, category_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [noteData.title, noteData.content, noteData.categoryId, noteData.userId, new Date().toISOString(), new Date().toISOString()]
      );
      
      // 添加标签关联
      for (const tag of tags) {
        await tx.executeQuery(
          `INSERT INTO ${TABLES.NOTE_TAGS} (note_id, tag_id, created_at) VALUES (?, ?, ?)`,
          [noteId, tag.id, new Date().toISOString()]
        );
      }
      
      return noteId;
    });
    
    console.log('创建带标签的笔记成功:', result);
    return result;
  } catch (error) {
    console.error('创建带标签的笔记失败:', error);
    return null;
  }
}
```

## 注意事项

- 数据库操作可能是耗时的，应考虑在后台线程中执行
- 同步操作应处理网络异常和冲突情况
- 数据库结构变更应谨慎处理，确保向后兼容
- 定期备份数据库，防止数据丢失
- 监控数据库大小，避免过大影响性能
- 使用参数化查询，防止SQL注入攻击
