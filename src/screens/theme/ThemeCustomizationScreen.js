/**
 * 主题自定义屏幕
 * 允许用户自定义主题颜色
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import { ThemeColorPicker } from '../../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const ThemeCustomizationScreen = ({ navigation }) => {
  const {
    colors,
    isDarkMode,
    resetThemeColors,
    getThemeByMode,
  } = useTheme();
  const insets = useSafeAreaInsets();

  // 当前编辑的主题模式
  const [editMode, setEditMode] = useState(isDarkMode ? 'dark' : 'light');
  const pageState = editMode === 'dark' ? 'editing-dark' : 'editing-light';
  const previewTheme = getThemeByMode(editMode);
  const previewColors = previewTheme.colors;

  // 重置主题颜色
  const handleResetColors = () => {
    resetThemeColors(editMode);
  };

  // 渲染颜色选择器
  const renderColorPickers = () => {
    // 主要颜色
    const mainColors = [
      { key: 'primary', label: '主要颜色' },
      { key: 'secondary', label: '次要颜色' },
      { key: 'background', label: '背景颜色' },
      { key: 'card', label: '卡片颜色' },
      { key: 'text', label: '文本颜色' },
    ];

    // 状态颜色
    const statusColors = [
      { key: 'success', label: '成功状态' },
      { key: 'info', label: '信息状态' },
      { key: 'warning', label: '警告状态' },
      { key: 'error', label: '错误状态' },
    ];

    // 辅助颜色
    const auxiliaryColors = [
      { key: 'border', label: '边框颜色' },
      { key: 'divider', label: '分隔线颜色' },
      { key: 'textSecondary', label: '次要文本' },
      { key: 'textDisabled', label: '禁用文本' },
      { key: 'textHint', label: '提示文本' },
    ];

    return (
      <>
        <View style={styles.sectionBlock}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>主要颜色</Text>
          <View style={styles.sectionCard} testID="list.themeCustomization.mainColors">
            {mainColors.map((item) => (
              <ThemeColorPicker
                key={item.key}
                colorKey={item.key}
                label={item.label}
                mode={editMode}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>状态颜色</Text>
          <View style={styles.sectionCard} testID="list.themeCustomization.statusColors">
            {statusColors.map((item) => (
              <ThemeColorPicker
                key={item.key}
                colorKey={item.key}
                label={item.label}
                mode={editMode}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>辅助颜色</Text>
          <View style={styles.sectionCard} testID="list.themeCustomization.auxColors">
            {auxiliaryColors.map((item) => (
              <ThemeColorPicker
                key={item.key}
                colorKey={item.key}
                label={item.label}
                mode={editMode}
              />
            ))}
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F3F8FF' }]} testID={`state.themeCustomization.state.${pageState}`}>
      <View testID="state.themeCustomization.visibility.visible" />
      <View testID={`state.themeCustomization.mode.${editMode}`} />
      <View style={[styles.headerCard, { paddingTop: Math.max(insets.top, 12) }]}>
        <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.themeCustomization.back" style={styles.backButton} />

        <Text variant="heading" level="h5" style={styles.headerTitle}>自定义主题</Text>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetColors}
          testID="action.themeCustomization.reset"
        >
          <Icon name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.modeCard} testID="state.themeCustomization.modeCard">
        <Text style={[styles.modeLabel, { color: colors.text }]}>
          编辑模式
        </Text>

        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              editMode === 'light' && styles.modeButtonActive,
            ]}
            onPress={() => setEditMode('light')}
            testID="action.themeCustomization.mode.light"
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: editMode === 'light' ? '#FFFFFF' : colors.text },
              ]}
            >
              浅色主题
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              editMode === 'dark' && styles.modeButtonActive,
            ]}
            onPress={() => setEditMode('dark')}
            testID="action.themeCustomization.mode.dark"
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: editMode === 'dark' ? '#FFFFFF' : colors.text },
              ]}
            >
              深色主题
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        testID="list.themeCustomization.sections"
      >
        {renderColorPickers()}

        <View style={styles.previewSection}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>预览</Text>

          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: previewColors.card,
                borderColor: previewColors.border,
              },
            ]}
            testID="state.themeCustomization.preview"
          >
            <Text style={[styles.previewTitle, { color: previewColors.text }]}>
              主题预览
            </Text>

            <Text style={[styles.previewText, { color: previewColors.textSecondary }]}>
              这是一段次要文本，用于展示主题效果。
            </Text>

            <View style={[styles.previewDivider, { backgroundColor: previewColors.divider }]} />

            <View style={styles.previewButtons}>
              <TouchableOpacity
                style={[styles.previewButton, { backgroundColor: previewColors.primary }]}
              >
                <Text style={styles.previewButtonText}>主要按钮</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewButton, { backgroundColor: previewColors.secondary }]}
              >
                <Text style={styles.previewButtonText}>次要按钮</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewStatus}>
              <View style={[styles.statusItem, { backgroundColor: previewColors.success }]}>
                <Text style={styles.statusText}>成功</Text>
              </View>

              <View style={[styles.statusItem, { backgroundColor: previewColors.info }]}>
                <Text style={styles.statusText}>信息</Text>
              </View>

              <View style={[styles.statusItem, { backgroundColor: previewColors.warning }]}>
                <Text style={styles.statusText}>警告</Text>
              </View>

              <View style={[styles.statusItem, { backgroundColor: previewColors.error }]}>
                <Text style={styles.statusText}>错误</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76,141,255,0.10)',
  },
  modeCard: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  modeLabel: {
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  modeButtons: {
    flexDirection: 'row',
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#BDD7FF',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  modeButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionTitle: {
    marginBottom: 10,
    marginLeft: 6,
  },
  sectionCard: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  previewSection: {
    marginTop: 4,
  },
  previewCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  previewText: {
    marginBottom: 16,
    lineHeight: 22,
  },
  previewDivider: {
    height: 1,
    marginVertical: 16,
  },
  previewButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  previewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  previewButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  previewStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statusItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    margin: 4,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ThemeCustomizationScreen;
