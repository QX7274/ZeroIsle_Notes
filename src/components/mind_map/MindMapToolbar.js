/**
 * 思维导图工具栏组件
 * 提供思维导图编辑工具
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
        size={24}
        color={tool.onPress ? colors.text : colors.textDisabled}
      />
      <Text
        style={[
          styles.toolLabel,
          { color: tool.onPress ? colors.text : colors.textDisabled }
        ]}
      >
        {tool.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolsContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolButton: {
    alignItems: 'center',
    marginRight: 24,
  },
  toolLabel: {
    fontSize: 12,
    marginTop: 4,
  },
});

export default MindMapToolbar;
