/**
 * AI助手API测试脚本
 * 用于测试前端与后端的AI助手API交互
 */

import aiAssistantApi from '../services/api/aiAssistantApi';

// 测试发送聊天消息
async function testSendChatMessage() {
  console.log('测试发送聊天消息...');
  const chatData = {
    message: '你好，请介绍一下自己',
    engine: 'gpt-3.5-turbo'
  };
  const response = await aiAssistantApi.sendChatMessage(chatData);
  console.log('响应:', response);
  return response;
}

// 测试生成内容
async function testGenerateContent() {
  console.log('测试生成内容...');
  const generateData = {
    prompt: '写一篇关于人工智能的短文',
    max_tokens: 200,
    engine: 'gpt-3.5-turbo'
  };
  const response = await aiAssistantApi.generateContent(generateData);
  console.log('响应:', response);
  return response;
}

// 测试总结文本
async function testSummarizeText() {
  console.log('测试总结文本...');
  const summarizeData = {
    text: '人工智能（AI）是计算机科学的一个分支，它致力于创造能够模拟人类智能的机器。这些机器可以学习、推理、感知、规划和解决问题。AI的应用范围非常广泛，从简单的语音识别到复杂的自动驾驶汽车。机器学习是AI的一个子领域，它使用算法和统计模型来使计算机系统能够从数据中学习和改进，而不需要明确的编程指令。深度学习是机器学习的一个分支，它使用多层神经网络来模拟人脑的工作方式。自然语言处理（NLP）是AI的另一个重要领域，它使计算机能够理解、解释和生成人类语言。计算机视觉使机器能够从图像或视频中获取信息并理解视觉世界。强化学习是一种机器学习方法，它通过与环境互动并从反馈中学习来优化决策。AI的发展带来了许多伦理和社会问题，如隐私、安全、就业和偏见等。',
    max_tokens: 100,
    engine: 'gpt-3.5-turbo'
  };
  const response = await aiAssistantApi.summarizeText(summarizeData);
  console.log('响应:', response);
  return response;
}

// 测试翻译文本
async function testTranslateText() {
  console.log('测试翻译文本...');
  const translateData = {
    text: 'Artificial Intelligence (AI) is a branch of computer science that aims to create machines capable of mimicking human intelligence.',
    source_language: 'en',
    target_language: 'zh',
    engine: 'gpt-3.5-turbo'
  };
  const response = await aiAssistantApi.translateText(translateData);
  console.log('响应:', response);
  return response;
}

// 测试分析情感
async function testAnalyzeSentiment() {
  console.log('测试分析情感...');
  const sentimentData = {
    text: '我非常喜欢这个产品，它超出了我的期望！',
    engine: 'gpt-3.5-turbo'
  };
  const response = await aiAssistantApi.analyzeSentiment(sentimentData);
  console.log('响应:', response);
  return response;
}

// 测试获取可用模型列表
async function testGetAvailableModels() {
  console.log('测试获取可用模型列表...');
  const response = await aiAssistantApi.getAvailableModels();
  console.log('响应:', response);
  return response;
}

// 测试重置会话
async function testResetSession() {
  console.log('测试重置会话...');
  const response = await aiAssistantApi.resetSession();
  console.log('响应:', response);
  return response;
}

// 运行测试
async function runTests() {
  try {
    // 获取可用模型列表
    await testGetAvailableModels();
    
    // 发送聊天消息
    await testSendChatMessage();
    
    // 生成内容
    await testGenerateContent();
    
    // 总结文本
    await testSummarizeText();
    
    // 翻译文本
    await testTranslateText();
    
    // 分析情感
    await testAnalyzeSentiment();
    
    // 重置会话
    await testResetSession();
    
    console.log('所有测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 导出测试函数
export default runTests;
