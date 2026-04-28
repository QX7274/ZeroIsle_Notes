import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';
import { SPACING, RADIUS, ELEVATION, SIZE, BORDER, OPACITY } from '../../theme/tokens';

const ReminderStatisticsView = ({ navigation }) => {
  const { theme } = useTheme();
  // Ensure we have correct color references
  const colors = theme.colors || theme;

  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(API_ENDPOINTS.REMINDER.STATISTICS);
      setStatistics(response.data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setError('获取统计数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchStatistics();
  }, []);

  // 渲染统计卡片
  const renderStatCard = (title, value, icon, color, onPress) => (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: colors.card || colors.surface }]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Icon name={icon} size={SIZE.icon.lg} color="#ffffff" />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  // 渲染分类统计
  const renderCategoryStats = () => {
    if (!statistics || !statistics.categories) {return null;}

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>分类统计</Text>
        <View style={styles.categoryContainer}>
          {Object.entries(statistics.categories).map(([id, data]) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.categoryItem,
                { backgroundColor: colors.card || colors.surface },
              ]}
              onPress={() => navigation.navigate('ReminderList', { category: id })}
            >
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryName, { color: colors.text }]}>{data.name}</Text>
                <Text style={[styles.categoryCount, { color: colors.primary }]}>{data.count}</Text>
              </View>
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: colors.primary,
                      width: `${(data.count / statistics.active) * 100}%`,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // 渲染优先级统计
  const renderPriorityStats = () => {
    if (!statistics || !statistics.priorities) {return null;}

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>优先级统计</Text>
        <View style={styles.priorityContainer}>
          {Object.entries(statistics.priorities).map(([id, data]) => {
            // 获取优先级颜色
            let color;
            switch (id) {
              case 'high':
                color = colors.error;
                break;
              case 'medium':
                color = colors.warning;
                break;
              case 'low':
                color = colors.success;
                break;
              default:
                color = colors.primary;
            }

            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.priorityItem,
                  { backgroundColor: colors.card || colors.surface },
                ]}
                onPress={() => navigation.navigate('ReminderList', { priority: id })}
              >
                <View style={[styles.priorityDot, { backgroundColor: color }]} />
                <Text style={[styles.priorityName, { color: colors.text }]}>{data.name}</Text>
                <Text style={[styles.priorityCount, { color }]}>{data.count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // 渲染频率统计
  const renderFrequencyStats = () => {
    if (!statistics || !statistics.frequencies) {return null;}

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>重复频率统计</Text>
        <View style={styles.frequencyContainer}>
          {Object.entries(statistics.frequencies).map(([id, data]) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.frequencyItem,
                { backgroundColor: colors.card || colors.surface },
              ]}
              onPress={() => navigation.navigate('ReminderList', { frequency: id })}
            >
              <Text style={[styles.frequencyName, { color: colors.text }]}>{data.name}</Text>
              <Text style={[styles.frequencyCount, { color: colors.primary }]}>{data.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : statistics ? (
        <>
          <View style={styles.statsGrid}>
            {renderStatCard(
              '总提醒',
              statistics.total,
              'event-note',
              colors.primary,
              () => navigation.navigate('ReminderList')
            )}
            {renderStatCard(
              '活跃提醒',
              statistics.active,
              'notifications-active',
              colors.success,
              () => navigation.navigate('ReminderList', { is_completed: false })
            )}
            {renderStatCard(
              '已完成',
              statistics.completed,
              'check-circle',
              colors.info,
              () => navigation.navigate('ReminderList', { is_completed: true })
            )}
            {renderStatCard(
              '已过期',
              statistics.overdue,
              'timer-off',
              colors.error,
              () => navigation.navigate('ReminderList', { overdue: true })
            )}
          </View>

          <View style={[styles.completionCard, { backgroundColor: colors.card || colors.surface }]}>
            <Text style={[styles.completionTitle, { color: colors.text }]}>完成率</Text>
            <View style={styles.completionContent}>
              <View style={styles.completionProgressContainer}>
                <View
                  style={[
                    styles.completionProgressBar,
                    {
                      backgroundColor: colors.primary,
                      width: `${statistics.completion_rate}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.completionRate, { color: colors.primary }]}>
                {statistics.completion_rate}%
              </Text>
            </View>
          </View>

          {renderCategoryStats()}
          {renderPriorityStats()}
          {renderFrequencyStats()}

          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('ReminderExport')}
          >
            <Icon name="import-export" size={SIZE.icon.md} color="#ffffff" />
            <Text style={styles.exportButtonText}>导入/导出提醒数据</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  statCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    ...ELEVATION.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.ms,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  statTitle: {
    fontSize: 14,
  },
  completionCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    ...ELEVATION.sm,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  completionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completionProgressContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0', // Could use token if available
    borderRadius: RADIUS.sm,
    marginRight: SPACING.ms,
  },
  completionProgressBar: {
    height: 8,
    borderRadius: RADIUS.sm,
  },
  completionRate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.ms,
  },
  categoryContainer: {
    marginBottom: SPACING.sm,
  },
  categoryItem: {
    padding: SPACING.ms,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    ...ELEVATION.xs,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: RADIUS.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: RADIUS.xs,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: SPACING.ms,
    marginHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
    ...ELEVATION.xs,
  },
  priorityDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  priorityName: {
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  priorityCount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  frequencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  frequencyItem: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.ms,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    ...ELEVATION.xs,
  },
  frequencyName: {
    fontSize: 14,
  },
  frequencyCount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  exportButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.ms,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: SPACING.sm,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  errorText: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    padding: SPACING.md,
  },
});

export default ReminderStatisticsView;
