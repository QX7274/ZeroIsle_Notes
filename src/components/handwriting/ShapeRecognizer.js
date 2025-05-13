/**
 * 形状识别组件
 * 提供手绘形状识别功能
 */
import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '../common/Typography';
import { Button, Toast } from '../common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import HandwritingCanvas from './HandwritingCanvas';
import handwritingApi from '../../services/api/handwritingApi';
import { offlineStorageService } from '../../services/offline';

/**
 * 形状识别组件
 * @param {Function} onRecognized - 识别结果回调
 * @param {Function} onCancel - 取消回调
 * @param {Object} style - 自定义样式
 */
const ShapeRecognizer = ({
  onRecognized,
  onCancel,
  style,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 引用
  const canvasRef = useRef(null);

  // 状态
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [isOffline, setIsOffline] = useState(!offlineStorageService.getStatus().isOnline);
  const [recognizedShapes, setRecognizedShapes] = useState([]);

  // 显示Toast消息
  const showToast = (message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);

    // 自动关闭
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // 处理画布捕获
  const handleCapture = async (imageData, status, errorMessage) => {
    if (status === 'empty') {
      showToast('请先绘制形状', 'warning');
      return;
    }

    if (status === 'error') {
      showToast(`捕获失败: ${errorMessage || '未知错误'}`, 'error');
      return;
    }

    // 开始识别
    recognizeShape(imageData);
  };

  // 识别形状
  const recognizeShape = async (imageData) => {
    setIsRecognizing(true);

    try {
      // 检查网络状态，决定使用在线还是离线识别
      const networkStatus = offlineStorageService.getStatus();

      let result;
      if (!networkStatus.isOnline) {
        // 离线模式 - 使用离线AI服务
        try {
          // 导入离线AI服务
          const { offlineAIService } = require('../../services/offlineAIService');

          // 检查离线模型是否已加载
          const modelStatus = await offlineAIService.getModelStatus('SHAPE_RECOGNITION');

          if (!modelStatus.loaded) {
            // 如果模型未加载，尝试加载
            showToast('正在加载离线识别模型...', 'info');

            const loadResult = await offlineAIService.loadModel('SHAPE_RECOGNITION');

            if (!loadResult.success) {
              throw new Error('离线模型加载失败: ' + loadResult.error);
            }
          }

          // 执行离线识别
          result = await offlineAIService.recognizeShape(imageData);

          // 添加离线标记
          result.offline = true;
        } catch (error) {
          console.error('离线识别失败:', error);
          showToast('离线识别失败: ' + error.message, 'error');
          setIsRecognizing(false);
          return;
        }
      } else {
        // 在线模式 - 调用API
        result = await handwritingApi.recognizeShape({
          image_base64: imageData,
          save_result: true
        });
      }

      if (result.success || result.shapes) {
        // 提取识别结果
        const shapes = result.shapes || [];
        setRecognizedShapes(shapes);

        // 显示成功消息
        showToast(
          result.offline
            ? '离线识别成功'
            : '识别成功',
          'success'
        );

        // 调用回调
        if (onRecognized) {
          onRecognized(shapes, result);
        }

        // 保存到历史记录
        await saveToHistory(
          imageData,
          shapes,
          result.confidence || 0,
          result.offline
        );
      } else {
        showToast(result.message || result.error || '识别失败', 'error');
      }
    } catch (error) {
      console.error('识别形状失败:', error);
      showToast('识别失败: ' + error.message, 'error');
    } finally {
      setIsRecognizing(false);
    }
  };

  // 保存到历史记录
  const saveToHistory = async (imageData, shapes, confidence = 0, isOfflineResult = false) => {
    try {
      // 获取历史记录
      const history = await offlineStorageService.getCachedData('handwriting_history') || [];

      // 添加新记录
      const newRecord = {
        id: Date.now().toString(),
        image: imageData,
        text: shapes.map(s => s.type).join(', '),
        shapes: shapes,
        confidence: confidence,
        timestamp: new Date().toISOString(),
        offline: isOfflineResult,
        type: 'shape',
      };

      // 更新历史记录
      const updatedHistory = [newRecord, ...history].slice(0, 100); // 保留最近100条
      await offlineStorageService.cacheData('handwriting_history', updatedHistory);

      // 如果是离线结果，添加到待同步队列
      if (isOfflineResult) {
        await offlineStorageService.addPendingOperation({
          type: 'sync_shape_recognition',
          data: {
            image: imageData,
            shapes: shapes,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  };

  // 清除画布
  const handleClear = () => {
    setRecognizedShapes([]);
  };

  // 取消
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // 渲染识别结果
  const renderResults = () => {
    if (recognizedShapes.length === 0) return null;

    return (
      <View style={styles.resultsContainer}>
        <Text variant="subtitle1" style={styles.resultsTitle}>
          识别结果
        </Text>

        <View style={styles.shapesList}>
          {recognizedShapes.map((shape, index) => (
            <View
              key={index}
              style={[
                styles.shapeItem,
                { backgroundColor: colors.card }
              ]}
            >
              <Icon
                name={getShapeIcon(shape.type)}
                size={24}
                color={colors.primary}
              />
              <Text variant="body2" style={styles.shapeText}>
                {getShapeName(shape.type)}
              </Text>
              <Text variant="caption" color="textSecondary">
                置信度: {Math.round(shape.confidence * 100)}%
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // 获取形状图标
  const getShapeIcon = (shapeType) => {
    switch (shapeType.toLowerCase()) {
      case 'circle':
        return 'circle';
      case 'rectangle':
        return 'crop-square';
      case 'triangle':
        return 'change-history';
      case 'line':
        return 'remove';
      case 'arrow':
        return 'arrow-forward';
      case 'star':
        return 'star';
      case 'heart':
        return 'favorite';
      default:
        return 'gesture';
    }
  };

  // 获取形状名称
  const getShapeName = (shapeType) => {
    switch (shapeType.toLowerCase()) {
      case 'circle':
        return '圆形';
      case 'rectangle':
        return '矩形';
      case 'triangle':
        return '三角形';
      case 'line':
        return '直线';
      case 'arrow':
        return '箭头';
      case 'star':
        return '星形';
      case 'heart':
        return '心形';
      default:
        return shapeType;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* 离线指示器 */}
      {isOffline && (
        <View style={[styles.offlineBar, { backgroundColor: colors.warning + '20' }]}>
          <Icon name="cloud-off" size={16} color={colors.warning} />
          <Text
            variant="caption"
            color="warning"
            style={styles.offlineText}
          >
            离线模式下无法进行形状识别
          </Text>
        </View>
      )}

      {/* 画布 */}
      <HandwritingCanvas
        ref={canvasRef}
        onCapture={handleCapture}
        onClear={handleClear}
        strokeColor={colors.primary}
        strokeWidth={3}
        height={300}
        showToolbar={true}
      />

      {/* 识别结果 */}
      {renderResults()}

      {/* 操作按钮 */}
      <View style={styles.actionButtons}>
        <Button
          title="取消"
          type="outline"
          onPress={handleCancel}
          style={styles.cancelButton}
        />

        <Button
          title="识别形状"
          icon="gesture"
          onPress={() => canvasRef.current?.captureCanvas()}
          loading={isRecognizing}
          disabled={isRecognizing || isOffline}
          style={styles.recognizeButton}
        />
      </View>

      {/* Toast消息 */}
      {toastMessage ? (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage('')}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  offlineText: {
    marginLeft: 8,
  },
  resultsContainer: {
    marginTop: 16,
  },
  resultsTitle: {
    marginBottom: 8,
  },
  shapesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  shapeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  shapeText: {
    marginHorizontal: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  recognizeButton: {
    flex: 2,
  },
});

export default ShapeRecognizer;
