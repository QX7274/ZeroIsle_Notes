import {
  ADD_NOTE,
  UPDATE_NOTE,
  DELETE_NOTE,
  SHARE_NOTE,
  SYNC_NOTES,
  SEARCH_NOTES
} from '../actions/notesActions';

const initialState = {
  notes: [],
  sharedNotes: [],
  searchResults: [],
  isLoading: false,
  error: null
};

const notesReducer = (state = initialState, action) => {
  switch (action.type) {
    case ADD_NOTE:
      return {
        ...state,
        notes: [...state.notes, action.payload]
      };
    case UPDATE_NOTE:
      return {
        ...state,
        notes: state.notes.map(note =>
          note.id === action.payload.id ? action.payload : note
        )
      };
    case DELETE_NOTE:
      return {
        ...state,
        notes: state.notes.filter(note => note.id !== action.payload)
      };
    case SHARE_NOTE:
      return {
        ...state,
        sharedNotes: [...state.sharedNotes, action.payload]
      };
    case SYNC_NOTES:
      return {
        ...state,
        notes: action.payload,
        isLoading: false
      };
    case SEARCH_NOTES:
      return {
        ...state,
        searchResults: action.payload
      };
    default:
      return state;
  }
};

export default notesReducer; 