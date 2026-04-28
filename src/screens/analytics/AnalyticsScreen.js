import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { format, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import reminderApi from '../../services/api/reminderApi';

const AnalyticsScreen = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');
  const [stats, setStats] = useState({
    reminderStats: {
      total: 0,
      completed: 0,
      pending: 0,
    },
    dailyStats: [],
    categoryStats: [],
  });

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [statisticsResponse, dailyStats] = await Promise.all([
        reminderApi.getReminderStatistics(),
        loadDailyStats(timeRange),
      ]);

      const statisticsData = statisticsResponse?.data || {};
      const reminderStats = {
        total: statisticsData.total ?? 0,
        completed: statisticsData.completed ?? 0,
        pending: statisticsData.active ?? 0,
      };

      const categoryStats = mapCategoryStats(statisticsData.categories || {});

      setStats({
        reminderStats,
        dailyStats,
        categoryStats,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapCategoryStats = (categories) => {
    if (!categories || typeof categories !== 'object') {
      return [];
    }

    return Object.values(categories).map((category) => ({
      name: category?.name || '未分类',
      count: category?.count ?? 0,
    }));
  };

  const loadDailyStats = async (range) => {
    const days = range === 'day' ? 1 : range === 'month' ? 30 : 7;
    const now = new Date();
    const dateList = Array.from({ length: days }, (_, index) => subDays(now, index)).reverse();
    const months = getMonthKeys(dateList);
    const calendarResponses = await Promise.all(
      months.map((monthKey) => {
        const [year, month] = monthKey.split('-');
        return reminderApi.getCalendarData(Number(year), Number(month));
      })
    );

    const calendarData = calendarResponses.reduce((acc, response) => {
      if (response?.data && typeof response.data === 'object') {
        Object.entries(response.data).forEach(([day, items]) => {
          if (!acc[day]) {
            acc[day] = [];
          }
          if (Array.isArray(items)) {
            acc[day].push(...items);
          }
        });
      }
      return acc;
    }, {});

    return dateList.map((date) => {
      const dayKey = String(date.getDate());
      const count = Array.isArray(calendarData[dayKey]) ? calendarData[dayKey].length : 0;
      return {
        date: format(date, 'MM-dd', { locale: zhCN }),
        count,
      };
    });
  };

  const getMonthKeys = (dates) => {
    const uniqueKeys = new Set();
    dates.forEach((date) => {
      uniqueKeys.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
    });
    return Array.from(uniqueKeys);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>数据分析</Text>
        <View style={styles.timeRangeContainer}>
          {['day', 'week', 'month'].map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                {
                  backgroundColor: timeRange === range ? theme.primary : theme.cardBackground,
                },
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  { color: timeRange === range ? '#fff' : theme.text },
                ]}
              >
                {range === 'day' ? '日' : range === 'week' ? '周' : '月'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>提醒统计</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {stats.reminderStats.total}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>总数</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.success }]}>
              {stats.reminderStats.completed}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>已完成</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.warning }]}>
              {stats.reminderStats.pending}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>待完成</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>每日提醒趋势</Text>
        <LineChart
          data={{
            labels: stats.dailyStats.map(stat => stat.date),
            datasets: [
              {
                data: stats.dailyStats.map(stat => stat.count),
              },
            ],
          }}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={{
            backgroundColor: theme.cardBackground,
            backgroundGradientFrom: theme.cardBackground,
            backgroundGradientTo: theme.cardBackground,
            decimalPlaces: 0,
            color: (opacity = 1) => theme.primary,
            labelColor: (opacity = 1) => theme.text,
            style: {
              borderRadius: 16,
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>提醒分类</Text>
        <PieChart
          data={stats.categoryStats.map((stat, index) => ({
            name: stat.name,
            count: stat.count,
            color: getCategoryColor(index),
            legendFontColor: theme.text,
            legendFontSize: 12,
          }))}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={{
            color: (opacity = 1) => theme.primary,
          }}
          accessor="count"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    </ScrollView>
  );
};

const getCategoryColor = (index) => {
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'];
  return colors[index % colors.length];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  timeRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  card: {
    margin: 20,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});

export default AnalyticsScreen;
