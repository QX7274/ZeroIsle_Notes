/**
 * AI聊天模型 - Realm版本
 */

import Realm from 'realm';

/**
 * AI聊天模型定义
 */
class AIChat extends Realm.Object {
  static schema = {
    name: 'AIChat',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      title: { type: 'string', default: '新对话' },
      messages: { type: 'string', default: '[]' }, // 存储为JSON字符串
      user_id: 'string',
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      model: { type: 'string', default: 'gpt-4' },
      system_prompt: {
        type: 'string',
        default: '你是一个智能助手，可以帮助用户回答问题、提供建议和完成各种任务。',
      },
      tags: { type: 'list', objectType: 'string', default: [] },
      is_favorite: { type: 'bool', default: false },
      category: { type: 'string', default: '默认' },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析消息JSON字符串
    const messages = this.messages ? JSON.parse(this.messages) : [];

    return {
      _id: this._id,
      id: this._id,
      title: this.title,
      messages: messages,
      user_id: this.user_id,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      model: this.model,
      system_prompt: this.system_prompt,
      tags: this.tags,
      is_favorite: this.is_favorite,
      category: this.category,
    };
  }

  /**
   * 添加消息
   * @param {Realm} realm Realm实例
   * @param {string} content 消息内容
   * @param {boolean} isUser 是否为用户消息
   * @param {Object} metadata 元数据
   */
  addMessage(realm, content, isUser = true, metadata = {}) {
    realm.write(() => {
      // 解析现有消息
      const messages = this.messages ? JSON.parse(this.messages) : [];

      // 添加新消息
      messages.push({
        content,
        isUser,
        timestamp: new Date().toISOString(),
        metadata: metadata || {},
      });

      // 更新消息和时间戳
      this.messages = JSON.stringify(messages);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 清空消息
   * @param {Realm} realm Realm实例
   */
  clearMessages(realm) {
    realm.write(() => {
      this.messages = JSON.stringify([]);
      this.updated_at = new Date();
    });

    return this;
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
   * 收藏
   * @param {Realm} realm Realm实例
   */
  favorite(realm) {
    realm.write(() => {
      this.is_favorite = true;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 取消收藏
   * @param {Realm} realm Realm实例
   */
  unfavorite(realm) {
    realm.write(() => {
      this.is_favorite = false;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新标题
   * @param {Realm} realm Realm实例
   * @param {string} title 标题
   */
  updateTitle(realm, title) {
    realm.write(() => {
      this.title = title;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新系统提示
   * @param {Realm} realm Realm实例
   * @param {string} prompt 系统提示
   */
  updateSystemPrompt(realm, prompt) {
    realm.write(() => {
      this.system_prompt = prompt;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 添加标签
   * @param {Realm} realm Realm实例
   * @param {string} tag 标签
   */
  addTag(realm, tag) {
    if (!this.tags.includes(tag)) {
      realm.write(() => {
        this.tags.push(tag);
        this.updated_at = new Date();
      });
    }

    return this;
  }

  /**
   * 移除标签
   * @param {Realm} realm Realm实例
   * @param {string} tag 标签
   */
  removeTag(realm, tag) {
    realm.write(() => {
      this.tags = this.tags.filter(t => t !== tag);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新分类
   * @param {Realm} realm Realm实例
   * @param {string} category 分类
   */
  updateCategory(realm, category) {
    realm.write(() => {
      this.category = category;
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
    return realm.objectForPrimaryKey('AIChat', id);
  }

  /**
   * 静态方法 - 查找用户的聊天
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      is_favorite = null,
      category = null,
      search = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (is_favorite !== null) {
      query += ` AND is_favorite = ${is_favorite}`;
    }

    if (category) {
      query += ` AND category = "${category}"`;
    }

    if (search) {
      query += ` AND (title CONTAINS[c] "${search}")`;
      // 注意：由于messages是JSON字符串，无法直接搜索其内容
      // 如需搜索消息内容，需要在应用层面实现
    }

    let results = realm.objects('AIChat').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('updated_at', true);
    }

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找已删除的聊天
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findDeleted(realm, userId, options = {}) {
    let results = realm.objects('AIChat')
      .filtered(`user_id = "${userId}" AND is_deleted = true`)
      .sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找收藏的聊天
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findFavorites(realm, userId, options = {}) {
    let results = realm.objects('AIChat')
      .filtered(`user_id = "${userId}" AND is_favorite = true AND is_deleted = false`)
      .sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 搜索聊天
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} searchText 搜索关键词
   * @param {Object} options 选项
   */
  static search(realm, userId, searchText, options = {}) {
    const { is_deleted = false } = options;

    // 基本查询
    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;
    query += ` AND (title CONTAINS[c] "${searchText}")`;

    let results = realm.objects('AIChat').filtered(query).sorted('updated_at', true);

    // 由于消息内容存储为JSON字符串，需要在应用层面进行搜索
    // 这里先获取所有结果，然后过滤包含搜索文本的消息
    const allResults = Array.from(results);
    const filteredResults = allResults.filter(chat => {
      try {
        const messages = JSON.parse(chat.messages);
        return messages.some(msg =>
          msg.content && msg.content.toLowerCase().includes(searchText.toLowerCase())
        );
      } catch (e) {
        return false;
      }
    });

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      return filteredResults.slice(skip, skip + limit);
    }

    return filteredResults;
  }
}

export default AIChat;
