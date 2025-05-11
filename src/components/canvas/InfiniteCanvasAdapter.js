/**
 * 无限画布适配器组件
 * 基于InfiniteCanvas实现，但提供与Canvas兼容的接口
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { InfiniteCanvas } from './index';

/**
 * 无限画布适配器组件
 * 提供与Canvas兼容的接口，但使用InfiniteCanvas的实现
 */
const InfiniteCanvasAdapter = ({
  elements = [],
  onContentChange,
  onElementSelect
}) => {
  // 主题
  const { colors } = useTheme();

  // 状态
  const [selectedElement, setSelectedElement] = useState(null);
  const [canvasId, setCanvasId] = useState(`canvas_${Date.now()}`);

  // 画布尺寸
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // 注释掉未使用的动画值，避免不必要的Reanimated警告
  // const scale = useSharedValue(1);
  // const translateX = useSharedValue(0);
  // const translateY = useSharedValue(0);

  // 处理元素选择
  const handleElementSelect = (element) => {
    setSelectedElement(element);
    if (onElementSelect) {
      onElementSelect(element);
    }
  };

  // 处理内容变化
  const handleContentChange = (newElements) => {
    if (onContentChange) {
      onContentChange(newElements);
    }
  };

  // 将旧格式的元素转换为新格式
  const convertElements = (oldElements) => {
    return oldElements.map(element => {
      // 基本属性
      const newElement = {
        id: element.id,
        type: element.type,
        layerId: 'default',
        x: element.x || 0,
        y: element.y || 0,
      };

      // 根据类型添加特定属性
      switch (element.type) {
        case 'text':
          return {
            ...newElement,
            text: element.text || '',
            fontSize: element.fontSize || 16,
            fontFamily: element.fontFamily || 'System',
            color: element.color || '#000000',
            width: element.width || 200,
            height: element.height || 50,
          };
        case 'image':
          return {
            ...newElement,
            uri: element.uri || '',
            width: element.width || 200,
            height: element.height || 200,
          };
        case 'shape':
          return {
            ...newElement,
            shapeType: element.shapeType || 'rectangle',
            width: element.width || 100,
            height: element.height || 100,
            strokeColor: element.strokeColor || '#000000',
            strokeWidth: element.strokeWidth || 2,
            fillColor: element.fillColor || 'transparent',
          };
        case 'path':
          return {
            ...newElement,
            points: element.points || [],
            color: element.color || '#000000',
            strokeWidth: element.strokeWidth || 2,
          };
        default:
          return newElement;
      }
    });
  };

  // 将新格式的元素转换为旧格式
  const convertBackElements = (newElements) => {
    return newElements.map(element => {
      // 基本属性
      const oldElement = {
        id: element.id,
        type: element.type,
        x: element.x || 0,
        y: element.y || 0,
      };

      // 根据类型添加特定属性
      switch (element.type) {
        case 'text':
          return {
            ...oldElement,
            text: element.text || '',
            fontSize: element.fontSize || 16,
            fontFamily: element.fontFamily || 'System',
            color: element.color || '#000000',
            width: element.width || 200,
            height: element.height || 50,
          };
        case 'image':
          return {
            ...oldElement,
            uri: element.uri || '',
            width: element.width || 200,
            height: element.height || 200,
          };
        case 'shape':
          return {
            ...oldElement,
            shapeType: element.shapeType || 'rectangle',
            width: element.width || 100,
            height: element.height || 100,
            strokeColor: element.strokeColor || '#000000',
            strokeWidth: element.strokeWidth || 2,
            fillColor: element.fillColor || 'transparent',
          };
        case 'path':
          return {
            ...oldElement,
            points: element.points || [],
            color: element.color || '#000000',
            strokeWidth: element.strokeWidth || 2,
          };
        default:
          return oldElement;
      }
    });
  };

  // 内容变化处理
  const handleInfiniteCanvasContentChange = (newElements) => {
    const convertedElements = convertBackElements(newElements);
    handleContentChange(convertedElements);
  };

  // 保存处理
  const handleSave = (canvasData) => {
    // 可以在这里添加保存逻辑
    console.log('Canvas saved:', canvasData);
  };

  // 转换后的元素
  const convertedElements = convertElements(elements);

  return (
    <View style={styles.container}>
      <InfiniteCanvas
        canvasId={canvasId}
        initialElements={convertedElements}
        onContentChange={handleInfiniteCanvasContentChange}
        onElementSelect={handleElementSelect}
        onSave={handleSave}
        readOnly={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

export default InfiniteCanvasAdapter;
