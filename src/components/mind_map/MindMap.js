import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import { analyticsService } from '../../services/analytics';

const { width, height } = Dimensions.get('window');

const MindMap = ({ data, onNodePress, editable = false }) => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const panRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    if (data) {
      processData(data);
    }
  }, [data]);

  const processData = (data) => {
    // 简单的布局算法
    const rootNode = {
      id: data.id,
      text: data.text,
      x: layout.width / 2,
      y: layout.height / 2,
      level: 0,
    };

    const processedNodes = [rootNode];
    const processedConnections = [];

    // 递归处理子节点
    const processChildren = (parent, children, level) => {
      if (!children || children.length === 0) return;

      const angleStep = (2 * Math.PI) / children.length;
      const radius = 150 * (level + 1); // 根据层级增加半径

      children.forEach((child, index) => {
        const angle = index * angleStep;
        const x = parent.x + radius * Math.cos(angle);
        const y = parent.y + radius * Math.sin(angle);

        const childNode = {
          id: child.id,
          text: child.text,
          x,
          y,
          level,
        };

        processedNodes.push(childNode);
        processedConnections.push({
          from: parent.id,
          to: child.id,
        });

        if (child.children) {
          processChildren(childNode, child.children, level + 1);
        }
      });
    };

    if (data.children) {
      processChildren(rootNode, data.children, 1);
    }

    setNodes(processedNodes);
    setConnections(processedConnections);
  };

  const handleNodePress = (node) => {
    setSelectedNode(node);
    if (onNodePress) {
      onNodePress(node);
    }
    analyticsService.trackMindMapAction('select_node', { nodeId: node.id });
  };

  const handlePanGestureEvent = (event) => {
    setTranslateX(translateX + event.nativeEvent.translationX);
    setTranslateY(translateY + event.nativeEvent.translationY);
  };

  const handlePinchGestureEvent = (event) => {
    setScale(scale * event.nativeEvent.scale);
  };

  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
    if (data) {
      processData(data);
    }
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <PanGestureHandler
        ref={panRef}
        onGestureEvent={handlePanGestureEvent}
        onHandlerStateChange={(event) => {
          if (event.nativeEvent.oldState === State.ACTIVE) {
            setTranslateX(translateX + event.nativeEvent.translationX);
            setTranslateY(translateY + event.nativeEvent.translationY);
          }
        }}
      >
        <View style={styles.svgContainer}>
          <PinchGestureHandler
            ref={pinchRef}
            onGestureEvent={handlePinchGestureEvent}
            onHandlerStateChange={(event) => {
              if (event.nativeEvent.oldState === State.ACTIVE) {
                setScale(scale * event.nativeEvent.scale);
              }
            }}
          >
            <Svg
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              }}
            >
              {/* 连接线 */}
              {connections.map((connection) => {
                const fromNode = nodes.find(node => node.id === connection.from);
                const toNode = nodes.find(node => node.id === connection.to);
                if (!fromNode || !toNode) return null;

                return (
                  <Path
                    key={`${connection.from}-${connection.to}`}
                    d={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
                    stroke="#666"
                    strokeWidth="2"
                  />
                );
              })}

              {/* 节点 */}
              {nodes.map((node) => (
                <React.Fragment key={node.id}>
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={node.level === 0 ? 40 : 30}
                    fill={selectedNode?.id === node.id ? '#4CAF50' : '#2196F3'}
                    onPress={() => handleNodePress(node)}
                  />
                  <SvgText
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill="#fff"
                    fontSize={node.level === 0 ? 14 : 12}
                    onPress={() => handleNodePress(node)}
                  >
                    {node.text.length > 10 ? `${node.text.substring(0, 10)}...` : node.text}
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>
          </PinchGestureHandler>
        </View>
      </PanGestureHandler>

      {editable && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setScale(scale * 1.2)}
          >
            <Text style={styles.controlButtonText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setScale(Math.max(0.5, scale * 0.8))}
          >
            <Text style={styles.controlButtonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              setScale(1);
              setTranslateX(0);
              setTranslateY(0);
            }}
          >
            <Text style={styles.controlButtonText}>重置</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  svgContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  controls: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default MindMap;
