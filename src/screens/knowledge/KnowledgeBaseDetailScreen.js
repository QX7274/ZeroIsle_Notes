/**
 * 知识库详情屏幕
 * @description 使用标签页展示知识库的概览、内容、图谱、问答、分析和设置。
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SkeletonBlock, SkeletonListCards } from '../../components/common/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { fetchKnowledgeBaseDetails } from '../../redux/slices/knowledgeBaseSlice';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import QATab from './QATab';
import ContentTab from './ContentTab';
import GraphTab from './GraphTab';
import AnalysisTab from './AnalysisTab';
import SettingsTab from './SettingsTab';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants/dimensions';



// 概览标签页
const OverviewTab = ({ kb, styles }) => {
  const StatCard = ({ icon, value, label, color }) => (
    <View style={[styles.statBox, { borderLeftColor: color }]}>
      <Icon name={icon} size={24} color={color} style={styles.statIcon} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.tabContentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>描述</Text>
        <Text style={styles.description}>{kb.description || '暂无描述'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>核心指标</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="bubble-chart" value={kb.nodeCount ?? 0} label="知识节点" color={styles.statIcon.color} />
          <StatCard icon="device-hub" value={kb.edgeCount ?? 0} label="知识关系" color={styles.statIcon.color} />
          <StatCard icon="note" value={kb.noteCount ?? 0} label="关联笔记" color={styles.statIcon.color} />
          <StatCard icon="group" value={kb.memberCount ?? 1} label="成员" color={styles.statIcon.color} />
        </View>
      </View>
       <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近活动</Text>
        <Text style={styles.description}>功能正在开发中...</Text>
      </View>
    </ScrollView>
  );
};



const initialLayout = { width: Dimensions.get('window').width };

const KnowledgeBaseDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();

  const { id } = route.params || {};
  const dispatch = useDispatch();
  const { currentKnowledgeBase: kbDetail, status, error } = useSelector((state) => state.knowledgeBase);

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'overview', title: '概览' },
    { key: 'content', title: '内容' },
    { key: 'graph', title: '图谱' },
    { key: 'qa', title: '问答' },
    { key: 'analysis', title: '分析' },
    { key: 'settings', title: '设置' },
  ]);

  useEffect(() => {
    if (id) {
      dispatch(fetchKnowledgeBaseDetails(id));
    }
  }, [id, dispatch]);

  const openKnowledgeBaseEdit = () => {
    navigation.navigate('KnowledgeBaseEdit', { kbId: id });
  };

  const handleTabIndexChange = (nextIndex) => {
    setIndex(nextIndex);
  };

  const renderScene = SceneMap({
    overview: () => <OverviewTab kb={kbDetail} styles={styles} />,
    content: () => <ContentTab kbId={id} />,
    graph: () => <GraphTab kbId={id} />,
    qa: () => <QATab kbId={id} />,
    analysis: () => <AnalysisTab kbId={id} />,
    settings: () => <SettingsTab kbId={id} />,
  });

  if (status === 'loading' || !kbDetail) {
    return (
      <View style={styles.loader}>
        <SkeletonBlock height={56} borderRadius={12} style={{ marginBottom: SPACING.medium }} />
        <SkeletonListCards count={4} cardHeight={88} />
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>加载失败: {error?.message || '未知错误'}</Text>
      </View>
    );
  }

  const accent = kbDetail?.color || theme.colors.primary;
  const iconName = kbDetail?.icon || 'menu-book';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.pageHeaderTopRow}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.knowledgeBaseDetail.back"
            style={styles.backButton}
          />
          <TouchableOpacity
            style={[styles.headerActionBtn, { borderColor: accent }]}
            onPress={openKnowledgeBaseEdit}
            activeOpacity={0.7}
          >
            <Icon name="edit" size={18} color={accent} />
            <Text style={[styles.headerActionText, { color: accent }]}>编辑</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRow}>
          <View style={[styles.headerIconBadge, { backgroundColor: accent + '22' }]}>
            <Icon name={iconName} size={26} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{kbDetail.name}</Text>
            {!!kbDetail.updatedAt && (
              <Text style={styles.headerSubtitle}>更新于 {new Date(kbDetail.updatedAt).toLocaleDateString()}</Text>
            )}
          </View>
        </View>
      </View>

      <TabView
        style={styles.tabView}
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleTabIndexChange}
        initialLayout={initialLayout}
        renderTabBar={(props) => (
          <TabBar
            {...props}
            scrollEnabled
            style={{ backgroundColor: theme.colors.card }}
            indicatorStyle={{ backgroundColor: accent, height: 3 }}
            tabStyle={{ width: 'auto' }}
            renderLabel={({ route, focused }) => (
              <Text style={{
                color: focused ? accent : theme.colors.textSecondary,
                fontSize: FONT_SIZES.small,
                fontWeight: focused ? '700' : '500',
              }}>
                {route.title}
              </Text>
            )}
          />
        )}
      />
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: SPACING.medium,
    paddingBottom: SPACING.medium,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pageHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.medium,
  },
  backButton: {
    marginRight: SPACING.small,
  },
  headerCard: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.medium,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabView: {
    flex: 1,
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.small,
  },
  headerTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  headerActionText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  tabContentContainer: {
    padding: SPACING.medium,
  },
  section: {
    marginBottom: SPACING.large,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: SPACING.medium,
  },
  description: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.small / 2,
  },
  statBox: {
    backgroundColor: theme.colors.card,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.medium,
    width: '48%',
    marginBottom: SPACING.medium,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    marginHorizontal: '1%',
  },
  statIcon: {
    color: theme.colors.primary,
    marginRight: SPACING.medium,
  },
  statValue: {
    fontSize: FONT_SIZES.xlarge,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: FONT_SIZES.medium,
  },
});

export default KnowledgeBaseDetailScreen;
