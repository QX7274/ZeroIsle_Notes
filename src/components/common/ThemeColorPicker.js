/**
 * 主题颜色选择器组件
 * 用于自定义主题颜色
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from './Typography';
import ColorPicker from './ColorPicker';

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
  mode = 'both',
}) => {
  const { colors, getModeColor, updateThemeColor } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const resolvedColorValue = getModeColor(colorKey, mode, '');
  const [colorValue, setColorValue] = useState(resolvedColorValue);

  useEffect(() => {
    setColorValue(resolvedColorValue);
  }, [resolvedColorValue]);

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
              backgroundColor: colors.card,
            },
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
            { backgroundColor: colorValue || colors.background },
          ]}
          onPress={() => setShowPicker(true)}
        />

        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: colors.primary }]}
          onPress={applyColor}
        >
          <Text style={{ color: '#fff', fontSize: 12 }}>应用</Text>
        </TouchableOpacity>
      </View>

      <ColorPicker
        visible={showPicker}
        initialColor={colorValue}
        onClose={() => setShowPicker(false)}
        onColorChange={handleColorChange}
      />
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
