import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Text } from '../../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Card } from '../../../components/common';
import * as Progress from 'react-native-progress';

// StatItem Component
const StatItem = ({ icon, value, label, color, loading }) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  return (
    <View style={styles.statItem}>
      <Icon name={icon} size={20} color={color || colors.primary} />
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }}/>
      ) : (
        <Text variant="h3" style={[styles.statItemValue, { color: color || colors.text }]}>{value}</Text>
      )}
      <Text variant="caption" style={styles.statItemLabel}>{label}</Text>
    </View>
  );
};

const ActivityDashboard = ({ data, loading, onNavigateToAnalytics }) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });

  const { today_stats, recent_activities } = data || {};
  const completionRate = today_stats?.completion_rate || 0;

  return (
    <View style={styles.container}>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text variant="h2">今日概览</Text>
          <TouchableOpacity onPress={onNavigateToAnalytics}>
            <Text variant="button" style={{ color: colors.primary }}>查看详情</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.summaryContent}>
          <View style={styles.progressContainer}>
            <Progress.Circle
              size={80}
              progress={completionRate / 100}
              showsText={true}
              formatText={() => `${completionRate}%`}
              color={colors.primary}
              unfilledColor={colors.border + '40'}
              borderColor={colors.card}
              textStyle={{ fontSize: 20, fontWeight: '600', color: colors.text }}
            />
            <Text variant="caption" style={styles.progressLabel}>完成率</Text>
          </View>
          <View style={styles.statsContainer}>
            <StatItem icon="check-circle-outline" value={today_stats?.completed || 0} label="已完成" color={colors.success} loading={loading} />
            <StatItem icon="hourglass-empty" value={today_stats?.in_progress || 0} label="进行中" color={colors.warning} loading={loading} />
            <StatItem icon="format-list-bulleted" value={today_stats?.total || 0} label="总计" color={colors.info} loading={loading} />
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <Text variant="h3" style={styles.sectionTitle}>最近活动</Text>
        {loading && !recent_activities?.length ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : recent_activities?.length > 0 ? (
          recent_activities.slice(0, 5).map((activity) => (
            <TouchableOpacity key={activity._id} style={styles.activityItem} activeOpacity={0.7}>
              <View style={[styles.activityIcon, { backgroundColor: getStatusColor(activity.status, colors) + '20' }]}>
                <Icon name={getActivityIcon(activity.type || activity.content_type)} size={20} color={getStatusColor(activity.status, colors)} />
              </View>
              <View style={styles.activityInfo}>
                <Text variant="body" style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
                <Text variant="caption" style={styles.activityTime}>
                  {activity.start_time
                    ? new Date(activity.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '刚刚'}
                </Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>暂无最近活动</Text>
        )}
      </View>
    </View>
  );
};

const getActivityIcon = (type) => {
    switch (type) {
        case 'diary': return 'book';
        case 'thought': return 'lightbulb';
        case 'activity': return 'directions-run';
        default: return 'list';
    }
};

const getStatusColor = (status, colors) => {
  switch (status) {
    case 'completed': return colors.success;
    case 'in_progress': return colors.warning;
    case 'published': return colors.primary;
    case 'paused': return colors.info;
    case 'cancelled': return colors.error;
    case 'planned': return colors.textSecondary;
    default: return colors.textSecondary;
  }
};

const getStyles = ({ colors }) => StyleSheet.create({
  container: { paddingBottom: 16 },
  summaryCard: { padding: 16, marginBottom: 24 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  summaryContent: { flexDirection: 'row', alignItems: 'center' },
  progressContainer: { alignItems: 'center', marginRight: 24 },
  progressLabel: { marginTop: 8 },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statItemValue: { marginTop: 4, fontWeight: '600' },
  statItemLabel: { marginTop: 2, fontSize: 12 },
  section: {},
  sectionTitle: { marginBottom: 12, fontSize: 18 },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: 12, borderRadius: 8, marginBottom: 8 },
  activityIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityInfo: { flex: 1 },
  activityTitle: { fontWeight: '500' },
  activityTime: { marginTop: 4, opacity: 0.6 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 14, color: colors.textSecondary },
});

export default ActivityDashboard;
