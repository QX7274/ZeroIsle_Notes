/**
 * 笔记API测试脚本
 * 用于测试前端与后端的笔记API交互
 */

import notesApi from '../services/api/notesApi';

// 测试获取笔记列表
async function testGetAllNotes() {
  console.log('测试获取笔记列表...');
  const response = await notesApi.getAllNotes();
  console.log('响应:', response);
  return response;
}

// 测试获取笔记详情
async function testGetNoteById(id) {
  console.log(`测试获取笔记详情 (ID: ${id})...`);
  const response = await notesApi.getNoteById(id);
  console.log('响应:', response);
  return response;
}

// 测试创建笔记
async function testCreateNote() {
  console.log('测试创建笔记...');
  const noteData = {
    title: '测试笔记',
    content: '这是一个测试笔记的内容',
    is_public: false,
  };
  const response = await notesApi.createNote(noteData);
  console.log('响应:', response);
  return response;
}

// 测试更新笔记
async function testUpdateNote(id) {
  console.log(`测试更新笔记 (ID: ${id})...`);
  const noteData = {
    title: '更新后的测试笔记',
    content: '这是更新后的测试笔记内容',
    is_public: true,
  };
  const response = await notesApi.updateNote(id, noteData);
  console.log('响应:', response);
  return response;
}

// 测试删除笔记
async function testDeleteNote(id) {
  console.log(`测试删除笔记 (ID: ${id})...`);
  const response = await notesApi.deleteNote(id);
  console.log('响应:', response);
  return response;
}

// 测试收藏/取消收藏笔记
async function testToggleFavorite(id) {
  console.log(`测试收藏/取消收藏笔记 (ID: ${id})...`);
  const response = await notesApi.toggleFavorite(id);
  console.log('响应:', response);
  return response;
}

// 测试获取笔记统计信息
async function testGetNoteStats() {
  console.log('测试获取笔记统计信息...');
  const response = await notesApi.getNoteStats();
  console.log('响应:', response);
  return response;
}

// 测试获取笔记标签
async function testGetNoteTags() {
  console.log('测试获取笔记标签...');
  const response = await notesApi.getNoteTags();
  console.log('响应:', response);
  return response;
}

// 测试获取笔记分类
async function testGetNoteCategories() {
  console.log('测试获取笔记分类...');
  const response = await notesApi.getNoteCategories();
  console.log('响应:', response);
  return response;
}

// 测试获取笔记历史版本
async function testGetNoteHistory(id) {
  console.log(`测试获取笔记历史版本 (ID: ${id})...`);
  const response = await notesApi.getNoteHistory(id);
  console.log('响应:', response);
  return response;
}

// 运行测试
async function runTests() {
  try {
    // 获取笔记列表
    const notesResponse = await testGetAllNotes();

    if (notesResponse.success && notesResponse.data.results && notesResponse.data.results.length > 0) {
      const noteId = notesResponse.data.results[0].id;

      // 获取笔记详情
      await testGetNoteById(noteId);

      // 收藏/取消收藏笔记
      await testToggleFavorite(noteId);

      // 获取笔记历史版本
      await testGetNoteHistory(noteId);

      // 更新笔记
      await testUpdateNote(noteId);
    } else {
      // 如果没有笔记，创建一个
      const createResponse = await testCreateNote();

      if (createResponse.success) {
        const noteId = createResponse.data.id;

        // 获取笔记详情
        await testGetNoteById(noteId);

        // 收藏/取消收藏笔记
        await testToggleFavorite(noteId);

        // 更新笔记
        await testUpdateNote(noteId);

        // 删除笔记
        await testDeleteNote(noteId);
      }
    }

    // 获取笔记统计信息
    await testGetNoteStats();

    // 获取笔记标签
    await testGetNoteTags();

    // 获取笔记分类
    await testGetNoteCategories();

    console.log('所有测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 导出测试函数
export default runTests;
