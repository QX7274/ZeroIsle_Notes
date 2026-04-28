/**
 * Personal Activity Redux Slice (Local-First)
 * 个人活动记录状态管理 (本地化存储)
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import personalActivityDb from '../../services/local/personalActivityDb';

// --- Thunks for Local DB Operations ---

export const fetchActivities = createAsyncThunk(
  'personalActivity/fetchActivities',
  async (_, { rejectWithValue }) => {
    try {
      const activities = await personalActivityDb.getActivities();
      return activities;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const createActivity = createAsyncThunk(
  'personalActivity/createActivity',
  async (activityData, { rejectWithValue }) => {
    try {
      const updatedActivities = await personalActivityDb.saveActivity(activityData);
      return updatedActivities;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const updateActivity = createAsyncThunk(
  'personalActivity/updateActivity',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const updatedActivities = await personalActivityDb.saveActivity({ ...data, _id: id });
      return updatedActivities;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const deleteActivity = createAsyncThunk(
  'personalActivity/deleteActivity',
  async (id, { dispatch, rejectWithValue }) => {
    try {
      const updatedActivities = await personalActivityDb.deleteActivity(id);
      dispatch(fetchRecycledItems()); // Refresh recycle bin
      return updatedActivities;
    } catch (error) {
      return rejectWithValue(error.toString());
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
