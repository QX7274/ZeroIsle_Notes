import api from './authService';

// 说明（本轮修复）：
// 本文件此前把全部 6 个函数指向 `/categories` 系列路径，
// 但后端的管理分类接口位于 `/content/categories/`（见 content/urls.py 的 router 注册）。
// 由于 CategoryManagement 是**已挂载的页面**，这意味着"分类管理"实际一直不可用：
//   列表 404、新建 404、编辑 404、删除 404。
// 现统一改到真实前缀；并去掉后端不存在的 /categories/stats（详情见 getCategoryStats）。

const BASE = "/content/categories/";

// 获取分类列表
export const getCategories = async (params) => {
  try {
    const response = await api.get(BASE, { params });
    // 后端是分页响应 {count, results}；调用方（CategoryManagement）期望数组，
    // 因此这里统一解包，避免页面把分页对象当成数组使用。
    return response.data.results ?? response.data;
  } catch (error) {
    console.error('获取分类列表错误:', error);
    throw error;
  }
};

// 获取分类详情
export const getCategoryDetail = async (id) => {
  try {
    const response = await api.get(`${BASE}${id}/`);
    return response.data;
  } catch (error) {
    console.error('获取分类详情错误:', error);
    throw error;
  }
};

// 创建分类
export const createCategory = async (categoryData) => {
  try {
    const response = await api.post(BASE, categoryData);
    return response.data;
  } catch (error) {
    console.error('创建分类错误:', error);
    throw error;
  }
};

// 更新分类
export const updateCategory = async (id, categoryData) => {
  try {
    const response = await api.put(`${BASE}${id}/`, categoryData);
    return response.data;
  } catch (error) {
    console.error('更新分类错误:', error);
    throw error;
  }
};

// 删除分类
export const deleteCategory = async (id) => {
  try {
    const response = await api.delete(`${BASE}${id}/`);
    return response.data;
  } catch (error) {
    console.error('删除分类错误:', error);
    throw error;
  }
};

// 获取分类统计数据
//
// 说明：后端 **没有** `/content/categories/stats/` 这个动作
// （NoteCategoryViewSet 只注册了标准 CRUD + sync）。
// 原先指向不存在的 `/categories/stats` 必然 404。
// 这里改为在前端用列表数据自行聚合 —— 分类数量通常不大，
// 且分类页本就需要拉全量列表，避免为了一个统计数字新增后端接口。
export const getCategoryStats = async () => {
  try {
    const categories = await getCategories();
    const list = Array.isArray(categories) ? categories : [];
    return {
      total: list.length,
      list,
    };
  } catch (error) {
    console.error('获取分类统计数据错误:', error);
    throw error;
  }
};
