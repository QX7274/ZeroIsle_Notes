# 思维导图组件

本目录包含与思维导图功能相关的组件。

## 组件列表

### MindMap

思维导图组件，用于显示和编辑思维导图。

**主要功能**：
- 支持节点创建和编辑
- 支持节点拖拽
- 支持节点折叠/展开
- 支持多种布局方式

### MindMapNode

思维导图节点组件，用于渲染单个思维导图节点。

**主要功能**：
- 显示节点内容
- 支持节点样式自定义
- 支持节点状态（选中、编辑等）
- 支持节点交互

### MindMapToolbar

思维导图工具栏组件，提供思维导图编辑工具。

**主要功能**：
- 提供添加节点按钮
- 提供删除节点按钮
- 提供节点样式设置
- 提供布局调整

### MindMapView

思维导图视图组件，提供思维导图的可视化展示。

**主要功能**：
- 支持缩放和平移
- 支持自适应布局
- 支持主题切换
- 支持导出图片

### NodeEditor

节点编辑器组件，用于编辑思维导图节点的内容。

**主要功能**：
- 编辑节点文本
- 设置节点样式
- 添加节点图标
- 设置节点链接

### TemplateSelector

模板选择器组件，用于选择思维导图模板。

**主要功能**：
- 显示模板列表
- 支持模板预览
- 支持模板搜索
- 支持自定义模板

## 使用方法

```javascript
import { MindMap, MindMapToolbar, TemplateSelector } from '../components/mind_map';

function MindMapScreen() {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [layout, setLayout] = useState('tree');
  
  const handleNodeAdd = (parentId) => {
    // 添加新节点逻辑
  };
  
  const handleNodeUpdate = (nodeId, data) => {
    // 更新节点逻辑
  };
  
  const handleNodeDelete = (nodeId) => {
    // 删除节点逻辑
  };
  
  return (
    <View style={styles.container}>
      <MindMapToolbar
        onLayoutChange={setLayout}
        onAddNode={() => handleNodeAdd(selectedNode?.id)}
        onDeleteNode={() => handleNodeDelete(selectedNode?.id)}
      />
      
      <MindMap
        nodes={nodes}
        layout={layout}
        selectedNode={selectedNode}
        onNodeSelect={setSelectedNode}
        onNodeUpdate={handleNodeUpdate}
      />
      
      <TemplateSelector
        onTemplateSelect={handleTemplateSelect}
      />
    </View>
  );
}
```
