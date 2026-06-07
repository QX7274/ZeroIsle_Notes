/**
 * 零屿空间主界面
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import { useFocusEffect } from '@react-navigation/native';


// 导入子组件
import ActivityList from './components/ActivityList';
import ImageViewer from '../../components/personal_activity/ImageViewer';
import QuickAddButton from './components/QuickAddButton';

// 导入Redux actions
import {
  fetchActivities,
} from '../../redux/slices/personalActivitySlice';

const PersonalActivityScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { activities, loading } = useSelector(state => state.personalActivity);

  const [refreshing, setRefreshing] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  // 设置导航栏
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const loadInitialData = useCallback(async () => {
    try {
      await dispatch(fetchActivities()).unwrap();
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [loadInitialData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadInitialData();
    } catch (err) {
      Alert.alert('刷新失败', err.message || '请稍后重试');
    } finally {
      setRefreshing(false);
    }
  };



  const navigateToActivityForm = (activity = null) => {
    Haptics.mediumFeedback();
    navigation.navigate('ActivityForm', { activity });
  };



  const handleImagePress = (images, initialIndex = 0) => {
    setViewerImages(images);
    setViewerInitialIndex(initialIndex);
    setImageViewerVisible(true);
  };

  const closeImageViewer = () => {
    setImageViewerVisible(false);
    setViewerImages([]);
    setViewerInitialIndex(0);
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const header = useCallback(() => {
    const rotate = pulse.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const scale = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] });
    const opacity = pulse.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0.3, 0.7, 0.7, 0.3] });

    const managementEntries = [
      {
        key: 'GoalManager',
        title: '目标管理',
        description: '管理长期目标与进度',
        icon: 'flag',
        accent: '#3B82F6',
      },
      {
        key: 'PersonalActivitySettings',
        title: '分类管理',
        description: '整理零屿空间分类',
        icon: 'folder-copy',
        accent: '#0EA5A4',
      },
      {
        key: 'PersonalActivityAnalytics',
        title: '数据分析',
        description: '查看活动统计趋势',
        icon: 'insights',
        accent: '#F59E0B',
      },
    ];

    return (
      <View>
        <View style={[styles.topBar, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}>
          <Text variant="h2" style={{ color: colors.text }}>零屿空间</Text>
        </View>
        <View style={[styles.hero, { backgroundColor: colors.card }]}>
          <Animated.View style={[styles.animatedBg, { transform: [{ rotate }], opacity }]}>
            <Icon name="all-inclusive" size={200} color={colors.primary + '20'} />
          </Animated.View>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Icon name="auto-awesome" size={32} color={colors.primary} />
          </Animated.View>
          <Text style={[styles.heroSub, { color: colors.text + '90' }]}>记录生活点滴</Text>
        </View>
        <View style={[styles.managementPanel, { backgroundColor: colors.card }]}>
          <View style={styles.managementHeader}>
            <Text variant="h3" style={{ color: colors.text }}>空间管理</Text>
            <Text variant="caption" style={{ color: colors.textSecondary }}>让规划功能真正可达</Text>
          </View>
          <View style={styles.managementGrid} testID="list.personalActivity.managementEntries">
            {managementEntries.map((entry) => (
              <TouchableOpacity
                key={entry.key}
                style={[
                  styles.managementCard,
                  {
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    borderColor: `${entry.accent}33`,
                    shadowColor: entry.accent,
                  },
                ]}
                onPress={() => navigation.navigate(entry.key)}
                activeOpacity={0.88}
                testID={`entry.personalActivity.management.${entry.key}`}
              >
                <View style={[styles.managementIconWrap, { backgroundColor: `${entry.accent}18` }]}>
                  <Icon name={entry.icon} size={22} color={entry.accent} />
                </View>
                <Text style={[styles.managementTitle, { color: colors.text }]}>{entry.title}</Text>
                <Text style={[styles.managementDesc, { color: colors.textSecondary }]}>{entry.description}</Text>
                <Icon name="chevron-right" size={18} color={entry.accent} style={styles.managementArrow} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }, [colors.background, colors.card, colors.primary, colors.text, insets.top, pulse]);



  const currentActivities = activities || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityList
        activities={currentActivities}
        loading={loading}
        onActivityPress={(activity) => navigateToActivityForm(activity)}
        onImagePress={handleImagePress}
        onRefresh={onRefresh}
        refreshing={refreshing}
        ListHeaderComponent={header}
      />
      <QuickAddButton onPress={() => navigateToActivityForm(null)} />
      <ImageViewer visible={imageViewerVisible} images={viewerImages} initialIndex={viewerInitialIndex} onClose={closeImageViewer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hero: {
    height: 220, // Increased height
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E020',
    position: 'relative',
  },
  animatedBg: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 300,
    height: 300,
    marginLeft: -150,
    marginTop: -150,
  },
  heroSub: {
    fontSize: 16,
    letterSpacing: 1,
    marginTop: 16,
  },
  managementPanel: {
    marginTop: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.16)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  managementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  managementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  managementCard: {
    width: '48.5%',
    minHeight: 124,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  managementIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  managementTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  managementDesc: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    paddingRight: 18,
  },
  managementArrow: {
    position: 'absolute',
    top: 14,
    right: 10,
  },
});

export default PersonalActivityScreen;
