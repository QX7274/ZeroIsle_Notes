/**
 * 测试模块导出文件
 * 集中导出所有测试函数，方便引用
 */

import testApi from './test_api';
import testAiAssistantApi from './test_ai_assistant_api';
import testKnowledgeGraphApi from './test_knowledge_graph_api';
import testNotesApi from './test_notes_api';
import testReminderApi from './test_reminder_api';
import testSearchApi from './test_search_api';

export {
  testApi,
  testAiAssistantApi,
  testKnowledgeGraphApi,
  testNotesApi,
  testReminderApi,
  testSearchApi,
};

/**
 * 运行所有测试
 */
export const runAllTests = async () => {
  console.log('===== 开始运行所有API测试 =====');

  try {
    console.log('\n----- 测试社区API -----');
    await testApi();

    console.log('\n----- 测试AI助手API -----');
    await testAiAssistantApi();

    console.log('\n----- 测试知识图谱API -----');
    await testKnowledgeGraphApi();

    console.log('\n----- 测试笔记API -----');
    await testNotesApi();

    console.log('\n----- 测试提醒API -----');
    await testReminderApi();

    console.log('\n----- 测试搜索API -----');
    await testSearchApi();

    console.log('\n===== 所有API测试完成 =====');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
};

export default runAllTests;
