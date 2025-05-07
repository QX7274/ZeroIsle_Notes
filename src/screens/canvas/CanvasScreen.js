import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, ActivityIndicator, Dimensions } from'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Canvas, CanvasToolbar, StyleEditor, LayerManager, DrawingToolbar, DrawingCanvas } from '../../components/canvas';
import { offlineStorageService } from '../../services/offline/offlineStorage';
import analyticsService from '../../services/analytics/analyticsService';
import canvasApi from '../../services/api/canvasApi';
import Icon from'react-native-vector-icons/Ionicons';
import DocumentPicker, { types } from'react-native-document-picker';

const CanvasScreen = ({ navigation, route }) => {
  const { theme, colors } = useTheme();
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
    width: Dimensions.get('window').width - 16,
    height: 400,
    backgroundColor: 'white',
    onStrokeEnd: (path) => {
      // 可以将绘图路径保存到画布元素中
      console.log('绘图路径:', path);
      // 将绘图路径添加到元素数组中
      const newElement = {
        id: Date.now().toString(),
        type: 'path',
        ...path
      };
      handleAddElement(newElement);
    },
    onScreenshotTaken: (uri) => {
      // 处理截图
      Alert.alert('截图已保存', '截图已保存到画布中');
    },
  });

  useEffect(() => {
    analyticsService.trackScreen('canvas');

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
        // 如果没有本地存储的画布，创建一个新的画布
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
    analyticsService.trackUserAction('canvas_update', { elementCount: newElements.length });
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
      analyticsService.trackUserAction('canvas_style_change', {
        elementId: selectedElement.id,
        elementType: selectedElement.type,
        style,
      });
    }
  }, [selectedElement, elements, handleContentChange]);

  const handleElementSelect = useCallback((element) => {
    setSelectedElement(element);
    analyticsService.trackUserAction('canvas_select_element', {
      elementId: element.id,
      elementType: element.type,
    });
  }, []);

  const handleLayerOrderChange = useCallback((newElements) => {
    handleContentChange(newElements);
    analyticsService.trackUserAction('canvas_layer_order_change', {
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
      analyticsService.trackUserAction('canvas_undo');
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    if (future.length > 0) {
      const newFuture = [...future];
      const next = newFuture.shift();
      setHistory(prev => [...prev, next]);
      setFuture(newFuture);
      setElements(next);
      analyticsService.trackUserAction('canvas_redo');
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

      analyticsService.trackUserAction('canvas_save', { elementCount: elements.length });
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
        analyticsService.trackUserAction('canvas_export', { canvasId, format: 'json' });
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
      const results = await DocumentPicker.pick({
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
          analyticsService.trackUserAction('canvas_import', { format: 'json' });
        } else {
          throw new Error(response.message || '导入画布失败');
        }
      }
    } catch (error) {
      if (error.code!== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入画布失败:', error);
        analyticsService.trackError(error, { action: 'import_canvas' });
        Alert.alert('错误', '导入画布失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddElement = useCallback((newElement) => {
    if (newElement?.type === 'clear') {
      setElements([]);
      setHistory(prev => [...prev, []]);
      setFuture([]);
      return;
    }

    setElements(prev => [...prev, newElement]);
    setHistory(prev => [...prev, [...prev, newElement]]);
    setFuture([]);
  }, []);

  // 切换绘图工具显示状态的函数
  const toggleDrawingTools = () => {
    setShowDrawingTools(!showDrawingTools);
  };

  // 渲染加载指示器
  const renderLoader = () => {
    if (isLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return null;
  };

  function renderCanvas() {
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
                {showDrawingTools? '隐藏绘图' : '绘图'}
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
        {showDrawingTools? (
          <View style={styles.drawingCanvasContainer}>
            {drawingCanvas.render()}
          </View>
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
        {selectedElement &&!showDrawingTools && (
          <StyleEditor
            selectedElement={selectedElement}
            onStyleChange={handleStyleChange}
          />
        )}

        {/* 图层管理 */}
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
  }

  return (
    <View style={styles.container}>
      {renderCanvas()}
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
  drawingCanvasContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#f5f5f5',
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