import api from './authService';

// 获取分类列表
export const getCategories = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/categories', { params });
    // return response.data;

    // 使用模拟数据
    return mockCategories(params);
  } catch (error) {
    console.error('获取分类列表错误:', error);
    throw error;
  }
};

// 获取分类详情
export const getCategoryDetail = async (id) => {
  try {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取分类详情错误:', error);
    throw error;
  }
};

// 创建分类
export const createCategory = async (categoryData) => {
  try {
    const response = await api.post('/categories', categoryData);
    return response.data;
  } catch (error) {
    console.error('创建分类错误:', error);
    throw error;
  }
};

// 更新分类
export const updateCategory = async (id, categoryData) => {
  try {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  } catch (error) {
    console.error('更新分类错误:', error);
    throw error;
  }
};

// 删除分类
export const deleteCategory = async (id) => {
  try {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除分类错误:', error);
    throw error;
  }
};

// 获取分类统计数据
export const getCategoryStats = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/categories/stats');
    // return response.data;

    // 使用模拟数据
    return mockCategoryStats();
  } catch (error) {
    console.error('获取分类统计数据错误:', error);
    throw error;
  }
};

// 模拟数据
const mockCategories = (params) => {
  // 生成模拟分类数据
  const categories = [
    { id: 'category-1', name: '工作', description: '工作相关的笔记', count: 20, createdAt: '2023-01-01', updatedAt: '2023-01-01' },
    { id: 'category-2', name: '学习', description: '学习相关的笔记', count: 15, createdAt: '2023-01-02', updatedAt: '2023-01-02' },
    { id: 'category-3', name: '生活', description: '生活相关的笔记', count: 15, createdAt: '2023-01-03', updatedAt: '2023-01-03' },
    { id: 'category-4', name: '项目', description: '项目相关的笔记', count: 10, createdAt: '2023-01-04', updatedAt: '2023-01-04' },
    { id: 'category-5', name: '会议', description: '会议相关的笔记', count: 8, createdAt: '2023-01-05', updatedAt: '2023-01-05' },
  ];

  // 关键词筛选
  let filteredCategories = [...categories];
  if (params && params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredCategories = filteredCategories.filter(
      (category) =>
        category.name.toLowerCase().includes(keyword) ||
        category.description.toLowerCase().includes(keyword)
    );
  }

  // 排序
  if (params && params.sortField && params.sortOrder) {
    filteredCategories.sort((a, b) => {
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
    const paginatedCategories = filteredCategories.slice(start, end);

    return {
      data: paginatedCategories,
      total: filteredCategories.length,
      page,
      pageSize,
    };
  }

  return filteredCategories;
};

const mockCategoryStats = () => {
  // 模拟分类统计数据
  return {
    totalCategories: 5,
    mostUsedCategories: [
      { id: 'category-1', name: '工作', count: 20 },
      { id: 'category-2', name: '学习', count: 15 },
      { id: 'category-3', name: '生活', count: 15 },
    ],
    recentlyAddedCategories: [
      { id: 'category-5', name: '会议', createdAt: '2023-01-05' },
      { id: 'category-4', name: '项目', createdAt: '2023-01-04' },
      { id: 'category-3', name: '生活', createdAt: '2023-01-03' },
    ],
  };
};
