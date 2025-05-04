/**
 * 手写画布组件
 * 提供手写输入功能
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Text } from '../common/Typography';
import { Button } from '../common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Canvas } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { captureRef } from 'react-native-view-shot';

/**
 * 手写画布组件
 * @param {Function} onCapture - 捕获画布内容回调
 * @param {Function} onClear - 清除画布回调
 * @param {Object} style - 自定义样式
 * @param {number} width - 画布宽度
 * @param {number} height - 画布高度
 * @param {string} backgroundColor - 画布背景色
 * @param {string} strokeColor - 笔触颜色
 * @param {number} strokeWidth - 笔触宽度
 * @param {boolean} showToolbar - 是否显示工具栏
 */
const HandwritingCanvas = ({
  onCapture,
  onClear,
  style,
  width,
  height = 300,
  backgroundColor,
  strokeColor: initialStrokeColor,
  strokeWidth: initialStrokeWidth = 3,
  showToolbar = true,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 计算画布宽度
  const screenWidth = Dimensions.get('window').width;
  const canvasWidth = width || screenWidth - 32;

  // 引用
  const canvasRef = useRef(null);
  const pathsRef = useRef([]);
  const currentPathRef = useRef(null);

  // 状态
  const [strokeColor, setStrokeColor] = useState(initialStrokeColor || colors.primary);
  const [strokeWidth, setStrokeWidth] = useState(initialStrokeWidth);
  const [canvasHeight, setCanvasHeight] = useState(height);

  // 手势处理
  const panGesture = Gesture.Pan()
    .onStart((event) => {
      const { x, y } = event;
      currentPathRef.current = {
        path: `M ${x} ${y}`,
        color: strokeColor,
        width: strokeWidth,
        points: [{ x, y }],
      };
    })
    .onUpdate((event) => {
      const { x, y } = event;
      if (currentPathRef.current) {
        currentPathRef.current.path += ` L ${x} ${y}`;
        currentPathRef.current.points.push({ x, y });
        // 强制重绘
        forceUpdate();
      }
    })
    .onEnd(() => {
      if (currentPathRef.current) {
        pathsRef.current.push(currentPathRef.current);
        currentPathRef.current = null;
      }
    });

  // 强制重绘
  const forceUpdate = () => {
    // 这里可以使用一个状态变量来触发重绘
    // 但由于我们使用的是Skia Canvas，它有自己的渲染机制
    // 所以我们可以直接调用其内部方法
    if (canvasRef.current) {
      canvasRef.current.redraw();
    }
  };

  // 清除画布
  const clearCanvas = () => {
    pathsRef.current = [];
    currentPathRef.current = null;
    forceUpdate();
    
    if (onClear) {
      onClear();
    }
  };

  // 撤销上一步
  const undoLastStroke = () => {
    if (pathsRef.current.length > 0) {
      pathsRef.current.pop();
      forceUpdate();
    }
  };

  // 更改笔触颜色
  const changeStrokeColor = (color) => {
    setStrokeColor(color);
  };

  // 更改笔触宽度
  const changeStrokeWidth = (width) => {
    setStrokeWidth(width);
  };

  // 捕获画布内容
  const captureCanvas = async () => {
    if (pathsRef.current.length === 0) {
      if (onCapture) {
        onCapture(null, 'empty');
      }
      return;
    }

    try {
      // 截取画布图像
      const uri = await captureRef(canvasRef, {
        format: 'png',
        quality: 0.8,
      });

      // 将图像转换为Base64
      const response = await fetch(uri);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = () => {
        const base64data = reader.result;
        // 移除前缀 "data:image/png;base64,"
        const imageData = base64data.split(',')[1];

        if (onCapture) {
          onCapture(imageData, 'success');
        }
      };

      reader.onerror = (error) => {
        console.error('读取图像失败:', error);
        if (onCapture) {
          onCapture(null, 'error', '读取图像失败');
        }
      };
    } catch (error) {
      console.error('捕获画布内容失败:', error);
      if (onCapture) {
        onCapture(null, 'error', error.message);
      }
    }
  };

  // 渲染画布
  const renderCanvas = () => {
    return (
      <Canvas
        ref={canvasRef}
        style={[
          styles.canvas,
          { 
            backgroundColor: backgroundColor || colors.card, 
            width: canvasWidth, 
            height: canvasHeight 
          }
        ]}
        onDraw={(canvas) => {
          // 清除画布
          canvas.clear(backgroundColor || colors.card);

          // 绘制已保存的路径
          for (const pathData of pathsRef.current) {
            const path = new Path2D(pathData.path);
            canvas.strokeStyle = pathData.color;
            canvas.lineWidth = pathData.width;
            canvas.lineCap = 'round';
            canvas.lineJoin = 'round';
            canvas.stroke(path);
          }

          // 绘制当前路径
          if (currentPathRef.current) {
            const path = new Path2D(currentPathRef.current.path);
            canvas.strokeStyle = currentPathRef.current.color;
            canvas.lineWidth = currentPathRef.current.width;
            canvas.lineCap = 'round';
            canvas.lineJoin = 'round';
            canvas.stroke(path);
          }
        }}
      />
    );
  };

  // 渲染工具栏
  const renderToolbar = () => {
    if (!showToolbar) return null;

    const colorOptions = [
      colors.primary,
      colors.error,
      '#4CAF50', // 绿色
      '#2196F3', // 蓝色
      '#FF9800', // 橙色
      '#9C27B0', // 紫色
      '#000000', // 黑色
    ];

    const widthOptions = [1, 3, 5, 8];

    return (
      <View style={styles.toolbar}>
        <View style={styles.toolSection}>
          {colorOptions.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                strokeColor === color && styles.selectedOption
              ]}
              onPress={() => changeStrokeColor(color)}
            />
          ))}
        </View>

        <View style={styles.toolDivider} />

        <View style={styles.toolSection}>
          {widthOptions.map((width) => (
            <TouchableOpacity
              key={width}
              style={[
                styles.widthOption,
                strokeWidth === width && styles.selectedOption
              ]}
              onPress={() => changeStrokeWidth(width)}
            >
              <View
                style={[
                  styles.widthIndicator,
                  {
                    backgroundColor: colors.text,
                    width: width * 2,
                    height: width * 2,
                    borderRadius: width
                  }
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toolDivider} />

        <View style={styles.toolSection}>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={undoLastStroke}
            disabled={pathsRef.current.length === 0}
          >
            <Icon
              name="undo"
              size={24}
              color={pathsRef.current.length === 0 ? colors.textSecondary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={clearCanvas}
            disabled={pathsRef.current.length === 0}
          >
            <Icon
              name="delete"
              size={24}
              color={pathsRef.current.length === 0 ? colors.textSecondary : colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={[styles.container, style]}>
      <GestureDetector gesture={panGesture}>
        <View>
          {renderCanvas()}
        </View>
      </GestureDetector>
      
      {renderToolbar()}
      
      <View style={styles.actionButtons}>
        <Button
          title="捕获"
          icon="camera"
          onPress={captureCanvas}
          disabled={pathsRef.current.length === 0}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  canvas: {
    borderRadius: 8,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  toolSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  colorOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  widthOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthIndicator: {
    borderRadius: 4,
  },
  selectedOption: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
});

export default HandwritingCanvas;
