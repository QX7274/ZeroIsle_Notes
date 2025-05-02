/**
 * 手写识别组件
 * 提供手写输入和识别功能
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  Share,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { offlineAIService } from '../../services/offlineAIService';
import { Canvas, Path, useCanvasRef, Circle, Group } from '@shopify/react-native-skia';
import { captureRef } from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 获取屏幕尺寸
const { width: screenWidth } = Dimensions.get('window');

// 存储键
const HANDWRITING_HISTORY_KEY = 'handwriting_history';

// 笔触类型
const STROKE_TYPES = {
  PEN: 'pen',
  MARKER: 'marker',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
};

// 颜色选项
const COLOR_OPTIONS = [
  '#000000', // 黑色
  '#0066CC', // 蓝色
  '#CC0000', // 红色
  '#009933', // 绿色
  '#9900CC', // 紫色
  '#FF6600', // 橙色
];

const HandwritingRecognizer = ({ visible, onClose, onRecognized }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [savedHandwritings, setSavedHandwritings] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeColor, setActiveColor] = useState(COLOR_OPTIONS[0]);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [activeStrokeType, setActiveStrokeType] = useState(STROKE_TYPES.PEN);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // 引用
  const canvasRef = useCanvasRef();
  const viewRef = useRef(null);

  // 加载保存的手写历史
  useEffect(() => {
    if (visible) {
      loadSavedHandwritings();

      // 动画显示模态框
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // 重置状态
      setRecognizedText('');
    }
  }, [visible]);

  // 加载保存的手写历史
  const loadSavedHandwritings = async () => {
    try {
      const historyJson = await AsyncStorage.getItem(HANDWRITING_HISTORY_KEY);
      if (historyJson) {
        setSavedHandwritings(JSON.parse(historyJson));
      }
    } catch (error) {
      console.error('加载手写历史失败:', error);
    }
  };

  // 处理触摸开始
  const handleTouchStart = (event) => {
    const { locationX, locationY } = event.nativeEvent;

    // 如果是橡皮擦，使用不同的路径格式
    if (activeStrokeType === STROKE_TYPES.ERASER) {
      // 查找与触摸点相交的路径
      const touchedPathIndex = findTouchedPath(locationX, locationY);
      if (touchedPathIndex !== -1) {
        // 移除触摸的路径
        const newPaths = [...paths];
        newPaths.splice(touchedPathIndex, 1);
        setPaths(newPaths);
      }
    } else {
      // 创建新路径
      setCurrentPath({
        path: `M ${locationX} ${locationY}`,
        color: activeColor,
        strokeWidth: getStrokeWidth(),
        strokeType: activeStrokeType,
      });
    }
  };

  // 处理触摸移动
  const handleTouchMove = (event) => {
    const { locationX, locationY } = event.nativeEvent;

    if (activeStrokeType === STROKE_TYPES.ERASER) {
      // 查找与触摸点相交的路径
      const touchedPathIndex = findTouchedPath(locationX, locationY);
      if (touchedPathIndex !== -1) {
        // 移除触摸的路径
        const newPaths = [...paths];
        newPaths.splice(touchedPathIndex, 1);
        setPaths(newPaths);
      }
    } else if (currentPath) {
      // 更新当前路径
      setCurrentPath(prev => ({
        ...prev,
        path: `${prev.path} L ${locationX} ${locationY}`,
      }));
    }
  };

  // 处理触摸结束
  const handleTouchEnd = () => {
    if (currentPath && activeStrokeType !== STROKE_TYPES.ERASER) {
      setPaths([...paths, currentPath]);
      setCurrentPath(null);
    }
  };

  // 查找与触摸点相交的路径
  const findTouchedPath = (x, y) => {
    // 简单实现：检查点是否在路径的边界框内
    // 实际应用中应该使用更精确的碰撞检测
    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      const pathPoints = path.path.split(' ').filter(p => p !== 'M' && p !== 'L');

      // 计算路径的边界框
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let j = 0; j < pathPoints.length; j += 2) {
        const px = parseFloat(pathPoints[j]);
        const py = parseFloat(pathPoints[j + 1]);
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }

      // 检查点是否在边界框内
      const eraserRadius = 10; // 橡皮擦半径
      if (x >= minX - eraserRadius && x <= maxX + eraserRadius &&
          y >= minY - eraserRadius && y <= maxY + eraserRadius) {
        return i;
      }
    }

    return -1;
  };

  // 获取笔触宽度
  const getStrokeWidth = () => {
    switch (activeStrokeType) {
      case STROKE_TYPES.MARKER:
        return strokeWidth * 2;
      case STROKE_TYPES.HIGHLIGHTER:
        return strokeWidth * 3;
      default:
        return strokeWidth;
    }
  };

  // 清除画布
  const handleClear = () => {
    setPaths([]);
    setCurrentPath(null);
    setRecognizedText('');
  };

  // 处理画布布局变化
  const handleCanvasLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvasSize({ width, height });
  };

  // 识别手写
  const handleRecognize = async () => {
    try {
      if (paths.length === 0) {
        Alert.alert('提示', '请先书写内容');
        return;
      }

      setIsRecognizing(true);

      // 捕获画布图像
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
      });

      // 模拟识别过程（实际应用中应该使用真实的识别API）
      // 这里我们假设识别成功并返回一个结果
      setTimeout(() => {
        const mockResult = "识别结果示例";
        setRecognizedText(mockResult);
        setIsRecognizing(false);
      }, 1500);

      /* 实际的识别代码（需要真实的模型）
      // 加载图像
      const image = new Image();
      image.src = uri;
      await new Promise(resolve => {
        image.onload = resolve;
      });

      // 创建画布并绘制图像
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      // 获取图像数据
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 识别手写
      const result = await offlineAIService.recognizeHandwriting(imageData);

      // 设置识别结果
      setRecognizedText(result);
      */
    } catch (error) {
      console.error('手写识别失败:', error);
      Alert.alert('错误', `手写识别失败: ${error.message}`);
      setIsRecognizing(false);
    }
  };

  // 插入识别结果
  const handleInsert = () => {
    if (!recognizedText) {
      Alert.alert('提示', '请先识别内容');
      return;
    }

    // 调用回调函数
    if (onRecognized) {
      onRecognized(recognizedText);
    }

    // 关闭模态框
    onClose();
  };

  // 保存手写笔迹
  const handleSaveHandwriting = async () => {
    try {
      if (paths.length === 0) {
        Alert.alert('提示', '请先书写内容');
        return;
      }

      // 捕获画布图像
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
      });

      // 创建新的手写记录
      const newHandwriting = {
        id: Date.now().toString(),
        imageUri: uri,
        paths: [...paths],
        timestamp: new Date().toISOString(),
      };

      // 更新历史记录
      const updatedHistory = [newHandwriting, ...savedHandwritings];

      // 限制历史记录数量（最多保存10条）
      const limitedHistory = updatedHistory.slice(0, 10);

      // 保存到本地存储
      await AsyncStorage.setItem(HANDWRITING_HISTORY_KEY, JSON.stringify(limitedHistory));

      // 更新状态
      setSavedHandwritings(limitedHistory);

      // 显示成功提示
      ToastAndroid.show('手写笔迹已保存', ToastAndroid.SHORT);
    } catch (error) {
      console.error('保存手写笔迹失败:', error);
      Alert.alert('错误', `保存失败: ${error.message}`);
    }
  };

  // 加载保存的手写笔迹
  const handleLoadHandwriting = (handwriting) => {
    // 加载路径
    setPaths(handwriting.paths);

    // 关闭历史记录模态框
    setShowHistory(false);
  };

  // 分享手写笔迹
  const handleShareHandwriting = async () => {
    try {
      if (paths.length === 0) {
        Alert.alert('提示', '请先书写内容');
        return;
      }

      // 捕获画布图像
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
      });

      // 分享图像
      await Share.share({
        url: uri,
        title: '手写笔迹',
        message: '我的手写笔迹',
      });
    } catch (error) {
      console.error('分享手写笔迹失败:', error);
      Alert.alert('错误', `分享失败: ${error.message}`);
    }
  };

  // 渲染历史记录模态框
  const renderHistoryModal = () => (
    <Modal
      visible={showHistory}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowHistory(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.historyModalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">手写历史</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {savedHandwritings.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon name="history" size={48} color={colors.textSecondary} />
              <Text
                variant="body"
                size="medium"
                color="textSecondary"
                style={styles.emptyHistoryText}
              >
                暂无保存的手写笔迹
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.historyList}>
              {savedHandwritings.map((handwriting) => (
                <TouchableOpacity
                  key={handwriting.id}
                  style={[styles.historyItem, { borderColor: colors.border }]}
                  onPress={() => handleLoadHandwriting(handwriting)}
                >
                  {handwriting.imageUri ? (
                    <View style={styles.historyImageContainer}>
                      <Image
                        source={{ uri: handwriting.imageUri }}
                        style={styles.historyImage}
                        resizeMode="contain"
                      />
                    </View>
                  ) : (
                    <View style={[styles.historyImagePlaceholder, { backgroundColor: colors.background }]}>
                      <Icon name="gesture" size={24} color={colors.textSecondary} />
                    </View>
                  )}

                  <View style={styles.historyItemInfo}>
                    <Text variant="body" size="small" color="textSecondary">
                      {new Date(handwriting.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // 渲染工具选择器
  const renderToolSelector = () => (
    <View style={styles.toolSelector}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[
            styles.toolOption,
            activeStrokeType === STROKE_TYPES.PEN && { borderColor: colors.primary, borderWidth: 2 }
          ]}
          onPress={() => setActiveStrokeType(STROKE_TYPES.PEN)}
        >
          <Icon name="edit" size={24} color={activeStrokeType === STROKE_TYPES.PEN ? colors.primary : colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toolOption,
            activeStrokeType === STROKE_TYPES.MARKER && { borderColor: colors.primary, borderWidth: 2 }
          ]}
          onPress={() => setActiveStrokeType(STROKE_TYPES.MARKER)}
        >
          <Icon name="brush" size={24} color={activeStrokeType === STROKE_TYPES.MARKER ? colors.primary : colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toolOption,
            activeStrokeType === STROKE_TYPES.HIGHLIGHTER && { borderColor: colors.primary, borderWidth: 2 }
          ]}
          onPress={() => setActiveStrokeType(STROKE_TYPES.HIGHLIGHTER)}
        >
          <Icon name="format-color-fill" size={24} color={activeStrokeType === STROKE_TYPES.HIGHLIGHTER ? colors.primary : colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toolOption,
            activeStrokeType === STROKE_TYPES.ERASER && { borderColor: colors.primary, borderWidth: 2 }
          ]}
          onPress={() => setActiveStrokeType(STROKE_TYPES.ERASER)}
        >
          <Icon name="auto-fix-high" size={24} color={activeStrokeType === STROKE_TYPES.ERASER ? colors.primary : colors.text} />
        </TouchableOpacity>

        <View style={styles.toolDivider} />

        {COLOR_OPTIONS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              activeColor === color && { borderColor: colors.primary, borderWidth: 2 }
            ]}
            onPress={() => setActiveColor(color)}
          />
        ))}

        <View style={styles.toolDivider} />

        <TouchableOpacity
          style={styles.toolOption}
          onPress={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
        >
          <Icon name="remove" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={[styles.strokeWidthIndicator, { width: strokeWidth * 4, backgroundColor: activeColor }]} />

        <TouchableOpacity
          style={styles.toolOption}
          onPress={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}
        >
          <Icon name="add" size={24} color={colors.text} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: 'rgba(0,0,0,0.5)',
            opacity: modalAnimation,
            transform: [
              {
                translateY: modalAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0]
                })
              }
            ]
          }
        ]}
      >
        <View style={[styles.content, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text variant="heading" level="h6">手写识别</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowHistory(true)}
              >
                <Icon name="history" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleShareHandwriting}
              >
                <Icon name="share" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={onClose}
              >
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {renderToolSelector()}

          <View
            ref={viewRef}
            style={[styles.canvasContainer, { backgroundColor: colors.background }]}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onLayout={handleCanvasLayout}
          >
            <Canvas style={styles.canvas} ref={canvasRef}>
              {paths.map((path, index) => (
                <Path
                  key={index}
                  path={path.path}
                  strokeWidth={path.strokeWidth}
                  style="stroke"
                  color={path.color}
                  strokeJoin="round"
                  strokeCap="round"
                  opacity={path.strokeType === STROKE_TYPES.HIGHLIGHTER ? 0.5 : 1}
                />
              ))}
              {currentPath && (
                <Path
                  path={currentPath.path}
                  strokeWidth={currentPath.strokeWidth}
                  style="stroke"
                  color={currentPath.color}
                  strokeJoin="round"
                  strokeCap="round"
                  opacity={currentPath.strokeType === STROKE_TYPES.HIGHLIGHTER ? 0.5 : 1}
                />
              )}
              {activeStrokeType === STROKE_TYPES.ERASER && (
                <Circle
                  cx={canvasSize.width / 2}
                  cy={canvasSize.height / 2}
                  r={10}
                  color={colors.primary}
                  style="stroke"
                  strokeWidth={1}
                />
              )}
            </Canvas>
          </View>

          {recognizedText ? (
            <View style={[styles.resultContainer, { backgroundColor: colors.background }]}>
              <Text variant="heading" level="h5" style={styles.resultText}>
                {recognizedText}
              </Text>
            </View>
          ) : null}

          <View style={styles.toolbar}>
            <TouchableOpacity
              style={[styles.toolbarButton, { backgroundColor: colors.error }]}
              onPress={handleClear}
            >
              <Icon name="delete" size={20} color="#fff" />
              <Text
                variant="body"
                size="small"
                color="white"
                style={styles.toolbarButtonText}
              >
                清除
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarButton, { backgroundColor: colors.secondary }]}
              onPress={handleSaveHandwriting}
            >
              <Icon name="save" size={20} color="#fff" />
              <Text
                variant="body"
                size="small"
                color="white"
                style={styles.toolbarButtonText}
              >
                保存
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarButton, { backgroundColor: colors.primary }]}
              onPress={handleRecognize}
              disabled={isRecognizing}
            >
              <Icon name="psychology" size={20} color="#fff" />
              <Text
                variant="body"
                size="small"
                color="white"
                style={styles.toolbarButtonText}
              >
                识别
              </Text>
            </TouchableOpacity>

            {recognizedText ? (
              <TouchableOpacity
                style={[styles.toolbarButton, { backgroundColor: colors.success }]}
                onPress={handleInsert}
              >
                <Icon name="check" size={20} color="#fff" />
                <Text
                  variant="body"
                  size="small"
                  color="white"
                  style={styles.toolbarButtonText}
                >
                  插入
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isRecognizing && (
            <View style={[styles.loaderContainer, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
              <View style={[styles.loaderContent, { backgroundColor: colors.card }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  variant="body"
                  size="medium"
                  color="text"
                  style={styles.loaderText}
                >
                  正在识别...
                </Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      {renderHistoryModal()}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '95%',
    maxWidth: 600,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 10,
    marginLeft: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolSelector: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  toolOption: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.8)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  toolDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 12,
  },
  strokeWidthIndicator: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  canvasContainer: {
    height: 350,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  canvas: {
    flex: 1,
  },
  resultContainer: {
    margin: 20,
    padding: 20,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(0,0,0,0.02)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  resultText: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 36,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  toolbarButtonText: {
    marginLeft: 10,
    fontWeight: 'bold',
    fontSize: 15,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
  },
  loaderContent: {
    padding: 24,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loaderText: {
    marginLeft: 20,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  historyModalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyList: {
    maxHeight: 450,
  },
  historyItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  historyImageContainer: {
    width: 90,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyImage: {
    width: '100%',
    height: '100%',
  },
  historyImagePlaceholder: {
    width: 90,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  historyItemInfo: {
    flex: 1,
    marginLeft: 16,
  },
  emptyHistory: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
});

export default HandwritingRecognizer;
