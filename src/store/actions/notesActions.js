import {
  ADD_NOTE,
  UPDATE_NOTE,
  DELETE_NOTE,
  SHARE_NOTE,
  SYNC_NOTES,
  SEARCH_NOTES
} from './types';

export const addNote = (note) => ({
  type: ADD_NOTE,
  payload: note
});

export const updateNote = (note) => ({
  type: UPDATE_NOTE,
  payload: note
});

export const deleteNote = (noteId) => ({
  type: DELETE_NOTE,
  payload: noteId
});

export const shareNote = (note) => ({
  type: SHARE_NOTE,
  payload: note
});

export const syncNotes = (notes) => ({
  type: SYNC_NOTES,
  payload: notes
});

export const searchNotes = (query) => ({
  type: SEARCH_NOTES,
  payload: query
}); 