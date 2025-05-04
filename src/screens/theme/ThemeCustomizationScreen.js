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
  Switch,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import { ThemeColorPicker } from '../../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ThemeCustomizationScreen = ({ navigation }) => {
  const {
    colors,
    isDarkMode,
    themeType,
    resetThemeColors,
    getColor,
  } = useTheme();

  // 当前编辑的主题模式
  const [editMode, setEditMode] = useState(isDarkMode ? 'dark' : 'light');

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
        <Text variant="h4" style={styles.sectionTitle}>主要颜色</Text>
        {mainColors.map((item) => (
          <ThemeColorPicker
            key={item.key}
            colorKey={item.key}
            label={item.label}
            mode={editMode}
          />
        ))}

        <Text variant="h4" style={styles.sectionTitle}>状态颜色</Text>
        {statusColors.map((item) => (
          <ThemeColorPicker
            key={item.key}
            colorKey={item.key}
            label={item.label}
            mode={editMode}
          />
        ))}

        <Text variant="h4" style={styles.sectionTitle}>辅助颜色</Text>
        {auxiliaryColors.map((item) => (
          <ThemeColorPicker
            key={item.key}
            colorKey={item.key}
            label={item.label}
            mode={editMode}
          />
        ))}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text variant="h4" style={styles.headerTitle}>自定义主题</Text>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleResetColors}
        >
          <Icon name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.modeSelector, { backgroundColor: colors.card }]}>
        <Text style={[styles.modeLabel, { color: colors.text }]}>
          编辑模式:
        </Text>

        <TouchableOpacity
          style={[
            styles.modeButton,
            editMode === 'light' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setEditMode('light')}
        >
          <Text
            style={[
              styles.modeButtonText,
              { color: editMode === 'light' ? '#fff' : colors.text }
            ]}
          >
            浅色主题
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            editMode === 'dark' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setEditMode('dark')}
        >
          <Text
            style={[
              styles.modeButtonText,
              { color: editMode === 'dark' ? '#fff' : colors.text }
            ]}
          >
            深色主题
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {renderColorPickers()}

        <View style={styles.previewSection}>
          <Text variant="h4" style={styles.sectionTitle}>预览</Text>

          <View style={[styles.previewCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              主题预览
            </Text>

            <Text style={[styles.previewText, { color: colors.textSecondary }]}>
              这是一段次要文本，用于展示主题效果。
            </Text>

            <View style={[styles.previewDivider, { backgroundColor: colors.divider }]} />

            <View style={styles.previewButtons}>
              <TouchableOpacity
                style={[styles.previewButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.previewButtonText}>主要按钮</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewButton, { backgroundColor: colors.secondary }]}
              >
                <Text style={styles.previewButtonText}>次要按钮</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.previewStatus}>
              <View style={[styles.statusItem, { backgroundColor: colors.success }]}>
                <Text style={styles.statusText}>成功</Text>
              </View>

              <View style={[styles.statusItem, { backgroundColor: colors.info }]}>
                <Text style={styles.statusText}>信息</Text>
              </View>

              <View style={[styles.statusItem, { backgroundColor: colors.warning }]}>
                <Text style={styles.statusText}>警告</Text>
              </View>

              <View style={[styles.statusItem, { backgroundColor: colors.error }]}>
                <Text style={styles.statusText}>错误</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  resetButton: {
    padding: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
    elevation: 1,
  },
  modeLabel: {
    marginRight: 8,
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  modeButtonText: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  previewSection: {
    marginTop: 24,
  },
  previewCard: {
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  previewText: {
    marginBottom: 16,
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
    borderRadius: 4,
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
