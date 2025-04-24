import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 导入reducers
import notesReducer from './reducers/notesReducer';
import userReducer from './reducers/userReducer';
import settingsReducer from './reducers/settingsReducer';
import remindersReducer from './reducers/remindersReducer';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['notes', 'user', 'settings', 'reminders']
};

const rootReducer = combineReducers({
  notes: notesReducer,
  user: userReducer,
  settings: settingsReducer,
  reminders: remindersReducer
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = createStore(persistedReducer, applyMiddleware(thunk));
export const persistor = persistStore(store); 