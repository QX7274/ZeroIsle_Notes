import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { analyticsService } from '../../services/analytics/analyticsService';

const CanvasToolbar = ({ onAddText, onAddImage, onAddShape, onUndo, onRedo, onClear, onSave }) => {
  const handleAddText = () => {
    onAddText();
    analyticsService.trackCanvasAction('add_text');
  };

  const handleAddImage = () => {
    onAddImage();
    analyticsService.trackCanvasAction('add_image');
  };

  const handleAddShape = (shapeType) => {
    onAddShape(shapeType);
    analyticsService.trackCanvasAction('add_shape', { shapeType });
  };

  const handleUndo = () => {
    onUndo();
    analyticsService.trackCanvasAction('undo');
  };

  const handleRedo = () => {
    onRedo();
    analyticsService.trackCanvasAction('redo');
  };

  const handleClear = () => {
    onClear();
    analyticsService.trackCanvasAction('clear');
  };

  const handleSave = () => {
    onSave();
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
          <Text style={styles.toolText}>三角�?/Text>
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

