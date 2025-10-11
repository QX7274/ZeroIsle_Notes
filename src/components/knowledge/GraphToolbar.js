/**
 * 知识图谱工具栏组件
 * 提供布局切换、过滤、导出等功能
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';

/**
 * 工具栏按钮组件
 */
const ToolbarButton = ({ icon, label, onPress, active = false }) => {
  const { colors } = useTheme();
  const styles = getButtonStyles(colors, active);

  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Icon name={icon} size={24} color={active ? colors.primary : colors.text} />
      {label && <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
};

/**
 * 知识图谱工具栏组件
 */
const GraphToolbar = ({
  onLayoutChange,
  onFilter,
  onAddNode,
  onAddEdge,
  onExport,
  onReset,
  currentLayout = 'force',
  showLabels = true,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // 布局选项
  const layouts = [
    { id: 'force', name: '力导向', icon: 'grain' },
    { id: 'radial', name: '径向', icon: 'trip-origin' },
    { id: 'tree', name: '树形', icon: 'account-tree' },
    { id: 'circular', name: '环形', icon: 'album' },
  ];

  // 处理布局切换
  const handleLayoutSelect = (layout) => {
    onLayoutChange && onLayoutChange(layout.id);
    setShowLayoutMenu(false);
  };

  return (
    <View style={styles.container}>
      {/* 左侧工具 */}
      <View style={styles.section}>
        {/* 布局切换 */}
        <ToolbarButton
          icon="view-comfy"
          label={showLabels ? '布局' : null}
          onPress={() => setShowLayoutMenu(true)}
        />

        {/* 过滤器 */}
        <ToolbarButton
          icon="filter-list"
          label={showLabels ? '过滤' : null}
          onPress={() => setShowFilterMenu(true)}
        />

        {/* 重置视图 */}
        <ToolbarButton
          icon="refresh"
          label={showLabels ? '重置' : null}
          onPress={onReset}
        />
      </View>

      {/* 右侧工具 */}
      <View style={styles.section}>
        {/* 添加节点 */}
        {onAddNode && (
          <ToolbarButton
            icon="add-circle-outline"
            label={showLabels ? '节点' : null}
            onPress={onAddNode}
          />
        )}

        {/* 添加边 */}
        {onAddEdge && (
          <ToolbarButton
            icon="timeline"
            label={showLabels ? '关系' : null}
            onPress={onAddEdge}
          />
        )}

        {/* 导出 */}
        {onExport && (
          <ToolbarButton
            icon="file-download"
            label={showLabels ? '导出' : null}
            onPress={onExport}
          />
        )}
      </View>

      {/* 布局选择菜单 */}
      <Modal
        visible={showLayoutMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLayoutMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLayoutMenu(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>选择布局</Text>
            {layouts.map((layout) => (
              <TouchableOpacity
                key={layout.id}
                style={[
                  styles.menuItem,
                  currentLayout === layout.id && styles.menuItemActive,
                ]}
                onPress={() => handleLayoutSelect(layout)}
              >
                <Icon
                  name={layout.icon}
                  size={24}
                  color={
                    currentLayout === layout.id ? colors.primary : colors.text
                  }
                />
                <Text
                  style={[
                    styles.menuItemText,
                    currentLayout === layout.id && styles.menuItemTextActive,
                  ]}
                >
                  {layout.name}
                </Text>
                {currentLayout === layout.id && (
                  <Icon name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 过滤器菜单 - 简化版 */}
      <Modal
        visible={showFilterMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterMenu(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>过滤器</Text>
            <Text style={styles.comingSoon}>即将推出...</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 8,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    section: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      minWidth: 250,
      maxWidth: 320,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    menuTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    menuItemActive: {
      backgroundColor: colors.primaryLight,
    },
    menuItemText: {
      fontSize: 16,
      color: colors.text,
      marginLeft: 12,
      flex: 1,
    },
    menuItemTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    comingSoon: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      padding: 20,
    },
  });

const getButtonStyles = (colors, active) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      marginHorizontal: 4,
      borderRadius: 8,
      backgroundColor: active ? colors.primaryLight : 'transparent',
    },
    label: {
      fontSize: 12,
      color: colors.text,
      marginLeft: 4,
    },
  });

export default GraphToolbar;




