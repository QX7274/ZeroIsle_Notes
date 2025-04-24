/**
 * 分类API服务
 * 导出categoryApi中的方法
 */

import { categoryApi } from './categoryApi';

// 导出所有方法
export const getCategories = categoryApi.getCategories;
export const createCategory = categoryApi.createCategory;
export const updateCategory = categoryApi.updateCategory;
export const deleteCategory = categoryApi.deleteCategory;
export const moveNotes = categoryApi.moveNotes;
export const getStatistics = categoryApi.getStatistics;
export const getCategoryTree = categoryApi.getCategoryTree;
export const mergeCategories = categoryApi.mergeCategories;

// 默认导出
export default categoryApi;
