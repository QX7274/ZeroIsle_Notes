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
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '获取知识图谱数据失败');
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
        state.nodes = action.payload.nodes;
        state.edges = action.payload.edges;
      })
      .addCase(fetchKnowledgeGraph.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
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