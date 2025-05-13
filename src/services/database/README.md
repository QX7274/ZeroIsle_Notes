# 数据库服务

本目录包含零屿笔记应用的数据库相关服务，使用MongoDB Realm作为统一的数据存储解决方案，替代了之前的MongoDB、SQLite和AsyncStorage。

## 文件结构

- **index.js**: 数据库服务导出文件，集中导出所有数据库相关服务
- **realmService.js**: Realm数据库服务，提供数据库初始化和操作功能
- **realmConfig.js**: Realm配置文件，定义Realm数据库的配置
- **realmInitializer.js**: Realm初始化器，负责初始化Realm数据库
- **databaseInitService.js**: 数据库初始化服务，负责初始化所有数据库相关服务
- **dataService.js**: 数据服务，提供高级数据操作功能

## 主要功能

### Realm数据库服务 (realmService.js)

Realm数据库服务提供以下主要功能：

- **数据库初始化**: 初始化Realm数据库，创建必要的数据模型
- **数据库升级**: 处理数据库版本升级和结构变更
- **数据库操作**: 提供基本的CRUD（创建、读取、更新、删除）操作
- **事务管理**: 支持数据库事务，确保数据一致性
- **查询执行**: 执行Realm查询和获取结果
- **错误处理**: 处理数据库操作中的错误和异常

## 数据模型

Realm数据库服务使用以下数据模型：

- **Note**: 笔记模型，定义笔记的结构和操作方法
- **Category**: 分类模型，定义分类的结构和操作方法
- **Tag**: 标签模型，定义标签的结构和操作方法
- **Reminder**: 提醒模型，定义提醒的结构和操作方法
- **User**: 用户模型，定义用户的结构和操作方法
- **KnowledgeNode**: 知识节点模型，定义知识图谱节点的结构和操作方法
- **KnowledgeEdge**: 知识边模型，定义知识图谱边的结构和操作方法
- **InfiniteCanvas**: 无限画布模型，定义无限画布的结构和操作方法
- **CanvasElement**: 画布元素模型，定义画布元素的结构和操作方法
- **SyncInfo**: 同步信息模型，定义同步状态的结构和操作方法

## 数据同步

MongoDB Realm支持自动数据同步，但需要配置MongoDB Realm App。目前项目使用本地优先的存储策略，数据首先保存在本地，然后在有网络连接时同步到云端。

同步策略包括：

- **本地优先**: 数据首先保存在本地，然后在有网络连接时同步到云端
- **增量同步**: 只同步自上次同步以来发生变化的数据
- **冲突解决**: 使用版本号和时间戳解决数据冲突
- **离线队列**: 在离线状态下将操作存入队列，在网络恢复后执行

## 与其他服务的交互

数据库服务与以下服务有交互：

- **存储服务**: 提供键值对存储功能
- **笔记服务**: 提供笔记相关的CRUD操作
- **分类服务**: 提供分类相关的CRUD操作
- **应用服务**: 负责初始化Realm数据库和其他服务

## 使用方法

```javascript
import { realmService } from '../../services/database/realmService';

// 初始化数据库
async function initializeDatabase() {
  try {
    await realmService.init();
    console.log('数据库初始化成功');
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return false;
  }
}

// 执行写入事务
async function createData() {
  try {
    await realmService.write(realm => {
      realm.create('Note', {
        _id: new Realm.BSON.ObjectId(),
        title: '新笔记',
        content: '笔记内容',
        created_at: new Date(),
        updated_at: new Date(),
      });
    });
    console.log('数据创建成功');
    return true;
  } catch (error) {
    console.error('数据创建失败:', error);
    return false;
  }
}

// 查询数据
async function queryData() {
  try {
    const realm = await realmService.waitForInit();
    const notes = realm.objects('Note').filtered('is_deleted = false');
    console.log(`查询到${notes.length}条笔记`);
    return Array.from(notes);
  } catch (error) {
    console.error('数据查询失败:', error);
    return [];
  }
}
```

## 注意事项

1. 所有数据操作都是异步的，需要使用`async/await`或Promise处理
2. 在使用数据库服务前，确保已经初始化完成
3. 数据模型的更改需要处理迁移逻辑
4. 大量数据操作应该在事务中执行，以提高性能和可靠性

## 故障排除

如果遇到数据库相关问题，可以尝试以下方法：

1. 检查Realm数据库是否正确初始化
2. 查看日志中是否有数据库错误
3. 尝试重新初始化数据库
4. 如果数据库损坏，可能需要删除数据库文件并重新创建

## 与其他服务的交互

数据库服务与以下服务有交互：

- **API服务**: 用于与后端服务器通信
- **网络服务**: 检测网络状态，决定同步策略
- **存储服务**: 管理数据库文件和备份
- **分析服务**: 跟踪数据库操作和性能

## 注意事项

1. 所有数据操作都是异步的，需要使用`async/await`或Promise处理
2. 在使用数据库服务前，确保已经初始化完成
3. 数据模型的更改需要处理迁移逻辑
4. 大量数据操作应该在事务中执行，以提高性能和可靠性
5. 数据库操作可能是耗时的，应考虑在后台线程中执行
6. 同步操作应处理网络异常和冲突情况
7. 数据库结构变更应谨慎处理，确保向后兼容
8. 定期备份数据库，防止数据丢失
9. 监控数据库大小，避免过大影响性能
