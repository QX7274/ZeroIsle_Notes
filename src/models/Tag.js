/**
 * 标签模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 标签模型定义
 */
class Tag extends Realm.Object {
  static schema = {
    name: 'Tag',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      name: 'string',
      color: { type: 'string', default: '#2196F3' },
      user_id: 'string',
      count: { type: 'int', default: 0 },
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
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
      color: this.color,
      user_id: this.user_id,
      count: this.count,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
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
   * 增加计数
   * @param {Realm} realm Realm实例
   * @param {number} amount 增加数量
   */
  incrementCount(realm, amount = 1) {
    realm.write(() => {
      this.count += amount;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 减少计数
   * @param {Realm} realm Realm实例
   * @param {number} amount 减少数量
   */
  decrementCount(realm, amount = 1) {
    realm.write(() => {
      this.count = Math.max(0, this.count - amount);
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 更新颜色
   * @param {Realm} realm Realm实例
   * @param {string} color 颜色
   */
  updateColor(realm, color) {
    realm.write(() => {
      this.color = color;
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
    return realm.objectForPrimaryKey('Tag', id);
  }

  /**
   * 静态方法 - 查找用户的标签
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    try {
      const {
        is_deleted = false,
      } = options;

      let results = realm.objects('Tag')
        .filtered(`user_id = "${userId}" AND is_deleted = ${is_deleted}`);

      // 排序
      if (options.sort) {
        try {
          const sortFields = [];

          // 检查模式中是否存在count属性
          const tagSchema = realm.schema.find(schema => schema.name === 'Tag');
          const hasCountProperty = tagSchema && tagSchema.properties &&
                                  (tagSchema.properties.count !== undefined);

          if (options.sort.count !== undefined) {
            if (hasCountProperty) {
              sortFields.push(['count', options.sort.count === -1]);
            } else {
              console.warn('Tag模式中不存在count属性，跳过count排序');
            }
          }

          if (options.sort.name !== undefined) {
            sortFields.push(['name', options.sort.name === -1]);
          }

          if (sortFields.length > 0) {
            results = results.sorted(sortFields);
          }
        } catch (sortError) {
          console.error('标签排序失败:', sortError);
          // 如果排序失败，尝试使用默认排序
          try {
            results = results.sorted('name');
          } catch (fallbackSortError) {
            console.error('标签默认排序也失败:', fallbackSortError);
            // 继续使用未排序的结果
          }
        }
      } else {
        // 默认排序，添加错误处理
        try {
          // 检查模式中是否存在count属性
          const tagSchema = realm.schema.find(schema => schema.name === 'Tag');
          const hasCountProperty = tagSchema && tagSchema.properties &&
                                  (tagSchema.properties.count !== undefined);

          if (hasCountProperty) {
            results = results.sorted([['count', true], ['name', false]]);
          } else {
            results = results.sorted('name');
          }
        } catch (defaultSortError) {
          console.error('标签默认排序失败:', defaultSortError);
          // 继续使用未排序的结果
        }
      }

      // 分页
      if (options.skip !== undefined && options.limit !== undefined) {
        const skip = options.skip || 0;
        const limit = options.limit || 100;
        results = Array.from(results).slice(skip, skip + limit);
      }

      return results;
    } catch (error) {
      console.error('查找多个Tag失败', error);
      // 返回空数组而不是抛出异常，以提高健壮性
      return [];
    }
  }

  /**
   * 静态方法 - 根据名称查找
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} name 标签名称
   */
  static findByName(realm, userId, name) {
    return realm.objects('Tag')
      .filtered(`user_id = "${userId}" AND name = "${name}" AND is_deleted = false`)[0];
  }

  /**
   * 静态方法 - 查找或创建标签
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} name 标签名称
   * @param {string} color 颜色
   */
  static findOrCreate(realm, userId, name, color = '#2196F3') {
    let tag = this.findByName(realm, userId, name);

    if (!tag) {
      realm.write(() => {
        tag = realm.create('Tag', {
          _id: new Realm.BSON.ObjectId().toHexString(),
          user_id: userId,
          name,
          color,
          count: 1,
          created_at: new Date(),
          updated_at: new Date(),
        });
      });
    }

    return tag;
  }

  /**
   * 静态方法 - 批量查找或创建标签
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Array<string>} names 标签名称数组
   */
  static findOrCreateBatch(realm, userId, names) {
    const tags = [];

    realm.write(() => {
      for (const name of names) {
        if (!name) continue;

        let tag = this.findByName(realm, userId, name);

        if (!tag) {
          tag = realm.create('Tag', {
            _id: new Realm.BSON.ObjectId().toHexString(),
            user_id: userId,
            name,
            color: '#2196F3',
            count: 1,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }

        tags.push(tag);
      }
    });

    return tags;
  }

  /**
   * 静态方法 - 更新标签计数
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static updateCounts(realm, userId) {
    const tags = realm.objects('Tag')
      .filtered(`user_id = "${userId}" AND is_deleted = false`);

    const notes = realm.objects('Note')
      .filtered(`user_id = "${userId}" AND is_deleted = false`);

    realm.write(() => {
      // 重置所有标签计数
      for (const tag of tags) {
        tag.count = 0;
      }

      // 统计每个标签的使用次数
      for (const note of notes) {
        for (const tagName of note.tags) {
          const tag = this.findByName(realm, userId, tagName);
          if (tag) {
            tag.count += 1;
          }
        }
      }

      // 更新时间戳
      for (const tag of tags) {
        tag.updated_at = new Date();
      }
    });
  }

  /**
   * 静态方法 - 获取热门标签
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   */
  static getPopularTags(realm, userId, limit = 10) {
    const results = realm.objects('Tag')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND count > 0`)
      .sorted('count', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 搜索标签
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} query 搜索关键词
   * @param {number} limit 限制数量
   */
  static searchTags(realm, userId, query, limit = 10) {
    const results = realm.objects('Tag')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND name CONTAINS[c] "${query}"`)
      .sorted('count', true);

    return Array.from(results).slice(0, limit);
  }
}

export default Tag;
