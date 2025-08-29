import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';

const ReminderStatisticsView = ({ navigation }) => {
  const { theme } = useTheme();
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
      style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color="#ffffff" />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  // 渲染分类统计
  const renderCategoryStats = () => {
    if (!statistics || !statistics.categories) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>分类统计</Text>
        <View style={styles.categoryContainer}>
          {Object.entries(statistics.categories).map(([id, data]) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.categoryItem,
                { backgroundColor: theme.cardBackground }
              ]}
              onPress={() => navigation.navigate('ReminderList', { category: id })}
            >
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryName, { color: theme.text }]}>{data.name}</Text>
                <Text style={[styles.categoryCount, { color: theme.primary }]}>{data.count}</Text>
              </View>
              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: theme.primary,
                      width: `${(data.count / statistics.active) * 100}%`,
                    }
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
    if (!statistics || !statistics.priorities) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>优先级统计</Text>
        <View style={styles.priorityContainer}>
          {Object.entries(statistics.priorities).map(([id, data]) => {
            // 获取优先级颜色
            let color;
            switch (id) {
              case 'high':
                color = theme.error;
                break;
              case 'medium':
                color = theme.warning;
                break;
              case 'low':
                color = theme.success;
                break;
              default:
                color = theme.primary;
            }

            return (
              <TouchableOpacity
                key={id}
                style={[
                  styles.priorityItem,
                  { backgroundColor: theme.cardBackground }
                ]}
                onPress={() => navigation.navigate('ReminderList', { priority: id })}
              >
                <View style={[styles.priorityDot, { backgroundColor: color }]} />
                <Text style={[styles.priorityName, { color: theme.text }]}>{data.name}</Text>
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
    if (!statistics || !statistics.frequencies) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>重复频率统计</Text>
        <View style={styles.frequencyContainer}>
          {Object.entries(statistics.frequencies).map(([id, data]) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.frequencyItem,
                { backgroundColor: theme.cardBackground }
              ]}
              onPress={() => navigation.navigate('ReminderList', { frequency: id })}
            >
              <Text style={[styles.frequencyName, { color: theme.text }]}>{data.name}</Text>
              <Text style={[styles.frequencyCount, { color: theme.primary }]}>{data.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : error ? (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      ) : statistics ? (
        <>
          <View style={styles.statsGrid}>
            {renderStatCard(
              '总提醒',
              statistics.total,
              'event-note',
              theme.primary,
              () => navigation.navigate('ReminderList')
            )}
            {renderStatCard(
              '活跃提醒',
              statistics.active,
              'notifications-active',
              theme.success,
              () => navigation.navigate('ReminderList', { is_completed: false })
            )}
            {renderStatCard(
              '已完成',
              statistics.completed,
              'check-circle',
              theme.info,
              () => navigation.navigate('ReminderList', { is_completed: true })
            )}
            {renderStatCard(
              '已过期',
              statistics.overdue,
              'timer-off',
              theme.error,
              () => navigation.navigate('ReminderList', { overdue: true })
            )}
          </View>

          <View style={[styles.completionCard, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.completionTitle, { color: theme.text }]}>完成率</Text>
            <View style={styles.completionContent}>
              <View style={styles.completionProgressContainer}>
                <View
                  style={[
                    styles.completionProgressBar,
                    {
                      backgroundColor: theme.primary,
                      width: `${statistics.completion_rate}%`,
                    }
                  ]}
                />
              </View>
              <Text style={[styles.completionRate, { color: theme.primary }]}>
                {statistics.completion_rate}%
              </Text>
            </View>
          </View>

          {renderCategoryStats()}
          {renderPriorityStats()}
          {renderFrequencyStats()}

          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ReminderExport')}
          >
            <Icon name="import-export" size={20} color="#ffffff" />
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
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
  },
  completionCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  completionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completionProgressContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginRight: 12,
  },
  completionProgressBar: {
    height: 8,
    borderRadius: 4,
  },
  completionRate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  categoryContainer: {
    marginBottom: 8,
  },
  categoryItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    borderRadius: 2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  priorityDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  priorityName: {
    fontSize: 14,
    marginBottom: 4,
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
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
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
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    padding: 16,
  },
});

export default ReminderStatisticsView;
