/**
 * 搜索索引模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 搜索索引模型定义
 */
class SearchIndex extends Realm.Object {
  static schema = {
    name: 'SearchIndex',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      entity_id: 'string',
      entity_type: 'string', // 'note', 'category', 'tag', 'file', 'knowledge_node', 'knowledge_graph', 'mind_map', 'mind_map_node', 'canvas', 'canvas_element', 'ai_chat'
      user_id: 'string',
      title: 'string',
      content: { type: 'string', default: '' },
      // Realm JS 新版中，属性对象声明列表需使用 { type: 'list', objectType: 'xxx' }
      keywords: { type: 'list', objectType: 'string', default: [] },
      tags: { type: 'list', objectType: 'string', default: [] },
      category: { type: 'string', optional: true },
      created_at: 'date',
      updated_at: 'date',
      is_deleted: { type: 'bool', default: false },
      metadata: { type: 'string', default: '{}' }, // 存储为JSON字符串
      relevance_score: { type: 'float', default: 1.0 },
      embedding: { type: 'string', optional: true }, // 存储为JSON字符串
      embedding_model: { type: 'string', optional: true },
      language: { type: 'string', default: 'zh-CN' },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    return {
      _id: this._id,
      id: this._id,
      entity_id: this.entity_id,
      entity_type: this.entity_type,
      user_id: this.user_id,
      title: this.title,
      content: this.content,
      keywords: this.keywords,
      tags: this.tags,
      category: this.category,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_deleted: this.is_deleted,
      metadata: metadata,
      relevance_score: this.relevance_score,
      embedding_model: this.embedding_model,
      language: this.language,
    };
  }

  /**
   * 更新索引内容
   * @param {Realm} realm Realm实例
   * @param {Object} data 索引数据
   */
  updateContent(realm, data) {
    const { title, content, keywords, tags, category, metadata, relevance_score, language } = data;

    realm.write(() => {
      if (title !== undefined) {this.title = title;}
      if (content !== undefined) {this.content = content;}
      if (keywords !== undefined) {this.keywords = keywords;}
      if (tags !== undefined) {this.tags = tags;}
      if (category !== undefined) {this.category = category;}

      if (metadata !== undefined) {
        // 解析当前元数据
        const currentMetadata = this.metadata ? JSON.parse(this.metadata) : {};

        // 合并元数据
        const newMetadata = {
          ...currentMetadata,
          ...metadata,
        };

        // 保存为JSON字符串
        this.metadata = JSON.stringify(newMetadata);
      }

      if (relevance_score !== undefined) {this.relevance_score = relevance_score;}
      if (language !== undefined) {this.language = language;}

      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新嵌入向量
   * @param {Realm} realm Realm实例
   * @param {Array<number>} embedding 嵌入向量
   * @param {string} model 嵌入模型
   */
  updateEmbedding(realm, embedding, model) {
    realm.write(() => {
      this.embedding = JSON.stringify(embedding);
      this.embedding_model = model;
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
   * 添加关键词
   * @param {Realm} realm Realm实例
   * @param {string|Array<string>} keywords 关键词
   */
  addKeywords(realm, keywords) {
    const keywordArray = Array.isArray(keywords) ? keywords : [keywords];

    realm.write(() => {
      // 添加不重复的关键词
      const uniqueKeywords = [...new Set([...this.keywords, ...keywordArray])];
      this.keywords = uniqueKeywords;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 移除关键词
   * @param {Realm} realm Realm实例
   * @param {string|Array<string>} keywords 关键词
   */
  removeKeywords(realm, keywords) {
    const keywordArray = Array.isArray(keywords) ? keywords : [keywords];

    realm.write(() => {
      this.keywords = this.keywords.filter(k => !keywordArray.includes(k));
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 添加标签
   * @param {Realm} realm Realm实例
   * @param {string|Array<string>} tags 标签
   */
  addTags(realm, tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];

    realm.write(() => {
      // 添加不重复的标签
      const uniqueTags = [...new Set([...this.tags, ...tagArray])];
      this.tags = uniqueTags;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 移除标签
   * @param {Realm} realm Realm实例
   * @param {string|Array<string>} tags 标签
   */
  removeTags(realm, tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];

    realm.write(() => {
      this.tags = this.tags.filter(t => !tagArray.includes(t));
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
    return realm.objectForPrimaryKey('SearchIndex', id);
  }

  /**
   * 静态方法 - 根据实体查找
   * @param {Realm} realm Realm实例
   * @param {string} entityId 实体ID
   * @param {string} entityType 实体类型
   */
  static findByEntity(realm, entityId, entityType) {
    return realm.objects('SearchIndex')
      .filtered(`entity_id = "${entityId}" AND entity_type = "${entityType}" AND is_deleted = false`)[0];
  }


  /**
   * 静态方法 - 查找用户的索引
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      entity_type = null,
      category = null,
      tags = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (entity_type) {
      query += ` AND entity_type = "${entity_type}"`;
    }

    if (category) {
      query += ` AND category = "${category}"`;
    }

    if (tags) {
      // 在Realm中处理数组包含查询比较复杂，这里简化处理
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagQueries = tagArray.map(tag => `tags CONTAINS "${tag}"`).join(' OR ');
      if (tagQueries) {
        query += ` AND (${tagQueries})`;
      }
    }

    let results = realm.objects('SearchIndex').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('updated_at', true);
    }

    // 分页 (性能优化：先 slice 再 materialize)
    if (options.skip !== undefined || options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 100;
      results = results.slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 创建或更新索引
   * @param {Realm} realm Realm实例
   * @param {Object} data 索引数据
   */
  static createOrUpdate(realm, data) {
    const { entity_id, entity_type, user_id, title, content, keywords, tags, category, metadata, relevance_score, language } = data;

    if (!entity_id || !entity_type || !user_id || !title) {
      throw new Error('实体ID、实体类型、用户ID和标题是必需的');
    }

    // 查找现有索引
    const index = realm.objects('SearchIndex')
      .filtered(`entity_id = "${entity_id}" AND entity_type = "${entity_type}"`)[0];

    if (index) {
      // 更新现有索引
      return index.updateContent(realm, {
        title,
        content,
        keywords,
        tags,
        category,
        metadata,
        relevance_score,
        language,
      });
    }

    // 创建新索引
    let newIndex;
    realm.write(() => {
      newIndex = realm.create('SearchIndex', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        entity_id,
        entity_type,
        user_id,
        title,
        content: content || '',
        keywords: keywords || [],
        tags: tags || [],
        category: category || null,
        metadata: JSON.stringify(metadata || {}),
        relevance_score: relevance_score || 1.0,
        language: language || 'zh-CN',
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    return newIndex;
  }

  /**
   * 静态方法 - 文本搜索
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} query 搜索关键词
   * @param {Object} options 选项
   */
  static textSearch(realm, userId, query, options = {}) {
    const {
      limit = 20,
      skip = 0,
      entity_types = null,
      category = null,
      tags = null,
      date_range = null,
    } = options;

    // 基本查询
    let queryStr = `user_id = "${userId}" AND is_deleted = false`;

    // 在Realm中，我们不能直接使用全文搜索，但可以使用CONTAINS运算符
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    if (searchTerms.length > 0) {
      const searchQueries = searchTerms.map(term =>
        `title CONTAINS[c] "${term}" OR content CONTAINS[c] "${term}" OR ANY keywords CONTAINS[c] "${term}" OR ANY tags CONTAINS[c] "${term}"`
      ).join(' OR ');

      queryStr += ` AND (${searchQueries})`;
    }

    // 实体类型过滤
    if (entity_types) {
      const typeArray = Array.isArray(entity_types) ? entity_types : [entity_types];
      const typeQueries = typeArray.map(type => `entity_type = "${type}"`).join(' OR ');
      if (typeQueries) {
        queryStr += ` AND (${typeQueries})`;
      }
    }

    // 分类过滤
    if (category) {
      queryStr += ` AND category = "${category}"`;
    }

    // 标签过滤
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagQueries = tagArray.map(tag => `tags CONTAINS "${tag}"`).join(' OR ');
      if (tagQueries) {
        queryStr += ` AND (${tagQueries})`;
      }
    }

    // 日期范围过滤
    if (date_range) {
      const { start, end } = date_range;
      if (start && end) {
        queryStr += ' AND (updated_at >= $0 AND updated_at <= $1)';
      } else if (start) {
        queryStr += ' AND updated_at >= $0';
      } else if (end) {
        queryStr += ' AND updated_at <= $0';
      }
    }

    // 执行查询
    let results;
    if (date_range) {
      const { start, end } = date_range;
      if (start && end) {
        results = realm.objects('SearchIndex').filtered(queryStr, new Date(start), new Date(end));
      } else if (start) {
        results = realm.objects('SearchIndex').filtered(queryStr, new Date(start));
      } else if (end) {
        results = realm.objects('SearchIndex').filtered(queryStr, new Date(end));
      }
    } else {
      results = realm.objects('SearchIndex').filtered(queryStr);
    }

    // 排序 - 由于Realm不支持文本搜索评分，我们使用相关性分数和更新时间排序
    results = results.sorted([['relevance_score', true], ['updated_at', true]]);

    // 分页 (性能优化：先 slice 再 materialize)
    results = results.slice(skip, skip + limit);

    return results;
  }

  /**
   * 静态方法 - 向量搜索
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Array<number>} embedding 查询嵌入向量
   * @param {Object} options 选项
   */
  static vectorSearch(realm, userId, embedding, options = {}) {
    const {
      limit = 20,
      entity_types = null,
      min_similarity = 0.7,
    } = options;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('嵌入向量是必需的');
    }

    // 基本查询
    let queryStr = `user_id = "${userId}" AND is_deleted = false AND embedding != null`;

    // 实体类型过滤
    if (entity_types) {
      const typeArray = Array.isArray(entity_types) ? entity_types : [entity_types];
      const typeQueries = typeArray.map(type => `entity_type = "${type}"`).join(' OR ');
      if (typeQueries) {
        queryStr += ` AND (${typeQueries})`;
      }
    }

    // 执行查询
    const results = realm.objects('SearchIndex').filtered(queryStr);

    // 计算余弦相似度并过滤 (注意：此操作为 CPU 密集型，仅用于小规模 embedding)
    const resultsWithSimilarity = Array.from(results.slice(0, 500)).map(index => {
      // 解析嵌入向量
      const indexEmbedding = JSON.parse(index.embedding);

      // 计算余弦相似度
      const dotProduct = embedding.reduce((sum, value, i) => sum + value * indexEmbedding[i], 0);
      const magnitude1 = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));
      const magnitude2 = Math.sqrt(indexEmbedding.reduce((sum, value) => sum + value * value, 0));
      const similarity = dotProduct / (magnitude1 * magnitude2);

      return { index, similarity };
    }).filter(item => item.similarity >= min_similarity);

    // 排序并限制结果
    resultsWithSimilarity.sort((a, b) => {
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }
      return b.index.relevance_score - a.index.relevance_score;
    });

    return resultsWithSimilarity.slice(0, limit).map(item => item.index);
  }
}

export default SearchIndex;
