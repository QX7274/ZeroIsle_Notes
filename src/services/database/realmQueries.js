/**
 * Realm 查询工具
 * 提供优化的Realm 查询方法
 */

import realmService from './realmService';


/**
 * 构建 Realm 查询字符串 * @param {Object} filter 过滤条件
 * @returns {Object} 查询字符串和参数
 */
export function buildRealmQuery(filter = {}) {
  const queryParts = [];
  const queryParams = [];

  Object.entries(filter).forEach(([key, value], index) => {
    if (value === undefined) {
      return;
    }

    if (value === null) {
      queryParts.push(`${key} == null`);
      return;
    }

    if (typeof value === 'string') {
      queryParts.push(`${key} == $${queryParams.length}`);
      queryParams.push(value);
      return;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      queryParts.push(`${key} == ${value}`);
      return;
    }

    if (value instanceof Date) {
      queryParts.push(`${key} == $${queryParams.length}`);
      queryParams.push(value);
      return;
    }

    if (typeof value === 'object') {
      // 处理特殊查询操作
      if (value.$eq !== undefined) {
        if (typeof value.$eq === 'string' || value.$eq instanceof Date) {
          queryParts.push(`${key} == $${queryParams.length}`);
          queryParams.push(value.$eq);
        } else {
          queryParts.push(`${key} == ${value.$eq}`);
        }
        return;
      }

      if (value.$ne !== undefined) {
        if (typeof value.$ne === 'string' || value.$ne instanceof Date) {
          queryParts.push(`${key} != $${queryParams.length}`);
          queryParams.push(value.$ne);
        } else {
          queryParts.push(`${key} != ${value.$ne}`);
        }
        return;
      }

      if (value.$in !== undefined && Array.isArray(value.$in)) {
        const conditions = value.$in.map((val) => {
          const paramIndex = queryParams.length;
          queryParams.push(val);
          return `${key} == $${paramIndex}`;
        });
        queryParts.push(`(${conditions.join(' OR ')})`);
        return;
      }

      if (value.$nin !== undefined && Array.isArray(value.$nin)) {
        const conditions = value.$nin.map((val) => {
          const paramIndex = queryParams.length;
          queryParams.push(val);
          return `${key} != $${paramIndex}`;
        });
        queryParts.push(`(${conditions.join(' AND ')})`);
        return;
      }

      if (value.$gt !== undefined) {
        if (typeof value.$gt === 'string' || value.$gt instanceof Date) {
          queryParts.push(`${key} > $${queryParams.length}`);
          queryParams.push(value.$gt);
        } else {
          queryParts.push(`${key} > ${value.$gt}`);
        }
        return;
      }

      if (value.$gte !== undefined) {
        if (typeof value.$gte === 'string' || value.$gte instanceof Date) {
          queryParts.push(`${key} >= $${queryParams.length}`);
          queryParams.push(value.$gte);
        } else {
          queryParts.push(`${key} >= ${value.$gte}`);
        }
        return;
      }

      if (value.$lt !== undefined) {
        if (typeof value.$lt === 'string' || value.$lt instanceof Date) {
          queryParts.push(`${key} < $${queryParams.length}`);
          queryParams.push(value.$lt);
        } else {
          queryParts.push(`${key} < ${value.$lt}`);
        }
        return;
      }

      if (value.$lte !== undefined) {
        if (typeof value.$lte === 'string' || value.$lte instanceof Date) {
          queryParts.push(`${key} <= $${queryParams.length}`);
          queryParams.push(value.$lte);
        } else {
          queryParts.push(`${key} <= ${value.$lte}`);
        }
        return;
      }

      if (value.$contains !== undefined) {
        queryParts.push(`${key} CONTAINS[c] $${queryParams.length}`);
        queryParams.push(value.$contains);
        return;
      }

      if (value.$beginsWith !== undefined) {
        queryParts.push(`${key} BEGINSWITH[c] $${queryParams.length}`);
        queryParams.push(value.$beginsWith);
        return;
      }

      if (value.$endsWith !== undefined) {
        queryParts.push(`${key} ENDSWITH[c] $${queryParams.length}`);
        queryParams.push(value.$endsWith);
        return;
      }
    }
  });

  return {
    queryString: queryParts.length > 0 ? queryParts.join(' AND ') : '',
    queryParams,
  };
}
/**
 * 查找文档
 * @param {string} schemaName 模式名称
 * @param {Object} filter 过滤条件
 * @param {Object} options 选项
 * @returns {Promise<Array>} 文档数组
 */
export async function findDocuments(schemaName, filter = {}, options = {}) {
  try {
    const realm = await realmService.getRealm();
    const { queryString, queryParams } = buildRealmQuery(filter);

    // 获取所有对象
    let objects = realm.objects(schemaName);

    // 应用过滤条件
    if (queryString) {
      objects = objects.filtered(queryString, ...queryParams);
    }

    // 应用排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortDirection = options.sort[sortField] === 1;
      objects = objects.sorted(sortField, sortDirection);
    }

    // 应用分页 (性能优化：先分页再 materialize)
    const skip = options.skip || 0;
    const limit = options.limit;

    let paged = objects;
    if (limit !== undefined) {
      paged = objects.slice(skip, skip + limit);
    } else if (skip > 0) {
      paged = objects.slice(skip);
    }

    // 转换为普通对象数组（仅转换分页后的对象）
    const results = Array.from(paged).map(obj => realmService.realmObjectToPlain(obj));

    // 如果未指定 limit，为避免意外全量加载，默认限制前 200 条
    if (limit === undefined) {
      return results.slice(0, 200);
    }

    return results;
  } catch (error) {
    console.error(`查询${schemaName}文档失败`, error);
    throw error;
  }
}

/**
 * 查找单个文档
 * @param {string} schemaName 模式名称
 * @param {Object} filter 过滤条件
 * @returns {Promise<Object|null>} 文档或null
 */
export async function findOneDocument(schemaName, filter = {}) {
  try {
    const results = await findDocuments(schemaName, filter, { limit: 1 });
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error(`查询单个${schemaName}文档失败`, error);
    throw error;
  }
}

/**
 * 根据ID查找文档
 * @param {string} schemaName 模式名称
 * @param {string} id 文档ID
 * @returns {Promise<Object|null>} 文档或null
 */
export async function findDocumentById(schemaName, id) {
  try {
    const realm = await realmService.getRealm();
    const object = realm.objectForPrimaryKey(schemaName, id);
    return object ? realmService.realmObjectToPlain(object) : null;
  } catch (error) {
    console.error(`根据ID查询${schemaName}文档失败`, error);
    throw error;
  }
}

/**
 * 创建文档
 * @param {string} schemaName 模式名称
 * @param {Object} data 文档数据
 * @returns {Promise<Object>} 创建的文档
 */
export async function createDocument(schemaName, data) {
  try {
    const realm = await realmService.getRealm();
    let createdObject;

    realm.write(() => {
      createdObject = realm.create(schemaName, {
        ...data,
        _id: data._id || realmService.createObjectId(),
        created_at: data.created_at || new Date(),
        updated_at: data.updated_at || new Date(),
      });
    });

    return realmService.realmObjectToPlain(createdObject);
  } catch (error) {
    console.error(`创建${schemaName}文档失败`, error);
    throw error;
  }
}

/**
 * 更新文档
 * @param {string} schemaName 模式名称
 * @param {string} id 文档ID
 * @param {Object} data 更新数据
 * @returns {Promise<Object|null>} 更新后的文档或null
 */
export async function updateDocument(schemaName, id, data) {
  try {
    const realm = await realmService.getRealm();
    const object = realm.objectForPrimaryKey(schemaName, id);

    if (!object) {
      throw new Error(`更新失败，文档不存在: ${schemaName}/${id}`);
    }

    realm.write(() => {
      // 更新更新时间
      object.updated_at = new Date();

      // 更新其他字段
      Object.entries(data).forEach(([key, value]) => {
        if (key !== '_id' && key !== 'created_at') {
          object[key] = value;
        }
      });
    });

    return realmService.realmObjectToPlain(object);
  } catch (error) {
    console.error(`更新${schemaName}文档失败`, error);
    throw error;
  }
}

/**
 * 删除文档
 * @param {string} schemaName 模式名称
 * @param {string} id 文档ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function deleteDocument(schemaName, id) {
  try {
    const realm = await realmService.getRealm();
    const object = realm.objectForPrimaryKey(schemaName, id);

    if (!object) {
      // 业务语义：目标不存在时视为幂等删除完成（非错误）
      return true;
    }

    realm.write(() => {
      realm.delete(object);
    });

    return true;
  } catch (error) {
    console.error(`删除${schemaName}文档失败`, error);
    throw error;
  }
}

export default {
  buildRealmQuery,
  findDocuments,
  findOneDocument,
  findDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
};

