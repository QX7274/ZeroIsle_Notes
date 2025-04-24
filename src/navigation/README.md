# 导航目录

这个目录包含应用的导航配置和组件。

## 导航结构

- **AppNavigator.js**：应用的主导航器，整合所有导航堆栈
- **AuthNavigator.js**：认证相关的导航堆栈
- **MainNavigator.js**：主要功能的导航堆栈
- **TabNavigator.js**：底部标签导航

## 导航类型

应用使用React Navigation库实现导航功能，包括：

1. 堆栈导航（Stack Navigation）：用于屏幕间的前进和后退
2. 底部标签导航（Tab Navigation）：用于主要功能模块间的切换
3. 抽屉导航（Drawer Navigation）：用于侧边菜单

## 导航参数

导航参数应该在导航器中定义，并在屏幕组件中通过props.route.params访问。