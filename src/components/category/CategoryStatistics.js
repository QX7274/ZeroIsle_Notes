/**
 * 分类统计组件
 * 显示分类的统计信息
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import { Card } from '../common';
import { useTheme } from '../../context/ThemeContext';

/**
 * 统计项组件
 */
const StatItem = ({ icon, label, value, color }) => {
  const { colors } = useTheme();
  const styles = getStatItemStyles(colors);

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
};

/**
 * 分类统计组件
 * @param {object} statistics - 统计数据
 * @param {number} statistics.totalCategories - 总分类数
 * @param {number} statistics.totalNotes - 总笔记数
 * @param {number} statistics.totalWords - 总字数
 * @param {object} statistics.mostUsedCategory - 使用最多的分类
 */
const CategoryStatistics = ({ statistics = {} }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const {
    totalCategories = 0,
    totalNotes = 0,
    totalWords = 0,
    mostUsedCategory = null,
  } = statistics;

  return (
    <Card style={styles.container}>
      <Text style={styles.title}>分类统计</Text>

      <View style={styles.statsGrid}>
        <StatItem
          icon="folder"
          label="总分类数"
          value={totalCategories}
          color={colors.primary}
        />
        <StatItem
          icon="note"
          label="总笔记数"
          value={totalNotes}
          color={colors.secondary}
        />
        <StatItem
          icon="text-fields"
          label="总字数"
          value={totalWords.toLocaleString()}
          color={colors.success}
        />
        {mostUsedCategory && (
          <StatItem
            icon="star"
            label="最常用"
            value={mostUsedCategory.name}
            color={colors.warning}
          />
        )}
      </View>
    </Card>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      padding: 16,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
  });

const getStatItemStyles = (colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '48%',
      marginBottom: 16,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    value: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    label: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });

export default CategoryStatistics;





