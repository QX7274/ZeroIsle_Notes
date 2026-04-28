/**
 * 知识库分析标签页
 * @description 展示知识缺口分析、知识密度、关键节点等分析结果。
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/common';
import { fetchKnowledgeBaseAnalysis } from '../../redux/slices/knowledgeBaseSlice';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants/dimensions';

const SEVERITY_COLORS = {
  high: '#E74C3C',
  medium: '#F39C12',
  low: '#3498DB',
};

const AnalysisTab = ({ kbId }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const dispatch = useDispatch();

  const { analysis, analysisStatus } = useSelector((state) => state.knowledgeBase);

  useEffect(() => {
    if (kbId) {
      dispatch(fetchKnowledgeBaseAnalysis(kbId));
    }
  }, [kbId, dispatch]);

  if (analysisStatus === 'loading' || !analysis) {
    return <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 知识密度卡片 */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>知识密度</Text>
        <View style={styles.densityContainer}>
          <View style={styles.densityCircleWrap}>
            <LinearGradient
              colors={[theme.colors.primary + '66', theme.colors.primary + '22']}
              start={{ x: 0.2, y: 0.1 }}
              end={{ x: 0.8, y: 0.9 }}
              style={styles.densityCircle}
            >
              <Text style={styles.densityValue}>{Math.round(analysis.densityScore * 100)}%</Text>
            </LinearGradient>
          </View>
          <Text style={styles.densityDescription}>
            当前知识库的知识密度为 {Math.round(analysis.densityScore * 100)}%，表示知识节点之间的连接程度较好。
          </Text>
        </View>
      </Card>

      {/* 知识缺口卡片 */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>知识缺口</Text>
        {analysis.knowledgeGaps.map(gap => (
          <TouchableOpacity key={gap.id} style={styles.gapItem}>
            <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[gap.severity] }]} />
            <View style={styles.gapContent}>
              <Text style={styles.gapTitle}>{gap.title}</Text>
              <Text style={styles.gapDescription}>{gap.description}</Text>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </Card>
      {/* 关键节点卡片 */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>关键节点</Text>
        {analysis.keyNodes.map((node, index) => (
          <TouchableOpacity key={node.id} style={styles.keyNodeItem}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.keyNodeContent}>
              <Text style={styles.keyNodeTitle}>{node.title}</Text>
              <Text style={styles.keyNodeStats}>
                {node.connections} 个连接 · 重要度 {Math.round(node.importance * 100)}%
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </Card>
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.medium,
  },
  card: {
    marginBottom: SPACING.medium,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS.large,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.medium,
  },
  densityContainer: {
    alignItems: 'center',
  },
  densityCircleWrap: {
    padding: 4,
    borderRadius: 64,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    marginBottom: SPACING.medium,
  },
  densityCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Style for the density value text
  densityValue: {
    fontSize: FONT_SIZES.xxxlarge,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  densityDescription: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  gapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.small,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  severityBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.medium,
  },
  gapContent: {
    flex: 1,
  },
  gapTitle: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.extraSmall,
  },
  gapDescription: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  keyNodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.small,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.medium,
  },
  rankText: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  keyNodeContent: {
    flex: 1,
  },
  keyNodeTitle: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.extraSmall,
  },
  keyNodeStats: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
  },
});

export default AnalysisTab;
