# Personal Activity Tracking Module - Technical Design Document

## 1. 系统架构设计

### 1.1 整体架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   Backend API   │    │   Database      │
│                 │    │                 │    │                 │
│ - React Native  │◄──►│ - Django REST   │◄──►│ - MongoDB       │
│ - Redux Store   │    │ - WebSocket     │    │ - Realm (Local) │
│ - Local Cache   │    │ - Celery Tasks  │    │ - Redis Cache   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 模块划分
- **数据层**: MongoDB + Realm本地存储
- **服务层**: Django REST API + WebSocket实时通信
- **业务层**: 活动记录、状态跟踪、分析引擎、可视化
- **表现层**: React Native组件 + Redux状态管理
- **缓存层**: Redis缓存 + 本地存储优化

### 1.3 技术栈选择
- **前端**: React Native + Redux Toolkit + React Navigation
- **后端**: Django + Django REST Framework + Channels
- **数据库**: MongoDB (主存储) + Realm (本地同步)
- **缓存**: Redis + AsyncStorage
- **实时通信**: WebSocket + Server-Sent Events
- **任务队列**: Celery + Redis
- **数据分析**: Pandas + NumPy + Chart.js

## 2. 数据库设计

### 2.1 MongoDB集合设计

#### 2.1.1 活动记录集合 (activities)
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  title: String,                    // 活动标题
  description: String,              // 详细描述
  category: {
    id: String,                     // 分类ID
    name: String,                   // 分类名称
    color: String,                  // 分类颜色
    icon: String                    // 分类图标
  },
  status: String,                   // completed, in_progress, paused, cancelled, planned
  priority: Number,                 // 1-5 重要程度
  progress: Number,                 // 0-100 完成百分比
  
  // 时间相关
  start_time: Date,
  end_time: Date,
  estimated_duration: Number,       // 预估时长(分钟)
  actual_duration: Number,          // 实际时长(分钟)
  deadline: Date,                   // 截止时间
  
  // 位置和环境
  location: {
    latitude: Number,
    longitude: Number,
    address: String,
    place_name: String
  },
  
  // 情绪和评价
  mood: String,                     // happy, neutral, sad, excited, stressed
  energy_level: Number,             // 1-5 能量水平
  satisfaction: Number,             // 1-5 满意度
  difficulty: Number,               // 1-5 难度评级
  
  // 关联数据
  tags: [String],                   // 标签数组
  attachments: [{
    type: String,                   // image, audio, document
    url: String,
    filename: String,
    size: Number
  }],
  
  // 子任务
  subtasks: [{
    id: String,
    title: String,
    completed: Boolean,
    created_at: Date,
    completed_at: Date
  }],
  
  // 依赖关系
  dependencies: [ObjectId],         // 依赖的其他活动ID
  
  // 重复设置
  recurrence: {
    type: String,                   // daily, weekly, monthly, yearly, custom
    interval: Number,               // 间隔数
    days_of_week: [Number],         // 周几重复 (0-6)
    end_date: Date                  // 重复结束日期
  },
  
  // 提醒设置
  reminders: [{
    type: String,                   // notification, email, sms
    time: Date,
    message: String,
    sent: Boolean
  }],
  
  // 元数据
  created_at: Date,
  updated_at: Date,
  deleted_at: Date,                 // 软删除
  sync_status: String,              // synced, pending, conflict
  version: Number                   // 版本号用于冲突解决
}
```

#### 2.1.2 分类管理集合 (categories)
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  name: String,
  description: String,
  color: String,                    // 十六进制颜色
  icon: String,                     // 图标名称
  parent_id: ObjectId,              // 父分类ID，支持层级
  order: Number,                    // 排序权重
  is_system: Boolean,               // 是否系统预设分类
  is_active: Boolean,               // 是否启用
  
  // 统计信息
  activity_count: Number,           // 活动数量
  total_time: Number,               // 总时长
  
  created_at: Date,
  updated_at: Date
}
```

#### 2.1.3 目标管理集合 (goals)
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  title: String,
  description: String,
  type: String,                     // habit, milestone, quantitative, qualitative
  
  // 目标设置
  target_value: Number,             // 目标数值
  current_value: Number,            // 当前数值
  unit: String,                     // 单位 (hours, times, pages, etc.)
  
  // 时间范围
  start_date: Date,
  end_date: Date,
  
  // 关联活动
  related_categories: [ObjectId],   // 关联的分类
  related_activities: [ObjectId],   // 关联的活动
  
  // 进度跟踪
  milestones: [{
    title: String,
    target_value: Number,
    achieved_at: Date,
    notes: String
  }],
  
  // 状态
  status: String,                   // active, completed, paused, cancelled
  completion_rate: Number,          // 完成率 0-100
  
  created_at: Date,
  updated_at: Date
}
```

#### 2.1.4 分析报告集合 (analytics_reports)
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  report_type: String,              // daily, weekly, monthly, yearly, custom
  period_start: Date,
  period_end: Date,
  
  // 统计数据
  statistics: {
    total_activities: Number,
    completed_activities: Number,
    total_time: Number,
    average_satisfaction: Number,
    most_productive_hour: Number,
    category_breakdown: [{
      category_id: ObjectId,
      category_name: String,
      activity_count: Number,
      total_time: Number,
      completion_rate: Number
    }],
    
    // 效率指标
    efficiency_metrics: {
      focus_score: Number,          // 专注度评分
      productivity_index: Number,   // 生产力指数
      time_utilization: Number,     // 时间利用率
      goal_achievement_rate: Number // 目标达成率
    },
    
    // 趋势分析
    trends: {
      activity_trend: String,       // increasing, decreasing, stable
      satisfaction_trend: String,
      productivity_trend: String
    }
  },
  
  // 洞察和建议
  insights: [{
    type: String,                   // pattern, recommendation, warning
    title: String,
    description: String,
    confidence: Number,             // 置信度 0-1
    action_items: [String]
  }],
  
  generated_at: Date,
  expires_at: Date                  // 报告过期时间
}
```

### 2.2 Realm本地数据模型

#### 2.2.1 Activity Schema
```javascript
const ActivitySchema = {
  name: 'Activity',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    user_id: 'string',
    title: 'string',
    description: 'string?',
    category: 'Category?',
    status: 'string',
    priority: 'int',
    progress: 'int',
    start_time: 'date?',
    end_time: 'date?',
    estimated_duration: 'int?',
    actual_duration: 'int?',
    deadline: 'date?',
    mood: 'string?',
    energy_level: 'int?',
    satisfaction: 'int?',
    difficulty: 'int?',
    tags: 'string[]',
    subtasks: 'Subtask[]',
    created_at: 'date',
    updated_at: 'date',
    deleted_at: 'date?',
    sync_status: 'string',
    version: 'int'
  }
};
```

#### 2.2.2 Category Schema
```javascript
const CategorySchema = {
  name: 'Category',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    user_id: 'string',
    name: 'string',
    description: 'string?',
    color: 'string',
    icon: 'string',
    parent_id: 'string?',
    order: 'int',
    is_system: 'bool',
    is_active: 'bool',
    created_at: 'date',
    updated_at: 'date'
  }
};
```

## 3. API设计

### 3.1 RESTful API端点

#### 3.1.1 活动管理API
```
GET    /api/v1/activities/              # 获取活动列表
POST   /api/v1/activities/              # 创建新活动
GET    /api/v1/activities/{id}/         # 获取活动详情
PUT    /api/v1/activities/{id}/         # 更新活动
DELETE /api/v1/activities/{id}/         # 删除活动
PATCH  /api/v1/activities/{id}/status/  # 更新活动状态
PATCH  /api/v1/activities/{id}/progress/ # 更新活动进度

# 批量操作
POST   /api/v1/activities/batch/        # 批量创建
PUT    /api/v1/activities/batch/        # 批量更新
DELETE /api/v1/activities/batch/        # 批量删除

# 搜索和过滤
GET    /api/v1/activities/search/       # 搜索活动
GET    /api/v1/activities/filter/       # 过滤活动
```

#### 3.1.2 分类管理API
```
GET    /api/v1/categories/              # 获取分类列表
POST   /api/v1/categories/              # 创建分类
GET    /api/v1/categories/{id}/         # 获取分类详情
PUT    /api/v1/categories/{id}/         # 更新分类
DELETE /api/v1/categories/{id}/         # 删除分类
GET    /api/v1/categories/tree/         # 获取分类树结构
```

#### 3.1.3 分析报告API
```
GET    /api/v1/analytics/dashboard/     # 获取仪表板数据
GET    /api/v1/analytics/reports/       # 获取报告列表
POST   /api/v1/analytics/reports/       # 生成新报告
GET    /api/v1/analytics/reports/{id}/  # 获取报告详情
GET    /api/v1/analytics/insights/      # 获取智能洞察
GET    /api/v1/analytics/trends/        # 获取趋势分析
```

### 3.2 WebSocket事件

#### 3.2.1 实时同步事件
```javascript
// 客户端发送
{
  type: 'activity.create',
  data: { /* activity data */ }
}

{
  type: 'activity.update',
  data: { id: 'xxx', changes: { /* updated fields */ } }
}

// 服务端推送
{
  type: 'activity.created',
  data: { /* complete activity data */ }
}

{
  type: 'activity.updated',
  data: { /* updated activity data */ }
}

{
  type: 'sync.conflict',
  data: { 
    local_version: { /* local data */ },
    server_version: { /* server data */ }
  }
}
```

## 4. 前端组件设计

### 4.1 组件层次结构
```
PersonalActivityScreen/
├── ActivityDashboard/
│   ├── TodayOverview/
│   ├── QuickStats/
│   └── RecentActivities/
├── ActivityList/
│   ├── ActivityItem/
│   ├── FilterBar/
│   └── SearchInput/
├── ActivityForm/
│   ├── BasicInfo/
│   ├── TimeSettings/
│   ├── CategorySelector/
│   └── AdvancedOptions/
├── AnalyticsView/
│   ├── ChartsContainer/
│   ├── InsightsPanel/
│   └── ReportsHistory/
└── SettingsPanel/
    ├── CategoryManager/
    ├── GoalSettings/
    └── NotificationSettings/
```

### 4.2 状态管理设计
```javascript
// Redux Store Structure
{
  personalActivity: {
    activities: {
      items: [],
      loading: false,
      error: null,
      filters: {},
      pagination: {}
    },
    categories: {
      items: [],
      tree: null,
      loading: false
    },
    analytics: {
      dashboard: null,
      reports: [],
      insights: [],
      loading: false
    },
    settings: {
      preferences: {},
      notifications: {}
    },
    sync: {
      status: 'idle',
      lastSync: null,
      conflicts: []
    }
  }
}
```

## 5. 数据同步策略

### 5.1 同步机制
- **增量同步**: 只同步变更的数据
- **冲突解决**: 基于时间戳和版本号的冲突解决
- **离线支持**: 本地优先，后台同步
- **批量同步**: 网络恢复时的批量数据同步

### 5.2 缓存策略
- **L1缓存**: Redux Store内存缓存
- **L2缓存**: AsyncStorage持久化缓存
- **L3缓存**: Realm本地数据库
- **智能预加载**: 基于使用模式的数据预加载

## 6. 性能优化

### 6.1 前端优化
- **虚拟列表**: 大数据量列表的虚拟化渲染
- **图片懒加载**: 附件图片的按需加载
- **组件缓存**: React.memo和useMemo优化
- **代码分割**: 按需加载分析组件

### 6.2 后端优化
- **数据库索引**: 关键字段的复合索引
- **查询优化**: 聚合管道优化
- **缓存策略**: Redis缓存热点数据
- **异步处理**: 报告生成的异步任务
