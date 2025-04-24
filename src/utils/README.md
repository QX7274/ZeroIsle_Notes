# 工具目录

这个目录包含应用中使用的各种工具函数、常量和辅助类。

## 工具分类

- **constants/**：常量定义
  - **colors.js**：颜色常量
  - **dimensions.js**：尺寸常量
  - **config.js**：应用配置常量
  - **apiEndpoints.js**：API端点常量
- **helpers/**：辅助函数
  - **dateHelpers.js**：日期处理函数
  - **stringHelpers.js**：字符串处理函数
  - **validationHelpers.js**：表单验证函数
- **hooks/**：自定义React Hooks
  - **useForm.js**：表单处理Hook
  - **useDebounce.js**：防抖Hook
  - **useTheme.js**：主题Hook

## 工具开发规范

1. 工具函数应该是纯函数，不依赖外部状态
2. 工具函数应该有清晰的命名和注释
3. 复杂工具函数应该有单元测试
4. 常量应该使用大写字母和下划线命名
5. 自定义Hook应该以use开头