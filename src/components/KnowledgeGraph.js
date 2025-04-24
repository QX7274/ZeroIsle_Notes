import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Svg, { Circle, Text, Line, G } from 'react-native-svg';

const KnowledgeGraph = ({ data, onNodePress }) => {
  const { theme } = useTheme();
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = React.useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.6,
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height * 0.6,
      });
    });
    return () => subscription?.remove();
  }, []);

  const renderNode = (node, x, y) => {
    const nodeSize = 40;
    return (
      <G key={node.id}>
        <Circle
          cx={x}
          cy={y}
          r={nodeSize / 2}
          fill={theme.primary}
          onPress={() => onNodePress?.(node)}
        />
        <Text
          x={x}
          y={y + 5}
          fontSize={12}
          fill={theme.text}
          textAnchor="middle"
          onPress={() => onNodePress?.(node)}
        >
          {node.text}
        </Text>
      </G>
    );
  };

  const renderEdge = (edge, nodes) => {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    if (!source || !target) return null;

    return (
      <Line
        key={`${edge.source}-${edge.target}`}
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke={theme.border}
        strokeWidth={2}
      />
    );
  };

  const layoutGraph = (data) => {
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.4;
    const angleStep = (2 * Math.PI) / nodes.length;

    return nodes.map((node, index) => ({
      ...node,
      x: centerX + Math.cos(angleStep * index) * radius,
      y: centerY + Math.sin(angleStep * index) * radius,
    }));
  };

  const positionedNodes = layoutGraph(data);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={styles.svg}
      >
        {data?.edges?.map(edge => renderEdge(edge, positionedNodes))}
        {positionedNodes.map(node => renderNode(node, node.x, node.y))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  svg: {
    flex: 1,
  },
});

export default KnowledgeGraph; 