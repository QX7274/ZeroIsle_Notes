/**
 * 主题颜色选择器组件
 * 用于自定义主题颜色
 */
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from './Typography';

/**
 * 主题颜色选择器组件
 * @param {string} colorKey - 颜色键名
 * @param {string} label - 显示标签
 * @param {function} onColorChange - 颜色变更回调
 * @param {string} mode - 主题模式：light, dark, both
 */
const ThemeColorPicker = ({ 
  colorKey, 
  label, 
  onColorChange,
  mode = 'both'
}) => {
  const { colors, getColor, updateThemeColor } = useTheme();
  
  // 当前颜色值
  const [colorValue, setColorValue] = useState(getColor(colorKey, ''));
  
  // 预设颜色
  const presetColors = [
    '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688',
    '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107',
    '#FF9800', '#FF5722', '#F44336', '#E91E63', '#9C27B0',
    '#673AB7', '#000000', '#FFFFFF', '#9E9E9E', '#607D8B'
  ];
  
  // 处理颜色变更
  const handleColorChange = (color) => {
    setColorValue(color);
    
    if (onColorChange) {
      onColorChange(color);
    }
  };
  
  // 应用颜色
  const applyColor = () => {
    if (colorValue && colorKey) {
      updateThemeColor(colorKey, colorValue, mode);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label || colorKey}
      </Text>
      
      <View style={styles.colorInputContainer}>
        <TextInput
          style={[
            styles.colorInput,
            { 
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card
            }
          ]}
          value={colorValue}
          onChangeText={handleColorChange}
          placeholder="#RRGGBB"
          placeholderTextColor={colors.textDisabled}
          autoCapitalize="characters"
          maxLength={9}
        />
        
        <TouchableOpacity
          style={[
            styles.colorPreview,
            { backgroundColor: colorValue || colors.background }
          ]}
          onPress={applyColor}
        />
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.presetContainer}
        contentContainerStyle={styles.presetContent}
      >
        {presetColors.map((color, index) => (
          <TouchableOpacity
            key={`color-${index}`}
            style={[
              styles.presetColor,
              { backgroundColor: color },
              colorValue === color && styles.selectedPreset
            ]}
            onPress={() => handleColorChange(color)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    marginBottom: 4,
    fontSize: 14,
  },
  colorInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  presetContainer: {
    marginTop: 8,
  },
  presetContent: {
    paddingVertical: 4,
  },
  presetColor: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedPreset: {
    borderWidth: 2,
    borderColor: '#000',
  },
});

export default ThemeColorPicker;
