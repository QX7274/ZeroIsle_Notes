/**
 * 分类状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as categoryApi from '../../services/api/categoryApi';

// 异步Action: 获取分类列表
export const fetchCategories = createAsyncThunk(
  'category/fetchCategories',
  async (params, { rejectWithValue }) => {
    try {
      const response = await categoryApi.getCategories(params);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '获取分类列表失败');
    }
  }
);

// 异步Action: 获取分类树
export const fetchCategoryTree = createAsyncThunk(
  'category/fetchCategoryTree',
  async (_, { rejectWithValue }) => {
    try {
      const response = await categoryApi.getCategoryTree();
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '获取分类树失败');
    }
  }
);

// 异步Action: 获取分类详情
export const fetchCategoryDetail = createAsyncThunk(
  'category/fetchCategoryDetail',
  async (id, { rejectWithValue }) => {
    try {
      const response = await categoryApi.getCategoryDetail(id);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '获取分类详情失败');
    }
  }
);

// 异步Action: 创建分类
export const createCategory = createAsyncThunk(
  'category/createCategory',
  async (data, { rejectWithValue }) => {
    try {
      const response = await categoryApi.createCategory(data);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '创建分类失败');
    }
  }
);

// 异步Action: 更新分类
export const updateCategory = createAsyncThunk(
  'category/updateCategory',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await categoryApi.updateCategory(id, data);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '更新分类失败');
    }
  }
);

// 异步Action: 删除分类
export const deleteCategory = createAsyncThunk(
  'category/deleteCategory',
  async (id, { rejectWithValue }) => {
    try {
      const response = await categoryApi.deleteCategory(id);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return { id, ...response.data };
    } catch (error) {
      return rejectWithValue(error.message || '删除分类失败');
    }
  }
);

// 异步Action: 获取分类下的笔记
export const fetchCategoryNotes = createAsyncThunk(
  'category/fetchCategoryNotes',
  async ({ id, params }, { rejectWithValue }) => {
    try {
      const response = await categoryApi.getCategoryNotes(id, params);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return { categoryId: id, notes: response.data };
    } catch (error) {
      return rejectWithValue(error.message || '获取分类笔记失败');
    }
  }
);

// 异步Action: 获取分类统计
export const fetchCategoryStatistics = createAsyncThunk(
  'category/fetchCategoryStatistics',
  async (id, { rejectWithValue }) => {
    try {
      const response = await categoryApi.getCategoryStatistics(id);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return { categoryId: id, statistics: response.data };
    } catch (error) {
      return rejectWithValue(error.message || '获取分类统计失败');
    }
  }
);

// 异步Action: 批量删除分类
export const batchDeleteCategories = createAsyncThunk(
  'category/batchDeleteCategories',
  async (ids, { rejectWithValue }) => {
    try {
      const response = await categoryApi.batchDeleteCategories(ids);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return { ids, ...response.data };
    } catch (error) {
      return rejectWithValue(error.message || '批量删除失败');
    }
  }
);

// 异步Action: 移动笔记到分类
export const moveNotesToCategory = createAsyncThunk(
  'category/moveNotesToCategory',
  async ({ categoryId, noteIds }, { rejectWithValue }) => {
    try {
      const response = await categoryApi.moveNotesToCategory(categoryId, noteIds);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '移动笔记失败');
    }
  }
);

// 异步Action: 合并分类
export const mergeCategories = createAsyncThunk(
  'category/mergeCategories',
  async ({ sourceId, targetId }, { rejectWithValue }) => {
    try {
      const response = await categoryApi.mergeCategories(sourceId, targetId);
      if (!response.success) {
        return rejectWithValue(response.message);
      }
      return { sourceId, targetId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.message || '合并分类失败');
    }
  }
);

// 初始状态
const initialState = {
  // 分类列表
  categories: [],
  // 分类树
  categoryTree: [],
  // 当前选中的分类
  currentCategory: null,
  // 分类统计信息
  statistics: {},
  // 分类下的笔记
  categoryNotes: {},
  // 加载状态
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  // 错误信息
  error: null,
  // 成功消息
  successMessage: null,
};

// 创建Slice
const categorySlice = createSlice({
  name: 'category',
  initialState,
  reducers: {
    // 设置当前分类
    setCurrentCategory: (state, action) => {
      state.currentCategory = action.payload;
    },
    // 清除当前分类
    clearCurrentCategory: (state) => {
      state.currentCategory = null;
    },
    // 清除错误
    clearError: (state) => {
      state.error = null;
    },
    // 清除成功消息
    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },
    // 重置状态
    resetState: (state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // 获取分类列表
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取分类列表失败';
      });

    // 获取分类树
    builder
      .addCase(fetchCategoryTree.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategoryTree.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categoryTree = action.payload;
      })
      .addCase(fetchCategoryTree.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取分类树失败';
      });

    // 获取分类详情
    builder
      .addCase(fetchCategoryDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategoryDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentCategory = action.payload;
      })
      .addCase(fetchCategoryDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取分类详情失败';
      });

    // 创建分类
    builder
      .addCase(createCategory.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.isCreating = false;
        state.categories.push(action.payload);
        state.successMessage = '分类创建成功';
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload || '创建分类失败';
      });

    // 更新分类
    builder
      .addCase(updateCategory.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.categories.findIndex(c => c.id === action.payload.id);
        if (index !== -1) {
          state.categories[index] = action.payload;
        }
        if (state.currentCategory?.id === action.payload.id) {
          state.currentCategory = action.payload;
        }
        state.successMessage = '分类更新成功';
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload || '更新分类失败';
      });

    // 删除分类
    builder
      .addCase(deleteCategory.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.categories = state.categories.filter(c => c.id !== action.payload.id);
        if (state.currentCategory?.id === action.payload.id) {
          state.currentCategory = null;
        }
        state.successMessage = '分类删除成功';
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload || '删除分类失败';
      });

    // 获取分类笔记
    builder
      .addCase(fetchCategoryNotes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategoryNotes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categoryNotes[action.payload.categoryId] = action.payload.notes;
      })
      .addCase(fetchCategoryNotes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取分类笔记失败';
      });

    // 获取分类统计
    builder
      .addCase(fetchCategoryStatistics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategoryStatistics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.statistics[action.payload.categoryId] = action.payload.statistics;
      })
      .addCase(fetchCategoryStatistics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取分类统计失败';
      });

    // 批量删除分类
    builder
      .addCase(batchDeleteCategories.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(batchDeleteCategories.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.categories = state.categories.filter(c => !action.payload.ids.includes(c.id));
        state.successMessage = '批量删除成功';
      })
      .addCase(batchDeleteCategories.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload || '批量删除失败';
      });

    // 移动笔记到分类
    builder
      .addCase(moveNotesToCategory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(moveNotesToCategory.fulfilled, (state) => {
        state.isLoading = false;
        state.successMessage = '笔记移动成功';
      })
      .addCase(moveNotesToCategory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '移动笔记失败';
      });

    // 合并分类
    builder
      .addCase(mergeCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(mergeCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories = state.categories.filter(c => c.id !== action.payload.sourceId);
        state.successMessage = '分类合并成功';
      })
      .addCase(mergeCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '合并分类失败';
      });
  },
});

// 导出Actions
export const {
  setCurrentCategory,
  clearCurrentCategory,
  clearError,
  clearSuccessMessage,
  resetState,
} = categorySlice.actions;

// Selectors
export const selectCategories = (state) => state.category.categories;
export const selectCategoryTree = (state) => state.category.categoryTree;
export const selectCurrentCategory = (state) => state.category.currentCategory;
export const selectStatistics = (state) => state.category.statistics;
export const selectCategoryNotes = (state) => state.category.categoryNotes;
export const selectIsLoading = (state) => state.category.isLoading;
export const selectIsCreating = (state) => state.category.isCreating;
export const selectIsUpdating = (state) => state.category.isUpdating;
export const selectIsDeleting = (state) => state.category.isDeleting;
export const selectError = (state) => state.category.error;
export const selectSuccessMessage = (state) => state.category.successMessage;

// 导出Reducer
export default categorySlice.reducer;





