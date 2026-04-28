/**
 * AI服务索引
 * 导出所有AI相关服务
 */
import aiService from './EnhancedAIService';
import { chatHistoryService } from './chatHistoryService';

export {
  aiService,
  chatHistoryService,
};

// 默认导出所有服务的集合
export default {
  ai: aiService,
  chatHistory: chatHistoryService,
};
