# 知识图谱组件

本目录包含与知识图谱功能相关的组件。

## 组件列表

### GraphVisualization

图谱可视化组件，用于可视化展示知识图谱。

**主要功能**：
- 支持节点和边的可视化
- 支持缩放和平移
- 支持节点拖拽
- 支持节点和边的样式自定义

### NodeDetail

节点详情组件，用于显示知识节点的详细信息。

**主要功能**：
- 显示节点属性
- 显示节点关系
- 支持节点编辑
- 支持节点删除

### EdgeEditor

边编辑器组件，用于编辑知识节点之间的关系。

**主要功能**：
- 设置关系类型
- 设置关系属性
- 支持双向关系
- 支持关系权重

### KnowledgeSearch

知识搜索组件，用于搜索知识图谱中的内容。

**主要功能**：
- 支持节点搜索
- 支持关系搜索
- 支持属性搜索
- 支持高级搜索条件

### KnowledgeGraphBuilder

知识图谱构建器组件，用于从笔记构建知识图谱。

**主要功能**：
- 自动提取实体和关系
- 支持手动调整
- 支持与现有图谱集成
- 支持构建进度显示

### GraphAnalytics

图谱分析组件，用于分析知识图谱的结构和特性。

**主要功能**：
- 显示中心性分析
- 显示社区检测结果
- 显示路径分析
- 支持自定义分析指标

## 使用方法

```javascript
import { GraphVisualization, NodeDetail, KnowledgeGraphBuilder } from '../components/knowledge';

function KnowledgeGraphScreen() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  
  useEffect(() => {
    // 获取知识图谱数据
    fetchKnowledgeGraph().then(data => {
      setNodes(data.nodes);
      setEdges(data.edges);
    });
  }, []);
  
  return (
    <View style={styles.container}>
      <GraphVisualization
        nodes={nodes}
        edges={edges}
        onNodePress={setSelectedNode}
      />
      
      {selectedNode && (
        <NodeDetail
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleNodeUpdate}
        />
      )}
      
      <KnowledgeGraphBuilder
        onBuild={handleBuildGraph}
      />
    </View>
  );
}
```
