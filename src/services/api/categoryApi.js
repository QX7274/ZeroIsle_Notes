import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import api from '../api';

class CategoryApi {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });
  }

  // 获取分类列表
  getCategories = () => api.get('/api/categories/');
  
  // 创建分类
  createCategory = (data) => api.post('/api/categories/', data);
  
  // 更新分类
  updateCategory = (id, data) => api.put(`/api/categories/${id}/`, data);
  
  // 删除分类
  deleteCategory = (id) => api.delete(`/api/categories/${id}/`);
  
  // 移动笔记到分类
  moveNotes = (id, noteIds) => api.post(`/api/categories/${id}/move_notes/`, { note_ids: noteIds });
  
  // 自动分类
  async autoCategorize() {
    try {
      const response = await this.api.post('/categories/auto-categorize');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 智能分类建议
  async getSmartSuggestions(noteId) {
    try {
      const response = await this.api.get(`/categories/suggestions/${noteId}`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 批量分类
  async batchCategorize(noteIds, categoryId) {
    try {
      const response = await this.api.post('/categories/batch', {
        note_ids: noteIds,
        category_id: categoryId
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 获取分类统计
  async getStatistics() {
    try {
      const response = await this.api.get('/categories/statistics');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 获取分类树
  async getCategoryTree() {
    try {
      const response = await this.api.get('/categories/tree');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 合并分类
  mergeCategories = (id, targetId) => api.post(`/api/categories/${id}/merge/`, { target_category_id: targetId });
  
  // 导出分类
  async exportCategories() {
    try {
      const response = await this.api.get('/categories/export');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 导入分类
  async importCategories(data) {
    try {
      const response = await this.api.post('/categories/import', data);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 获取导入模板
  async getImportTemplate() {
    try {
      const response = await this.api.get('/categories/import/template');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 验证导入数据
  async validateImportData(data) {
    try {
      const response = await this.api.post('/categories/import/validate', data);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 获取分类标签
  async getCategoryTags(categoryId) {
    try {
      const response = await this.api.get(`/categories/${categoryId}/tags`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 添加分类标签
  async addCategoryTag(categoryId, tag) {
    try {
      const response = await this.api.post(`/categories/${categoryId}/tags`, { tag });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 删除分类标签
  async deleteCategoryTag(categoryId, tagId) {
    try {
      const response = await this.api.delete(`/categories/${categoryId}/tags/${tagId}`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 更新分类标签
  async updateCategoryTag(categoryId, tagId, tag) {
    try {
      const response = await this.api.put(`/categories/${categoryId}/tags/${tagId}`, { tag });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 获取所有标签
  async getAllTags() {
    try {
      const response = await this.api.get('/tags');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 按标签搜索分类
  async searchCategoriesByTag(tag) {
    try {
      const response = await this.api.get(`/categories/search/tag/${tag}`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 获取分类权限
  async getCategoryPermissions(categoryId) {
    try {
      const response = await this.api.get(`/categories/${categoryId}/permissions`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 更新分类权限
  async updateCategoryPermissions(categoryId, permissions) {
    try {
      const response = await this.api.put(`/categories/${categoryId}/permissions`, permissions);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 添加分类成员
  async addCategoryMember(categoryId, userId, role) {
    try {
      const response = await this.api.post(`/categories/${categoryId}/members`, {
        user_id: userId,
        role: role
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 删除分类成员
  async removeCategoryMember(categoryId, userId) {
    try {
      const response = await this.api.delete(`/categories/${categoryId}/members/${userId}`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 更新分类成员角色
  async updateCategoryMemberRole(categoryId, userId, role) {
    try {
      const response = await this.api.put(`/categories/${categoryId}/members/${userId}`, {
        role: role
      });
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 获取分类成员列表
  async getCategoryMembers(categoryId) {
    try {
      const response = await this.api.get(`/categories/${categoryId}/members`);
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // 获取可用的角色列表
  async getAvailableRoles() {
    try {
      const response = await this.api.get('/roles');
      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  
  // 错误处理
  handleError(error) {
    if (error.response) {
      // 服务器返回错误
      return new Error(error.response.data.message || '服务器错误');
    } else if (error.request) {
      // 请求未收到响应
      return new Error('网络错误，请检查网络连接');
    } else {
      // 请求配置错误
      return new Error('请求配置错误');
    }
  }
}

export const categoryApi = new CategoryApi(); 