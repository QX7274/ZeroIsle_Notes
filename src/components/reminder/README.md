# 提醒组件

本目录包含与提醒功能相关的组件。

## 组件列表

### ReminderListView

提醒列表视图组件，用于显示提醒列表。

**主要功能**：
- 显示提醒列表
- 支持列表排序
- 支持列表筛选
- 支持列表分组

### ReminderCalendarView

提醒日历视图组件，用于以日历形式显示提醒。

**主要功能**：
- 以日历形式显示提醒
- 支持月视图、周视图、日视图
- 支持日期导航
- 支持日期范围选择

### ReminderCategoryView

提醒分类视图组件，用于按分类显示提醒。

**主要功能**：
- 按分类显示提醒
- 支持分类统计
- 支持分类筛选
- 支持分类管理

### CalendarIntegrationView

日历集成视图组件，用于管理与设备日历的集成。

**主要功能**：
- 显示可用的设备日历
- 支持日历同步设置
- 支持导入/导出提醒
- 支持同步状态显示

### ReminderStatisticsView

提醒统计视图组件，用于显示提醒的统计信息。

**主要功能**：
- 显示提醒完成率
- 显示提醒分类分布
- 显示提醒时间分布
- 支持时间范围选择

### ReminderForm

提醒表单组件，用于创建和编辑提醒。

**主要功能**：
- 设置提醒标题和描述
- 设置提醒时间和重复规则
- 设置提醒优先级
- 设置提醒分类和标签

### ReminderDetail

提醒详情组件，用于显示提醒的详细信息。

**主要功能**：
- 显示提醒详情
- 支持提醒编辑
- 支持提醒完成/取消
- 支持提醒分享

## 使用方法

```javascript
import { ReminderListView, ReminderCalendarView, ReminderCategoryView } from '../components/reminder';

function ReminderScreen() {
  const [viewType, setViewType] = useState('list');
  const [reminders, setReminders] = useState([]);
  
  useEffect(() => {
    // 获取提醒列表
    fetchReminders().then(setReminders);
  }, []);
  
  const renderView = () => {
    switch (viewType) {
      case 'list':
        return (
          <ReminderListView
            reminders={reminders}
            onReminderPress={handleReminderPress}
            onReminderComplete={handleReminderComplete}
          />
        );
      case 'calendar':
        return (
          <ReminderCalendarView
            reminders={reminders}
            onDatePress={handleDatePress}
            onReminderPress={handleReminderPress}
          />
        );
      case 'category':
        return (
          <ReminderCategoryView
            reminders={reminders}
            onCategoryPress={handleCategoryPress}
            onReminderPress={handleReminderPress}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <View style={styles.container}>
      <SegmentedControl
        values={['列表', '日历', '分类']}
        selectedIndex={['list', 'calendar', 'category'].indexOf(viewType)}
        onChange={(event) => {
          setViewType(['list', 'calendar', 'category'][event.nativeEvent.selectedSegmentIndex]);
        }}
      />
      
      {renderView()}
      
      <FAB
        icon="plus"
        onPress={() => navigation.navigate('AddReminder')}
      />
    </View>
  );
}
```
