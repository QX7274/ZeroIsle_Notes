import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Slider,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import ColorPicker from '../common/ColorPicker';

const StyleEditor = ({ selectedElement, onStyleChange }) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [color, setColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState('normal');
  const [opacity, setOpacity] = useState(1);
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderColor, setBorderColor] = useState('#000000');
  const [borderRadius, setBorderRadius] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('transparent');

  useEffect(() => {
    if (selectedElement) {
      // 初始化样式值
      setColor(selectedElement.color || '#000000');
      setFontSize(selectedElement.fontSize || 16);
      setFontWeight(selectedElement.fontWeight || 'normal');
      setOpacity(selectedElement.opacity || 1);
      setBorderWidth(selectedElement.borderWidth || 0);
      setBorderColor(selectedElement.borderColor || '#000000');
      setBorderRadius(selectedElement.borderRadius || 0);
      setBackgroundColor(selectedElement.backgroundColor || 'transparent');
    }
  }, [selectedElement]);

  const handleColorChange = (newColor) => {
    setColor(newColor);
    onStyleChange({ ...selectedElement, color: newColor });
  };

  const handleFontSizeChange = (value) => {
    const newFontSize = parseInt(value);
    setFontSize(newFontSize);
    onStyleChange({ ...selectedElement, fontSize: newFontSize });
  };

  const handleFontWeightChange = (value) => {
    setFontWeight(value);
    onStyleChange({ ...selectedElement, fontWeight: value });
  };

  const handleOpacityChange = (value) => {
    setOpacity(value);
    onStyleChange({ ...selectedElement, opacity: value });
  };

  const handleBorderWidthChange = (value) => {
    const newBorderWidth = parseInt(value);
    setBorderWidth(newBorderWidth);
    onStyleChange({ ...selectedElement, borderWidth: newBorderWidth });
  };

  const handleBorderColorChange = (newColor) => {
    setBorderColor(newColor);
    onStyleChange({ ...selectedElement, borderColor: newColor });
  };

  const handleBorderRadiusChange = (value) => {
    const newBorderRadius = parseInt(value);
    setBorderRadius(newBorderRadius);
    onStyleChange({ ...selectedElement, borderRadius: newBorderRadius });
  };

  const handleBackgroundColorChange = (newColor) => {
    setBackgroundColor(newColor);
    onStyleChange({ ...selectedElement, backgroundColor: newColor });
  };

  if (!selectedElement) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={[styles.title, { color: theme.text }]}>样式编辑器</Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.text}
        />
      </TouchableOpacity>
      {expanded && (
        <ScrollView style={styles.content}>
          {/* 颜色选择器 */}
          <View style={styles.styleRow}>
            <Text style={[styles.styleLabel, { color: theme.text }]}>颜色</Text>
            <ColorPicker
              color={color}
              onColorChange={handleColorChange}
            />
          </View>

          {/* 文本样式（仅对文本元素显示） */}
          {selectedElement.type === 'text' && (
            <>
              <View style={styles.styleRow}>
                <Text style={[styles.styleLabel, { color: theme.text }]}>字体大小</Text>
                <View style={styles.sliderContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={8}
                    maximumValue={72}
                    step={1}
                    value={fontSize}
                    onValueChange={handleFontSizeChange}
                    minimumTrackTintColor={theme.primary}
                    maximumTrackTintColor="#ccc"
                  />
                  <Text style={[styles.sliderValue, { color: theme.text }]}>{fontSize}</Text>
                </View>
              </View>

              <View style={styles.styleRow}>
                <Text style={[styles.styleLabel, { color: theme.text }]}>字体粗细</Text>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[
                      styles.styleButton,
                      fontWeight === 'normal' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => handleFontWeightChange('normal')}
                  >
                    <Text style={[styles.buttonText, { color: fontWeight === 'normal' ? '#fff' : theme.text }]}>
                      正常
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.styleButton,
                      fontWeight === 'bold' && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => handleFontWeightChange('bold')}
                  >
                    <Text style={[styles.buttonText, { color: fontWeight === 'bold' ? '#fff' : theme.text }]}>
                      粗体
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* 通用样式 */}
          <View style={styles.styleRow}>
            <Text style={[styles.styleLabel, { color: theme.text }]}>不透明度</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                value={opacity}
                onValueChange={handleOpacityChange}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor="#ccc"
              />
              <Text style={[styles.sliderValue, { color: theme.text }]}>{Math.round(opacity * 100)}%</Text>
            </View>
          </View>

          {/* 边框样式 */}
          <View style={styles.styleRow}>
            <Text style={[styles.styleLabel, { color: theme.text }]}>边框宽度</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={20}
                step={1}
                value={borderWidth}
                onValueChange={handleBorderWidthChange}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor="#ccc"
              />
              <Text style={[styles.sliderValue, { color: theme.text }]}>{borderWidth}</Text>
            </View>
          </View>

          {borderWidth > 0 && (
            <View style={styles.styleRow}>
              <Text style={[styles.styleLabel, { color: theme.text }]}>边框颜色</Text>
              <ColorPicker
                color={borderColor}
                onColorChange={handleBorderColorChange}
              />
            </View>
          )}

          <View style={styles.styleRow}>
            <Text style={[styles.styleLabel, { color: theme.text }]}>圆角</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={50}
                step={1}
                value={borderRadius}
                onValueChange={handleBorderRadiusChange}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor="#ccc"
              />
              <Text style={[styles.sliderValue, { color: theme.text }]}>{borderRadius}</Text>
            </View>
          </View>

          {/* 背景颜色（对形状和文本有效） */}
          {(selectedElement.type === 'shape' || selectedElement.type === 'text') && (
            <View style={styles.styleRow}>
              <Text style={[styles.styleLabel, { color: theme.text }]}>背景颜色</Text>
              <ColorPicker
                color={backgroundColor}
                onColorChange={handleBackgroundColorChange}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 250,
    maxHeight: 400,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    maxHeight: 300,
  },
  styleRow: {
    marginBottom: 16,
  },
  styleLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 40,
    textAlign: 'right',
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  styleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonText: {
    fontSize: 12,
  },
});

export default StyleEditor;
