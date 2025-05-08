# 查看器模块

本目录包含零屿笔记应用的各种文件查看器相关屏幕组件。查看器模块允许用户查看和交互不同类型的文件，如PDF、Word文档、图片、音频和视频等。

## 文件结构

- **index.js**: 查看器模块导出文件，集中导出所有查看器相关屏幕
- **PDFViewerScreen.js**: PDF查看器屏幕，用于查看PDF文件
- **DocViewerScreen.js**: 文档查看器屏幕，用于查看Word、Excel等文档
- **ImageViewerScreen.js**: 图片查看器屏幕，用于查看图片
- **AudioPlayerScreen.js**: 音频播放器屏幕，用于播放音频文件
- **VideoPlayerScreen.js**: 视频播放器屏幕，用于播放视频文件
- **MarkdownViewerScreen.js**: Markdown查看器屏幕，用于查看Markdown文件
- **CodeViewerScreen.js**: 代码查看器屏幕，用于查看代码文件
- **WebViewerScreen.js**: 网页查看器屏幕，用于查看网页和HTML文件

## 主要功能

### PDF查看器屏幕 (PDFViewerScreen)

PDF查看器屏幕用于查看PDF文件，主要功能包括：

- 显示PDF文件内容，支持分页查看
- 支持缩放、旋转和适应屏幕
- 支持页面跳转和目录导航
- 支持文本搜索和高亮
- 支持添加书签和注释
- 支持分享和导出

### 文档查看器屏幕 (DocViewerScreen)

文档查看器屏幕用于查看Word、Excel等文档，主要功能包括：

- 显示文档内容，保持原始格式
- 支持缩放和滚动
- 支持文本搜索
- 支持表格和图表查看
- 支持分享和导出

### 图片查看器屏幕 (ImageViewerScreen)

图片查看器屏幕用于查看图片，主要功能包括：

- 显示图片，支持多种格式（JPEG、PNG、GIF等）
- 支持缩放、旋转和平移
- 支持全屏查看和幻灯片模式
- 支持基本编辑功能（裁剪、滤镜等）
- 支持分享和保存

### 音频播放器屏幕 (AudioPlayerScreen)

音频播放器屏幕用于播放音频文件，主要功能包括：

- 播放音频文件，支持多种格式（MP3、WAV、AAC等）
- 提供播放控制（播放、暂停、快进、快退等）
- 显示音频波形和进度
- 支持播放速度调整
- 支持后台播放和锁屏控制
- 支持播放列表管理

### 视频播放器屏幕 (VideoPlayerScreen)

视频播放器屏幕用于播放视频文件，主要功能包括：

- 播放视频文件，支持多种格式（MP4、AVI、MKV等）
- 提供播放控制（播放、暂停、快进、快退等）
- 支持全屏和画中画模式
- 支持字幕显示和选择
- 支持播放速度和分辨率调整
- 支持截图和分享

### Markdown查看器屏幕 (MarkdownViewerScreen)

Markdown查看器屏幕用于查看Markdown文件，主要功能包括：

- 渲染Markdown内容，支持所有常用语法
- 支持代码块语法高亮
- 支持目录导航
- 支持主题切换
- 支持导出为HTML或PDF

### 代码查看器屏幕 (CodeViewerScreen)

代码查看器屏幕用于查看代码文件，主要功能包括：

- 显示代码，支持多种编程语言
- 提供语法高亮
- 支持行号显示
- 支持代码折叠
- 支持搜索和跳转
- 支持主题切换

### 网页查看器屏幕 (WebViewerScreen)

网页查看器屏幕用于查看网页和HTML文件，主要功能包括：

- 加载和显示网页内容
- 支持导航控制（前进、后退、刷新等）
- 支持缩放和适应屏幕
- 支持书签和历史记录
- 支持离线查看
- 支持分享和保存

## 使用的组件

查看器模块使用了以下主要组件：

- **PDFViewer**: PDF查看器组件，用于渲染PDF文件
- **DocViewer**: 文档查看器组件，用于渲染Office文档
- **ImageViewer**: 图片查看器组件，用于显示图片
- **AudioPlayer**: 音频播放器组件，用于播放音频
- **VideoPlayer**: 视频播放器组件，用于播放视频
- **MarkdownRenderer**: Markdown渲染器组件，用于渲染Markdown内容
- **CodeHighlighter**: 代码高亮组件，用于显示带语法高亮的代码
- **WebView**: 网页查看器组件，用于显示网页内容

## 与其他模块的交互

查看器模块与以下模块有交互：

- **笔记模块**: 支持从笔记中打开附件和链接
- **文件管理模块**: 提供文件查看功能
- **导出模块**: 支持将查看的内容导出为其他格式
- **注释模块**: 支持在文件上添加注释和标记

## API交互

查看器模块主要与以下API端点交互：

- **GET /api/files/:id**: 获取文件内容
- **GET /api/files/:id/annotations**: 获取文件注释
- **POST /api/files/:id/annotations**: 添加文件注释
- **PUT /api/files/:id/annotations/:annotationId**: 更新文件注释
- **DELETE /api/files/:id/annotations/:annotationId**: 删除文件注释

## 状态管理

查看器模块的状态主要通过Redux进行管理，相关的状态切片包括：

- **viewersSlice**: 管理查看器相关状态，如当前查看的文件、查看器设置等
- **annotationsSlice**: 管理注释相关状态
