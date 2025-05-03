/**
 * 提醒功能API测试脚本
 * 用于测试前端与后端的提醒功能API交互
 */

import reminderApi from '../services/api/reminderApi';

// 测试获取所有提醒
async function testGetAllReminders() {
  console.log('测试获取所有提醒...');
  const response = await reminderApi.getAllReminders();
  console.log('响应:', response);
  return response;
}

// 测试获取提醒详情
async function testGetReminderById(id) {
  console.log(`测试获取提醒详情 (ID: ${id})...`);
  const response = await reminderApi.getReminderById(id);
  console.log('响应:', response);
  return response;
}

// 测试创建提醒
async function testCreateReminder() {
  console.log('测试创建提醒...');
  const reminderData = {
    title: '测试提醒',
    description: '这是一个测试提醒',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明天
    priority: 'medium',
    frequency: 'once'
  };
  const response = await reminderApi.createReminder(reminderData);
  console.log('响应:', response);
  return response;
}

// 测试更新提醒
async function testUpdateReminder(id) {
  console.log(`测试更新提醒 (ID: ${id})...`);
  const reminderData = {
    title: '更新后的测试提醒',
    description: '这是更新后的测试提醒',
    due_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 后天
    priority: 'high',
    frequency: 'daily'
  };
  const response = await reminderApi.updateReminder(id, reminderData);
  console.log('响应:', response);
  return response;
}

// 测试完成提醒
async function testCompleteReminder(id) {
  console.log(`测试完成提醒 (ID: ${id})...`);
  const response = await reminderApi.completeReminder(id);
  console.log('响应:', response);
  return response;
}

// 测试重新打开提醒
async function testReopenReminder(id) {
  console.log(`测试重新打开提醒 (ID: ${id})...`);
  const response = await reminderApi.reopenReminder(id);
  console.log('响应:', response);
  return response;
}

// 测试获取即将到期的提醒
async function testGetUpcomingReminders() {
  console.log('测试获取即将到期的提醒...');
  const response = await reminderApi.getUpcomingReminders();
  console.log('响应:', response);
  return response;
}

// 测试获取已过期的提醒
async function testGetOverdueReminders() {
  console.log('测试获取已过期的提醒...');
  const response = await reminderApi.getOverdueReminders();
  console.log('响应:', response);
  return response;
}

// 测试获取今日提醒
async function testGetTodayReminders() {
  console.log('测试获取今日提醒...');
  const response = await reminderApi.getTodayReminders();
  console.log('响应:', response);
  return response;
}

// 测试从笔记创建提醒
async function testCreateReminderFromNote(noteId) {
  console.log(`测试从笔记创建提醒 (笔记ID: ${noteId})...`);
  const reminderData = {
    note_id: noteId,
    title: '笔记提醒测试',
    description: '这是从笔记创建的测试提醒',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 明天
  };
  const response = await reminderApi.createReminderFromNote(reminderData);
  console.log('响应:', response);
  return response;
}

// 测试启用/禁用提醒
async function testToggleEnableReminder(id) {
  console.log(`测试启用/禁用提醒 (ID: ${id})...`);
  const response = await reminderApi.toggleEnableReminder(id);
  console.log('响应:', response);
  return response;
}

// 测试获取提醒通知
async function testGetReminderNotifications() {
  console.log('测试获取提醒通知...');
  const response = await reminderApi.getReminderNotifications();
  console.log('响应:', response);
  return response;
}

// 测试删除提醒
async function testDeleteReminder(id) {
  console.log(`测试删除提醒 (ID: ${id})...`);
  const response = await reminderApi.deleteReminder(id);
  console.log('响应:', response);
  return response;
}

// 运行测试
async function runTests() {
  try {
    // 获取所有提醒
    const remindersResponse = await testGetAllReminders();
    
    // 创建提醒
    const createResponse = await testCreateReminder();
    
    if (createResponse.success) {
      const reminderId = createResponse.data.id;
      
      // 获取提醒详情
      await testGetReminderById(reminderId);
      
      // 更新提醒
      await testUpdateReminder(reminderId);
      
      // 完成提醒
      await testCompleteReminder(reminderId);
      
      // 重新打开提醒
      await testReopenReminder(reminderId);
      
      // 启用/禁用提醒
      await testToggleEnableReminder(reminderId);
      
      // 删除提醒
      await testDeleteReminder(reminderId);
    }
    
    // 获取即将到期的提醒
    await testGetUpcomingReminders();
    
    // 获取已过期的提醒
    await testGetOverdueReminders();
    
    // 获取今日提醒
    await testGetTodayReminders();
    
    // 获取提醒通知
    await testGetReminderNotifications();
    
    // 如果有笔记，测试从笔记创建提醒
    if (remindersResponse.success && remindersResponse.data.results && remindersResponse.data.results.length > 0) {
      const noteId = remindersResponse.data.results[0].note;
      if (noteId) {
        await testCreateReminderFromNote(noteId);
      }
    }
    
    console.log('所有测试完成!');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 导出测试函数
export default runTests;
