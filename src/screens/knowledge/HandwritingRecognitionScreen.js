/**
 * 手写识别屏幕
 * 用于识别用户手写输入并转换为文本
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Canvas, Path, useCanvasRef } from '@shopify/react-native-skia';
import NetInfo from '@react-native-community/netinfo';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

// 导入常量和工具函数
import { useTheme } from '../../context/ThemeContext';
import { dimensions } from '../../utils/constants/dimensions';
import { NOTES_ENDPOINTS } from '../../utils/constants/apiEndpoints';

// 导入组件
import { Button, Loading, Toast } from '../../components/common';

// 屏幕尺寸
const { width, height } = Dimensions.get('window');

/**
 * 手写识别屏幕组件
 */
const HandwritingRecognitionScreen = ({ navigation, route, styles, colors }) => {
  const dispatch = useDispatch();
  const canvasRef = useCanvasRef();

  // 状态
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [strokeColor, setStrokeColor] = useState(colors.primary);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokeOptions, setShowStrokeOptions] = useState(false);

  // 从路由参数获取回调函数和笔记ID
  const { onRecognized, noteId } = route.params || {};

  // 请求相机权限
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: "相机权限",
            message: "需要相机权限来拍摄手写内容",
            buttonNeutral: "稍后询问",
            buttonNegative: "取消",
            buttonPositive: "确定"
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS会自动请求权限
  };

  // 手势处理
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (event) => {
      const newPath = {
        id: Date.now().toString(),
        color: strokeColor,
        width: strokeWidth,
        points: [{ x: event.x, y: event.y }],
      };
      runOnJS(setCurrentPath)(newPath);
    },
    onActive: (event) => {
      if (currentPath) {
        runOnJS(setCurrentPath)({
          ...currentPath,
          points: [...currentPath.points, { x: event.x, y: event.y }],
        });
      }
    },
    onEnd: () => {
      if (currentPath) {
        runOnJS(setPaths)([...paths, currentPath]);
        runOnJS(setCurrentPath)(null);
      }
    },
  });

  // 将路径转换为SVG路径字符串
  const pathToSvg = (path) => {
    if (!path || path.points.length === 0) return '';

    const points = path.points;
    let svgPath = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      svgPath += ` L ${points[i].x} ${points[i].y}`;
    }

    return svgPath;
  };

  // 清除画布
  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath(null);
    setRecognizedText('');
  };

  // 撤销上一步
  const undoLastPath = () => {
    if (paths.length > 0) {
      const newPaths = [...paths];
      newPaths.pop();
      setPaths(newPaths);
    }
  };

  // 识别手写内容
  const recognizeHandwriting = async () => {
    if (paths.length === 0) {
      setToastMessage('请先书写或绘制内容');
      return;
    }

    try {
      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setToastMessage('无网络连接，无法进行手写识别');
        return;
      }

      setIsRecognizing(true);

      // 将画布转换为图像
      const imageData = canvasRef.current?.makeImageSnapshot();
      if (!imageData) {
        throw new Error('无法获取画布图像');
      }

      // 将图像转换为base64
      const base64Image = imageData.encodeToBase64();

      // 调用手写识别API
      const response = await fetch(NOTES_ENDPOINTS.HANDWRITING_RECOGNITION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          noteId: noteId,
        }),
      });

      if (!response.ok) {
        throw new Error(`识别失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.text) {
        setRecognizedText(result.text);
        setToastMessage('识别成功');
      } else {
        throw new Error(result.message || '识别失败');
      }
    } catch (error) {
      console.error('手写识别错误:', error);
      setToastMessage(`识别失败: ${error.message || '请稍后重试'}`);
    } finally {
      setIsRecognizing(false);
    }
  };

  // 从相册选择图片
  const selectImageFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert('错误', '选择图片失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        processSelectedImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('错误', '选择图片失败: ' + error.message);
    }
  };

  // 使用相机拍照
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setToastMessage('需要相机权限才能拍照');
      return;
    }

    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert('错误', '拍照失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        processSelectedImage(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('错误', '拍照失败: ' + error.message);
    }
  };

  // 处理选择的图片
  const processSelectedImage = async (asset) => {
    try {
      setIsRecognizing(true);

      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        setToastMessage('无网络连接，无法进行手写识别');
        setIsRecognizing(false);
        return;
      }

      // 调用手写识别API
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `image_${Date.now()}.jpg`,
      });

      if (noteId) {
        formData.append('noteId', noteId);
      }

      const response = await fetch(NOTES_ENDPOINTS.HANDWRITING_RECOGNITION, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`识别失败: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.text) {
        setRecognizedText(result.text);
        setToastMessage('识别成功');
      } else {
        throw new Error(result.message || '识别失败');
      }
    } catch (error) {
      console.error('图片识别错误:', error);
      setToastMessage(`识别失败: ${error.message || '请稍后重试'}`);
    } finally {
      setIsRecognizing(false);
    }
  };

  // 应用识别结果
  const applyRecognizedText = () => {
    if (!recognizedText) {
      setToastMessage('没有可应用的识别结果');
      return;
    }

    if (onRecognized) {
      onRecognized(recognizedText);
      navigation.goBack();
    } else {
      // 如果没有提供回调，则复制到剪贴板或导航到笔记编辑页面
      Alert.alert(
        '识别结果',
        '是否创建新笔记？',
        [
          {
            text: '取消',
            style: 'cancel',
          },
          {
            text: '创建新笔记',
            onPress: () => {
              navigation.navigate('NoteEdit', { initialContent: recognizedText });
            },
          },
        ],
      );
    }
  };

  // 渲染颜色选择器
  const renderColorPicker = () => (
    <View style={styles.colorPickerContainer}>
      {[
        colors.primary,
        colors.accent,
        colors.success,
        colors.warning,
        colors.error,
        colors.text,
      ].map((color) => (
        <TouchableOpacity
          key={color}
          style={[styles.colorOption, { backgroundColor: color }, color === strokeColor && styles.selectedColor]}
          onPress={() => {
            setStrokeColor(color);
            setShowColorPicker(false);
          }}
        />
      ))}
    </View>
  );

  // 渲染笔画宽度选择器
  const renderStrokeOptions = () => (
    <View style={styles.strokeOptionsContainer}>
      {[1, 2, 3, 5, 8].map((width) => (
        <TouchableOpacity
          key={width}
          style={[styles.strokeOption, width === strokeWidth && styles.selectedStroke]}
          onPress={() => {
            setStrokeWidth(width);
            setShowStrokeOptions(false);
          }}
        >
          <View style={[styles.strokeSample, { height: width, backgroundColor: strokeColor }]} />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 顶部工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={clearCanvas}>
          <Icon name="delete" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>清除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={undoLastPath}
          disabled={paths.length === 0}
        >
          <Icon
            name="undo"
            size={24}
            color={paths.length > 0 ? colors.text : colors.textLight}
          />
          <Text
            style={[styles.toolbarButtonText, paths.length === 0 && styles.disabledText]}
          >
            撤销
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowColorPicker(!showColorPicker)}
        >
          <View style={[styles.colorIndicator, { backgroundColor: strokeColor }]} />
          <Text style={styles.toolbarButtonText}>颜色</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowStrokeOptions(!showStrokeOptions)}
        >
          <Icon name="line-weight" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>粗细</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={takePhoto}>
          <Icon name="camera-alt" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>拍照</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolbarButton} onPress={selectImageFromGallery}>
          <Icon name="photo-library" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>相册</Text>
        </TouchableOpacity>
      </View>

      {/* 颜色选择器 */}
      {showColorPicker && renderColorPicker()}

      {/* 笔画宽度选择器 */}
      {showStrokeOptions && renderStrokeOptions()}

      {/* 手写区域 */}
      <View style={styles.canvasContainer}>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={styles.canvas}>
            <Canvas style={styles.canvas} ref={canvasRef}>
              {/* 渲染已完成的路径 */}
              {paths.map((path) => (
                <Path
                  key={path.id}
                  path={pathToSvg(path)}
                  strokeWidth={path.width}
                  color={path.color}
                  style="stroke"
                />
              ))}

              {/* 渲染当前绘制中的路径 */}
              {currentPath && (
                <Path
                  path={pathToSvg(currentPath)}
                  strokeWidth={currentPath.width}
                  color={currentPath.color}
                  style="stroke"
                />
              )}
            </Canvas>
          </Animated.View>
        </PanGestureHandler>
      </View>

      {/* 识别结果区域 */}
      <View style={styles.resultContainer}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>识别结果</Text>
          <TouchableOpacity
            style={styles.recognizeButton}
            onPress={recognizeHandwriting}
            disabled={isRecognizing || paths.length === 0}
          >
            <Text style={styles.recognizeButtonText}>
              {isRecognizing ? '识别中...' : '识别'}
            </Text>
          </TouchableOpacity>
        </View>

        {isRecognizing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>正在识别...</Text>
          </View>
        ) : (
          <ScrollView style={styles.resultTextContainer}>
            <Text style={styles.resultText}>
              {recognizedText || '识别结果将显示在这里'}
            </Text>
          </ScrollView>
        )}

        <Button
          title="应用识别结果"
          onPress={applyRecognizedText}
          disabled={!recognizedText || isRecognizing}
          style={styles.applyButton}
        />
      </View>

      {/* Toast消息 */}
      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage('')}
          type={toastMessage.includes('失败') ? 'error' : 'success'}
        />
      ) : null}
    </View>
  );
};

// 创建样式表，使用闭包捕获colors变量
const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolbarButton: {
    alignItems: 'center',
    padding: 6,
  },
  toolbarButtonText: {
    fontSize: 12,
    marginTop: 4,
    color: colors.text,
  },
  disabledText: {
    color: colors.textLight,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: colors.text,
  },
  strokeOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  strokeOption: {
    width: 50,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedStroke: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.backgroundLight,
  },
  strokeSample: {
    width: 30,
    borderRadius: 2,
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    margin: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  resultContainer: {
    height: 200,
    padding: 10,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  recognizeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  recognizeButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.text,
    fontSize: 14,
  },
  resultTextContainer: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  resultText: {
    fontSize: 16,
    color: colors.text,
  },
  applyButton: {
    marginTop: 10,
  },
});

const HandwritingRecognitionScreenWrapper = (props) => {
  // 获取主题颜色
  const { colors } = useTheme();

  // 创建样式
  const styles = createStyles(colors);

  // 渲染组件，传递样式和颜色
  return <HandwritingRecognitionScreen {...props} styles={styles} colors={colors} />;
};

export default HandwritingRecognitionScreenWrapper;