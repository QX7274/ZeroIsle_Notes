/**
 * 数据分析界面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import personalActivityApi from '../../services/api/personalActivityApi';

const { width } = Dimensions.get('window');

const AnalyticsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('reports');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [activeTab]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'reports') {
        const response = await personalActivityApi.getAnalyticsReports({ type: 'weekly' });
        setReportData(response.data);
      } else if (activeTab === 'insights') {
        const response = await personalActivityApi.getInsights();
        setInsights(response.data.insights || []);
      } else if (activeTab === 'trends') {
        const response = await personalActivityApi.getTrends({ period: 'week', metric: 'completion_rate' });
        setTrends(response.data);
      }
    } catch (error) {
      console.error('加载分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTabBar = () => {
    const tabs = [
      { key: 'reports', title: '报告', icon: 'assessment' },
      { key: 'insights', title: '洞察', icon: 'lightbulb' },
      { key: 'trends', title: '趋势', icon: 'trending_up' },
    ];

    return (
      <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabItem,
              activeTab === tab.key && { backgroundColor: colors.primary + '15' },
            ]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Icon
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? colors.primary : colors.text + '80'}
            />
            <Text
              variant="caption"
              style={[
                styles.tabText,
                { color: activeTab === tab.key ? colors.primary : colors.text + '80' },
              ]}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderReports = () => {
    if (!reportData) {return null;}

    return (
      <View style={styles.reportsContainer}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text variant="h3" style={styles.cardTitle}>周报摘要</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text variant="h2" style={[styles.summaryValue, { color: colors.primary }]}>
                {reportData.summary.total_activities}
              </Text>
              <Text variant="caption" style={styles.summaryLabel}>总活动数</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="h2" style={[styles.summaryValue, { color: colors.success }]}>
                {reportData.summary.completed_activities}
              </Text>
              <Text variant="caption" style={styles.summaryLabel}>已完成</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="h2" style={[styles.summaryValue, { color: colors.warning }]}>
                {reportData.summary.completion_rate}%
              </Text>
              <Text variant="caption" style={styles.summaryLabel}>完成率</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="h2" style={[styles.summaryValue, { color: colors.info }]}>
                {reportData.summary.average_satisfaction}
              </Text>
              <Text variant="caption" style={styles.summaryLabel}>平均满意度</Text>
            </View>
          </View>
        </View>

        <View style={[styles.categoryCard, { backgroundColor: colors.card }]}>
          <Text variant="h3" style={styles.cardTitle}>分类统计</Text>
          {reportData.category_breakdown.map((category, index) => (
            <View key={index} style={styles.categoryItem}>
              <View style={styles.categoryInfo}>
                <Text variant="body" style={styles.categoryName}>{category.category}</Text>
                <Text variant="caption" style={styles.categoryStats}>
                  {category.completed}/{category.count} 活动
                </Text>
              </View>
              <View style={styles.categoryProgress}>
                <Text variant="caption" style={styles.categoryRate}>
                  {category.completion_rate}%
                </Text>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${category.completion_rate}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderInsights = () => {
    if (insights.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Icon name="lightbulb" size={64} color={colors.text + '40'} />
          <Text style={[styles.emptyText, { color: colors.text + '60' }]}>
            暂无智能洞察
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.text + '40' }]}>
            记录更多活动后将生成个性化建议
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.insightsContainer}>
        {insights.map((insight, index) => (
          <View key={index} style={[styles.insightCard, { backgroundColor: colors.card }]}>
            <View style={styles.insightHeader}>
              <Icon
                name={getInsightIcon(insight.type)}
                size={24}
                color={getInsightColor(insight.type, colors)}
              />
              <Text variant="body" style={styles.insightTitle}>{insight.title}</Text>
            </View>
            <Text variant="caption" style={styles.insightDescription}>
              {insight.description}
            </Text>
            {insight.action_items && insight.action_items.length > 0 && (
              <View style={styles.actionItems}>
                <Text variant="caption" style={styles.actionTitle}>建议行动:</Text>
                {insight.action_items.map((action, actionIndex) => (
                  <Text key={actionIndex} variant="caption" style={styles.actionItem}>
                    • {action}
                  </Text>
                ))}
              </View>
            )}
            <View style={styles.confidenceBar}>
              <Text variant="caption" style={styles.confidenceLabel}>
                置信度: {Math.round(insight.confidence * 100)}%
              </Text>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: getInsightColor(insight.type, colors),
                      width: `${insight.confidence * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTrends = () => {
    if (!trends) {return null;}

    return (
      <View style={styles.trendsContainer}>
        <View style={[styles.trendCard, { backgroundColor: colors.card }]}>
          <Text variant="h3" style={styles.cardTitle}>
            {getTrendTitle(trends.metric)} 趋势
          </Text>
          <Text variant="caption" style={styles.trendPeriod}>
            时间周期: {getTrendPeriodText(trends.period)}
          </Text>

          {/* 简单的趋势图表 */}
          <View style={styles.chartContainer}>
            <View style={styles.chartArea}>
              {trends.trend_data.map((point, index) => {
                const maxValue = Math.max(...trends.trend_data.map(p => p.value));
                const height = maxValue > 0 ? (point.value / maxValue) * 100 : 0;

                return (
                  <View key={index} style={styles.chartBar}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${height}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                    <Text variant="caption" style={styles.barLabel}>
                      {point.value.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'pattern': return 'insights';
      case 'recommendation': return 'recommend';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const getInsightColor = (type, colors) => {
    switch (type) {
      case 'pattern': return colors.info;
      case 'recommendation': return colors.success;
      case 'warning': return colors.warning;
      default: return colors.primary;
    }
  };

  const getTrendTitle = (metric) => {
    switch (metric) {
      case 'completion_rate': return '完成率';
      case 'activity_count': return '活动数量';
      case 'satisfaction': return '满意度';
      default: return '数据';
    }
  };

  const getTrendPeriodText = (period) => {
    switch (period) {
      case 'week': return '按周统计';
      case 'month': return '按月统计';
      case 'quarter': return '按季度统计';
      default: return '时间统计';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text variant="h2" style={styles.headerTitle}>数据分析</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 标签栏 */}
      {renderTabBar()}

      {/* 内容区域 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text + '60' }]}>
              加载分析数据中...
            </Text>
          </View>
        ) : (
          <>
            {activeTab === 'reports' && renderReports()}
            {activeTab === 'insights' && renderInsights()}
            {activeTab === 'trends' && renderTrends()}
          </>
        )}
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
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  reportsContainer: {
    paddingBottom: 20,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    marginTop: 4,
    opacity: 0.7,
  },
  categoryCard: {
    padding: 16,
    borderRadius: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontWeight: '500',
  },
  categoryStats: {
    marginTop: 2,
    opacity: 0.7,
  },
  categoryProgress: {
    width: 80,
    alignItems: 'flex-end',
  },
  categoryRate: {
    marginBottom: 4,
    fontSize: 12,
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  insightsContainer: {
    paddingBottom: 20,
  },
  insightCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    marginLeft: 12,
    fontWeight: '600',
    flex: 1,
  },
  insightDescription: {
    marginBottom: 12,
    lineHeight: 18,
  },
  actionItems: {
    marginBottom: 12,
  },
  actionTitle: {
    fontWeight: '500',
    marginBottom: 4,
  },
  actionItem: {
    marginLeft: 8,
    marginBottom: 2,
    opacity: 0.8,
  },
  confidenceBar: {
    marginTop: 8,
  },
  confidenceLabel: {
    marginBottom: 4,
    fontSize: 12,
  },
  trendsContainer: {
    paddingBottom: 20,
  },
  trendCard: {
    padding: 16,
    borderRadius: 12,
  },
  trendPeriod: {
    marginBottom: 16,
    opacity: 0.7,
  },
  chartContainer: {
    height: 200,
    marginTop: 16,
  },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  bar: {
    width: '80%',
    minHeight: 4,
    borderRadius: 2,
  },
  barLabel: {
    marginTop: 4,
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default AnalyticsScreen;
