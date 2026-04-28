/**
 * 知识库图谱标签页
 * @description 在知识库详情页中嵌入知识图谱的可视化展示。
 */
import React from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import KnowledgeGraphScreen from './KnowledgeGraphScreen';
import { useTheme } from '../../context/ThemeContext';

const GraphTab = ({ kbId }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <KnowledgeGraphScreen kbId={kbId} embedded={true} />
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

export default GraphTab;

