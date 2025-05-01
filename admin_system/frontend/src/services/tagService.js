import api from './authService';

// 获取标签列表
export const getTags = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/tags', { params });
    // return response.data;

    // 使用模拟数据
    return mockTags(params);
  } catch (error) {
    console.error('获取标签列表错误:', error);
    throw error;
  }
};

// 获取标签详情
export const getTagDetail = async (id) => {
  try {
    const response = await api.get(`/tags/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取标签详情错误:', error);
    throw error;
  }
};

// 创建标签
export const createTag = async (tagData) => {
  try {
    const response = await api.post('/tags', tagData);
    return response.data;
  } catch (error) {
    console.error('创建标签错误:', error);
    throw error;
  }
};

// 更新标签
export const updateTag = async (id, tagData) => {
  try {
    const response = await api.put(`/tags/${id}`, tagData);
    return response.data;
  } catch (error) {
    console.error('更新标签错误:', error);
    throw error;
  }
};

// 删除标签
export const deleteTag = async (id) => {
  try {
    const response = await api.delete(`/tags/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除标签错误:', error);
    throw error;
  }
};

// 批量删除标签
export const batchDeleteTags = async (ids) => {
  try {
    const response = await api.post('/tags/batch-delete', { ids });
    return response.data;
  } catch (error) {
    console.error('批量删除标签错误:', error);
    throw error;
  }
};

// 合并标签
export const mergeTags = async (sourceId, targetId) => {
  try {
    const response = await api.post('/tags/merge', { sourceId, targetId });
    return response.data;
  } catch (error) {
    console.error('合并标签错误:', error);
    throw error;
  }
};

// 获取标签统计数据
export const getTagStats = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/tags/stats');
    // return response.data;

    // 使用模拟数据
    return mockTagStats();
  } catch (error) {
    console.error('获取标签统计数据错误:', error);
    throw error;
  }
};

// 模拟数据
const mockTags = (params) => {
  // 生成模拟标签数据
  const tags = [
    { id: 'tag-1', name: '重要', color: 'red', count: 10, createdAt: '2023-01-01', updatedAt: '2023-01-01' },
    { id: 'tag-2', name: '会议', color: 'blue', count: 8, createdAt: '2023-01-02', updatedAt: '2023-01-02' },
    { id: 'tag-3', name: '项目', color: 'green', count: 12, createdAt: '2023-01-03', updatedAt: '2023-01-03' },
    { id: 'tag-4', name: '学习', color: 'orange', count: 15, createdAt: '2023-01-04', updatedAt: '2023-01-04' },
    { id: 'tag-5', name: '生活', color: 'purple', count: 5, createdAt: '2023-01-05', updatedAt: '2023-01-05' },
    { id: 'tag-6', name: '工作', color: 'cyan', count: 20, createdAt: '2023-01-06', updatedAt: '2023-01-06' },
    { id: 'tag-7', name: '家庭', color: 'pink', count: 7, createdAt: '2023-01-07', updatedAt: '2023-01-07' },
    { id: 'tag-8', name: '旅行', color: 'lime', count: 3, createdAt: '2023-01-08', updatedAt: '2023-01-08' },
    { id: 'tag-9', name: '健康', color: 'gold', count: 6, createdAt: '2023-01-09', updatedAt: '2023-01-09' },
    { id: 'tag-10', name: '财务', color: 'magenta', count: 4, createdAt: '2023-01-10', updatedAt: '2023-01-10' },
  ];

  // 关键词筛选
  let filteredTags = [...tags];
  if (params && params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredTags = filteredTags.filter(
      (tag) => tag.name.toLowerCase().includes(keyword)
    );
  }

  // 排序
  if (params && params.sortField && params.sortOrder) {
    filteredTags.sort((a, b) => {
      const fieldA = a[params.sortField];
      const fieldB = b[params.sortField];

      if (params.sortOrder === 'ascend') {
        return fieldA > fieldB ? 1 : -1;
      } else {
        return fieldA < fieldB ? 1 : -1;
      }
    });
  }

  // 分页
  if (params && params.page && params.pageSize) {
    const pageSize = params.pageSize;
    const page = params.page;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedTags = filteredTags.slice(start, end);

    return {
      data: paginatedTags,
      total: filteredTags.length,
      page,
      pageSize,
    };
  }

  return filteredTags;
};

const mockTagStats = () => {
  // 模拟标签统计数据
  return {
    totalTags: 10,
    mostUsedTags: [
      { id: 'tag-6', name: '工作', color: 'cyan', count: 20 },
      { id: 'tag-4', name: '学习', color: 'orange', count: 15 },
      { id: 'tag-3', name: '项目', color: 'green', count: 12 },
      { id: 'tag-1', name: '重要', color: 'red', count: 10 },
      { id: 'tag-2', name: '会议', color: 'blue', count: 8 },
    ],
    recentlyAddedTags: [
      { id: 'tag-10', name: '财务', color: 'magenta', createdAt: '2023-01-10' },
      { id: 'tag-9', name: '健康', color: 'gold', createdAt: '2023-01-09' },
      { id: 'tag-8', name: '旅行', color: 'lime', createdAt: '2023-01-08' },
      { id: 'tag-7', name: '家庭', color: 'pink', createdAt: '2023-01-07' },
      { id: 'tag-6', name: '工作', color: 'cyan', createdAt: '2023-01-06' },
    ],
    tagColors: [
      { color: 'red', count: 1 },
      { color: 'blue', count: 1 },
      { color: 'green', count: 1 },
      { color: 'orange', count: 1 },
      { color: 'purple', count: 1 },
      { color: 'cyan', count: 1 },
      { color: 'pink', count: 1 },
      { color: 'lime', count: 1 },
      { color: 'gold', count: 1 },
      { color: 'magenta', count: 1 },
    ],
  };
};
