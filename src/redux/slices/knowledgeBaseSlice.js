/**
 * 知识库状态管理 Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import knowledgeBaseApi from '../../services/api/knowledgeBaseApi';

// 异步 Thunks

export const fetchKnowledgeBases = createAsyncThunk(
  'knowledgeBase/fetchKnowledgeBases',
  async (params, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.getKnowledgeBases(params);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

export const createKnowledgeBase = createAsyncThunk(
  'knowledgeBase/createKnowledgeBase',
  async (kbData, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.createKnowledgeBase(kbData);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

export const fetchKnowledgeBaseDetails = createAsyncThunk(
  'knowledgeBase/fetchKnowledgeBaseDetails',
  async (id, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.getKnowledgeBaseDetails(id);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

export const askKnowledgeBase = createAsyncThunk(
  'knowledgeBase/askKnowledgeBase',
  async ({ id, queryData }, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.askKnowledgeBase(id, queryData);
    if (!response.success) {return rejectWithValue(response);}
    return { response: response.data, userQuery: queryData.query };
  }
);

export const fetchKnowledgeBaseNodes = createAsyncThunk(
  'knowledgeBase/fetchKnowledgeBaseNodes',
  async (id, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.getKnowledgeBaseNodes(id);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

export const fetchKnowledgeBaseAnalysis = createAsyncThunk(
  'knowledgeBase/fetchKnowledgeBaseAnalysis',
  async (id, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.getKnowledgeBaseAnalysis(id);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

export const updateKnowledgeBase = createAsyncThunk(
  'knowledgeBase/updateKnowledgeBase',
  async ({ id, kbData }, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.updateKnowledgeBase(id, kbData);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

export const deleteKnowledgeBase = createAsyncThunk(
  'knowledgeBase/deleteKnowledgeBase',
  async (id, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.deleteKnowledgeBase(id);
    if (!response.success) {return rejectWithValue(response);}
    return id; // Return the id on success for removal from state
  }
);

export const createKnowledgeBaseNode = createAsyncThunk(
  'knowledgeBase/createNode',
  async ({ kbId, nodeData }, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.createNode(kbId, nodeData);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

export const updateKnowledgeBaseNode = createAsyncThunk(
  'knowledgeBase/updateNode',
  async ({ kbId, nodeId, nodeData }, { rejectWithValue }) => {
    const response = await knowledgeBaseApi.updateNode(kbId, nodeId, nodeData);
    if (!response.success) {return rejectWithValue(response);}
    return response.data;
  }
);

const initialState = {
  knowledgeBases: [],
  currentKnowledgeBase: null,
  nodes: [],
  analysis: null,
  conversation: [],
  status: 'idle', // for list and detail
  nodesStatus: 'idle',
  analysisStatus: 'idle',
  error: null,
};

const knowledgeBaseSlice = createSlice({
  name: 'knowledgeBase',
  initialState,
  reducers: {
    clearConversation(state) {
        state.conversation = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchKnowledgeBases
      .addCase(fetchKnowledgeBases.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchKnowledgeBases.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.knowledgeBases = action.payload;
      })
      .addCase(fetchKnowledgeBases.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })

      // createKnowledgeBase
      .addCase(createKnowledgeBase.fulfilled, (state, action) => {
        state.knowledgeBases.push(action.payload);
      })

      // fetchKnowledgeBaseDetails
      .addCase(fetchKnowledgeBaseDetails.pending, (state) => {
        state.status = 'loading';
        state.currentKnowledgeBase = null;
      })
      .addCase(fetchKnowledgeBaseDetails.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.currentKnowledgeBase = action.payload;
      })
      .addCase(fetchKnowledgeBaseDetails.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })

      // askKnowledgeBase
      .addCase(askKnowledgeBase.pending, (state, action) => {
        const userMessage = { role: 'user', content: action.meta.arg.queryData.query };
        state.conversation.push(userMessage);
      })

      // createKnowledgeBaseNode
      .addCase(createKnowledgeBaseNode.fulfilled, (state, action) => {
        state.nodes.push(action.payload);
        state.nodesStatus = 'succeeded';
      })

      // updateKnowledgeBaseNode
      .addCase(updateKnowledgeBaseNode.fulfilled, (state, action) => {
        const updatedNode = action.payload;
        const index = state.nodes.findIndex(node => node.id === updatedNode.id);
        if (index !== -1) {
          state.nodes[index] = updatedNode;
        }
        state.nodesStatus = 'succeeded';
      })

      .addCase(askKnowledgeBase.fulfilled, (state, action) => {
        const assistantMessage = {
          role: 'assistant',
          content: action.payload.response?.answer || action.payload.answer || '',
          citations: action.payload.response?.citations || action.payload.citations || [],
        };
        state.conversation.push(assistantMessage);
      })

      // fetchKnowledgeBaseNodes
      .addCase(fetchKnowledgeBaseNodes.pending, (state) => {
        state.nodesStatus = 'loading';
      })
      .addCase(fetchKnowledgeBaseNodes.fulfilled, (state, action) => {
        state.nodesStatus = 'succeeded';
        state.nodes = action.payload;
      })
      .addCase(fetchKnowledgeBaseNodes.rejected, (state, action) => {
        state.nodesStatus = 'failed';
        state.error = action.payload;
      })

      // fetchKnowledgeBaseAnalysis
      .addCase(fetchKnowledgeBaseAnalysis.pending, (state) => {
        state.analysisStatus = 'loading';
      })
      .addCase(fetchKnowledgeBaseAnalysis.fulfilled, (state, action) => {
        state.analysisStatus = 'succeeded';
        state.analysis = action.payload;
      })
      .addCase(fetchKnowledgeBaseAnalysis.rejected, (state, action) => {
        state.analysisStatus = 'failed';
        state.error = action.payload;
      })

      // updateKnowledgeBase
      .addCase(updateKnowledgeBase.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const updatedKb = action.payload;
        state.knowledgeBases = state.knowledgeBases.map(kb =>
          kb.id === updatedKb.id ? updatedKb : kb
        );
        if (state.currentKnowledgeBase?.id === updatedKb.id) {
          state.currentKnowledgeBase = updatedKb;
        }
      })

      // deleteKnowledgeBase
      .addCase(deleteKnowledgeBase.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const deletedId = action.payload;
        state.knowledgeBases = state.knowledgeBases.filter(kb => kb.id !== deletedId);
        if (state.currentKnowledgeBase?.id === deletedId) {
          state.currentKnowledgeBase = null;
        }
      });
  },
});

export const { clearConversation } = knowledgeBaseSlice.actions;

export default knowledgeBaseSlice.reducer;

