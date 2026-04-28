/**
 * API测试脚本
 * 用于测试前端与后端的API交互
 */

import communityApi from '../services/api/communityApi';

// 测试获取帖子列表
async function testGetPosts() {
  console.log('测试获取帖子列表...');
  const response = await communityApi.getPosts();
  console.log('响应:', response);
  return response;
}

// 测试获取帖子详情
async function testGetPostDetail(postId) {
  console.log(`测试获取帖子详情 (ID: ${postId})...`);
  const response = await communityApi.getPostDetail(postId);
  console.log('响应:', response);
  return response;
}

// 测试创建帖子
async function testCreatePost() {
  console.log('测试创建帖子...');
  const postData = {
    title: '测试帖子',
    content: '这是一个测试帖子的内容',
    excerpt: '测试帖子摘要',
    tags: ['测试', 'API'],
    is_public: true,
  };
  const response = await communityApi.createPost(postData);
  console.log('响应:', response);
  return response;
}

// 测试获取评论
async function testGetComments(postId) {
  console.log(`测试获取评论 (帖子ID: ${postId})...`);
  const response = await communityApi.getPostComments(postId);
  console.log('响应:', response);
  return response;
}

// 测试添加评论
async function testAddComment(postId) {
  console.log(`测试添加评论 (帖子ID: ${postId})...`);
  const commentData = {
    content: '这是一条测试评论',
  };
  const response = await communityApi.addComment(postId, commentData);
  console.log('响应:', response);
  return response;
}

// 测试点赞帖子
async function testTogglePostLike(postId) {
  console.log(`测试点赞帖子 (ID: ${postId})...`);
  const response = await communityApi.togglePostLike(postId);
  console.log('响应:', response);
  return response;
}

// 测试获取标签
async function testGetTags() {
  console.log('测试获取标签...');
  const response = await communityApi.getTags();
  console.log('响应:', response);
  return response;
}

// 测试获取分类
async function testGetCategories() {
  console.log('测试获取分类...');
  const response = await communityApi.getCategories();
  console.log('响应:', response);
  return response;
}

// 运行测试
async function runTests() {
  try {
    // 获取帖子列表
    const postsResponse = await testGetPosts();

    if (postsResponse.success && postsResponse.data.results && postsResponse.data.results.length > 0) {
      const postId = postsResponse.data.results[0].id;

      // 获取帖子详情
      await testGetPostDetail(postId);

      // 获取评论
      await testGetComments(postId);

      // 添加评论
      await testAddComment(postId);

      // 点赞帖子
      await testTogglePostLike(postId);
    } else {
      // 如果没有帖子，创建一个
      const createResponse = await testCreatePost();

      if (createResponse.success) {
        const postId = createResponse.data.id;

        // 获取帖子详情
        await testGetPostDetail(postId);

        // 添加评论
        await testAddComment(postId);

        // 点赞帖子
        await testTogglePostLike(postId);
      }
    }

    // 获取标签
    await testGetTags();

    // 获取分类
    await testGetCategories();

    console.log('所有测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 导出测试函数
export default runTests;
