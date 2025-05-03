/**
 * AI服务索引
 * 导出所有AI相关服务
 */
import textAnalysisService from './textAnalysis';
import translationService from './translationService';
import mindMapService from './mindMapService';
import aiService from './aiService';

export {
  textAnalysisService,
  translationService,
  mindMapService,
  aiService
};

// 默认导出所有服务的集合
export default {
  textAnalysis: textAnalysisService,
  translation: translationService,
  mindMap: mindMapService,
  ai: aiService
};
