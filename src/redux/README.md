# Redux状态管理目录

这个目录包含应用的Redux状态管理相关文件。

## 目录结构

- **store.js**：Redux存储配置
- **slices/**：Redux Toolkit切片文件
  - **authSlice.js**：认证相关状态
  - **notesSlice.js**：笔记相关状态
  - **uiSlice.js**：UI相关状态
  - **knowledgeGraphSlice.js**：知识图谱相关状态
- **selectors/**：Redux选择器

## 状态管理原则

1. 使用Redux Toolkit简化Redux的使用
2. 按功能模块划分状态切片
3. 使用选择器（selectors）获取状态
4. 异步操作使用createAsyncThunk
5. 保持状态扁平化，避免深层嵌套
6. 使用规范化数据结构存储实体数据