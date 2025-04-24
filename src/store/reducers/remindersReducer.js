import {
  ADD_REMINDER,
  UPDATE_REMINDER,
  DELETE_REMINDER
} from '../actions/types';

const initialState = {
  reminders: [],
  isLoading: false,
  error: null
};

const remindersReducer = (state = initialState, action) => {
  switch (action.type) {
    case ADD_REMINDER:
      return {
        ...state,
        reminders: [...state.reminders, action.payload]
      };
    case UPDATE_REMINDER:
      return {
        ...state,
        reminders: state.reminders.map(reminder =>
          reminder.id === action.payload.id ? action.payload : reminder
        )
      };
    case DELETE_REMINDER:
      return {
        ...state,
        reminders: state.reminders.filter(reminder => reminder.id !== action.payload)
      };
    default:
      return state;
  }
};

export default remindersReducer;
