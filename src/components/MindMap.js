import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Svg, { Circle, Text, Line } from 'react-native-svg';

const MindMap = ({ data, onNodePress }) => {
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

  const renderNode = (node, x, y, level = 0) => {
    const nodeSize = 40;
    const spacing = 100;
    const children = node.children || [];
    const childCount = children.length;
    const startAngle = -Math.PI / 2;
    const angleStep = Math.PI / (childCount + 1);

    return (
      <React.Fragment key={node.id}>
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
        {children.map((child, index) => {
          const angle = startAngle + angleStep * (index + 1);
          const childX = x + Math.cos(angle) * spacing;
          const childY = y + Math.sin(angle) * spacing;
          return (
            <React.Fragment key={child.id}>
              <Line
                x1={x}
                y1={y}
                x2={childX}
                y2={childY}
                stroke={theme.border}
                strokeWidth={2}
              />
              {renderNode(child, childX, childY, level + 1)}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={styles.svg}
      >
        {data && renderNode(data, dimensions.width / 2, dimensions.height / 2)}
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

export default MindMap; 