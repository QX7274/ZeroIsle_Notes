/**
 * API服务索引
 * 统一导出所有API服务
 */

// 导入API服务
import { apiWrapper } from '../api';
import authApi from './authApi';
import notesApi from './notesApi';
import knowledgeGraphApi from './knowledgeGraphApi';
import aiAssistantApi from './aiAssistantApi';
import reminderApi from './reminderApi';
import voiceApi from './voiceApi';
import searchApi from './searchApi';
import communityApi from './communityApi';
import canvasApi from './canvasApi';
import codeApi from './codeApi';
import userApi from './userApi';
import annotationApi from './annotationApi';
import drawingPathApi from './drawingPathApi';
import tagApi from './tagApi';
import fileApi from './fileApi';
import categoryApi from './categoryApi';
import apiClient from './apiClient';
import knowledgeBaseApi from './knowledgeBaseApi';

// 导出API服务
export {
  apiClient,
  authApi,
  notesApi,
  knowledgeGraphApi,
  knowledgeBaseApi,
  aiAssistantApi,
  reminderApi,
  voiceApi,
  searchApi,
  communityApi,
  canvasApi,
  codeApi,
  userApi,
  annotationApi,
  drawingPathApi,
  tagApi,
  fileApi,
  categoryApi,
};

// 默认导出所有API服务
export default {
  api: apiClient,
  auth: authApi,
  notes: notesApi,
  knowledgeGraph: knowledgeGraphApi,
  knowledgeBase: knowledgeBaseApi,
  aiAssistant: aiAssistantApi,
  reminder: reminderApi,
  voice: voiceApi,
  search: searchApi,
  community: communityApi,
  canvas: canvasApi,
  code: codeApi,
  user: userApi,
  annotation: annotationApi,
  drawingPath: drawingPathApi,
  tag: tagApi,
  file: fileApi,
  category: categoryApi,
  apiWrapper,
};
