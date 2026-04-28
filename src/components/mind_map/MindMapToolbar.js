/**
 * 思维导图工具栏组件
 * 提供思维导图编辑工具
 * Refactored with Design Tokens
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, SIZE, BORDER, ELEVATION, RADIUS } from '../../theme/tokens';

const MindMapToolbar = ({
  onAddNode,
  onGenerateFromNote,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // 工具按钮配置
  const tools = [
    {
      id: 'add-node',
      icon: 'add-circle-outline',
      label: '添加节点',
      onPress: onAddNode,
    },
    {
      id: 'generate',
      icon: 'auto-awesome',
      label: '从笔记生成',
      onPress: onGenerateFromNote,
    },
    {
      id: 'undo',
      icon: 'undo',
      label: '撤销',
      onPress: onUndo,
    },
    {
      id: 'redo',
      icon: 'redo',
      label: '重做',
      onPress: onRedo,
    },
    {
      id: 'zoom-in',
      icon: 'add',
      label: '放大',
      onPress: onZoomIn,
    },
    {
      id: 'zoom-out',
      icon: 'remove',
      label: '缩小',
      onPress: onZoomOut,
    },
    {
      id: 'reset-zoom',
      icon: 'center-focus-strong',
      label: '重置缩放',
      onPress: onResetZoom,
    },
  ];

  // 渲染工具按钮
  const renderToolButton = (tool) => (
    <TouchableOpacity
      key={tool.id}
      style={styles.toolButton}
      onPress={tool.onPress}
      disabled={!tool.onPress}
    >
      <Icon
        name={tool.icon}
        size={SIZE.icon.lg}
        color={tool.onPress ? colors.text : (colors.textDisabled || '#BDBDBD')}
      />
      <Text
        style={[
          styles.toolLabel,
          { color: tool.onPress ? colors.text : (colors.textDisabled || '#BDBDBD') },
        ]}
      >
        {tool.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsContainer}
      >
        {tools.map(renderToolButton)}
      </ScrollView>
    </View>
  );
};

// 样式
const getStyles = (colors) => StyleSheet.create({
  container: {
    borderBottomWidth: BORDER.width.thin,
    borderBottomColor: colors.border,
    backgroundColor: colors.card || colors.surface,
    ...ELEVATION.sm,
  },
  toolsContainer: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  toolButton: {
    alignItems: 'center',
    marginRight: SPACING.lg,
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  toolLabel: {
    fontSize: 12, // Small label
    marginTop: SPACING.xs,
  },
});

export default MindMapToolbar;
