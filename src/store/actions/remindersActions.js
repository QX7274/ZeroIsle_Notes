import {
  ADD_REMINDER,
  UPDATE_REMINDER,
  DELETE_REMINDER
} from './types';

export const addReminder = (reminder) => ({
  type: ADD_REMINDER,
  payload: reminder
});

export const updateReminder = (reminder) => ({
  type: UPDATE_REMINDER,
  payload: reminder
});

export const deleteReminder = (reminderId) => ({
  type: DELETE_REMINDER,
  payload: reminderId
});
