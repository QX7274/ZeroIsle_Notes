import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { analyticsService } from '../../services/analytics/analyticsService';

const CanvasToolbar = ({ onAddElement, onUndo, onRedo, onSave, canUndo, canRedo }) => {
  const handleAddText = () => {
    if (onAddElement) {
      const newElement = {
        id: Date.now().toString(),
        type: 'text',
        content: '双击编辑文本',
        x: 100,
        y: 100,
        scale: 1,
        rotation: 0,
        color: '#000000',
        fontSize: 16,
      };
      onAddElement(newElement);
    }
    analyticsService.trackCanvasAction('add_text');
  };

  const handleAddImage = () => {
    // 这里应该打开图片选择器，但为了简化，我们先创建一个占位图像元素
    if (onAddElement) {
      const newElement = {
        id: Date.now().toString(),
        type: 'image',
        content: 'https://via.placeholder.com/150',
        x: 100,
        y: 100,
        scale: 1,
        rotation: 0,
        width: 150,
        height: 150,
      };
      onAddElement(newElement);
    }
    analyticsService.trackCanvasAction('add_image');
  };

  const handleAddShape = (shapeType) => {
    if (onAddElement) {
      const newElement = {
        id: Date.now().toString(),
        type: 'shape',
        shapeType: shapeType,
        x: 100,
        y: 100,
        scale: 1,
        rotation: 0,
        color: '#000000',
        width: 100,
        height: 100,
      };
      onAddElement(newElement);
    }
    analyticsService.trackCanvasAction('add_shape', { shapeType });
  };

  const handleUndo = () => {
    if (onUndo) {
      onUndo();
    }
    analyticsService.trackCanvasAction('undo');
  };

  const handleRedo = () => {
    if (onRedo) {
      onRedo();
    }
    analyticsService.trackCanvasAction('redo');
  };

  const handleClear = () => {
    // 清空画布功能可以通过添加一个空元素数组来实现
    if (onAddElement) {
      // 这里我们发送一个特殊的清空信号
      onAddElement({ type: 'clear' });
    }
    analyticsService.trackCanvasAction('clear');
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
    }
    analyticsService.trackCanvasAction('save');
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolGroup}>
        <TouchableOpacity style={styles.tool} onPress={handleAddText}>
          <Icon name="text-fields" size={24} color="#333" />
          <Text style={styles.toolText}>文本</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tool} onPress={handleAddImage}>
          <Icon name="image" size={24} color="#333" />
          <Text style={styles.toolText}>图片</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolGroup}>
        <TouchableOpacity style={styles.tool} onPress={() => handleAddShape('rectangle')}>
          <Icon name="crop-square" size={24} color="#333" />
          <Text style={styles.toolText}>矩形</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tool} onPress={() => handleAddShape('circle')}>
          <Icon name="radio-button-unchecked" size={24} color="#333" />
          <Text style={styles.toolText}>圆形</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tool} onPress={() => handleAddShape('triangle')}>
          <Icon name="change-history" size={24} color="#333" />
          <Text style={styles.toolText}>三角形</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tool} onPress={() => handleAddShape('line')}>
          <Icon name="remove" size={24} color="#333" />
          <Text style={styles.toolText}>直线</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolGroup}>
        <TouchableOpacity style={styles.tool} onPress={handleUndo}>
          <Icon name="undo" size={24} color="#333" />
          <Text style={styles.toolText}>撤销</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tool} onPress={handleRedo}>
          <Icon name="redo" size={24} color="#333" />
          <Text style={styles.toolText}>重做</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolGroup}>
        <TouchableOpacity style={styles.tool} onPress={handleClear}>
          <Icon name="delete" size={24} color="#333" />
          <Text style={styles.toolText}>清空</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tool} onPress={handleSave}>
          <Icon name="save" size={24} color="#333" />
          <Text style={styles.toolText}>保存</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tool: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  toolText: {
    fontSize: 10,
    marginTop: 2,
  },
});

export default CanvasToolbar;

