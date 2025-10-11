# 分类组件

本目录包含与分类功能相关的组件。

## 组件列表

### CategoryManager

分类管理主组件，集成了所有分类管理功能。

**主要功能**：
- 分类列表和树形视图切换
- 创建、编辑、删除分类
- 分类统计信息展示
- 下拉刷新
- 多种交互方式（点击、长按）

**使用方法**：
```javascript
import { CategoryManager } from '../components/category';

<CategoryManager 
  onCategorySelect={(category) => console.log(category)}
  viewMode="list"
/>
```

### CategoryList

分类列表视图组件。

**主要功能**：
- 以列表形式展示分类
- 支持下拉刷新
- 支持空状态显示
- 支持分类的各种操作

### CategoryTree

分类树形视图组件。

**主要功能**：
- 以树形结构展示分类层级
- 支持展开/折叠
- 支持无限层级
- 显示分类的父子关系

### CategoryCard

分类卡片组件。

**主要功能**：
- 显示单个分类的详细信息
- 显示分类图标和颜色
- 显示笔记数量统计
- 支持编辑和删除操作
- 支持选中状态

### CategoryEditor

分类编辑器组件。

**主要功能**：
- 创建新分类
- 编辑现有分类
- 设置分类名称、描述
- 选择分类图标和颜色
- 选择父分类
- 表单验证

### CategoryPicker

分类选择器组件。

**主要功能**：
- 从分类列表中选择分类
- 支持选择"无"选项
- 显示分类的基本信息
- 选中状态指示

### CategoryStatistics

分类统计组件。

**主要功能**：
- 显示总分类数
- 显示总笔记数
- 显示总字数
- 显示最常用分类
- 可视化统计数据

## 数据流

所有分类组件都通过Redux进行状态管理：

1. 使用 `categorySlice` 管理分类数据
2. 通过 `categoryApi` 与后端通信
3. 支持离线模式和数据同步

## 样式定制

所有组件都支持主题定制，使用 `ThemeContext` 获取颜色配置。

## 示例

```javascript
import { CategoryManager } from '../components/category';

function MyScreen() {
  const handleCategorySelect = (category) => {
    // 处理分类选择
    console.log('Selected category:', category);
  };

  return (
    <CategoryManager 
      onCategorySelect={handleCategorySelect}
      viewMode="list"
    />
  );
}
```





