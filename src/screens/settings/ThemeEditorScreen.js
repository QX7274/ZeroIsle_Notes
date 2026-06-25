import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { getThemePresetList } from '../../theme/presets';
import ColorPicker from '../../components/common/ColorPicker';

const ThemeEditorScreen = () => {
  const { theme, setTheme, colors, customColors, setCustomColors } = useTheme();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [localCustomColors, setLocalCustomColors] = useState(customColors || {});
  const pageState = showColorPicker ? 'picker' : 'ready';
  const themePresets = getThemePresetList();

  const selectPreset = useCallback((preset) => {
    setTheme(preset.id);
  }, [setTheme]);

  const openColorEditor = useCallback((colorKey) => {
    setEditingColor(colorKey);
    setShowColorPicker(true);
  }, []);

  const saveCustomColor = useCallback((color) => {
    if (editingColor) {
      const nextColors = { ...localCustomColors, [editingColor]: color };
      setLocalCustomColors(nextColors);
      if (setCustomColors) setCustomColors(nextColors);
    }
    setShowColorPicker(false);
    setEditingColor(null);
  }, [editingColor, localCustomColors, setCustomColors]);

  const resetCustomColors = useCallback(() => {
    Alert.alert('重置自定义颜色', '确定要恢复默认颜色吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: () => {
          setLocalCustomColors({});
          if (setCustomColors) setCustomColors({});
        },
      },
    ]);
  }, [setCustomColors]);

  const colorItems = [
    { key: 'primary', label: '主色调', icon: 'palette' },
    { key: 'secondary', label: '次色调', icon: 'color-lens' },
    { key: 'background', label: '背景色', icon: 'crop-square' },
    { key: 'card', label: '卡片色', icon: 'dashboard' },
    { key: 'text', label: '文字色', icon: 'format-color-text' },
    { key: 'success', label: '成功色', icon: 'check-circle' },
    { key: 'warning', label: '警告色', icon: 'warning' },
    { key: 'error', label: '错误色', icon: 'error' },
  ];

  return (
    <View style={[styles.page, { backgroundColor: '#F3F8FF' }]} testID={`state.settings.themeEditor.state.${pageState}`}>
      <View testID="state.settings.themeEditor.visibility.visible" />
      <View testID={`state.settings.themeEditor.picker.visibility.${showColorPicker ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.themeEditor.current.${theme?.id || 'unknown'}`} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} testID="list.settings.themeEditor.sections">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>主题预设</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          选择预设主题可快速切换应用外观。
        </Text>

        <View style={styles.presetsGrid} testID="list.settings.themeEditor.presets">
          {themePresets.map((preset) => {
            const isSelected = theme.id === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetCard,
                  styles.glassCard,
                  { borderColor: isSelected ? colors.primary : 'rgba(76,141,255,0.18)' },
                ]}
                onPress={() => selectPreset(preset)}
                testID={`action.settings.themeEditor.selectPreset.${preset.id}`}
              >
                <View style={[styles.presetPreview, { backgroundColor: preset.colors.background }]}>
                  <View style={[styles.previewHeader, { backgroundColor: preset.colors.primary }]} />
                  <View style={styles.previewContent}>
                    <View style={[styles.previewLine, { backgroundColor: preset.colors.text, width: '80%' }]} />
                    <View style={[styles.previewLine, { backgroundColor: preset.colors.textSecondary, width: '60%' }]} />
                    <View style={[styles.previewLine, { backgroundColor: preset.colors.textSecondary, width: '70%' }]} />
                  </View>
                </View>
                <View style={styles.presetInfo}>
                  <Icon name={preset.icon} size={18} color={preset.colors.text} />
                  <Text style={[styles.presetName, { color: preset.colors.text }]}>{preset.name}</Text>
                  {isSelected ? <Icon name="check-circle" size={18} color={colors.primary} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>自定义颜色</Text>
          <TouchableOpacity onPress={resetCustomColors} style={styles.resetButton} testID="action.settings.themeEditor.resetColors">
            <Icon name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.resetText, { color: colors.primary }]}>重置</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          点击颜色项可单独调整各类主题色。
        </Text>

        <View style={[styles.colorGrid, styles.glassCard]} testID="list.settings.themeEditor.colors">
          {colorItems.map((item) => {
            const currentColor = localCustomColors[item.key] || colors[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={styles.colorItem}
                onPress={() => openColorEditor(item.key)}
                testID={`action.settings.themeEditor.editColor.${item.key}`}
              >
                <View style={[styles.colorSwatch, { backgroundColor: currentColor, borderColor: 'rgba(76,141,255,0.22)' }]} />
                <View style={styles.colorInfo}>
                  <Icon name={item.icon} size={16} color={colors.textSecondary} />
                  <Text style={[styles.colorLabel, { color: colors.text }]}>{item.label}</Text>
                </View>
                <Icon name="edit" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.tipCard, styles.glassCard]} testID="state.settings.themeEditor.tip">
          <Icon name="lightbulb-outline" size={20} color={colors.warning} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            提示：自定义颜色会覆盖当前主题预设中的对应颜色。
          </Text>
        </View>
      </ScrollView>

      {showColorPicker ? (
        <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} testID="state.settings.themeEditor.picker">
          <View style={[styles.pickerContainer, styles.glassCard]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                选择{colorItems.find((c) => c.key === editingColor)?.label || '颜色'}
              </Text>
              <TouchableOpacity onPress={() => setShowColorPicker(false)} testID="action.settings.themeEditor.closePicker">
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ColorPicker
              initialColor={localCustomColors[editingColor] || colors[editingColor]}
              onSelectColor={saveCustomColor}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionDescription: { fontSize: 13, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 },
  resetButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  resetText: { fontSize: 13, marginLeft: 4 },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    borderRadius: 12,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  presetCard: { width: '48%', marginBottom: 12, overflow: 'hidden' },
  presetPreview: { height: 80, padding: 8 },
  previewHeader: { height: 12, borderRadius: 6, marginBottom: 8 },
  previewContent: { flex: 1, justifyContent: 'space-around' },
  previewLine: { height: 6, borderRadius: 3 },
  presetInfo: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  presetName: { fontSize: 13, fontWeight: '500', marginLeft: 8, flex: 1 },
  colorGrid: { overflow: 'hidden' },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(76,141,255,0.20)',
  },
  colorSwatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 1 },
  colorInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  colorLabel: { fontSize: 14, marginLeft: 8 },
  tipCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 16, marginBottom: 32 },
  tipText: { fontSize: 13, marginLeft: 10, flex: 1 },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: { width: '90%', maxWidth: 360, padding: 16 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 16, fontWeight: '600' },
});

export default ThemeEditorScreen;
