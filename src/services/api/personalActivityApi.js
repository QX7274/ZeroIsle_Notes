/**
 * Personal Activity API Service
 * 个人活动记录API服务
 */
import apiClient from './apiClient';

const BASE_URL = '/personal-activity';

class PersonalActivityApi {
  /**
   * 获取活动列表
   */
  async getActivities(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) {queryParams.append('page', params.page);}
    if (params.page_size) {queryParams.append('page_size', params.page_size);}
    if (params.status) {queryParams.append('status', params.status);}
    if (params.category_id) {queryParams.append('category_id', params.category_id);}
    if (params.tags && params.tags.length > 0) {
      queryParams.append('tags', params.tags.join(','));
    }
    if (params.start_date) {queryParams.append('start_date', params.start_date);}
    if (params.end_date) {queryParams.append('end_date', params.end_date);}

    const url = `${BASE_URL}/activities/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return await apiClient.get(url);
  }

  /**
   * 获取活动详情
   */
  async getActivity(id) {
    return await apiClient.get(`${BASE_URL}/activities/${id}/`);
  }

  /**
   * 创建活动
   */
  async createActivity(data) {
    return await apiClient.post(`${BASE_URL}/activities/`, data);
  }

  /**
   * 更新活动
   */
  async updateActivity(id, data) {
    return await apiClient.put(`${BASE_URL}/activities/${id}/`, data);
  }

  /**
   * 删除活动
   */
  async deleteActivity(id) {
    return await apiClient.delete(`${BASE_URL}/activities/${id}/`);
  }

  /**
   * 更新活动状态
   */
  async updateActivityStatus(id, status) {
    return await apiClient.patch(`${BASE_URL}/activities/${id}/status/`, { status });
  }

  /**
   * 更新活动进度
   */
  async updateActivityProgress(id, progress) {
    return await apiClient.patch(`${BASE_URL}/activities/${id}/progress/`, { progress });
  }

  /**
   * 批量操作活动
   */
  async batchOperation(operation, activityIds, data = {}) {
    return await apiClient.post(`${BASE_URL}/batch/`, {
      operation,
      activity_ids: activityIds,
      data,
    });
  }

  /**
   * 获取仪表板数据
   */
  async getDashboard() {
    return await apiClient.get(`${BASE_URL}/dashboard/`);
  }

  /**
   * 搜索活动
   */
  async searchActivities(query) {
    return await apiClient.get(`${BASE_URL}/search/?q=${encodeURIComponent(query)}`);
  }

  /**
   * 获取分类列表
   */
  async getCategories() {
    return await apiClient.get(`${BASE_URL}/categories/`);
  }

  /**
   * 创建分类
   */
  async createCategory(data) {
    return await apiClient.post(`${BASE_URL}/categories/`, data);
  }

  /**
   * 更新分类
   */
  async updateCategory(id, data) {
    return await apiClient.put(`${BASE_URL}/categories/${id}/`, data);
  }

  /**
   * 删除分类
   */
  async deleteCategory(id) {
    return await apiClient.delete(`${BASE_URL}/categories/${id}/`);
  }

  /**
   * 获取分类树结构
   */
  async getCategoryTree() {
    return await apiClient.get(`${BASE_URL}/categories/tree/`);
  }

  /**
   * 获取目标列表
   */
  async getGoals() {
    return await apiClient.get(`${BASE_URL}/goals/`);
  }

  /**
   * 创建目标
   */
  async createGoal(data) {
    return await apiClient.post(`${BASE_URL}/goals/`, data);
  }

  /**
   * 更新目标
   */
  async updateGoal(id, data) {
    return await apiClient.put(`${BASE_URL}/goals/${id}/`, data);
  }

  /**
   * 删除目标
   */
  async deleteGoal(id) {
    return await apiClient.delete(`${BASE_URL}/goals/${id}/`);
  }

  /**
   * 获取分析报告
   */
  async getAnalyticsReports(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.type) {queryParams.append('type', params.type);}
    if (params.start_date) {queryParams.append('start_date', params.start_date);}
    if (params.end_date) {queryParams.append('end_date', params.end_date);}

    const url = `${BASE_URL}/analytics/reports/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return await apiClient.get(url);
  }

  /**
   * 获取智能洞察
   */
  async getInsights() {
    return await apiClient.get(`${BASE_URL}/analytics/insights/`);
  }

  /**
   * 获取趋势分析
   */
  async getTrends(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.period) {queryParams.append('period', params.period);}
    if (params.metric) {queryParams.append('metric', params.metric);}

    const url = `${BASE_URL}/analytics/trends/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return await apiClient.get(url);
  }

  /**
   * 导出数据
   */
  async exportData(format = 'json', params = {}) {
    const queryParams = new URLSearchParams();
    queryParams.append('format', format);
    if (params.start_date) {queryParams.append('start_date', params.start_date);}
    if (params.end_date) {queryParams.append('end_date', params.end_date);}
    if (params.categories) {queryParams.append('categories', params.categories.join(','));}

    const url = `${BASE_URL}/export/?${queryParams.toString()}`;
    return await apiClient.get(url);
  }

  /**
   * 导入数据
   */
  async importData(file, format = 'json') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    return await apiClient.post(`${BASE_URL}/import/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * 获取统计数据
   */
  async getStatistics(period = 'week') {
    return await apiClient.get(`${BASE_URL}/statistics/?period=${period}`);
  }

  /**
   * 获取活动建议
   */
  async getActivitySuggestions() {
    return await apiClient.get(`${BASE_URL}/suggestions/`);
  }

  /**
   * 标记活动为收藏
   */
  async toggleActivityFavorite(id, favorite = true) {
    return await apiClient.patch(`${BASE_URL}/activities/${id}/`, {
      is_favorite: favorite,
    });
  }

  /**
   * 添加活动评论
   */
  async addActivityComment(id, comment) {
    return await apiClient.post(`${BASE_URL}/activities/${id}/comments/`, {
      content: comment,
    });
  }

  /**
   * 获取活动历史
   */
  async getActivityHistory(id) {
    return await apiClient.get(`${BASE_URL}/activities/${id}/history/`);
  }

  /**
   * 复制活动
   */
  async duplicateActivity(id) {
    return await apiClient.post(`${BASE_URL}/activities/${id}/duplicate/`);
  }

  /**
   * 获取活动模板
   */
  async getActivityTemplates() {
    return await apiClient.get(`${BASE_URL}/templates/`);
  }

  /**
   * 创建活动模板
   */
  async createActivityTemplate(data) {
    return await apiClient.post(`${BASE_URL}/templates/`, data);
  }

  /**
   * 上传图片
   */
  async uploadImage(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    return await apiClient.post(`${BASE_URL}/upload-image/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * 删除图片
   */
  async deleteImage(filename) {
    return await apiClient.delete(`${BASE_URL}/delete-image/${filename}/`);
  }
}

export default new PersonalActivityApi();
