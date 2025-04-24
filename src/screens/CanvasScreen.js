import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Canvas from '../components/Canvas';
import CanvasToolbar from '../components/CanvasToolbar';
import StyleEditor from '../components/StyleEditor';
import LayerManager from '../components/LayerManager';
import { offlineStorageService } from '../services/offlineStorage';
import { analyticsService } from '../services/analytics';

const CanvasScreen = () => {
  const { theme } = useTheme();
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);

  useEffect(() => {
    analyticsService.trackScreenView('canvas');
    loadCanvas();
  }, []);

  const loadCanvas = async () => {
    try {
      const savedCanvas = await offlineStorageService.getCanvas();
      if (savedCanvas) {
        setElements(savedCanvas.elements);
        setHistory([savedCanvas.elements]);
      }
    } catch (error) {
      console.error('加载画布失败:', error);
      analyticsService.trackError(error, { action: 'load_canvas' });
    }
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
      await offlineStorageService.saveCanvas({
        id: Date.now().toString(),
        elements,
        createdAt: new Date().toISOString(),
      });
      analyticsService.trackCanvasAction('save', { elementCount: elements.length });
      Alert.alert('成功', '画布已保存');
    } catch (error) {
      analyticsService.trackError(error, { action: 'save_canvas' });
      Alert.alert('错误', '保存画布失败');
    }
  };

  const handleAddElement = useCallback((newElement) => {
    setElements(prev => [...prev, newElement]);
    setHistory(prev => [...prev, [...elements, newElement]]);
    setFuture([]);
  }, [elements]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Canvas 
        elements={elements} 
        onContentChange={handleContentChange}
        onElementSelect={handleElementSelect}
      />
      <CanvasToolbar
        onAddElement={handleAddElement}
        onSave={handleSave}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.length > 1}
        canRedo={future.length > 0}
      />
      {selectedElement && (
        <StyleEditor
          selectedElement={selectedElement}
          onStyleChange={handleStyleChange}
        />
      )}
      <LayerManager
        elements={elements}
        selectedElement={selectedElement}
        onElementSelect={handleElementSelect}
        onLayerOrderChange={handleLayerOrderChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CanvasScreen; 