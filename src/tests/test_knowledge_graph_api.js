/**
 * 知识图谱API测试脚本
 * 用于测试前端与后端的知识图谱API交互
 */

import knowledgeGraphApi from '../services/api/knowledgeGraphApi';

// 测试获取知识图谱
async function testGetKnowledgeGraph() {
  console.log('测试获取知识图谱...');
  const response = await knowledgeGraphApi.getKnowledgeGraph();
  console.log('响应:', response);
  return response;
}

// 测试获取所有节点
async function testGetAllNodes() {
  console.log('测试获取所有节点...');
  const response = await knowledgeGraphApi.getAllNodes();
  console.log('响应:', response);
  return response;
}

// 测试创建节点
async function testCreateNode() {
  console.log('测试创建节点...');
  const nodeData = {
    title: '测试节点',
    description: '这是一个测试节点',
    type: 'concept',
    x: 100,
    y: 100,
    color: '#2196F3',
    size: 20,
  };
  const response = await knowledgeGraphApi.createNode(nodeData);
  console.log('响应:', response);
  return response;
}

// 测试获取节点详情
async function testGetNodeById(id) {
  console.log(`测试获取节点详情 (ID: ${id})...`);
  const response = await knowledgeGraphApi.getNodeById(id);
  console.log('响应:', response);
  return response;
}

// 测试更新节点
async function testUpdateNode(id) {
  console.log(`测试更新节点 (ID: ${id})...`);
  const nodeData = {
    title: '更新后的测试节点',
    description: '这是更新后的测试节点',
    type: 'concept',
    x: 200,
    y: 200,
    color: '#4CAF50',
    size: 25,
  };
  const response = await knowledgeGraphApi.updateNode(id, nodeData);
  console.log('响应:', response);
  return response;
}

// 测试获取所有边
async function testGetAllEdges() {
  console.log('测试获取所有边...');
  const response = await knowledgeGraphApi.getAllEdges();
  console.log('响应:', response);
  return response;
}

// 测试创建边
async function testCreateEdge(sourceId, targetId) {
  console.log(`测试创建边 (源节点: ${sourceId}, 目标节点: ${targetId})...`);
  const edgeData = {
    source: sourceId,
    target: targetId,
    type: 'related',
    label: '相关',
    weight: 1,
  };
  const response = await knowledgeGraphApi.createEdge(edgeData);
  console.log('响应:', response);
  return response;
}

// 测试获取边详情
async function testGetEdgeById(id) {
  console.log(`测试获取边详情 (ID: ${id})...`);
  const response = await knowledgeGraphApi.getEdgeById(id);
  console.log('响应:', response);
  return response;
}

// 测试更新边
async function testUpdateEdge(id) {
  console.log(`测试更新边 (ID: ${id})...`);
  const edgeData = {
    type: 'related',
    label: '更新后的相关',
    weight: 2,
  };
  const response = await knowledgeGraphApi.updateEdge(id, edgeData);
  console.log('响应:', response);
  return response;
}

// 测试查找路径
async function testFindPath(sourceId, targetId) {
  console.log(`测试查找路径 (源节点: ${sourceId}, 目标节点: ${targetId})...`);
  const response = await knowledgeGraphApi.findPath(sourceId, targetId);
  console.log('响应:', response);
  return response;
}

// 测试分析图谱
async function testAnalyzeGraph() {
  console.log('测试分析图谱...');
  const response = await knowledgeGraphApi.analyzeGraph();
  console.log('响应:', response);
  return response;
}

// 测试生成标签
async function testGenerateTags() {
  console.log('测试生成标签...');
  const response = await knowledgeGraphApi.generateTags();
  console.log('响应:', response);
  return response;
}

// 测试获取相关概念
async function testGetRelatedConcepts(id) {
  console.log(`测试获取相关概念 (ID: ${id})...`);
  const response = await knowledgeGraphApi.getRelatedConcepts(id);
  console.log('响应:', response);
  return response;
}

// 测试删除边
async function testDeleteEdge(id) {
  console.log(`测试删除边 (ID: ${id})...`);
  const response = await knowledgeGraphApi.deleteEdge(id);
  console.log('响应:', response);
  return response;
}

// 测试删除节点
async function testDeleteNode(id) {
  console.log(`测试删除节点 (ID: ${id})...`);
  const response = await knowledgeGraphApi.deleteNode(id);
  console.log('响应:', response);
  return response;
}

// 运行测试
async function runTests() {
  try {
    // 获取知识图谱
    await testGetKnowledgeGraph();

    // 获取所有节点
    const nodesResponse = await testGetAllNodes();

    // 创建两个节点
    const createNode1Response = await testCreateNode();
    const createNode2Response = await testCreateNode();

    if (createNode1Response.success && createNode2Response.success) {
      const node1Id = createNode1Response.data.id;
      const node2Id = createNode2Response.data.id;

      // 获取节点详情
      await testGetNodeById(node1Id);

      // 更新节点
      await testUpdateNode(node1Id);

      // 获取所有边
      await testGetAllEdges();

      // 创建边
      const createEdgeResponse = await testCreateEdge(node1Id, node2Id);

      if (createEdgeResponse.success) {
        const edgeId = createEdgeResponse.data.id;

        // 获取边详情
        await testGetEdgeById(edgeId);

        // 更新边
        await testUpdateEdge(edgeId);

        // 查找路径
        await testFindPath(node1Id, node2Id);

        // 获取相关概念
        await testGetRelatedConcepts(node1Id);

        // 删除边
        await testDeleteEdge(edgeId);
      }

      // 分析图谱
      await testAnalyzeGraph();

      // 生成标签
      await testGenerateTags();

      // 删除节点
      await testDeleteNode(node1Id);
      await testDeleteNode(node2Id);
    }

    console.log('所有测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 导出测试函数
export default runTests;
