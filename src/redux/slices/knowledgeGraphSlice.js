/**
 * 知识图谱状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// 导入知识图谱相关的API服务
import * as knowledgeGraphApi from '../../services/api/knowledgeGraphApi';

// 异步Action: 获取知识图谱数据
export const fetchKnowledgeGraph = createAsyncThunk(
  'knowledgeGraph/fetchKnowledgeGraph',
  async (params, { rejectWithValue }) => {
    try {
      // 调用API获取知识图谱数据
      const response = await knowledgeGraphApi.getKnowledgeGraph(params);

      // 检查响应是否成功
      if (!response.success) {
        console.error('知识图谱API返回错误:', response.message);
        return rejectWithValue({
          message: response.message || '获取知识图谱数据失败',
          statusCode: response.statusCode,
          isNetworkError: response.isNetworkError
        });
      }

      // 检查是否是认证错误但返回了空数据（401错误的特殊处理）
      if (response.isAuthError) {
        console.log('知识图谱Redux: 检测到认证错误，但API返回了空数据，继续处理');
        // 不抛出错误，而是返回空数据
        return {
          nodes: [],
          edges: [],
          message: response.data?.message || '认证过期，显示空知识图谱'
        };
      }

      // 检查响应数据是否有效
      if (!response.data) {
        console.warn('知识图谱API返回的数据为空:', response);
        return {
          nodes: [],
          edges: []
        };
      }

      // 检查数据格式
      if (!response.data.nodes) {
        console.warn('知识图谱API返回的数据格式不正确:', response);
        // 如果响应数据本身就是节点数组，则使用它
        if (Array.isArray(response.data)) {
          return {
            nodes: response.data,
            edges: []
          };
        }
        // 否则返回空数据
        return {
          nodes: [],
          edges: []
        };
      }

      return response.data;
    } catch (error) {
      console.error('获取知识图谱数据异常:', error);
      return rejectWithValue({
        message: error.message || '获取知识图谱数据失败',
        statusCode: error.response?.status,
        isNetworkError: error.message === 'Network Error'
      });
    }
  }
);

// 异步Action: 创建知识节点
export const createNode = createAsyncThunk(
  'knowledgeGraph/createNode',
  async (nodeData, { rejectWithValue }) => {
    try {
      // 调用API创建知识节点
      const response = await knowledgeGraphApi.createNode(nodeData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '创建知识节点失败');
    }
  }
);

// 异步Action: 创建知识连接
export const createEdge = createAsyncThunk(
  'knowledgeGraph/createEdge',
  async (edgeData, { rejectWithValue }) => {
    try {
      // 调用API创建知识连接
      const response = await knowledgeGraphApi.createLink(edgeData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '创建知识连接失败');
    }
  }
);

// 初始状态
const initialState = {
  nodes: [],
  edges: [],
  currentNode: null,
  isLoading: false,
  error: null,
  layout: 'force', // force, hierarchical, circular
  filters: {
    nodeTypes: [],
    edgeTypes: [],
    tags: [],
  },
  visualization: {
    zoomLevel: 1,
    centerNode: null,
    highlightedNodes: [],
    highlightedEdges: [],
  },
};

// 创建Slice
const knowledgeGraphSlice = createSlice({
  name: 'knowledgeGraph',
  initialState,
  reducers: {
    // 设置当前选中的节点
    setCurrentNode: (state, action) => {
      state.currentNode = action.payload;
    },
    // 设置布局类型
    setLayout: (state, action) => {
      state.layout = action.payload;
    },
    // 设置过滤条件
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    // 设置可视化参数
    setVisualization: (state, action) => {
      state.visualization = { ...state.visualization, ...action.payload };
    },
    // 重置知识图谱状态
    resetKnowledgeGraph: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // 获取知识图谱数据
      .addCase(fetchKnowledgeGraph.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchKnowledgeGraph.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;

        // 确保有效的节点和边数据
        if (action.payload) {
          state.nodes = action.payload.nodes || [];
          state.edges = action.payload.edges || [];
        } else {
          console.warn('知识图谱数据为空');
          state.nodes = [];
          state.edges = [];
        }
      })
      .addCase(fetchKnowledgeGraph.rejected, (state, action) => {
        state.isLoading = false;

        // 处理错误信息
        if (action.payload) {
          state.error = action.payload.message || '获取知识图谱数据失败';
          console.error('知识图谱加载失败:', action.payload);
        } else {
          state.error = '未知错误，请稍后重试';
        }
      })

      // 创建知识节点
      .addCase(createNode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createNode.fulfilled, (state, action) => {
        state.isLoading = false;
        state.nodes.push(action.payload);
      })
      .addCase(createNode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 创建知识连接
      .addCase(createEdge.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createEdge.fulfilled, (state, action) => {
        state.isLoading = false;
        state.edges.push(action.payload);
      })
      .addCase(createEdge.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// 导出Actions
export const {
  setCurrentNode,
  setLayout,
  setFilters,
  setVisualization,
  resetKnowledgeGraph,
} = knowledgeGraphSlice.actions;

// 导出Selectors
export const selectNodes = (state) => state.knowledgeGraph.nodes;
export const selectEdges = (state) => state.knowledgeGraph.edges;
export const selectCurrentNode = (state) => state.knowledgeGraph.currentNode;
export const selectIsLoading = (state) => state.knowledgeGraph.isLoading;
export const selectError = (state) => state.knowledgeGraph.error;
export const selectLayout = (state) => state.knowledgeGraph.layout;
export const selectFilters = (state) => state.knowledgeGraph.filters;
export const selectVisualization = (state) => state.knowledgeGraph.visualization;

// 导出Reducer
export default knowledgeGraphSlice.reducer;