/**
 * 思维导图状态管理
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../services/api/apiClient';
import analyticsService from '../../services/analytics/analyticsService';

// 异步操作：获取思维导图列表
export const fetchMindMaps = createAsyncThunk(
  'mindMap/fetchMindMaps',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/mind-map/maps/', { params });
      return response.data;
    } catch (error) {
      analyticsService.trackError(error, { action: 'fetch_mind_maps' });
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// 异步操作：获取单个思维导图
export const fetchMindMap = createAsyncThunk(
  'mindMap/fetchMindMap',
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/mind-map/maps/${id}/`);
      return response.data;
    } catch (error) {
      analyticsService.trackError(error, { action: 'fetch_mind_map' });
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// 异步操作：创建思维导图
export const createMindMap = createAsyncThunk(
  'mindMap/createMindMap',
  async (data, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/mind-map/maps/', data);
      analyticsService.trackEvent('create_mind_map', { id: response.data.id });
      return response.data;
    } catch (error) {
      analyticsService.trackError(error, { action: 'create_mind_map' });
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// 异步操作：更新思维导图
export const updateMindMap = createAsyncThunk(
  'mindMap/updateMindMap',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await apiClient.put(`/mind-map/maps/${id}/`, data);
      analyticsService.trackEvent('update_mind_map', { id });
      return response.data;
    } catch (error) {
      analyticsService.trackError(error, { action: 'update_mind_map' });
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// 异步操作：删除思维导图
export const deleteMindMap = createAsyncThunk(
  'mindMap/deleteMindMap',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/mind-map/maps/${id}/`);
      analyticsService.trackEvent('delete_mind_map', { id });
      return id;
    } catch (error) {
      analyticsService.trackError(error, { action: 'delete_mind_map' });
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// 思维导图状态切片
const mindMapSlice = createSlice({
  name: 'mindMap',
  initialState: {
    mindMaps: [],
    currentMindMap: null,
    nodes: [],
    edges: [],
    selectedNode: null,
    isLoading: false,
    error: null,
    totalCount: 0,
    layout: 'tree',
    theme: 'default',
    history: [],
    future: [],
  },
  reducers: {
    // 设置当前思维导图
    setCurrentMindMap: (state, action) => {
      state.currentMindMap = action.payload;
      
      if (action.payload?.data) {
        state.nodes = action.payload.data.nodes || [];
        state.edges = action.payload.data.edges || [];
      } else if (action.payload?.nodes && action.payload?.edges) {
        state.nodes = action.payload.nodes;
        state.edges = action.payload.edges;
      }
      
      state.layout = action.payload?.layout_type || 'tree';
      state.theme = action.payload?.theme || 'default';
    },
    
    // 设置节点
    setNodes: (state, action) => {
      state.nodes = action.payload;
      
      // 保存历史记录
      state.history.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      });
      
      // 限制历史记录长度
      if (state.history.length > 20) {
        state.history.shift();
      }
      
      // 清空未来记录
      state.future = [];
    },
    
    // 设置边
    setEdges: (state, action) => {
      state.edges = action.payload;
      
      // 保存历史记录
      state.history.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      });
      
      // 限制历史记录长度
      if (state.history.length > 20) {
        state.history.shift();
      }
      
      // 清空未来记录
      state.future = [];
    },
    
    // 设置选中节点
    setSelectedNode: (state, action) => {
      state.selectedNode = action.payload;
    },
    
    // 设置布局
    setLayout: (state, action) => {
      state.layout = action.payload;
    },
    
    // 设置主题
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    
    // 撤销操作
    undo: (state) => {
      if (state.history.length > 0) {
        // 保存当前状态到未来记录
        state.future.push({
          nodes: [...state.nodes],
          edges: [...state.edges]
        });
        
        // 恢复上一个历史状态
        const prevState = state.history.pop();
        state.nodes = prevState.nodes;
        state.edges = prevState.edges;
      }
    },
    
    // 重做操作
    redo: (state) => {
      if (state.future.length > 0) {
        // 保存当前状态到历史记录
        state.history.push({
          nodes: [...state.nodes],
          edges: [...state.edges]
        });
        
        // 恢复下一个未来状态
        const nextState = state.future.pop();
        state.nodes = nextState.nodes;
        state.edges = nextState.edges;
      }
    },
    
    // 清空状态
    clearMindMapState: (state) => {
      state.currentMindMap = null;
      state.nodes = [];
      state.edges = [];
      state.selectedNode = null;
      state.history = [];
      state.future = [];
    }
  },
  extraReducers: (builder) => {
    builder
      // 获取思维导图列表
      .addCase(fetchMindMaps.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMindMaps.fulfilled, (state, action) => {
        state.isLoading = false;
        state.mindMaps = action.payload.results;
        state.totalCount = action.payload.count;
      })
      .addCase(fetchMindMaps.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || { message: '获取思维导图列表失败' };
      })
      
      // 获取单个思维导图
      .addCase(fetchMindMap.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMindMap.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentMindMap = action.payload;
        
        if (action.payload.data) {
          state.nodes = action.payload.data.nodes || [];
          state.edges = action.payload.data.edges || [];
        } else if (action.payload.nodes && action.payload.edges) {
          state.nodes = action.payload.nodes;
          state.edges = action.payload.edges;
        }
        
        state.layout = action.payload.layout_type || 'tree';
        state.theme = action.payload.theme || 'default';
        
        // 清空历史和未来记录
        state.history = [];
        state.future = [];
      })
      .addCase(fetchMindMap.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || { message: '获取思维导图失败' };
      })
      
      // 创建思维导图
      .addCase(createMindMap.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createMindMap.fulfilled, (state, action) => {
        state.isLoading = false;
        state.mindMaps = [action.payload, ...state.mindMaps];
        state.currentMindMap = action.payload;
        
        if (action.payload.data) {
          state.nodes = action.payload.data.nodes || [];
          state.edges = action.payload.data.edges || [];
        } else if (action.payload.nodes && action.payload.edges) {
          state.nodes = action.payload.nodes;
          state.edges = action.payload.edges;
        }
        
        state.layout = action.payload.layout_type || 'tree';
        state.theme = action.payload.theme || 'default';
        
        // 清空历史和未来记录
        state.history = [];
        state.future = [];
      })
      .addCase(createMindMap.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || { message: '创建思维导图失败' };
      })
      
      // 更新思维导图
      .addCase(updateMindMap.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateMindMap.fulfilled, (state, action) => {
        state.isLoading = false;
        state.mindMaps = state.mindMaps.map(mindMap => 
          mindMap.id === action.payload.id ? action.payload : mindMap
        );
        state.currentMindMap = action.payload;
      })
      .addCase(updateMindMap.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || { message: '更新思维导图失败' };
      })
      
      // 删除思维导图
      .addCase(deleteMindMap.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteMindMap.fulfilled, (state, action) => {
        state.isLoading = false;
        state.mindMaps = state.mindMaps.filter(mindMap => mindMap.id !== action.payload);
        
        if (state.currentMindMap && state.currentMindMap.id === action.payload) {
          state.currentMindMap = null;
          state.nodes = [];
          state.edges = [];
          state.selectedNode = null;
          state.history = [];
          state.future = [];
        }
      })
      .addCase(deleteMindMap.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || { message: '删除思维导图失败' };
      });
  }
});

// 导出 actions
export const {
  setCurrentMindMap,
  setNodes,
  setEdges,
  setSelectedNode,
  setLayout,
  setTheme,
  undo,
  redo,
  clearMindMapState
} = mindMapSlice.actions;

// 导出 selectors
export const selectMindMaps = (state) => state.mindMap.mindMaps;
export const selectCurrentMindMap = (state) => state.mindMap.currentMindMap;
export const selectNodes = (state) => state.mindMap.nodes;
export const selectEdges = (state) => state.mindMap.edges;
export const selectSelectedNode = (state) => state.mindMap.selectedNode;
export const selectIsLoading = (state) => state.mindMap.isLoading;
export const selectError = (state) => state.mindMap.error;
export const selectTotalCount = (state) => state.mindMap.totalCount;
export const selectLayout = (state) => state.mindMap.layout;
export const selectTheme = (state) => state.mindMap.theme;
export const selectCanUndo = (state) => state.mindMap.history.length > 0;
export const selectCanRedo = (state) => state.mindMap.future.length > 0;

// 导出 reducer
export default mindMapSlice.reducer;
