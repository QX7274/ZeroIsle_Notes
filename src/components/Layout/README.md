# 布局组件

本目录包含应用的布局组件，用于构建页面的整体结构。

## 组件列表

### MainLayout

主布局组件，提供应用的主要布局结构。

**主要功能**：
- 提供页面容器
- 支持顶部导航栏
- 支持底部标签栏
- 支持侧边栏

### Header

头部组件，用于显示页面顶部的导航栏。

**主要功能**：
- 显示页面标题
- 提供返回按钮
- 提供操作按钮
- 支持搜索框

### Footer

底部组件，用于显示页面底部的内容。

**主要功能**：
- 显示版权信息
- 提供快捷链接
- 支持自定义内容
- 支持固定定位

### Sidebar

侧边栏组件，用于显示侧边导航菜单。

**主要功能**：
- 显示导航菜单
- 支持多级菜单
- 支持菜单折叠
- 支持自定义菜单项

### TabBar

标签栏组件，用于显示底部标签导航。

**主要功能**：
- 显示标签项
- 支持图标和文本
- 支持徽章显示
- 支持自定义样式

### Container

容器组件，用于包裹页面内容。

**主要功能**：
- 提供内边距
- 支持背景色
- 支持滚动行为
- 支持安全区域

## 使用方法

```javascript
import { MainLayout, Header, Footer } from '../components/Layout';

function MyScreen() {
  return (
    <MainLayout>
      <Header
        title="首页"
        showBackButton={false}
        rightComponent={<Button title="设置" onPress={handleSettings} />}
      />
      
      <Container>
        {/* 页面内容 */}
        <Text>Hello World</Text>
      </Container>
      
      <Footer>
        <Text>© 2023 ZeroIsle Notes</Text>
      </Footer>
    </MainLayout>
  );
}
```
