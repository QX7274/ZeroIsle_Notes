# 零屿笔记组件目录

本目录包含零屿笔记应用中使用的所有可重用组件。每个子目录都有自己的README.md文件，详细说明该目录下的组件用途和使用方法。

## 目录结构

### 通用组件 (`common/`)

- **Button.js**: 按钮组件，支持多种样式和状态
- **Input.js**: 输入框组件，支持多种输入类型
- **Card.js**: 卡片容器组件，用于展示内容块
- **Loading.js**: 加载指示器组件，支持全屏和局部加载状态
- **Toast.js**: 提示组件，用于显示短暂的提示信息
- **Modal.js**: 模态框组件，用于显示弹出内容
- **RichTextEditor.js**: 富文本编辑器组件，支持格式化文本
- **EnhancedRichTextEditor.js**: 增强版富文本编辑器，支持更多功能
- **MarkdownPreview.js**: Markdown预览组件，用于显示Markdown内容
- **TagSelector.js**: 标签选择器组件，用于选择标签
- **CategorySelector.js**: 分类选择器组件，用于选择分类
- **NoteShareDialog.js**: 笔记分享对话框组件，用于分享笔记
- **OfflineIndicator.js**: 离线指示器组件，用于显示离线状态
- **GradientButton.js**: 渐变按钮组件，支持渐变背景
- **GlassCard.js**: 玻璃拟态卡片组件，提供带有毛玻璃效果的卡片
- **ThemeColorPicker.js**: 主题颜色选择器组件，用于选择主题颜色
- **AnimatedList.js**: 动画列表组件，支持列表项动画
- **OptimizedImage.js**: 优化图像组件，提供图像加载优化、缓存和渐进式加载
- **VirtualizedList.js**: 虚拟化列表组件，支持大量数据的高效渲染
- **AccessibleButton.js**: 可访问性按钮组件，支持屏幕阅读器

### AI相关组件 (`ai/`)

- **ChatInput.js**: 聊天输入组件，用于AI助手对话
- **ChatMessage.js**: 聊天消息组件，用于显示AI助手对话消息
- **AIToolbar.js**: AI工具栏组件，提供AI相关功能
- **AIModelSelector.js**: AI模型选择器组件，用于选择AI模型
- **AIPromptTemplates.js**: AI提示模板组件，提供常用提示模板

### 手写相关组件 (`handwriting/`)

- **HandwritingAdapter.js**: 手写适配器组件，将AllInOneToolbar工具映射到手写引擎
- **UniversalHandwritingEngine.js**: 通用手写引擎，提供高性能手写功能

### 知识图谱相关组件 (`knowledge/`)

- **KnowledgeGraph.js**: 知识图谱组件，用于显示知识图谱
- **GraphNode.js**: 图节点组件，用于显示知识图谱节点
- **GraphEdge.js**: 图边组件，用于显示知识图谱边
- **GraphControls.js**: 图控制组件，用于控制知识图谱
- **AutoClassification.js**: 自动分类组件，提供自动分类功能

### 画布相关组件 (`canvas/`)

- **InfiniteCanvas.js**: 无限画布组件，提供基于SVG的高性能无限画布功能
- **InfiniteDrawingCanvas.js**: 无限绘图画布组件，提供绘图功能
- **InfiniteCanvasAdapter.js**: 无限画布适配器组件，提供元素管理功能
- **CanvasToolbar.js**: 画布工具栏组件，提供各种绘图工具和操作按钮
- **DrawingToolbar.js**: 绘图工具栏组件，提供绘图相关工具
- **LayerManager.js**: 图层管理器组件，用于管理画布上的图层
- **StyleEditor.js**: 样式编辑器组件，用于编辑元素的样式
- **CanvasElement.js**: 画布元素组件，用于在画布上渲染各种元素

### 笔记相关组件 (`notes/`)

- **NoteList.js**: 笔记列表组件，用于显示笔记列表
- **NoteEditor.js**: 笔记编辑器组件，用于编辑笔记
- **NoteDetail.js**: 笔记详情组件，用于显示笔记详情
- **NotePreview.js**: 笔记预览组件，用于预览笔记
- **NoteToolbar.js**: 笔记工具栏组件，提供笔记相关工具
- **OfflineAIToolbar.js**: 离线AI工具栏组件，提供离线AI功能

### 思维导图相关组件 (`mind_map/`)

- **MindMap.js**: 思维导图组件，用于显示思维导图
- **MindMapNode.js**: 思维导图节点组件，用于显示思维导图节点
- **MindMapEdge.js**: 思维导图边组件，用于显示思维导图边
- **MindMapControls.js**: 思维导图控制组件，用于控制思维导图

### 社区相关组件 (`community/`)

- **PostList.js**: 帖子列表组件，用于显示社区帖子列表
- **PostItem.js**: 帖子项组件，用于显示社区帖子项
- **CommentList.js**: 评论列表组件，用于显示评论列表
- **CommentItem.js**: 评论项组件，用于显示评论项
- **UserProfile.js**: 用户资料组件，用于显示用户资料

### 群组相关组件 (`groups/`)

- **GroupList.js**: 群组列表组件，用于显示群组列表
- **GroupDetail.js**: 群组详情组件，用于显示群组详情
- **GroupMemberList.js**: 群组成员列表组件，用于显示群组成员列表
- **GroupInvitation.js**: 群组邀请组件，用于邀请用户加入群组
- **SharedScreen.js**: 共享屏幕组件，用于共享屏幕内容

### 语音相关组件 (`voice/`)

- **VoiceRecorder.js**: 语音录制组件，用于录制语音
- **VoicePlayer.js**: 语音播放组件，用于播放语音
- **VoiceTranscription.js**: 语音转写组件，用于将语音转写为文本
- **VoiceCommand.js**: 语音命令组件，用于识别语音命令

### 搜索相关组件 (`search/`)

- **SearchBar.js**: 搜索栏组件，用于输入搜索关键词
- **SearchResults.js**: 搜索结果组件，用于显示搜索结果
- **SearchFilters.js**: 搜索过滤器组件，用于过滤搜索结果
- **SearchHistory.js**: 搜索历史组件，用于显示搜索历史

### 提醒相关组件 (`reminder/`)

- **ReminderList.js**: 提醒列表组件，用于显示提醒列表
- **ReminderForm.js**: 提醒表单组件，用于创建和编辑提醒
- **ReminderItem.js**: 提醒项组件，用于显示提醒项
- **ReminderNotification.js**: 提醒通知组件，用于显示提醒通知

### 布局组件 (`Layout/`)

- **Container.js**: 容器组件，用于包裹页面内容
- **Header.js**: 头部组件，用于显示页面头部
- **Footer.js**: 底部组件，用于显示页面底部
- **Sidebar.js**: 侧边栏组件，用于显示侧边栏
- **TabBar.js**: 标签栏组件，用于显示底部标签栏

## 使用方法

### 导入通用组件

```javascript
// 导入通用组件
import { Button, Input, Card, Loading } from '../components/common';

// 使用组件
<Button title="点击我" onPress={handlePress} />
<Input placeholder="请输入" value={text} onChangeText={setText} />
<Card>
  <Text>卡片内容</Text>
</Card>
<Loading visible={isLoading} />
```

### 导入特定组件

```javascript
// 导入特定组件
import { NoteList, NoteEditor } from '../components/notes';
import { HandwritingAdapter } from '../components/handwriting';
import { KnowledgeGraph } from '../components/knowledge';
import { MindMap } from '../components/mind_map';
import { SearchBar, SearchResults } from '../components/search';
import { RecordButton, TranscriptionResult } from '../components/voice';
import { ChatInput, ChatMessage } from '../components/ai';
import { GroupList, GroupDetail } from '../components/groups';
import { ReminderListView, ReminderCalendarView } from '../components/reminder';

// 使用组件
<NoteList notes={notes} onNotePress={handleNotePress} />
<NoteEditor note={note} onSave={handleSave} />
<HandwritingRecognizer onRecognize={handleRecognize} />
<KnowledgeGraph data={graphData} />
<MindMap nodes={nodes} edges={edges} />
<SearchBar value={query} onChangeText={setQuery} />
<RecordButton isRecording={isRecording} onStartRecording={handleStart} />
```

## 组件开发规范

1. 每个组件应该有自己的目录或文件
2. 组件应该有清晰的命名和注释
3. 组件应该有适当的PropTypes定义
4. 组件应该尽可能保持纯函数式，状态管理交给Redux或Context API
5. 复杂组件可以包含子组件
6. 组件应该有良好的性能
7. 组件应该有良好的可访问性
8. 组件应该有良好的可测试性
9. 组件应该有良好的可维护性
10. 组件应该有良好的可重用性

## 子目录文档

每个子目录都有自己的README.md文件，详细说明该目录下的组件用途和使用方法：

- [通用组件 (common)](./common/README.md)
- [AI组件 (ai)](./ai/README.md)
- [手写识别组件 (handwriting)](./handwriting/README.md)
- [知识图谱组件 (knowledge)](./knowledge/README.md)
- [笔记组件 (notes)](./notes/README.md)
- [思维导图组件 (mind_map)](./mind_map/README.md)
- [社区组件 (community)](./community/README.md)
- [群组组件 (groups)](./groups/README.md)
- [语音组件 (voice)](./voice/README.md)
- [搜索组件 (search)](./search/README.md)
- [提醒组件 (reminder)](./reminder/README.md)
- [布局组件 (Layout)](./Layout/README.md)
- [首页组件 (home)](./home/README.md)
- [画布组件 (canvas)](./canvas/README.md)
- [代码编辑器组件 (code)](./code/README.md)