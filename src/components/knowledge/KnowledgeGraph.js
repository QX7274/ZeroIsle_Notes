import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';

/**
 * 知识图谱可视化组件
 * 使用D3.js在WebView中渲染交互式知识图谱
 */
const KnowledgeGraph = ({ data, onNodeClick }) => {
  const { theme } = useTheme();
  const webViewRef = useRef(null);
  
  // 将图数据转换为D3.js可用的格式
  const formatGraphData = (graphData) => {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    // 处理Neo4j返回的路径数据
    graphData.forEach(pathData => {
      const path = pathData.path;
      
      // 处理节点
      path.nodes.forEach(node => {
        if (!nodeMap.has(node.id)) {
          nodeMap.set(node.id, {
            id: node.id,
            label: node.properties.title,
            type: node.properties.node_type,
            group: getNodeGroup(node.properties.node_type)
          });
          nodes.push(nodeMap.get(node.id));
        }
      });
      
      // 处理关系
      path.relationships.forEach(rel => {
        links.push({
          source: rel.start,
          target: rel.end,
          type: rel.type,
          value: rel.properties.weight || 1
        });
      });
    });
    
    return { nodes, links };
  };
  
  // 根据节点类型确定分组（用于颜色区分）
  const getNodeGroup = (nodeType) => {
    switch (nodeType) {
      case 'NOTE': return 1;
      case 'TAG': return 2;
      case 'CONCEPT': return 3;
      default: return 4;
    }
  };
  
  useEffect(() => {
    if (webViewRef.current && data) {
      const formattedData = formatGraphData(data);
      webViewRef.current.injectJavaScript(`
        updateGraph(${JSON.stringify(formattedData)});
        true;
      `);
    }
  }, [data]);
  
  // 处理节点点击事件
  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'nodeClick' && onNodeClick) {
        onNodeClick(message.nodeId);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };
  
  // D3.js可视化HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Knowledge Graph</title>
      <style>
        body { margin: 0; overflow: hidden; background-color: ${theme.background}; }
        #graph { width: 100%; height: 100%; }
        .node text { font-family: sans-serif; font-size: 12px; fill: ${theme.text}; }
        .link { stroke-opacity: 0.6; }
      </style>
      <script src="https://d3js.org/d3.v7.min.js"></script>
    </head>
    <body>
      <div id="graph"></div>
      <script>
        // 初始化力导向图
        let svg = d3.select("#graph")
          .append("svg")
          .attr("width", "100%")
          .attr("height", "100%");
          
        let width = window.innerWidth;
        let height = window.innerHeight;
        
        // 定义颜色方案
        const color = d3.scaleOrdinal(d3.schemeCategory10);
        
        // 创建力导向模拟
        let simulation = d3.forceSimulation()
          .force("link", d3.forceLink().id(d => d.id).distance(100))
          .force("charge", d3.forceManyBody().strength(-300))
          .force("center", d3.forceCenter(width / 2, height / 2));
        
        // 创建箭头标记
        svg.append("defs").selectAll("marker")
          .data(["end"])
          .enter().append("marker")
          .attr("id", d => d)
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 15)
          .attr("refY", 0)
          .attr("markerWidth", 6)
          .attr("markerHeight", 6)
          .attr("orient", "auto")
          .append("path")
          .attr("d", "M0,-5L10,0L0,5")
          .attr("fill", "#999");
        
        let link = svg.append("g")
          .attr("class", "links")
          .selectAll("line");
          
        let node = svg.append("g")
          .attr("class", "nodes")
          .selectAll("g");
        
        // 更新图数据
        function updateGraph(graph) {
          // 移除现有元素
          link.remove();
          node.remove();
          
          // 更新链接
          link = svg.select(".links")
            .selectAll("line")
            .data(graph.links)
            .enter().append("line")
            .attr("stroke-width", d => Math.sqrt(d.value))
            .attr("stroke", "#999")
            .attr("marker-end", "url(#end)");
          
          // 更新节点
          node = svg.select(".nodes")
            .selectAll("g")
            .data(graph.nodes)
            .enter().append("g")
            .call(d3.drag()
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended));
          
          // 添加节点圆圈
          node.append("circle")
            .attr("r", 10)
            .attr("fill", d => color(d.group));
          
          // 添加节点标签
          node.append("text")
            .attr("dy", -15)
            .attr("text-anchor", "middle")
            .text(d => d.label);
          
          // 添加点击事件
          node.on("click", function(event, d) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'nodeClick',
              nodeId: d.id
            }));
          });
          
          // 更新模拟
          simulation.nodes(graph.nodes)
            .on("tick", ticked);
            
          simulation.force("link")
            .links(graph.links);
          
          // 重启模拟
          simulation.alpha(1).restart();
          
          // 更新位置
          function ticked() {
            link
              .attr("x1", d => d.source.x)
              .attr("y1", d => d.source.y)
              .attr("x2", d => d.target.x)
              .attr("y2", d => d.target.y);
            
            node
              .attr("transform", d => \`translate(\${d.x},\${d.y})\`);
          }
        }
        
        // 拖拽事件处理
        function dragstarted(event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
        
        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }
        
        function dragended(event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        
        // 窗口大小调整
        window.addEventListener('resize', function() {
          width = window.innerWidth;
          height = window.innerHeight;
          simulation.force("center", d3.forceCenter(width / 2, height / 2));
          simulation.alpha(0.3).restart();
        });
      </script>
    </body>
    </html>
  `;
  
  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webView: {
    flex: 1,
  },
});

export default KnowledgeGraph;
