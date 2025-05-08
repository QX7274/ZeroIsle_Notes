# 提醒服务

本目录包含零屿笔记应用的提醒相关服务，用于管理提醒通知和日程提醒功能。

## 文件结构

- **reminderNotificationService.js**: 提醒通知服务，提供提醒通知功能

## 主要功能

### 提醒通知服务 (reminderNotificationService.js)

提醒通知服务提供以下主要功能：

- **创建提醒**: 创建新的提醒和日程
- **更新提醒**: 更新现有提醒的内容和时间
- **删除提醒**: 删除不再需要的提醒
- **查询提醒**: 查询和筛选提醒列表
- **提醒通知**: 在提醒时间到达时发送通知
- **重复提醒**: 支持定期重复的提醒
- **提醒分类**: 对提醒进行分类管理
- **提醒优先级**: 设置提醒的优先级
- **提醒完成状态**: 标记提醒为已完成或未完成

## 提醒数据结构

提醒的基本数据结构如下：

```javascript
{
  id: String,                 // 提醒ID
  title: String,              // 提醒标题
  description: String,        // 提醒描述
  date: Date,                 // 提醒日期时间
  isCompleted: Boolean,       // 是否已完成
  priority: String,           // 优先级（高/中/低）
  category: String,           // 分类
  repeat: {                   // 重复设置（可选）
    type: String,             // 重复类型（每天/每周/每月/每年）
    interval: Number,         // 重复间隔
    endDate: Date,            // 结束日期（可选）
    count: Number,            // 重复次数（可选）
    weekdays: Array,          // 每周重复的星期几（可选）
    monthDay: Number,         // 每月重复的日期（可选）
  },
  notification: {             // 通知设置
    enabled: Boolean,         // 是否启用通知
    time: Number,             // 提前通知时间（分钟）
    sound: Boolean,           // 是否播放声音
    vibration: Boolean,       // 是否振动
  },
  relatedNote: String,        // 关联的笔记ID（可选）
  location: {                 // 位置信息（可选）
    latitude: Number,         // 纬度
    longitude: Number,        // 经度
    radius: Number,           // 半径（米）
    address: String,          // 地址描述
  },
  createdAt: Date,            // 创建时间
  updatedAt: Date             // 更新时间
}
```

## 提醒优先级

提醒服务定义了以下优先级：

- **高优先级**: 重要且紧急的提醒
- **中优先级**: 重要但不紧急的提醒
- **低优先级**: 一般重要性的提醒

## 重复类型

提醒服务支持以下重复类型：

- **每天**: 每天重复
- **每周**: 每周特定日期重复
- **每月**: 每月特定日期重复
- **每年**: 每年特定日期重复
- **自定义**: 自定义重复间隔

## 与其他服务的交互

提醒服务与以下服务有交互：

- **通知服务**: 发送提醒通知
- **日历服务**: 与设备日历集成
- **存储服务**: 存储提醒数据
- **位置服务**: 支持基于位置的提醒

## 使用方法

```javascript
import { reminderNotificationService } from '../../services/reminder';

// 创建提醒
async function createReminder(reminderData) {
  try {
    const reminder = await reminderNotificationService.createReminder({
      title: reminderData.title,
      description: reminderData.description || '',
      date: reminderData.date,
      priority: reminderData.priority || 'medium',
      category: reminderData.category || 'general',
      repeat: reminderData.repeat,
      notification: reminderData.notification || { enabled: true, time: 15 }
    });
    
    console.log('提醒创建成功:', reminder);
    return reminder;
  } catch (error) {
    console.error('创建提醒失败:', error);
    return null;
  }
}

// 获取提醒列表
async function getReminders(filters = {}) {
  try {
    const reminders = await reminderNotificationService.getReminders(filters);
    console.log('获取提醒列表成功:', reminders.length, '个提醒');
    return reminders;
  } catch (error) {
    console.error('获取提醒列表失败:', error);
    return [];
  }
}

// 获取提醒详情
async function getReminderDetails(reminderId) {
  try {
    const reminder = await reminderNotificationService.getReminder(reminderId);
    console.log('获取提醒详情成功:', reminder);
    return reminder;
  } catch (error) {
    console.error('获取提醒详情失败:', error);
    return null;
  }
}

// 更新提醒
async function updateReminder(reminderId, updates) {
  try {
    const updated = await reminderNotificationService.updateReminder(reminderId, updates);
    console.log('更新提醒成功:', updated);
    return updated;
  } catch (error) {
    console.error('更新提醒失败:', error);
    return null;
  }
}

// 删除提醒
async function deleteReminder(reminderId) {
  try {
    await reminderNotificationService.deleteReminder(reminderId);
    console.log('删除提醒成功');
    return true;
  } catch (error) {
    console.error('删除提醒失败:', error);
    return false;
  }
}

// 标记提醒为已完成
async function completeReminder(reminderId) {
  try {
    await reminderNotificationService.completeReminder(reminderId);
    console.log('标记提醒为已完成');
    return true;
  } catch (error) {
    console.error('标记提醒失败:', error);
    return false;
  }
}

// 创建重复提醒
async function createRepeatingReminder(title, date, repeatType, repeatInterval = 1) {
  try {
    const reminder = await reminderNotificationService.createReminder({
      title,
      date,
      repeat: {
        type: repeatType,
        interval: repeatInterval
      },
      notification: { enabled: true, time: 15 }
    });
    
    console.log('创建重复提醒成功:', reminder);
    return reminder;
  } catch (error) {
    console.error('创建重复提醒失败:', error);
    return null;
  }
}

// 获取今天的提醒
async function getTodayReminders() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const reminders = await reminderNotificationService.getReminders({
      startDate: today,
      endDate: tomorrow,
      completed: false
    });
    
    console.log('获取今天的提醒成功:', reminders.length, '个提醒');
    return reminders;
  } catch (error) {
    console.error('获取今天的提醒失败:', error);
    return [];
  }
}

// 获取即将到期的提醒
async function getUpcomingReminders(days = 7) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    
    const reminders = await reminderNotificationService.getReminders({
      startDate: today,
      endDate: endDate,
      completed: false
    });
    
    console.log('获取即将到期的提醒成功:', reminders.length, '个提醒');
    return reminders;
  } catch (error) {
    console.error('获取即将到期的提醒失败:', error);
    return [];
  }
}
```

## 注意事项

- 提醒通知需要用户授予通知权限，应处理权限被拒绝的情况
- 重复提醒应考虑时区变化和夏令时调整
- 提醒数据应定期同步，确保多设备间的一致性
- 处理提醒的通知点击事件，导航到相应的屏幕
- 考虑提醒的电池消耗，优化提醒调度
- 提供提醒的导入导出功能，方便用户迁移数据
