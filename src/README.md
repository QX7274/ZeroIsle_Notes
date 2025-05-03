# 零屿笔记前端源代码

本目录包含零屿笔记应用的前端源代码。

## 目录结构

- **assets/**: 静态资源文件，如图片、字体等
- **components/**: 可复用的组件
  - **common/**: 通用组件，如按钮、输入框等
  - **ai/**: AI相关组件
  - **community/**: 社区相关组件
  - **groups/**: 群组相关组件
  - **handwriting/**: 手写识别相关组件
  - **knowledge/**: 知识图谱相关组件
  - **Layout/**: 布局组件
  - **mind_map/**: 思维导图相关组件
  - **notes/**: 笔记相关组件
  - **reminder/**: 提醒相关组件
  - **search/**: 搜索相关组件
  - **voice/**: 语音相关组件
- **config/**: 配置文件
  - **index.js**: 主配置文件，包含API地址、主题、语言等常量
  - **api.js**: API端点配置
- **context/**: React上下文
  - **ThemeContext.js**: 主题上下文
  - **AccessibilityContext.js**: 可访问性上下文
- **native/**: 原生模块桥接
- **navigation/**: 导航相关
- **pages/**: 页面组件
- **redux/**: Redux状态管理
  - **actions/**: Redux动作
  - **reducers/**: Redux归约器
  - **slices/**: Redux Toolkit切片
- **screens/**: 屏幕组件
- **services/**: 服务
  - **api/**: API服务
  - **ai/**: AI服务
  - **analytics/**: 分析服务
- **store/**: Redux存储配置
- **tests/**: 测试文件
- **theme/**: 主题相关
- **utils/**: 工具函数
  - **constants/**: 常量
- **App.js**: 应用入口组件

## 文件命名规范

- 组件文件使用大驼峰命名法，如`Button.js`、`NoteList.js`
- 工具函数和服务使用小驼峰命名法，如`dateUtils.js`、`apiService.js`
- 常量文件使用小写加下划线，如`api_endpoints.js`、`config.js`

## 代码规范

- 使用ES6+语法
- 使用函数组件和React Hooks
- 使用Redux进行状态管理
- 使用React Navigation进行导航
- 使用Axios进行API请求
- 使用AsyncStorage进行本地存储
