/**
 * 思维导图服务
 * 提供思维导图生成和处理功能
 */
import apiClient from '../api/apiClient';
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
      // 预处理文本
      const processedText = this._preprocessText(text);

      // 调用API生成思维导图
      const response = await apiService.post('/mind-map/generator/generate/text/', {
        text: processedText,
        title: options.title || '思维导图',
        options: {
          layout_type: options.layoutType || 'tree',
          theme: options.theme || 'default',
          max_depth: options.maxDepth || 3,
          max_children: options.maxChildren || 7,
        },
      });

      // 记录分析事件
      analyticsService.trackEvent('generate_mind_map', {
        textLength: text.length,
        layoutType: options.layoutType || 'tree',
        theme: options.theme || 'default',
      });

      return response.data;
    } catch (error) {
      console.error('生成思维导图失败:', error);
      analyticsService.trackError(error, { action: 'generate_mind_map' });
      throw error;
    }
  }

  /**
   * 从笔记生成思维导图
   * @param {string} noteId - 笔记ID
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} - 思维导图数据
   */
  async generateFromNote(noteId, options = {}) {
    try {
      // 调用API从笔记生成思维导图
      const response = await apiService.post(`/mind-map/generator/generate/note/${noteId}/`, {
        options: {
          layout_type: options.layoutType || 'tree',
          theme: options.theme || 'default',
          max_depth: options.maxDepth || 3,
          max_children: options.maxChildren || 7,
        },
      });

      // 记录分析事件
      analyticsService.trackEvent('generate_mind_map_from_note', {
        noteId,
        layoutType: options.layoutType || 'tree',
        theme: options.theme || 'default',
      });

      return response.data;
    } catch (error) {
      console.error('从笔记生成思维导图失败:', error);
      analyticsService.trackError(error, { action: 'generate_mind_map_from_note' });
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
      // 调用API扩展节点
      const response = await apiService.post('/mind-map/generator/expand-node/', {
        node,
        depth,
      });

      // 记录分析事件
      analyticsService.trackEvent('expand_mind_map_node', {
        nodeId: node.id,
        depth,
      });

      return response.data.children;
    } catch (error) {
      console.error('扩展思维导图节点失败:', error);
      analyticsService.trackError(error, { action: 'expand_mind_map_node' });
      throw error;
    }
  }

  /**
   * 预处理文本
   * @param {string} text - 原始文本
   * @returns {string} - 处理后的文本
   * @private
   */
  _preprocessText(text) {
    // 移除多余空白
    let processedText = text.replace(/\s+/g, ' ').trim();

    // 如果文本太长，截断
    const maxLength = 5000;
    if (processedText.length > maxLength) {
      processedText = processedText.substring(0, maxLength) + '...';
    }

    return processedText;
  }

  /**
   * 本地生成思维导图（离线备份方案）
   * @param {string} text - 源文本
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} - 思维导图数据
   * @private
   */
  async _generateLocalFallback(text, options = {}) {
    // 使用本地AI服务生成简单的思维导图结构
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    // 创建根节点
    const rootTitle = paragraphs[0]?.split('.')[0] || '思维导图';
    const rootNode = {
      id: `node-${Date.now()}`,
      title: rootTitle.length > 30 ? rootTitle.substring(0, 27) + '...' : rootTitle,
      children: [],
    };

    // 为每个段落创建子节点
    const maxChildren = options.maxChildren || 7;
    for (let i = 1; i < paragraphs.length && i <= maxChildren; i++) {
      const paragraph = paragraphs[i];
      const sentences = paragraph.split(/[.。!！?？;；]/);
      const title = sentences[0] || `节点 ${i}`;

      const childNode = {
        id: `node-${Date.now()}-${i}`,
        title: title.length > 30 ? title.substring(0, 27) + '...' : title,
        children: [],
      };

      // 为每个句子创建孙节点
      const maxGrandchildren = 3;
      for (let j = 1; j < sentences.length && j <= maxGrandchildren; j++) {
        const sentence = sentences[j];
        if (sentence.trim()) {
          const grandchildNode = {
            id: `node-${Date.now()}-${i}-${j}`,
            title: sentence.length > 30 ? sentence.substring(0, 27) + '...' : sentence,
            children: [],
          };
          childNode.children.push(grandchildNode);
        }
      }

      rootNode.children.push(childNode);
    }

    // 构建思维导图数据
    return {
      id: `mindmap-${Date.now()}`,
      title: options.title || '思维导图',
      data: {
        nodes: this._flattenNodes(rootNode),
        edges: this._generateEdges(rootNode),
      },
    };
  }

  /**
   * 本地扩展节点（离线备份方案）
   * @param {Object} node - 要扩展的节点
   * @param {number} depth - 扩展深度
   * @returns {Promise<Array>} - 新生成的子节点
   * @private
   */
  async _expandNodeLocalFallback(node, depth = 1) {
    // 创建简单的子节点
    const childCount = 3;
    const children = [];

    for (let i = 0; i < childCount; i++) {
      const childNode = {
        id: `node-${Date.now()}-${i}`,
        title: `${node.title} - 子项 ${i + 1}`,
        parent_id: node.id,
        children: [],
      };

      children.push(childNode);
    }

    return children;
  }

  /**
   * 将节点树扁平化为节点数组
   * @param {Object} rootNode - 根节点
   * @returns {Array} - 扁平化的节点数组
   * @private
   */
  _flattenNodes(rootNode) {
    const nodes = [];

    const traverse = (node, parentId = null) => {
      const flatNode = {
        id: node.id,
        title: node.title,
        parent_id: parentId,
      };

      if (node.content) {
        flatNode.content = node.content;
      }

      if (node.type) {
        flatNode.type = node.type;
      }

      nodes.push(flatNode);

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, node.id));
      }
    };

    traverse(rootNode);
    return nodes;
  }

  /**
   * 生成边数组
   * @param {Object} rootNode - 根节点
   * @returns {Array} - 边数组
   * @private
   */
  _generateEdges(rootNode) {
    const edges = [];

    const traverse = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          edges.push({
            id: `edge-${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
          });

          traverse(child);
        });
      }
    };

    traverse(rootNode);
    return edges;
  }

  /**
   * 优化思维导图
   * @param {Object} mindMap - 思维导图数据
   * @param {Object} options - 优化选项
   * @returns {Promise<Object>} - 优化后的思维导图数据
   */
  async optimizeMindMap(mindMap, options = {}) {
    try {
      // 调用API优化思维导图
      const response = await apiService.post('/mind-map/generator/optimize/', {
        mind_map: mindMap,
        options: {
          balance: options.balance !== undefined ? options.balance : true,
          simplify: options.simplify !== undefined ? options.simplify : false,
          recolor: options.recolor !== undefined ? options.recolor : false,
          reorganize: options.reorganize !== undefined ? options.reorganize : true,
        },
      });

      // 记录分析事件
      analyticsService.trackEvent('optimize_mind_map', {
        nodeCount: mindMap.nodes?.length || 0,
        edgeCount: mindMap.edges?.length || 0,
        options: JSON.stringify(options),
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
      // 调用API转换为大纲
      const response = await apiService.post('/mind-map/generator/to-outline/', {
        mind_map: mindMap,
      });

      // 记录分析事件
      analyticsService.trackEvent('convert_mind_map_to_outline', {
        nodeCount: mindMap.nodes?.length || 0,
        edgeCount: mindMap.edges?.length || 0,
      });

      return response.data.outline;
    } catch (error) {
      console.error('转换思维导图为大纲失败:', error);
      analyticsService.trackError(error, { action: 'convert_mind_map_to_outline' });

      // 如果API调用失败，尝试本地转换
      try {
        return this._convertToOutlineLocal(mindMap);
      } catch (localError) {
        console.error('本地转换为大纲失败:', localError);
        throw error; // 仍然抛出原始错误
      }
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
      // 调用API导出为图片
      const response = await apiService.post('/mind-map/generator/export/', {
        mind_map: mindMap,
        format,
      });

      // 记录分析事件
      analyticsService.trackEvent('export_mind_map', {
        nodeCount: mindMap.nodes?.length || 0,
        edgeCount: mindMap.edges?.length || 0,
        format,
      });

      return response.data.image;
    } catch (error) {
      console.error('导出思维导图失败:', error);
      analyticsService.trackError(error, { action: 'export_mind_map' });
      throw error;
    }
  }

  /**
   * 本地转换思维导图为大纲
   * @param {Object} mindMap - 思维导图数据
   * @returns {string} - 大纲文本
   * @private
   */
  _convertToOutlineLocal(mindMap) {
    // 构建节点映射
    const nodeMap = {};
    if (mindMap.nodes) {
      mindMap.nodes.forEach(node => {
        nodeMap[node.id] = { ...node, children: [] };
      });
    }

    // 构建树结构
    let rootNode = null;
    if (mindMap.edges) {
      mindMap.edges.forEach(edge => {
        if (nodeMap[edge.source] && nodeMap[edge.target]) {
          nodeMap[edge.source].children.push(nodeMap[edge.target]);

          // 标记为非根节点
          nodeMap[edge.target].hasParent = true;
        }
      });
    }

    // 找到根节点
    for (const id in nodeMap) {
      if (!nodeMap[id].hasParent) {
        rootNode = nodeMap[id];
        break;
      }
    }

    // 如果没有找到根节点，使用第一个节点
    if (!rootNode && mindMap.nodes && mindMap.nodes.length > 0) {
      rootNode = nodeMap[mindMap.nodes[0].id];
    }

    // 如果仍然没有节点，返回空字符串
    if (!rootNode) {
      return '';
    }

    // 递归生成大纲
    let outline = '';

    const generateOutline = (node, level = 0) => {
      // 添加当前节点
      const indent = '  '.repeat(level);
      outline += `${indent}${level === 0 ? '# ' : '- '}${node.title}\n`;

      // 如果有内容，添加内容
      if (node.content) {
        const contentIndent = '  '.repeat(level + 1);
        outline += `${contentIndent}${node.content}\n`;
      }

      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        // 按照某种顺序排序子节点（这里简单地按照标题排序）
        const sortedChildren = [...node.children].sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return a.title.localeCompare(b.title);
        });

        sortedChildren.forEach(child => {
          generateOutline(child, level + 1);
        });
      }
    };

    generateOutline(rootNode);
    return outline;
  }
}

export default new MindMapService();
