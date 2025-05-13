# 分类服务

本目录包含零屿笔记应用的分类服务，负责管理笔记分类的创建、读取、更新和删除操作。

## 文件结构

- **realmCategoryService.js**: Realm分类服务，提供分类相关的CRUD操作
- **index.js**: 分类服务索引，导出所有分类相关服务

## 主要功能

### Realm分类服务 (realmCategoryService.js)

Realm分类服务提供以下主要功能：

- **分类创建**: 创建新的笔记分类
- **分类更新**: 更新现有的笔记分类
- **分类删除**: 删除笔记分类（软删除或永久删除）
- **分类恢复**: 恢复已删除的笔记分类
- **分类查询**: 查询分类列表，支持按用户ID、名称等条件查询
- **分类搜索**: 搜索分类，支持关键词搜索
- **分类同步**: 管理分类的同步状态，支持离线操作和同步

## 分类模型

分类模型定义了分类的结构和属性：

```javascript
// Category.js
export class Category extends Realm.Object {
  static schema = {
    name: 'Category',
    primaryKey: '_id',
    properties: {
      _id: 'objectId',
      user_id: 'string?',
      name: 'string',
      description: 'string?',
      color: 'string?',
      icon: 'string?',
      parent_id: 'string?',
      order_index: { type: 'int', default: 0 },
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

## 分类操作

### 创建分类

```javascript
/**
 * 创建分类
 * @param {Object} categoryData 分类数据
 * @returns {Promise<Object>} 创建的分类
 */
async createCategory(categoryData) {
  try {
    const realm = await realmService.waitForInit();
    
    let category;
    await realm.write(() => {
      category = Category.create(realm, categoryData);
    });
    
    EventEmitter.emit(CATEGORY_EVENTS.CREATED, category);
    return category;
  } catch (error) {
    console.error('创建分类失败:', error);
    throw error;
  }
}
```

### 更新分类

```javascript
/**
 * 更新分类
 * @param {string} categoryId 分类ID
 * @param {Object} categoryData 分类数据
 * @returns {Promise<Object>} 更新后的分类
 */
async updateCategory(categoryId, categoryData) {
  try {
    const realm = await realmService.waitForInit();
    
    let category;
    await realm.write(() => {
      category = Category.update(realm, categoryId, categoryData);
    });
    
    EventEmitter.emit(CATEGORY_EVENTS.UPDATED, category);
    return category;
  } catch (error) {
    console.error('更新分类失败:', error);
    throw error;
  }
}
```

### 删除分类

```javascript
/**
 * 删除分类
 * @param {string} categoryId 分类ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
async deleteCategory(categoryId, permanent = false) {
  try {
    const realm = await realmService.waitForInit();
    
    if (permanent) {
      await realm.write(() => {
        Category.hardDelete(realm, categoryId);
      });
    } else {
      await realm.write(() => {
        Category.softDelete(realm, categoryId);
      });
    }
    
    EventEmitter.emit(CATEGORY_EVENTS.DELETED, { id: categoryId, permanent });
    return true;
  } catch (error) {
    console.error('删除分类失败:', error);
    throw error;
  }
}
```

### 获取分类列表

```javascript
/**
 * 获取分类列表
 * @param {string} userId 用户ID
 * @returns {Promise<Array>} 分类列表
 */
async getCategories(userId = null) {
  try {
    const realm = await realmService.waitForInit();
    const categories = Category.findAll(realm, userId);
    return Array.from(categories);
  } catch (error) {
    console.error('获取分类列表失败:', error);
    throw error;
  }
}
```

### 搜索分类

```javascript
/**
 * 搜索分类
 * @param {string} keyword 关键词
 * @param {string} userId 用户ID
 * @returns {Promise<Array>} 分类列表
 */
async searchCategories(keyword, userId = null) {
  try {
    const realm = await realmService.waitForInit();
    const categories = Category.search(realm, keyword, userId);
    return Array.from(categories);
  } catch (error) {
    console.error('搜索分类失败:', error);
    throw error;
  }
}
```

## 分类事件

分类服务发送以下事件：

- **CATEGORY_EVENTS.CREATED**: 分类创建事件，包含创建的分类
- **CATEGORY_EVENTS.UPDATED**: 分类更新事件，包含更新后的分类
- **CATEGORY_EVENTS.DELETED**: 分类删除事件，包含删除的分类ID和是否永久删除
- **CATEGORY_EVENTS.RESTORED**: 分类恢复事件，包含恢复的分类

## 与其他服务的交互

分类服务与以下服务有交互：

- **数据库服务 (realmService)**: 用于访问Realm数据库
- **事件服务 (EventEmitter)**: 用于发送分类相关事件
- **离线服务 (realmOfflineService)**: 用于处理离线操作和同步

## 使用方法

```javascript
import { realmCategoryService } from '../../services/categories';

// 创建分类
async function createCategory() {
  try {
    const category = await realmCategoryService.createCategory({
      name: '工作',
      description: '工作相关的笔记',
      color: '#FF5733',
      icon: 'briefcase',
    });
    console.log('分类创建成功:', category);
    return category;
  } catch (error) {
    console.error('创建分类失败:', error);
    return null;
  }
}

// 获取分类列表
async function getCategories() {
  try {
    const categories = await realmCategoryService.getCategories();
    console.log('分类列表:', categories);
    return categories;
  } catch (error) {
    console.error('获取分类列表失败:', error);
    return [];
  }
}
```

## 注意事项

1. **事务**: 所有修改Realm数据库的操作都必须在事务中执行
2. **异步**: 所有数据库操作都应该是异步的，使用`async/await`处理
3. **错误处理**: 添加适当的错误处理，确保应用在数据库操作失败时能够正常运行
4. **事件**: 使用事件机制通知其他组件分类的变化
5. **离线操作**: 支持离线操作，确保用户在离线状态下也能操作分类
