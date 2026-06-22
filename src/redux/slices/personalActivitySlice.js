/**
 * Personal Activity Redux Slice (Local-First)
 * 个人活动记录状态管理 (本地化存储)
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import personalActivityDb from '../../services/local/personalActivityDb';
import personalActivityApi from '../../services/api/personalActivityApi';

const normalizeActivityListPayload = (payload) => {
  if (Array.isArray(payload?.data?.activities)) {
    return payload.data.activities;
  }

  if (Array.isArray(payload?.activities)) {
    return payload.activities;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

const buildActivityTitle = (data = {}) => {
  const explicitTitle = String(data.title || '').trim();
  if (explicitTitle) {
    return explicitTitle;
  }

  const normalizedContent = String(data.content || '').replace(/\s+/g, ' ').trim();
  return normalizedContent ? normalizedContent.slice(0, 24) : '动态';
};

const buildRemoteActivityPayload = (data = {}, existingActivity = null) => ({
  title: buildActivityTitle({ ...existingActivity, ...data }),
  description: data.description ?? existingActivity?.description ?? '',
  content: data.content ?? existingActivity?.content ?? '',
  images: Array.isArray(data.images) ? data.images : (existingActivity?.images || []),
  content_type: data.content_type ?? existingActivity?.content_type ?? existingActivity?.type ?? 'activity',
  is_public: data.is_public ?? existingActivity?.is_public ?? true,
  start_time: data.start_time ?? existingActivity?.start_time ?? existingActivity?.created_at ?? new Date().toISOString(),
  status: data.status ?? existingActivity?.status ?? 'planned',
  progress: typeof data.progress === 'number' ? data.progress : (existingActivity?.progress ?? 0),
});

// --- Thunks for Local DB Operations ---

export const fetchActivities = createAsyncThunk(
  'personalActivity/fetchActivities',
  async (_, { rejectWithValue }) => {
    try {
      const response = await personalActivityApi.getActivities({ page: 1, page_size: 100 });
      return normalizeActivityListPayload(response);
    } catch (error) {
      try {
        const activities = await personalActivityDb.getActivities();
        return activities;
      } catch (localError) {
        return rejectWithValue(localError.toString() || error.toString());
      }
    }
  }
);

export const createActivity = createAsyncThunk(
  'personalActivity/createActivity',
  async (activityData, { rejectWithValue }) => {
    try {
      const payload = buildRemoteActivityPayload(activityData);
      await personalActivityApi.createActivity(payload);
      const refreshed = await personalActivityApi.getActivities({ page: 1, page_size: 100 });
      return normalizeActivityListPayload(refreshed);
    } catch (error) {
      try {
        const updatedActivities = await personalActivityDb.saveActivity(activityData);
        return updatedActivities;
      } catch (localError) {
        return rejectWithValue(localError.toString() || error.toString());
      }
    }
  }
);

export const updateActivity = createAsyncThunk(
  'personalActivity/updateActivity',
  async ({ id, data, existingActivity }, { rejectWithValue }) => {
    try {
      const payload = buildRemoteActivityPayload(data, existingActivity);
      await personalActivityApi.updateActivity(id, payload);
      const refreshed = await personalActivityApi.getActivities({ page: 1, page_size: 100 });
      return normalizeActivityListPayload(refreshed);
    } catch (error) {
      try {
        const updatedActivities = await personalActivityDb.saveActivity({ ...data, _id: id });
        return updatedActivities;
      } catch (localError) {
        return rejectWithValue(localError.toString() || error.toString());
      }
    }
  }
);

export const deleteActivity = createAsyncThunk(
  'personalActivity/deleteActivity',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await personalActivityApi.deleteActivity(id);
      const refreshed = await personalActivityApi.getActivities({ page: 1, page_size: 100 });
      dispatch(fetchRecycledItems()); // Refresh recycle bin
      return normalizeActivityListPayload(refreshed);
    } catch (error) {
      try {
        const updatedActivities = await personalActivityDb.deleteActivity(id);
        dispatch(fetchRecycledItems()); // Refresh recycle bin
        return updatedActivities;
      } catch (localError) {
        return rejectWithValue(localError.toString() || error.toString());
      }
    }
  }
);

export const saveDraft = createAsyncThunk(
  'personalActivity/saveDraft',
  async (draftData, { rejectWithValue }) => {
    try {
      const savedDraft = await personalActivityDb.saveDraft(draftData);
      return savedDraft;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const fetchDrafts = createAsyncThunk(
  'personalActivity/fetchDrafts',
  async (_, { rejectWithValue }) => {
    try {
      const drafts = await personalActivityDb.getDrafts();
      return drafts;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const deleteDraft = createAsyncThunk(
  'personalActivity/deleteDraft',
  async (id, { rejectWithValue }) => {
    try {
      const updatedDrafts = await personalActivityDb.deleteDraft(id);
      return updatedDrafts;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const fetchRecycledItems = createAsyncThunk(
  'personalActivity/fetchRecycledItems',
  async (_, { rejectWithValue }) => {
    try {
      const items = await personalActivityDb.getRecycledItems();
      return items;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const restoreRecycledItem = createAsyncThunk(
  'personalActivity/restoreRecycledItem',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const updatedRecycled = await personalActivityDb.restoreItem(id);
      dispatch(fetchActivities()); // Refresh activities list
      return updatedRecycled;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const permanentlyDeleteRecycledItem = createAsyncThunk(
  'personalActivity/permanentlyDeleteRecycledItem',
  async (id, { rejectWithValue }) => {
    try {
      const updatedRecycled = await personalActivityDb.permanentlyDeleteItem(id);
      return updatedRecycled;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

// --- Initial State ---
const initialState = {
  activities: [],
  drafts: [],
  recycledItems: [],
  loading: false,
  error: null,
};

// --- Slice Definition ---
const personalActivitySlice = createSlice({
  name: 'personalActivity',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Generic pending handler
    const pendingHandler = (state) => {
      state.loading = true;
      state.error = null;
    };

    // Generic rejected handler
    const rejectedHandler = (state, action) => {
      state.loading = false;
      state.error = action.payload;
    };

    // Activities
    builder
      .addCase(fetchActivities.fulfilled, (state, action) => {
        state.loading = false;
        state.activities = action.payload;
      })
      .addCase(createActivity.fulfilled, (state, action) => {
        state.loading = false;
        state.activities = action.payload;
      })
      .addCase(updateActivity.fulfilled, (state, action) => {
        state.loading = false;
        state.activities = action.payload;
      })
      .addCase(deleteActivity.fulfilled, (state, action) => {
        state.loading = false;
        state.activities = action.payload;
      });

    // Drafts
    builder
      .addCase(fetchDrafts.fulfilled, (state, action) => {
        state.loading = false;
        state.drafts = action.payload;
      })
      .addCase(saveDraft.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.drafts.findIndex(d => d._id === action.payload._id);
        if (index !== -1) {
          state.drafts[index] = action.payload;
        } else {
          state.drafts.push(action.payload);
        }
      })
      .addCase(deleteDraft.fulfilled, (state, action) => {
        state.loading = false;
        state.drafts = action.payload;
      });

    // Recycle Bin
    builder
      .addCase(fetchRecycledItems.fulfilled, (state, action) => {
        state.loading = false;
        state.recycledItems = action.payload;
      })
      .addCase(restoreRecycledItem.fulfilled, (state, action) => {
        state.loading = false;
        state.recycledItems = action.payload;
      })
      .addCase(permanentlyDeleteRecycledItem.fulfilled, (state, action) => {
        state.loading = false;
        state.recycledItems = action.payload;
      });

    // Add matcher for all pending and rejected actions
    builder
      .addMatcher(
        (action) => action.type.endsWith('/pending'),
        pendingHandler
      )
      .addMatcher(
        (action) => action.type.endsWith('/rejected'),
        rejectedHandler
      );
  },
});

export const { clearError } = personalActivitySlice.actions;

export default personalActivitySlice.reducer;
