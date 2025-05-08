# 日历服务

本目录包含零屿笔记应用的日历集成服务，用于管理日历事件、提醒和与设备日历的同步功能。

## 文件结构

- **calendarIntegrationService.js**: 日历集成服务，提供与设备日历交互的功能

## 主要功能

### 日历集成服务 (calendarIntegrationService.js)

日历集成服务提供以下主要功能：

- **获取日历列表**: 获取设备上可用的日历列表
- **创建日历事件**: 在设备日历中创建新事件
- **更新日历事件**: 更新设备日历中的现有事件
- **删除日历事件**: 从设备日历中删除事件
- **获取日历事件**: 获取特定时间范围内的日历事件
- **设置事件提醒**: 为日历事件设置提醒
- **日历权限管理**: 请求和检查日历访问权限

## 日历事件数据结构

日历事件的基本数据结构如下：

```javascript
{
  id: String,               // 事件ID
  title: String,            // 事件标题
  description: String,      // 事件描述
  location: String,         // 事件地点
  startDate: Date,          // 开始时间
  endDate: Date,            // 结束时间
  allDay: Boolean,          // 是否全天事件
  recurrence: {             // 重复设置（可选）
    frequency: String,      // 重复频率（daily, weekly, monthly, yearly）
    interval: Number,       // 重复间隔
    endDate: Date,          // 重复结束日期
    occurrences: Number     // 重复次数
  },
  alarms: [{                // 提醒设置（可选）
    date: Date,             // 提醒时间
    relativeOffset: Number  // 相对事件开始时间的偏移（分钟）
  }],
  notes: String,            // 事件备注
  url: String,              // 相关URL
  calendarId: String        // 日历ID
}
```

## 与设备日历的集成

日历服务使用React Native的日历API（如`react-native-calendars`或`@react-native-community/datetimepicker`）与设备日历进行集成，支持以下功能：

- 在iOS和Android设备上创建和管理日历事件
- 支持不同类型的日历（如iCloud、Google、Exchange等）
- 处理不同平台的权限请求和日历访问

## 与应用内功能的集成

日历服务与应用内的以下功能集成：

- **提醒功能**: 将应用内提醒同步到设备日历
- **笔记截止日期**: 将笔记的截止日期作为日历事件
- **会议记录**: 将会议安排同步到日历
- **任务管理**: 将任务和待办事项同步到日历

## 与其他服务的交互

日历服务与以下服务有交互：

- **提醒服务**: 协调应用内提醒和日历提醒
- **权限服务**: 管理日历访问权限
- **同步服务**: 确保日历事件在多设备间同步

## 使用方法

```javascript
import { calendarIntegrationService } from '../../services/calendar';

// 获取可用日历列表
async function getCalendars() {
  try {
    const calendars = await calendarIntegrationService.getCalendars();
    console.log('可用日历:', calendars);
    return calendars;
  } catch (error) {
    console.error('获取日历失败:', error);
    return [];
  }
}

// 创建日历事件
async function createEvent(eventDetails) {
  try {
    const eventId = await calendarIntegrationService.createEvent({
      title: '项目会议',
      description: '讨论项目进度和下一步计划',
      location: '会议室A',
      startDate: new Date('2023-06-15T10:00:00'),
      endDate: new Date('2023-06-15T11:30:00'),
      alarms: [{ relativeOffset: -30 }], // 提前30分钟提醒
      notes: '带上项目文档',
      calendarId: 'primary'
    });
    
    console.log('事件创建成功:', eventId);
    return eventId;
  } catch (error) {
    console.error('创建事件失败:', error);
    return null;
  }
}

// 获取特定时间范围内的事件
async function getEvents(startDate, endDate) {
  try {
    const events = await calendarIntegrationService.getEvents(
      new Date('2023-06-01'),
      new Date('2023-06-30')
    );
    
    console.log('本月事件:', events);
    return events;
  } catch (error) {
    console.error('获取事件失败:', error);
    return [];
  }
}

// 更新事件
async function updateEvent(eventId, updates) {
  try {
    await calendarIntegrationService.updateEvent(eventId, {
      title: '更新后的会议标题',
      location: '会议室B'
    });
    
    console.log('事件更新成功');
    return true;
  } catch (error) {
    console.error('更新事件失败:', error);
    return false;
  }
}

// 删除事件
async function deleteEvent(eventId) {
  try {
    await calendarIntegrationService.deleteEvent(eventId);
    console.log('事件删除成功');
    return true;
  } catch (error) {
    console.error('删除事件失败:', error);
    return false;
  }
}
```

## 注意事项

- 使用日历功能前需要获取用户授权
- 不同平台（iOS/Android）的日历API可能有差异
- 应考虑时区问题，确保事件时间正确
- 提供同步失败的错误处理和重试机制
- 尊重用户隐私，只访问必要的日历数据
