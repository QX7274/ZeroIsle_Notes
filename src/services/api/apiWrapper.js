import notesApi from './notesApi';
import { logService } from '../utils/logService';

class ApiWrapper {
  constructor() {
    this._checkApiInitialized();
  }

  _checkApiInitialized() {
    if (!notesApi || typeof notesApi !== 'object') {
      const error = new Error('notesApi未正确初始化');
      logService.error('API服务初始化失败', error);
      throw error;
    }
  }

  getAllNotes(params) {
    this._checkMethod('getAllNotes');
    return notesApi.getAllNotes(params);
  }

  importNote(formData) {
    this._checkMethod('importNote');
    return notesApi.importNote(formData);
  }

  deleteNote(noteId) {
    this._checkMethod('deleteNote');
    return notesApi.deleteNote(noteId);
  }

  updateNote(noteId, noteData) {
    this._checkMethod('updateNote');
    return notesApi.updateNote(noteId, noteData);
  }

  _checkMethod(methodName) {
    if (!notesApi[methodName] || typeof notesApi[methodName] !== 'function') {
      const error = new Error(`notesApi.${methodName}方法不可用`);
      logService.error('API方法调用失败', error);
      throw error;
    }
  }
}

export const apiWrapper = new ApiWrapper();