/**
 * 思维导图服务
 * 提供思维导图生成和处理功能
 */
import apiService from '../api/apiService';
import analyticsService from '../analytics/analyticsService';

/**
 * 思维导图服务
 */
class MindMapService {
  /**
   * 从文本生成思维导图
   * @param {string} text - 源文本
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} - 思维导图数据
   */
  async generateFromText(text, options = {}) {
    try {
      const response = await apiService.post('/ai/mind-map/generate', {
        text,
        ...options
      });
      
      analyticsService.trackEvent('generate_mind_map', {
        textLength: text.length,
        nodeCount: response.data.nodes.length
      });
      
      return response.data;
    } catch (error) {
      console.error('生成思维导图失败:', error);
      analyticsService.trackError(error, { action: 'generate_mind_map' });
      throw error;
    }
  }
  
  /**
   * 扩展思维导图节点
   * @param {Object} node - 要扩展的节点
   * @param {number} depth - 扩展深度
   * @returns {Promise<Array>} - 新生成的子节点
   */
  async expandNode(node, depth = 1) {
    try {
      const response = await apiService.post('/ai/mind-map/expand', {
        node,
        depth
      });
      
      analyticsService.trackEvent('expand_mind_map_node', {
        nodeId: node.id,
        depth
      });
      
      return response.data.children;
    } catch (error) {
      console.error('扩展思维导图节点失败:', error);
      analyticsService.trackError(error, { action: 'expand_mind_map_node' });
      throw error;
    }
  }
  
  /**
   * 优化思维导图
   * @param {Object} mindMap - 思维导图数据
   * @param {Object} options - 优化选项
   * @returns {Promise<Object>} - 优化后的思维导图数据
   */
  async optimizeMindMap(mindMap, options = {}) {
    try {
      const response = await apiService.post('/ai/mind-map/optimize', {
        mind_map: mindMap,
        ...options
      });
      
      analyticsService.trackEvent('optimize_mind_map', {
        nodeCount: mindMap.nodes.length
      });
      
      return response.data;
    } catch (error) {
      console.error('优化思维导图失败:', error);
      analyticsService.trackError(error, { action: 'optimize_mind_map' });
      throw error;
    }
  }
  
  /**
   * 将思维导图转换为大纲
   * @param {Object} mindMap - 思维导图数据
   * @returns {Promise<string>} - 大纲文本
   */
  async convertToOutline(mindMap) {
    try {
      const response = await apiService.post('/ai/mind-map/to-outline', {
        mind_map: mindMap
      });
      
      analyticsService.trackEvent('convert_mind_map_to_outline', {
        nodeCount: mindMap.nodes.length
      });
      
      return response.data.outline;
    } catch (error) {
      console.error('转换思维导图为大纲失败:', error);
      analyticsService.trackError(error, { action: 'convert_mind_map_to_outline' });
      throw error;
    }
  }
  
  /**
   * 将思维导图导出为图片
   * @param {Object} mindMap - 思维导图数据
   * @param {string} format - 导出格式 (png, jpg, svg)
   * @returns {Promise<string>} - 图片URL或Base64数据
   */
  async exportToImage(mindMap, format = 'png') {
    try {
      const response = await apiService.post('/ai/mind-map/export', {
        mind_map: mindMap,
        format
      });
      
      analyticsService.trackEvent('export_mind_map', {
        nodeCount: mindMap.nodes.length,
        format
      });
      
      return response.data.image;
    } catch (error) {
      console.error('导出思维导图失败:', error);
      analyticsService.trackError(error, { action: 'export_mind_map' });
      throw error;
    }
  }
}

export default new MindMapService();
