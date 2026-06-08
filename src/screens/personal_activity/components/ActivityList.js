import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Animated, Easing, RefreshControl } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Text } from '../../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Progress from 'react-native-progress';
import ImageGrid from './ImageGrid';

const MAX_CONTENT_LINES = 3;

const ActivityItem = ({ item, onPress, onImagePress }) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const statusColor = getStatusColor(item.status, colors);
  const [expanded, setExpanded] = useState(false);

  const contentLength = item.content?.length || 0;
  const shouldShowExpand = contentLength > 100;

  return (
    <View style={styles.itemContainer}>
      <View style={styles.itemHeader}>
        <View style={[styles.iconContainer, { backgroundColor: statusColor + '20' }]}>
          <Icon name={getActivityIcon(item.type)} size={24} color={statusColor} />
        </View>
        <View style={styles.itemContent}>
          <Text variant="body" style={styles.itemTitle} numberOfLines={1}>{item.title || '动态'}</Text>
          <Text variant="caption" style={styles.itemTime}>
            {new Date(item.start_time).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
      {item.content && (
        <View>
          <Text
            style={styles.contentText}
            numberOfLines={expanded ? undefined : MAX_CONTENT_LINES}
          >
            {item.content}
          </Text>
          {shouldShowExpand && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setExpanded(!expanded)}
            >
              <Text style={[styles.expandText, { color: colors.primary }]}>
                {expanded ? '收起' : '展开'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {item.images && item.images.length > 0 && (
        <ImageGrid images={item.images} onImagePress={(index) => onImagePress(item.images, index)} />
      )}
      {item.progress > 0 && (
        <View style={styles.progressWrapper}>
          <Progress.Bar progress={item.progress / 100} width={null} color={statusColor} unfilledColor={statusColor + '30'} borderWidth={0} height={4} />
        </View>
      )}
    </View>
  );
};

const ActivityList = ({ activities, loading, onActivityPress, onImagePress, onRefresh, refreshing, ListHeaderComponent }) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });

  // Blue twinkling star animation for empty state
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Icon name="auto-awesome" size={72} color="#3b82f6" />
      </Animated.View>
      <Text style={[styles.emptyText, { color: '#3b82f6' }]}>空空如也</Text>
      <Text style={styles.emptySubText}>发表第一条动态，记录属于你自己的零屿空间吧。</Text>
    </View>
  );

  return (
    <FlatList
      data={activities || []}
      renderItem={({ item }) => <ActivityItem item={item} onPress={onActivityPress} onImagePress={onImagePress} />}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3b82f6" // iOS
          colors={['#3b82f6']} // Android
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={!loading ? renderEmptyComponent() : <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />}
    />
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
    case 'paused': return colors.info;
    case 'cancelled': return colors.error;
    case 'planned': return colors.textSecondary;
    default: return colors.textSecondary;
  }
};

const getStyles = ({ colors }) => StyleSheet.create({
  listContainer: { paddingBottom: 20, paddingHorizontal: 16 },
  itemContainer: { backgroundColor: colors.card, padding: 12, borderRadius: 12, marginBottom: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemContent: { flex: 1 },
  itemTitle: { fontWeight: '600', marginBottom: 4 },
  itemTime: { color: colors.textSecondary },
  contentText: { color: colors.text, lineHeight: 22, marginVertical: 8 },
  expandButton: { paddingVertical: 8, marginTop: 4 },
  expandText: { fontSize: 14, fontWeight: '500' },
  progressWrapper: { marginTop: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 44, paddingBottom: 72, paddingHorizontal: 32, opacity: 0.7 },
  emptyText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: colors.textSecondary },
  emptySubText: { marginTop: 8, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

export default ActivityList;
