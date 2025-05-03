# 零屿笔记屏幕目录

本目录包含零屿笔记应用中的所有屏幕/页面组件。

## 目录结构

### 认证相关屏幕 (`auth/`)

- **LoginScreen.js**: 登录屏幕，用于用户登录
- **RegisterScreen.js**: 注册屏幕，用于用户注册
- **ForgotPasswordScreen.js**: 忘记密码屏幕，用于重置密码
- **VerificationScreen.js**: 验证屏幕，用于验证邮箱或手机号
- **WelcomeScreen.js**: 欢迎屏幕，用于应用首次启动

### 笔记相关屏幕 (`notes/`)

- **NotesHomeScreen.js**: 笔记首页屏幕，用于显示笔记列表
- **NoteDetailScreen.js**: 笔记详情屏幕，用于显示笔记详情
- **NoteEditScreen.js**: 笔记编辑屏幕，用于编辑笔记
- **NoteCreateScreen.js**: 笔记创建屏幕，用于创建新笔记
- **NoteHistoryScreen.js**: 笔记历史屏幕，用于显示笔记历史版本
- **NoteShareScreen.js**: 笔记分享屏幕，用于分享笔记
- **NoteCategoriesScreen.js**: 笔记分类屏幕，用于管理笔记分类
- **NoteTagsScreen.js**: 笔记标签屏幕，用于管理笔记标签
- **NoteSearchScreen.js**: 笔记搜索屏幕，用于搜索笔记
- **NoteExportScreen.js**: 笔记导出屏幕，用于导出笔记
- **NoteImportScreen.js**: 笔记导入屏幕，用于导入笔记

### 知识图谱相关屏幕 (`knowledge/`)

- **KnowledgeGraphScreen.js**: 知识图谱屏幕，用于显示知识图谱
- **KnowledgeNodeScreen.js**: 知识节点屏幕，用于显示知识节点详情
- **KnowledgeEdgeScreen.js**: 知识边屏幕，用于显示知识边详情
- **KnowledgeCreateScreen.js**: 知识创建屏幕，用于创建知识节点或边
- **KnowledgeEditScreen.js**: 知识编辑屏幕，用于编辑知识节点或边
- **KnowledgeSearchScreen.js**: 知识搜索屏幕，用于搜索知识图谱
- **KnowledgeAnalysisScreen.js**: 知识分析屏幕，用于分析知识图谱
- **KnowledgeVisualizationScreen.js**: 知识可视化屏幕，用于可视化知识图谱

### 思维导图相关屏幕 (`mind_map/`)

- **MindMapScreen.js**: 思维导图屏幕，用于显示思维导图
- **MindMapCreateScreen.js**: 思维导图创建屏幕，用于创建思维导图
- **MindMapEditScreen.js**: 思维导图编辑屏幕，用于编辑思维导图
- **MindMapDetailScreen.js**: 思维导图详情屏幕，用于显示思维导图详情
- **MindMapExportScreen.js**: 思维导图导出屏幕，用于导出思维导图

### 社区相关屏幕 (`community/`)

- **CommunityHomeScreen.js**: 社区首页屏幕，用于显示社区内容
- **PostDetailScreen.js**: 帖子详情屏幕，用于显示帖子详情
- **PostCreateScreen.js**: 帖子创建屏幕，用于创建帖子
- **PostEditScreen.js**: 帖子编辑屏幕，用于编辑帖子
- **UserProfileScreen.js**: 用户资料屏幕，用于显示用户资料
- **FollowersScreen.js**: 关注者屏幕，用于显示关注者列表
- **FollowingScreen.js**: 正在关注屏幕，用于显示正在关注列表
- **NotificationsScreen.js**: 通知屏幕，用于显示通知列表

### 群组相关屏幕 (`groups/`)

- **GroupsHomeScreen.js**: 群组首页屏幕，用于显示群组列表
- **GroupDetailScreen.js**: 群组详情屏幕，用于显示群组详情
- **GroupCreateScreen.js**: 群组创建屏幕，用于创建群组
- **GroupEditScreen.js**: 群组编辑屏幕，用于编辑群组
- **GroupMembersScreen.js**: 群组成员屏幕，用于显示群组成员列表
- **GroupInviteScreen.js**: 群组邀请屏幕，用于邀请用户加入群组
- **GroupJoinScreen.js**: 群组加入屏幕，用于加入群组
- **SharedScreensScreen.js**: 共享屏幕屏幕，用于显示共享屏幕列表

### 语音相关屏幕 (`voice/`)

- **VoiceHomeScreen.js**: 语音首页屏幕，用于显示语音功能
- **VoiceRecordScreen.js**: 语音录制屏幕，用于录制语音
- **VoiceTranscriptionScreen.js**: 语音转写屏幕，用于将语音转写为文本
- **VoiceCommandScreen.js**: 语音命令屏幕，用于识别语音命令
- **VoiceHistoryScreen.js**: 语音历史屏幕，用于显示语音历史记录

### 设置相关屏幕 (`settings/`)

- **SettingsHomeScreen.js**: 设置首页屏幕，用于显示设置选项
- **ProfileSettingsScreen.js**: 个人资料设置屏幕，用于设置个人资料
- **AccountSettingsScreen.js**: 账户设置屏幕，用于设置账户信息
- **AppearanceSettingsScreen.js**: 外观设置屏幕，用于设置应用外观
- **NotificationSettingsScreen.js**: 通知设置屏幕，用于设置通知选项
- **PrivacySettingsScreen.js**: 隐私设置屏幕，用于设置隐私选项
- **SecuritySettingsScreen.js**: 安全设置屏幕，用于设置安全选项
- **SyncSettingsScreen.js**: 同步设置屏幕，用于设置同步选项
- **AISettingsScreen.js**: AI设置屏幕，用于设置AI选项
- **LanguageSettingsScreen.js**: 语言设置屏幕，用于设置应用语言
- **AboutScreen.js**: 关于屏幕，用于显示应用信息

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