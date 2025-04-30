/**
 * AI服务索引
 * 导出所有AI相关服务
 */
import textAnalysisService from './textAnalysis';
import translationService from './translationService';
import mindMapService from './mindMapService';

export {
  textAnalysisService,
  translationService,
  mindMapService
};

// 默认导出所有服务的集合
export default {
  textAnalysis: textAnalysisService,
  translation: translationService,
  mindMap: mindMapService
};
