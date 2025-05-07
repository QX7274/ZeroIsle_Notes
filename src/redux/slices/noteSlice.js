import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notesApi } from '../../services/api';

export const loadNotes = createAsyncThunk(
  'notes/loadNotes',
  async (notes) => {
    return notes;
  }
);

export const addNote = createAsyncThunk(
  'notes/addNote',
  async (note) => {
    const response = await notesApi.create(note);
    return response.data;
  }
);

export const updateNote = createAsyncThunk(
  'notes/updateNote',
  async (notes) => {
    // 如果传入的是数组，直接返回
    if (Array.isArray(notes)) {
      console.log('更新笔记列表:', notes.length, '条笔记');
      return notes;
    }

    // 如果是单个笔记，尝试更新
    try {
      const response = await notesApi.update(notes.id, notes);
      return response.data;
    } catch (error) {
      console.error('更新笔记失败，返回原始笔记:', error);
      // 更新失败时返回原始笔记，确保UI不会中断
      return notes;
    }
  }
);

export const deleteNote = createAsyncThunk(
  'notes/deleteNote',
  async (noteId) => {
    await notesApi.delete(noteId);
    return noteId;
  }
);

const noteSlice = createSlice({
  name: 'notes',
  initialState: {
    notes: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadNotes.fulfilled, (state, action) => {
        state.notes = action.payload;
      })
      .addCase(addNote.fulfilled, (state, action) => {
        state.notes.push(action.payload);
      })
      .addCase(updateNote.fulfilled, (state, action) => {
        // 处理数组情况（批量更新）
        if (Array.isArray(action.payload)) {
          console.log('批量更新笔记:', action.payload.length, '条笔记');
          state.notes = action.payload;
        }
        // 处理单个笔记更新
        else {
          const index = state.notes.findIndex(note => note.id === action.payload.id);
          if (index !== -1) {
            state.notes[index] = action.payload;
          } else {
            // 如果找不到对应的笔记，添加到列表中
            state.notes.push(action.payload);
          }
        }
      })
      .addCase(deleteNote.fulfilled, (state, action) => {
        state.notes = state.notes.filter(note => note.id !== action.payload);
      });
  },
});

export default noteSlice.reducer;
