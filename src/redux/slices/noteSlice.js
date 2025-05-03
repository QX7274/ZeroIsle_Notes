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
  async (note) => {
    const response = await notesApi.update(note.id, note);
    return response.data;
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
        const index = state.notes.findIndex(note => note.id === action.payload.id);
        if (index !== -1) {
          state.notes[index] = action.payload;
        }
      })
      .addCase(deleteNote.fulfilled, (state, action) => {
        state.notes = state.notes.filter(note => note.id !== action.payload);
      });
  },
});

export default noteSlice.reducer;
