/**
 * 服务导出文件
 * 集中导出所有API服务，方便引用
 */

import authApi from './api/authApi';
import * as notesApi from './api/notesApi';
import * as knowledgeGraphApi from './api/knowledgeGraphApi';
import * as aiAssistantApi from './api/aiAssistantApi';
import * as voiceRecognitionApi from './api/voiceApi';
import * as communityApi from './communityApi';

export {
  authApi,
  notesApi,
  knowledgeGraphApi,
  aiAssistantApi,
  voiceRecognitionApi,
  communityApi,
};
