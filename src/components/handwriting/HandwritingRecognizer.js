/**
 * 手写识别组件
 * 提供手写输入和识别功能
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import { Button, Toast } from '../common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Canvas } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import handwritingApi from '../../services/api/handwritingApi';
import { offlineStorageService } from '../../services/offlineStorage';
import { captureRef } from 'react-native-view-shot';
import { STORAGE_KEYS } from '../../utils/constants/config';

/**
 * 手写识别组件
 * @param {Function} onRecognized - 识别结果回调
 * @param {Function} onCancel - 取消回调
 * @param {string} language - 识别语言
 * @param {string} model - 识别模型
 * @param {boolean} recognizeShape - 是否识别形状
 * @param {Object} style - 自定义样式
 */
const HandwritingRecognizer = ({
  onRecognized,
  onCancel,
  language = 'zh-CN',
  model = 'default',
  recognizeShape = false,
  style,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 引用
  const canvasRef = useRef(null);
  const pathsRef = useRef([]);
  const currentPathRef = useRef(null);
  
  // 状态
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [isOffline, setIsOffline] = useState(!offlineStorageService.getStatus().isOnline);
  const [strokeColor, setStrokeColor] = useState(colors.primary);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [canvasWidth, setCanvasWidth] = useState(dimensions.width - 32);
  const [canvasHeight, setCanvasHeight] = useState(300);
  
  // 监听离线状态变化
  useEffect(() => {
    const unsubscribe = offlineStorageService.addListener(event => {
      if (event.type === 'connectionChange') {
        setIsOffline(!event.isOnline);
      }
    });
    
    return () => unsubscribe();
  }, []);
  
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
  
  // 显示Toast消息
  const showToast = (message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);
    
    // 自动关闭
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };
  
  // 请求存储权限（仅Android）
  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: '存储权限',
          message: '应用需要访问您的存储以保存手写图像',
          buttonNeutral: '稍后再说',
          buttonNegative: '取消',
          buttonPositive: '确定',
        }
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('请求存储权限失败:', error);
      return false;
    }
  };
  
  // 识别手写内容
  const recognizeHandwriting = async () => {
    // 检查是否有内容
    if (pathsRef.current.length === 0) {
      showToast('请先书写内容', 'warning');
      return;
    }
    
    // 检查网络状态
    if (isOffline) {
      showToast('离线模式下无法进行手写识别', 'error');
      return;
    }
    
    // 请求存储权限
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      showToast('无法获取存储权限', 'error');
      return;
    }
    
    setIsRecognizing(true);
    
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
      
      reader.onloadend = async () => {
        const base64data = reader.result;
        // 移除前缀 "data:image/png;base64,"
        const imageData = base64data.split(',')[1];
        
        // 调用API
        let result;
        if (recognizeShape) {
          result = await handwritingApi.recognizeShape({
            image: imageData,
          });
        } else {
          result = await handwritingApi.recognizeHandwriting({
            image: imageData,
            language,
            model,
          });
        }
        
        if (result.success) {
          // 调用回调
          if (onRecognized) {
            onRecognized(recognizeShape ? result.shapes : result.text);
          }
          
          // 保存到历史记录
          await saveToHistory(imageData, recognizeShape ? result.shapes : result.text);
        } else {
          showToast(result.message || '识别失败', 'error');
        }
      };
      
      reader.onerror = (error) => {
        console.error('读取图像失败:', error);
        showToast('读取图像失败', 'error');
        setIsRecognizing(false);
      };
    } catch (error) {
      console.error('识别手写内容失败:', error);
      showToast('识别失败: ' + error.message, 'error');
      setIsRecognizing(false);
    }
  };
  
  // 保存到历史记录
  const saveToHistory = async (imageData, recognizedText) => {
    try {
      // 获取历史记录
      const history = await offlineStorageService.getCachedData('handwriting_history') || [];
      
      // 添加新记录
      const newRecord = {
        id: Date.now().toString(),
        image: imageData,
        text: recognizedText,
        timestamp: new Date().toISOString(),
        language,
        model,
      };
      
      // 更新历史记录
      const updatedHistory = [newRecord, ...history].slice(0, 50); // 只保留最近50条
      await offlineStorageService.cacheData('handwriting_history', updatedHistory);
      
      setIsRecognizing(false);
    } catch (error) {
      console.error('保存历史记录失败:', error);
      setIsRecognizing(false);
    }
  };
  
  // 渲染画布
  const renderCanvas = () => {
    return (
      <Canvas
        ref={canvasRef}
        style={[
          styles.canvas,
          { backgroundColor: colors.card, width: canvasWidth, height: canvasHeight }
        ]}
        onDraw={(canvas) => {
          // 清除画布
          canvas.clear(colors.card);
          
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
      {/* 离线指示器 */}
      {isOffline && (
        <View style={[styles.offlineBar, { backgroundColor: colors.warning + '20' }]}>
          <Icon name="cloud-off" size={16} color={colors.warning} />
          <Text
            variant="caption"
            color="warning"
            style={styles.offlineText}
          >
            离线模式下无法进行手写识别
          </Text>
        </View>
      )}
      
      <Text
        variant="body"
        size="medium"
        style={styles.title}
      >
        {recognizeShape ? '手写形状识别' : '手写文字识别'}
      </Text>
      
      <GestureDetector gesture={panGesture}>
        {renderCanvas()}
      </GestureDetector>
      
      {renderToolbar()}
      
      <View style={styles.actions}>
        <Button
          title="取消"
          type="outline"
          onPress={onCancel}
          style={styles.actionButton}
        />
        
        <Button
          title="识别"
          onPress={recognizeHandwriting}
          style={styles.actionButton}
          disabled={isOffline || pathsRef.current.length === 0 || isRecognizing}
          loading={isRecognizing}
        />
      </View>
      
      {/* Toast消息 */}
      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage('')}
          type={toastType}
        />
      ) : null}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    justifyContent: 'center',
    marginBottom: 8,
  },
  offlineText: {
    marginLeft: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  canvas: {
    alignSelf: 'center',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  toolSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e0e0e0',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  widthIndicator: {
    backgroundColor: '#000',
  },
  selectedOption: {
    borderWidth: 2,
    borderColor: '#000',
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  actionButton: {
    minWidth: 120,
    marginHorizontal: 8,
  },
});

export default HandwritingRecognizer;
