/**
 * 搜索API测试脚本
 * 用于测试前端与后端的搜索API交互
 */

import searchApi from './services/api/searchApi';

// 测试基础搜索
async function testSearch() {
  console.log('测试基础搜索...');
  const query = '测试';
  const params = {
    page: 1,
    page_size: 10
  };
  const response = await searchApi.search(query, params);
  console.log('响应:', response);
  return response;
}

// 测试高级搜索
async function testAdvancedSearch() {
  console.log('测试高级搜索...');
  const searchParams = {
    q: '测试',
    content_type: 'note',
    date_from: '2023-01-01',
    date_to: '2023-12-31',
    tags: ['测试', 'API'],
    page: 1,
    page_size: 10
  };
  const response = await searchApi.advancedSearch(searchParams);
  console.log('响应:', response);
  return response;
}

// 测试语义搜索
async function testSemanticSearch() {
  console.log('测试语义搜索...');
  const query = '如何使用人工智能提高工作效率';
  const params = {
    page: 1,
    page_size: 10
  };
  const response = await searchApi.semanticSearch(query, params);
  console.log('响应:', response);
  return response;
}

// 测试标签搜索
async function testSearchByTags() {
  console.log('测试标签搜索...');
  const tags = ['测试', 'API'];
  const params = {
    page: 1,
    page_size: 10
  };
  const response = await searchApi.searchByTags(tags, params);
  console.log('响应:', response);
  return response;
}

// 测试获取搜索建议
async function testGetSearchSuggestions() {
  console.log('测试获取搜索建议...');
  const query = '测试';
  const limit = 5;
  const response = await searchApi.getSearchSuggestions(query, limit);
  console.log('响应:', response);
  return response;
}

// 测试文本搜索
async function testTextSearch() {
  console.log('测试文本搜索...');
  const query = '测试API';
  const params = {
    content_type: 'note',
    page: 1,
    page_size: 10
  };
  const response = await searchApi.textSearch(query, params);
  console.log('响应:', response);
  return response;
}

// 测试知识图谱搜索
async function testKnowledgeGraphSearch() {
  console.log('测试知识图谱搜索...');
  const query = '人工智能';
  const params = {
    depth: 2,
    max_results: 10
  };
  const response = await searchApi.knowledgeGraphSearch(query, params);
  console.log('响应:', response);
  return response;
}

// 测试获取搜索历史
async function testGetSearchHistory() {
  console.log('测试获取搜索历史...');
  const limit = 10;
  const response = await searchApi.getSearchHistory(limit);
  console.log('响应:', response);
  return response;
}

// 测试清除搜索历史
async function testClearSearchHistory() {
  console.log('测试清除搜索历史...');
  const response = await searchApi.clearSearchHistory();
  console.log('响应:', response);
  return response;
}

// 运行测试
async function runTests() {
  try {
    // 基础搜索
    await testSearch();
    
    // 高级搜索
    await testAdvancedSearch();
    
    // 语义搜索
    await testSemanticSearch();
    
    // 标签搜索
    await testSearchByTags();
    
    // 获取搜索建议
    await testGetSearchSuggestions();
    
    // 文本搜索
    await testTextSearch();
    
    // 知识图谱搜索
    await testKnowledgeGraphSearch();
    
    // 获取搜索历史
    await testGetSearchHistory();
    
    // 清除搜索历史
    await testClearSearchHistory();
    
    console.log('所有测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 导出测试函数
export default runTests;
