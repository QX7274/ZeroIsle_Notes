/**
 * 简单可靠的手写覆盖层
 * 使用SVG渲染，确保手写笔迹能正确显示
 */

import React, { useState, useRef } from 'react';
import { View, StyleSheet, PanResponder, Dimensions, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const SimpleHandwritingOverlay = ({ 
  color = '#000000', 
  width = 3, 
  onStrokeEnd,
  onStrokeStart,
  style 
}) => {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  
  const currentStroke = useRef(null);

  // 简单的手写笔检测
  const isLikelyPen = (event) => {
    const { pressure = 0.5, radiusX = 10, radiusY = 10 } = event;
    
    // 检查压感
    if (pressure > 0.1 && pressure < 0.9) {
      return true;
    }
    
    // 检查触控面积
    const touchArea = Math.PI * radiusX * radiusY;
    if (touchArea < 100) {
      return true;
    }
    
    // 检查其他属性
    if (event.touchType === 'stylus' || event.touchType === 'pen') {
      return true;
    }
    
    if (event.toolType === 2) {
      return true;
    }
    
    // 正确识别手写笔输入
    return isPen;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const isPen = isLikelyPen(evt.nativeEvent);
        console.log('SimpleHandwritingOverlay: 检测输入类型:', isPen ? '手写笔' : '手指');
        return isPen;
      },
      
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (evt) => {
        const { locationX, locationY, pressure = 0.5 } = evt.nativeEvent;
        
        console.log('SimpleHandwritingOverlay: 开始绘制', { x: locationX, y: locationY, pressure });
        
        setIsDrawing(true);
        
        const newStroke = {
          id: Date.now(),
          path: `M${locationX},${locationY}`,
          color,
          width,
          pressure,
          points: [{ x: locationX, y: locationY, pressure }]
        };
        
        currentStroke.current = newStroke;
        setCurrentPath(newStroke.path);
        
        onStrokeStart?.(newStroke);
      },
      
      onPanResponderMove: (evt) => {
        if (!isDrawing || !currentStroke.current) return;
        
        const { locationX, locationY, pressure = 0.5 } = evt.nativeEvent;
        
        // 添加点到当前笔画
        currentStroke.current.points.push({ x: locationX, y: locationY, pressure });
        
        // 更新路径
        const newPath = currentStroke.current.path + `L${locationX},${locationY}`;
        currentStroke.current.path = newPath;
        setCurrentPath(newPath);
      },
      
      onPanResponderRelease: () => {
        if (!isDrawing || !currentStroke.current) return;
        
        console.log('SimpleHandwritingOverlay: 完成绘制');
        
        setIsDrawing(false);
        
        // 添加完成的笔画到路径列表
        const completedStroke = { ...currentStroke.current };
        const updatedPaths = [...prev, completedStroke];
console.log('添加新笔画，当前路径数:', updatedPaths.length);
setPaths(updatedPaths);
        
        // 清除当前路径
        setCurrentPath('');
        currentStroke.current = null;
        
        onStrokeEnd?.(completedStroke);
      },
      
      onPanResponderTerminate: () => {
        setIsDrawing(false);
        setCurrentPath('');
        currentStroke.current = null;
      }
    })
  ).current;

  // 清除所有路径
  const clear = () => {
    setPaths([]);
    setCurrentPath('');
    currentStroke.current = null;
    setIsDrawing(false);
  };

  // 撤销最后一笔
  const undo = () => {
    setPaths(prev => prev.slice(0, -1));
  };

  return (
    <View 
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents={isDrawing ? 'auto' : 'box-none'}
      {...panResponder.panHandlers}
    >
      <Svg 
        width={screenWidth} 
        height={screenHeight} 
        style={StyleSheet.absoluteFill}
      >
        {/* 渲染完成的路径 */}
        {paths.map((stroke) => (
          <Path
            key={stroke.id}
            d={stroke.path}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.9}
          />
        ))}
        
        {/* 渲染当前正在绘制的路径 */}
        {currentPath && (
          <Path
            d={currentPath}
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.9}
          />
        )}
      </Svg>
      
      {/* 调试信息 */}
      {__DEV__ && isDrawing && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            正在绘制 | 路径数: {paths.length}
          </Text>
        </View>
      )}
    </View>
  );
};

// 暴露清除和撤销方法
SimpleHandwritingOverlay.clear = () => {};
SimpleHandwritingOverlay.undo = () => {};

const styles = StyleSheet.create({
  debugInfo: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 4,
    zIndex: 1000,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
  },
});

export default SimpleHandwritingOverlay;