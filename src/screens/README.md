# 零屿笔记屏幕目录

本目录包含零屿笔记应用中的所有屏幕/页面组件。

## 目录结构

### 通用屏幕 (`common/`)
- **HomeScreen.js**: 应用首页屏幕，显示用户的笔记概览、最近编辑的笔记、推荐内容等

### AI助手相关屏幕 (`ai/`)
- **AIAssistantScreen.js**: AI助手主屏幕，提供智能对话、文本处理、图像分析等AI功能

### 画布相关屏幕 (`canvas/`)
- **CanvasScreen.js**: 画布主屏幕，提供无限画布功能，支持添加文本、图形、图片等元素

### 代码编辑器相关屏幕 (`code/`)
- **CodeEditorScreen.js**: 代码编辑器屏幕，支持多种编程语言的语法高亮、代码补全等功能

### 搜索相关屏幕 (`search/`)
- **SearchScreen.js**: 搜索屏幕，提供全文搜索功能
- **SearchResultsScreen.js**: 搜索结果屏幕，显示搜索结果列表

### 分析相关屏幕 (`analytics/`)
- **AnalyticsScreen.js**: 分析屏幕，显示用户的使用统计、笔记分析、知识图谱分析等数据

### 分类相关屏幕 (`category/`)
- **CategoryScreen.js**: 分类屏幕，显示笔记分类列表，支持创建、编辑和删除分类

### 标签相关屏幕 (`tag/`)
- **TagScreen.js**: 标签屏幕，显示笔记标签列表，支持创建、编辑和删除标签

### 主题相关屏幕 (`theme/`)
- **ThemeCustomizationScreen.js**: 主题自定义屏幕，支持自定义应用主题颜色、字体等

### PDF相关屏幕 (`pdf/`)
- **PDFViewerScreen.js**: PDF查看器屏幕，支持查看PDF文件，提供缩放、翻页等功能

### 提醒相关屏幕 (`reminder/`)
- **AddReminderScreen.js**: 添加提醒屏幕，用于创建新的提醒
- **ReminderDetailScreen.js**: 提醒详情屏幕，显示提醒的详细信息
- **ReminderExportScreen.js**: 提醒导出屏幕，用于导出提醒数据

### 认证相关屏幕 (`auth/`)
- **LoginScreen.js**: 登录屏幕，用于用户登录
- **RegisterScreen.js**: 注册屏幕，用于用户注册
- **ForgotPasswordScreen.js**: 忘记密码屏幕，用于重置密码
- **VerificationScreen.js**: 验证屏幕，用于验证邮箱或手机号
- **WelcomeScreen.js**: 欢迎屏幕，用于应用首次启动

### 笔记相关屏幕 (`notes/`)
- **NoteScreen.js**: 笔记屏幕，用于显示笔记列表
- **NoteDetailScreen.js**: 笔记详情屏幕，用于显示笔记详情
- **NoteEditScreen.js**: 笔记编辑屏幕，用于编辑笔记
- **NoteListScreen.js**: 笔记列表屏幕，用于显示笔记列表
- **RealtimeTranscriptionScreen.js**: 实时转写屏幕，用于实时将语音转写为文本
- **ReminderScreen.js**: 提醒屏幕，用于管理提醒
- **SharedNoteScreen.js**: 共享笔记屏幕，用于查看和管理共享笔记
- **VoiceToTextScreen.js**: 语音转文本屏幕，用于将语音转换为文本

### 知识图谱相关屏幕 (`knowledge/`)
- **KnowledgeGraphScreen.js**: 知识图谱屏幕，用于显示知识图谱
- **NodeDetailScreen.js**: 节点详情屏幕，用于显示知识节点详情
- **EdgeEditScreen.js**: 边编辑屏幕，用于编辑知识边

- **KnowledgeAnalysisScreen.js**: 知识分析屏幕，用于分析知识图谱

### 思维导图相关屏幕 (`mind_map/`)
- **MindMapScreen.js**: 思维导图屏幕，用于显示思维导图
- **MindMapEditScreen.js**: 思维导图编辑屏幕，用于编辑思维导图
- **MindMapTemplateScreen.js**: 思维导图模板屏幕，用于选择思维导图模板

### 社区相关屏幕 (`community/`)
- **CommunityScreen.js**: 社区屏幕，用于显示社区内容
- **PostDetailScreen.js**: 帖子详情屏幕，用于显示帖子详情
- **CreatePostScreen.js**: 创建帖子屏幕，用于创建帖子

### 群组相关屏幕 (`groups/`)
- **GroupScreen.js**: 群组屏幕，用于显示群组信息
- **CreateGroupScreen.js**: 创建群组屏幕，用于创建新群组
- **GroupDetailScreen.js**: 群组详情屏幕，用于显示群组详情
- **GroupsScreen.js**: 群组列表屏幕，用于显示群组列表
- **JoinGroupScreen.js**: 加入群组屏幕，用于加入群组
- **ScreenShareScreen.js**: 屏幕共享屏幕，用于共享屏幕

### 语音相关屏幕 (`voice/`)
- **VoiceReminderScreen.js**: 语音提醒屏幕，用于创建语音提醒
- **VoiceSearchScreen.js**: 语音搜索屏幕，用于通过语音进行搜索

### 设置相关屏幕 (`settings/`)
- **SettingsScreen.js**: 设置屏幕，用于显示设置选项
- **AboutScreen.js**: 关于屏幕，用于显示应用信息
- **AIAssistantSettingsScreen.js**: AI助手设置屏幕，用于设置AI助手
- **BackupRestoreScreen.js**: 备份恢复屏幕，用于备份和恢复数据
- **BindEmail.js**: 绑定邮箱屏幕，用于绑定邮箱
- **BindPhone.js**: 绑定手机屏幕，用于绑定手机
- **HelpScreen.js**: 帮助屏幕，用于显示帮助信息
- **NotificationSettingsScreen.js**: 通知设置屏幕，用于设置通知选项
- **OfflineDataScreen.js**: 离线数据屏幕，用于管理离线数据
- **ProfileSettings.js**: 个人资料设置屏幕，用于设置个人资料
- **ThemeSettingsScreen.js**: 主题设置屏幕，用于设置应用主题

## 使用方法

### 导航到屏幕

```javascript
// 导入导航函数
import { useNavigation } from '@react-navigation/native';

// 在组件内部
const navigation = useNavigation();

// 导航到屏幕
navigation.navigate('NoteDetail', { noteId: '123' });
navigation.navigate('NoteEdit', { noteId: '123' });
navigation.navigate('Settings');
```

### 屏幕参数

```javascript
// 导入导航和路由
import { useNavigation, useRoute } from '@react-navigation/native';

// 在组件内部
const route = useRoute();
const { noteId } = route.params;

// 使用参数
console.log('笔记ID:', noteId);
```

### 屏幕生命周期

```javascript
// 导入React和导航
import React, { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

// 在组件内部
useEffect(() => {
  // 组件挂载时执行
  console.log('屏幕已挂载');

  return () => {
    // 组件卸载时执行
    console.log('屏幕已卸载');
  };
}, []);

// 屏幕获得焦点时执行
useFocusEffect(
  React.useCallback(() => {
    console.log('屏幕已获得焦点');

    return () => {
      console.log('屏幕已失去焦点');
    };
  }, [])
);
```

## 屏幕开发规范

1. 每个屏幕应该有自己的目录或文件
2. 屏幕应该有清晰的命名和注释
3. 屏幕应该专注于布局和数据流，具体UI细节应该委托给可重用组件
4. 屏幕应该连接到Redux或Context API进行状态管理
5. 屏幕应该处理导航和路由参数
6. 屏幕应该处理生命周期事件
7. 屏幕应该处理错误和加载状态
8. 屏幕应该处理权限和认证
9. 屏幕应该处理网络状态
10. 屏幕应该处理设备方向和屏幕尺寸