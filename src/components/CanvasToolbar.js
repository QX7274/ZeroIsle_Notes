import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  TextInput,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { canvasService } from '../services/canvasService';
import { analyticsService } from '../services/analytics';

const CanvasToolbar = ({ onElementsChange, onExport }) => {
  const { theme } = useTheme();
  const [showTextInput, setShowTextInput] = React.useState(false);
  const [textInput, setTextInput] = React.useState('');

  const handleAddText = () => {
    setShowTextInput(true);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      canvasService.addElement({
        type: 'text',
        content: textInput,
        x: 0,
        y: 0,
      });
      onElementsChange(canvasService.canvasData.elements);
      analyticsService.trackCanvasAction('add_text');
    }
    setTextInput('');
    setShowTextInput(false);
  };

  const handleAddShape = (shapeType) => {
    canvasService.addElement({
      type: 'shape',
      shapeType,
      x: 0,
      y: 0,
    });
    onElementsChange(canvasService.canvasData.elements);
    analyticsService.trackCanvasAction('add_shape', { shapeType });
  };

  const handleUndo = () => {
    canvasService.undo();
    onElementsChange(canvasService.canvasData.elements);
    analyticsService.trackCanvasAction('undo');
  };

  const handleRedo = () => {
    canvasService.redo();
    onElementsChange(canvasService.canvasData.elements);
    analyticsService.trackCanvasAction('redo');
  };

  const handleExport = async () => {
    try {
      const imageData = await canvasService.exportToImage();
      onExport(imageData);
      analyticsService.trackCanvasAction('export');
    } catch (error) {
      console.error('导出画布错误:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={handleAddText}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>文本</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={() => handleAddShape('rectangle')}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>矩形</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={() => handleAddShape('circle')}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>圆形</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={() => handleAddShape('triangle')}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>三角形</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={() => handleAddShape('line')}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>线条</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={handleUndo}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>撤销</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={handleRedo}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>重做</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={handleExport}
      >
        <Text style={[styles.buttonText, { color: theme.colors.text }]}>导出</Text>
      </TouchableOpacity>

      <Modal
        visible={showTextInput}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <TextInput
              style={[styles.textInput, { color: theme.colors.text }]}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="输入文本"
              placeholderTextColor={theme.colors.text + '80'}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleTextSubmit}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>确定</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowTextInput(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  button: {
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 5,
  },
  buttonText: {
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 10,
  },
  textInput: {
    height: 100,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
  },
});

export default CanvasToolbar; 