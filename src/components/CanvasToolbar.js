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
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(0,0,0,0.01)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  button: {
    padding: 12,
    marginHorizontal: 6,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '80%',
    padding: 24,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textInput: {
    height: 120,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  modalButton: {
    padding: 14,
    borderRadius: 16,
    minWidth: 120,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CanvasToolbar;