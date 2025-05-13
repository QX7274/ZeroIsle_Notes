/**
 * 分类模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 分类模型定义
 */
class Category extends Realm.Object {
  static schema = {
    name: 'Category',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      name: 'string',
      description: { type: 'string', default: '' },
      color: { type: 'string', default: '#2196F3' },
      icon: { type: 'string', default: 'folder' },
      parent_id: { type: 'string', optional: true },
      is_default: { type: 'bool', default: false },
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      user_id: 'string',
      order: { type: 'int', default: 0 },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    return {
      _id: this._id,
      id: this._id,
      name: this.name,
      description: this.description,
      color: this.color,
      icon: this.icon,
      parent_id: this.parent_id,
      is_default: this.is_default,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      user_id: this.user_id,
      order: this.order,
    };
  }

  /**
   * 软删除
   * @param {Realm} realm Realm实例
   */
  softDelete(realm) {
    realm.write(() => {
      this.is_deleted = true;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 恢复
   * @param {Realm} realm Realm实例
   */
  restore(realm) {
    realm.write(() => {
      this.is_deleted = false;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('Category', id);
  }

  /**
   * 静态方法 - 查找用户的分类
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      parent_id = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (parent_id !== undefined) {
      if (parent_id === null) {
        query += ' AND parent_id = null';
      } else {
        query += ` AND parent_id = "${parent_id}"`;
      }
    }

    let results = realm.objects('Category').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === 1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted([['order', false], ['name', false]]);
    }

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 100;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找默认分类
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static findDefault(realm, userId) {
    return realm.objects('Category')
      .filtered(`user_id = "${userId}" AND is_default = true AND is_deleted = false`)
      .sorted('created_at')[0];
  }

  /**
   * 静态方法 - 创建默认分类
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static createDefault(realm, userId) {
    const defaultCategory = this.findDefault(realm, userId);

    if (defaultCategory) {
      return defaultCategory;
    }

    let category;
    realm.write(() => {
      category = realm.create('Category', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        name: '默认分类',
        description: '默认分类',
        color: '#2196F3',
        icon: 'folder',
        is_default: true,
        user_id: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    return category;
  }

  /**
   * 静态方法 - 根据名称查找
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} name 分类名称
   */
  static findByName(realm, userId, name) {
    return realm.objects('Category')
      .filtered(`user_id = "${userId}" AND name = "${name}" AND is_deleted = false`)
      .sorted('created_at')[0];
  }

  /**
   * 静态方法 - 获取分类树
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static getTree(realm, userId) {
    const categories = realm.objects('Category')
      .filtered(`user_id = "${userId}" AND is_deleted = false`)
      .sorted([['order', false], ['name', false]]);

    const categoryMap = {};
    const rootCategories = [];

    // 构建分类映射
    Array.from(categories).forEach(category => {
      categoryMap[category._id] = {
        ...category.toJSON(),
        children: [],
      };
    });

    // 构建分类树
    Array.from(categories).forEach(category => {
      const categoryId = category._id;

      if (category.parent_id) {
        const parentId = category.parent_id;

        if (categoryMap[parentId]) {
          categoryMap[parentId].children.push(categoryMap[categoryId]);
        } else {
          rootCategories.push(categoryMap[categoryId]);
        }
      } else {
        rootCategories.push(categoryMap[categoryId]);
      }
    });

    return rootCategories;
  }
}

export default Category;
