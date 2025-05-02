import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Canvas from '../components/Canvas';
import CanvasToolbar from '../components/CanvasToolbar';
import StyleEditor from '../components/StyleEditor';
import LayerManager from '../components/LayerManager';
import { offlineStorageService } from '../services/offlineStorage';
import { analyticsService } from '../services/analytics';
import canvasApi from '../services/api/canvasApi';
import Icon from 'react-native-vector-icons/Ionicons';
import { pick, types } from '@react-native-documents/picker';
import DrawingToolbar from '../components/DrawingToolbar';
import DrawingCanvas from '../components/DrawingCanvas';

const CanvasScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [canvasTitle, setCanvasTitle] = useState('新画布');
  const [canvasId, setCanvasId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDrawingTools, setShowDrawingTools] = useState(false);

  // 初始化绘图画布
  const drawingCanvas = DrawingCanvas({
    width: '100%',
    height: 300,
    backgroundColor: 'transparent',
    onStrokeEnd: (path) => {
      // 可以将绘图路径保存到画布元素中
      console.log('绘图路径:', path);
    },
    onScreenshotTaken: (uri) => {
      // 处理截图
      Alert.alert('截图已保存', '截图已保存到画布中');
    },
  });

  useEffect(() => {
    analyticsService.trackScreenView('canvas');

    // 检查是否有传入的画布ID
    if (route.params?.canvasId) {
      loadCanvasById(route.params.canvasId);
    } else {
      loadLastCanvas();
    }
  }, [route.params]);

  const loadCanvasById = async (id) => {
    try {
      setIsLoading(true);
      const response = await canvasApi.getCanvasById(id);

      if (response.success && response.data) {
        setCanvasId(response.data.id);
        setCanvasTitle(response.data.title);
        setElements(response.data.elements || []);
        setHistory([response.data.elements || []]);
        setFuture([]);
      }
    } catch (error) {
      console.error('加载画布失败:', error);
      analyticsService.trackError(error, { action: 'load_canvas_by_id' });
      Alert.alert('错误', '加载画布失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLastCanvas = async () => {
    try {
      setIsLoading(true);
      // 尝试从本地存储加载最后编辑的画布
      const savedCanvas = await offlineStorageService.getLastCanvas();
      if (savedCanvas) {
        setCanvasId(savedCanvas.id);
        setCanvasTitle(savedCanvas.title || '新画布');
        setElements(savedCanvas.elements || []);
        setHistory([savedCanvas.elements || []]);
      } else {
        // 如果没有本地存储的画布，创建一个新的
        createNewCanvas();
      }
    } catch (error) {
      console.error('加载画布失败:', error);
      analyticsService.trackError(error, { action: 'load_last_canvas' });
      // 创建一个新的画布
      createNewCanvas();
    } finally {
      setIsLoading(false);
    }
  };

  const createNewCanvas = () => {
    const newId = Date.now().toString();
    setCanvasId(newId);
    setCanvasTitle('新画布');
    setElements([]);
    setHistory([[]]);
    setFuture([]);
  };

  const handleContentChange = useCallback((newElements) => {
    setElements(newElements);
    setHistory(prev => [...prev, newElements]);
    setFuture([]);
    analyticsService.trackCanvasAction('update', { elementCount: newElements.length });
  }, []);

  const handleStyleChange = useCallback((style) => {
    if (selectedElement) {
      const newElements = elements.map(element => {
        if (element.id === selectedElement.id) {
          return { ...element, ...style };
        }
        return element;
      });
      handleContentChange(newElements);
      analyticsService.trackCanvasAction('style_change', {
        elementId: selectedElement.id,
        elementType: selectedElement.type,
        style,
      });
    }
  }, [selectedElement, elements, handleContentChange]);

  const handleElementSelect = useCallback((element) => {
    setSelectedElement(element);
    analyticsService.trackCanvasAction('select_element', {
      elementId: element.id,
      elementType: element.type,
    });
  }, []);

  const handleLayerOrderChange = useCallback((newElements) => {
    handleContentChange(newElements);
    analyticsService.trackCanvasAction('layer_order_change', {
      elementCount: newElements.length,
    });
  }, [handleContentChange]);

  const handleUndo = useCallback(() => {
    if (history.length > 1) {
      const newHistory = [...history];
      const current = newHistory.pop();
      setFuture(prev => [current, ...prev]);
      setHistory(newHistory);
      setElements(newHistory[newHistory.length - 1]);
      analyticsService.trackCanvasAction('undo');
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    if (future.length > 0) {
      const newFuture = [...future];
      const next = newFuture.shift();
      setHistory(prev => [...prev, next]);
      setFuture(newFuture);
      setElements(next);
      analyticsService.trackCanvasAction('redo');
    }
  }, [future]);

  const handleSave = async () => {
    try {
      setIsLoading(true);

      // 保存到本地存储
      const canvasData = {
        id: canvasId,
        title: canvasTitle,
        elements,
        updatedAt: new Date().toISOString(),
      };

      await offlineStorageService.saveCanvas(canvasData);

      // 保存到服务器
      if (canvasId) {
        const response = await canvasApi.updateCanvas(canvasId, canvasData);
        if (!response.success) {
          throw new Error(response.message || '保存到服务器失败');
        }
      } else {
        const response = await canvasApi.createCanvas(canvasData);
        if (response.success && response.data) {
          setCanvasId(response.data.id);
        } else {
          throw new Error(response.message || '创建画布失败');
        }
      }

      analyticsService.trackCanvasAction('save', { elementCount: elements.length });
      Alert.alert('成功', '画布已保存');
    } catch (error) {
      console.error('保存画布失败:', error);
      analyticsService.trackError(error, { action: 'save_canvas' });
      Alert.alert('提示', '已保存到本地，但同步到服务器失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsLoading(true);

      if (!canvasId) {
        // 如果画布还没有保存，先保存
        await handleSave();
      }

      // 导出画布
      const response = await canvasApi.exportCanvas(canvasId, 'json');

      if (response.success) {
        Alert.alert('成功', '画布已导出');
        analyticsService.trackCanvasAction('export', { canvasId, format: 'json' });
      } else {
        throw new Error(response.message || '导出画布失败');
      }
    } catch (error) {
      console.error('导出画布失败:', error);
      analyticsService.trackError(error, { action: 'export_canvas' });
      Alert.alert('错误', '导出画布失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      // 选择文件
      const results = await pick({
        type: [types.json],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        setIsLoading(true);
        const file = results[0];

        // 创建表单数据
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: 'application/json',
          name: file.name || 'canvas.json',
        });

        // 调用导入API
        const response = await canvasApi.importCanvas(formData);

        if (response.success && response.data) {
          // 导入成功，加载新画布
          loadCanvasById(response.data.canvas_id);
          Alert.alert('成功', '画布导入成功');
          analyticsService.trackCanvasAction('import', { format: 'json' });
        } else {
          throw new Error(response.message || '导入画布失败');
        }
      }
    } catch (error) {
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入画布失败:', error);
        analyticsService.trackError(error, { action: 'import_canvas' });
        Alert.alert('错误', '导入画布失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddElement = useCallback((newElement) => {
    setElements(prev => [...prev, newElement]);
    setHistory(prev => [...prev, [...elements, newElement]]);
    setFuture([]);
  }, [elements]);

  // 渲染加载指示器
  const renderLoader = () => {
    if (isLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }
    return null;
  };

  // 切换绘图工具
  const toggleDrawingTools = () => {
    setShowDrawingTools(!showDrawingTools);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderLoader()}

      {/* 顶部工具栏 */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {canvasTitle}
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.primary }]}
            onPress={handleImport}
          >
            <Icon name="cloud-download-outline" size={20} color={theme.onPrimary} />
            <Text style={[styles.headerButtonText, { color: theme.onPrimary }]}>导入</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.primary }]}
            onPress={handleExport}
          >
            <Icon name="cloud-upload-outline" size={20} color={theme.onPrimary} />
            <Text style={[styles.headerButtonText, { color: theme.onPrimary }]}>导出</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: showDrawingTools
                  ? theme.primary + '80'
                  : theme.primary
              }
            ]}
            onPress={toggleDrawingTools}
          >
            <Icon name="brush-outline" size={20} color={theme.onPrimary} />
            <Text style={[styles.headerButtonText, { color: theme.onPrimary }]}>
              {showDrawingTools ? '隐藏绘图' : '绘图'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 绘图工具栏 */}
      {showDrawingTools && (
        <DrawingToolbar
          onToolChange={drawingCanvas.handleToolChange}
          onColorChange={drawingCanvas.handleColorChange}
          onStrokeWidthChange={drawingCanvas.handleStrokeWidthChange}
          onUndo={drawingCanvas.handleUndo}
          onRedo={drawingCanvas.handleRedo}
          canUndo={drawingCanvas.canUndo}
          canRedo={drawingCanvas.canRedo}
          onScreenshot={drawingCanvas.handleScreenshot}
          onClear={drawingCanvas.handleClear}
        />
      )}

      {/* 绘图画布或普通画布 */}
      {showDrawingTools ? (
        drawingCanvas.render()
      ) : (
        <Canvas
          elements={elements}
          onContentChange={handleContentChange}
          onElementSelect={handleElementSelect}
        />
      )}

      {/* 工具栏 */}
      {!showDrawingTools && (
        <CanvasToolbar
          onAddElement={handleAddElement}
          onSave={handleSave}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={history.length > 1}
          canRedo={future.length > 0}
        />
      )}

      {/* 样式编辑器 */}
      {selectedElement && !showDrawingTools && (
        <StyleEditor
          selectedElement={selectedElement}
          onStyleChange={handleStyleChange}
        />
      )}

      {/* 图层管理器 */}
      {!showDrawingTools && (
        <LayerManager
          elements={elements}
          selectedElement={selectedElement}
          onElementSelect={handleElementSelect}
          onLayerOrderChange={handleLayerOrderChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerButtonText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '600',
  },
});

export default CanvasScreen;