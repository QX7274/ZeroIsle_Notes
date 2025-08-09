/**
 * 手写画布组件
 * 提供手写输入功能
 */
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
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
import { Canvas, Image, useImage, Path } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
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
const HandwritingCanvas = forwardRef(({
  onCapture,
  onClear,
  style,
  width,
  height = 300,
  backgroundColor,
  strokeColor: initialStrokeColor,
  strokeWidth: initialStrokeWidth = 3,
  showToolbar = true,
}, ref) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 计算画布宽度
  const screenWidth = Dimensions.get('window').width;
  const canvasWidth = width || screenWidth - 32;

  // 引用
  const canvasRef = useRef(null);
  const pathsRef = useRef([]);
  const currentPathRef = useRef(null);
  const undoStackRef = useRef([]);

  // 状态
  const [strokeColor, setStrokeColor] = useState(initialStrokeColor || colors.primary);
  const [strokeWidth, setStrokeWidth] = useState(initialStrokeWidth);
  const [canvasHeight, setCanvasHeight] = useState(height);
  const [stylusActive, setStylusActive] = useState(false);

  // 图像状态
  const [imageUrl, setImageUrl] = useState(null);
  const backgroundImage = useImage(imageUrl);

  // 添加图片到画布
  const addImage = (imageData) => {
    console.log('=== HandwritingCanvas 添加图片 ===');
    console.log('图片数据:', imageData);

    try {
      // 创建图片对象
      const imageObject = {
        id: `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        uri: imageData.uri,
        x: imageData.x || 100,
        y: imageData.y || 100,
        width: imageData.width || 200,
        height: imageData.height || 200,
        fileName: imageData.fileName || 'image.jpg',
        timestamp: Date.now()
      };

      // 将图片添加到路径数组中（作为特殊的路径对象）
      pathsRef.current = [...pathsRef.current, imageObject];

      // 清空重做栈
      undoStackRef.current = [];

      // 触发重绘
      setRedrawTrigger(prev => prev + 1);

      console.log('✅ 图片已添加到画布:', imageObject);
      console.log('当前路径数量:', pathsRef.current.length);

    } catch (error) {
      console.error('❌ 添加图片失败:', error);
    }
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    clearCanvas,
    undoLastStroke,
    redoLastStroke,
    setColor: (color) => changeStrokeColor(color),
    setWidth: (width) => changeStrokeWidth(width),
    captureCanvas,
    loadImageData,
    addImage // 新增图片添加方法
  }));

  // 加载图像数据
  const loadImageData = (base64Data) => {
    if (!base64Data) {
      console.log('没有提供图像数据，清空画布');
      clearCanvas();
      setImageUrl(null);
      return;
    }

    try {
      console.log('加载图像数据到画布');
      // 创建完整的base64 URL
      const fullImageUrl = `data:image/png;base64,${base64Data}`;
      
      // 更新图像URL状态，这将触发useImage hook重新加载图像
      setImageUrl(fullImageUrl);
      
      // 清除当前路径数据，因为我们将使用图像作为背景
      pathsRef.current = [];
      currentPathRef.current = null;
      undoStackRef.current = [];
      
      console.log('图像数据加载成功');
    } catch (error) {
      console.error('加载图像数据失败:', error);
    }
  };

  // 检测是否为触控笔输入 - 使用原生事件属性
  const isStylusInput = (event) => {
    'worklet';
    
    try {
      // 安全检查：确保事件对象存在
      if (!event) {
        console.log('❌ 事件对象为空');
        return false;
      }

      // 检查原生事件对象
      const nativeEvent = event.nativeEvent || event;
      
      // 安全获取属性的辅助函数
      const safeGet = (obj, prop) => {
        try {
          return obj && prop in obj ? obj[prop] : undefined;
        } catch (error) {
          console.error('安全获取属性错误:', error);
          return undefined;
        }
      };

      // 方法1: 检查工具类型 (Android)
      const toolType = safeGet(nativeEvent, 'toolType');
      if (toolType !== undefined) {
        // toolType: 1=手指, 2=触控笔, 3=鼠标, 'stylus'=触控笔, 'eraser'=橡皮擦
        if (toolType === 2 || toolType === 'stylus' || toolType === 'eraser') {
          console.log('✅ 检测到触控笔 - toolType:', toolType);
          return true;
        }
        if (toolType === 1 || toolType === 'finger') {
          console.log('❌ 检测到手指 - toolType:', toolType);
          return false;
        }
      }

      // 方法2: 检查压力值 - 触控笔通常有压力感应
      const pressure = safeGet(nativeEvent, 'force') || safeGet(nativeEvent, 'pressure') || 0;
      if (pressure > 0 && pressure < 0.9) {
        console.log('✅ 检测到触控笔 - 有压力值:', pressure);
        return true;
      }

      // 方法3: 检查触摸面积 - 触控笔通常比手指小
      const touchSize = safeGet(nativeEvent, 'majorRadius') || safeGet(nativeEvent, 'size') || 0;
      if (touchSize > 0 && touchSize < 10) {
        console.log('✅ 检测到触控笔 - 触摸面积小:', touchSize);
        return true;
      }

      // 方法4: 检查触摸类型 (iOS)
      const touchType = safeGet(nativeEvent, 'type');
      if (touchType === 'stylus') {
        console.log('✅ 检测到触控笔 - iOS stylus type');
        return true;
      }

      // 方法5: 检查pointerType (Web标准)
      const pointerType = safeGet(nativeEvent, 'pointerType');
      if (pointerType === 'pen') {
        console.log('✅ 检测到触控笔 - pointerType: pen');
        return true;
      }

      // 方法6: 检查倾斜角度 (触控笔特有)
      const tiltX = safeGet(nativeEvent, 'tiltX') || 0;
      const tiltY = safeGet(nativeEvent, 'tiltY') || 0;
      if (tiltX !== 0 || tiltY !== 0) {
        console.log('✅ 检测到触控笔 - 倾斜角度:', { tiltX, tiltY });
        return true;
      }

      // 方法7: 检查触摸点数量和面积组合
      const numberOfTouches = safeGet(nativeEvent, 'numberOfTouches') || 1;
      if (numberOfTouches === 1 && touchSize > 0 && touchSize < 20) {
        console.log('✅ 检测到触控笔 - 单点小面积:', { numberOfTouches, touchSize });
        return true;
      }

      // 临时：为了测试，检查是否有任何压力或小触摸面积的迹象
      if ((pressure > 0 && pressure < 1) || (touchSize > 0 && touchSize < 15)) {
        console.log('✅ 可能是触控笔 - 压力:', pressure, '触摸面积:', touchSize);
        return true;
      }

      // 默认情况：安全地记录所有属性，避免序列化问题
      try {
        // 单独记录每个属性，避免序列化整个对象
        try {
          console.log('❌ 检测到手指触摸。事件属性:');
          console.log('- toolType:', safeGet(nativeEvent, 'toolType'));
          console.log('- force:', safeGet(nativeEvent, 'force'));
          console.log('- pressure:', safeGet(nativeEvent, 'pressure'));
          console.log('- majorRadius:', safeGet(nativeEvent, 'majorRadius'));
          console.log('- size:', safeGet(nativeEvent, 'size'));
          console.log('- type:', safeGet(nativeEvent, 'type'));
        } catch (propError) {
          console.error('读取事件属性错误:', propError);
        }
        
        return false; // 默认为手指输入
      } catch (error) {
        console.error('触控笔检测错误:', error);
        // 确保返回false以避免意外行为
        return false; // 出错时默认为手指输入
      }
    } catch (error) {
      console.error('触控笔检测错误:', error);
      // 确保返回false以避免意外行为
      return false; // 出错时默认为手指输入
    }
  };

  // 手势处理 - 智能区分触控笔和手指输入
  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event, state) => {
      'worklet';
      try {
        if (isStylusInput(event)) {
          state.activate();
        } else {
          state.fail();
        }
      } catch (e) {
        state.fail();
      }
    })
    .onStart((event) => {
      runOnJS(setStylusActive)(true);
      'worklet';
      try {
        // 安全地调用isStylusInput函数
        let isStylusDetected = false;
        try {
          isStylusDetected = isStylusInput(event);
        } catch (stylusError) {
          console.error('触控笔检测错误:', stylusError);
          // 出错时默认为手指输入
          return false;
        }

        if (!isStylusDetected) {
          try {
            console.log('❌ 检测到手指触摸，忽略绘制，允许PDF处理滑动');
          } catch (logError) {
            // 忽略日志错误
          }
          // 手指触摸时不处理，让底层PDF处理
          return false;
        }

        // 确保所有后续操作都在try-catch块中
        try {
          console.log('✅ 检测到触控笔输入，开始绘制');
        } catch (logError) {
          // 忽略日志错误
        }
        
        // 安全地获取坐标
        let x = 0, y = 0;
        try {
          x = event.x || 0;
          y = event.y || 0;
        } catch (coordError) {
          console.error('获取坐标错误:', coordError);
          return false;
        }
        // 使用runOnJS来安全地修改ref
        const startDrawing = (x, y, color, width) => {
          currentPathRef.current = {
            path: `M ${x} ${y}`,
            color: color,
            width: width,
            points: [{ x, y }],
          };
        };
        runOnJS(startDrawing)(x, y, strokeColor, strokeWidth);
        return true;
      } catch (error) {
        console.error('手势处理错误:', error);
        // 出错时不处理手势，让事件继续传递
        return false;
      }
    })
    .onUpdate((event) => {
      'worklet';
      try {
        // 安全地检查当前路径
        if (!currentPathRef.current) {
          return;
        }

        // 安全地获取坐标
        let x, y;
        try {
          x = event.x;
          y = event.y;
        } catch (coordError) {
          console.error('获取坐标错误:', coordError);
          return;
        }

        // 使用runOnJS来安全地修改ref
        const updateDrawing = (x, y) => {
          try {
            if (currentPathRef.current) {
              // 安全地更新路径
              try {
                currentPathRef.current.path += ` L ${x} ${y}`;
                currentPathRef.current.points.push({ x, y });
                // 强制重绘
                forceUpdate();
              } catch (pathError) {
                console.error('路径更新错误:', pathError);
              }
            }
          } catch (error) {
            console.error('更新绘图错误:', error);
          }
        };
        runOnJS(updateDrawing)(x, y);
      } catch (error) {
        console.error('手势更新错误:', error);
      }
    })
    .onEnd(() => {
  runOnJS(setStylusActive)(false);
      'worklet';
      try {
        // 使用runOnJS来安全地修改ref
        const endDrawing = () => {
          try {
            if (currentPathRef.current) {
              // 安全地保存当前路径
              try {
                pathsRef.current.push(currentPathRef.current);
                currentPathRef.current = null;
                // 添加新笔画时清除撤销栈
                undoStackRef.current = [];
              } catch (saveError) {
                console.error('保存路径错误:', saveError);
              }
            }
          } catch (error) {
            console.error('结束绘图错误:', error);
          }
        };
        runOnJS(endDrawing)();
      } catch (error) {
        console.error('手势结束错误:', error);
      }
    });

  // 强制重绘 - 使用状态变量触发重绘，避免直接操作ref
  const [redrawTrigger, setRedrawTrigger] = useState(0);
  const forceUpdate = () => {
    setRedrawTrigger(prev => prev + 1);
  };

  // 清除画布
  const clearCanvas = () => {
    pathsRef.current = [];
    currentPathRef.current = null;
    undoStackRef.current = [];
    setImageUrl(null); // 清除背景图像
    forceUpdate();
    
    if (onClear) {
      onClear();
    }
  };

  // 撤销上一步
  const undoLastStroke = () => {
    if (pathsRef.current.length > 0) {
      const removedStroke = pathsRef.current.pop();
      undoStackRef.current.push(removedStroke);
      forceUpdate();
    }
  };

  // 重做上一步
  const redoLastStroke = () => {
    if (undoStackRef.current.length > 0) {
      const strokeToRedo = undoStackRef.current.pop();
      pathsRef.current.push(strokeToRedo);
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
          // 使用redrawTrigger确保重绘
          const _ = redrawTrigger;

          // 清除画布
          canvas.clear(backgroundColor || colors.card);

          // 如果有背景图像，先绘制背景图像
          if (backgroundImage) {
            try {
              // 绘制图像，适应画布大小
              canvas.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
            } catch (error) {
              console.error('绘制背景图像失败:', error);
            }
          }

          // 绘制已保存的路径和图片
          for (const pathData of pathsRef.current) {
            if (pathData.type === 'image') {
              // 绘制图片对象
              try {
                // 这里需要加载图片并绘制
                // 注意：Skia Canvas的图片绘制需要先加载图片资源
                console.log('绘制图片:', pathData.uri);
                // TODO: 实现图片绘制逻辑
                // 可能需要使用useImage hook来加载图片
              } catch (error) {
                console.error('绘制图片失败:', error);
              }
            } else {
              // 绘制路径
              const path = Path.MakeFromSVGString(pathData.path);
              if (path) {
                canvas.drawPath(path, {
                  color: pathData.color,
                  style: 'stroke',
                  strokeWidth: pathData.width,
                  strokeCap: 'round',
                  strokeJoin: 'round',
                });
              }
            }
          }

          // 绘制当前路径
          if (currentPathRef.current) {
            const path = Path.MakeFromSVGString(currentPathRef.current.path);
            if (path) {
              canvas.drawPath(path, {
                color: currentPathRef.current.color,
                style: 'stroke',
                strokeWidth: currentPathRef.current.width,
                strokeCap: 'round',
                strokeJoin: 'round',
              });
            }
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
            onPress={redoLastStroke}
            disabled={undoStackRef.current.length === 0}
          >
            <Icon
              name="redo"
              size={24}
              color={undoStackRef.current.length === 0 ? colors.textSecondary : colors.text}
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
    <View style={[styles.container, style]}>
      <GestureDetector gesture={panGesture}>
        <View
          style={[
            styles.canvasContainer,
            { pointerEvents: stylusActive ? 'auto' : 'none' } // 仅触控笔时接收事件
          ]}
        >
          {renderCanvas()}
        </View>
      </GestureDetector>

      {/* 移除工具栏和捕获按钮，在PDF查看器中使用AllInOneToolbar */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  canvasContainer: {
    flex: 1,
    pointerEvents: 'auto', // 画布容器接收触摸事件
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