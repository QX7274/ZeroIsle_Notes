import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  Animated,
  StatusBar,
  Image
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { notesApi } from '../services/api';
import { addNote, updateNote, deleteNote } from '../redux/slices/notesSlice';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { Card, Button } from '../components/common';
import { SPACING, SHADOW, BORDER_RADIUS } from '../utils/constants/dimensions';
import { createHorizontalGradient } from '../utils/gradientUtils';

const HomeScreen = ({ navigation }) => {
  const { colors, isDarkMode } = useTheme();
  const dispatch = useDispatch();
  const notes = useSelector(state => state.notes.notes);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 动画值
  const scrollY = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(1)).current;

  // 渐变色
  const headerGradient = isDarkMode
    ? colors.gradients.header
    : ['#4361EE', '#4CC9F0'];

  useEffect(() => {
    loadNotes();

    // 设置状态栏
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }
  }, []);

  // 监听滚动，控制FAB动画
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      // 当滚动超过50时，开始缩小FAB
      if (value > 50) {
        Animated.spring(fabAnim, {
          toValue: 0.8,
          friction: 5,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(fabAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [scrollY, fabAnim]);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await notesApi.getAll();
      dispatch(updateNote(response));
    } catch (error) {
      console.error('加载笔记失败:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotes();
  };

  const renderNoteItem = ({ item, index }) => {
    // 为每个笔记选择不同的渐变色
    const gradientColors = getGradientForIndex(index);

    // 计算动画延迟，实现列表项的交错动画
    const animDelay = index * 100;

    return (
      <Animated.View
        style={[
          styles.noteItemContainer,
          {
            opacity: 1,
            transform: [{
              translateY: 0
            }],
          }
        ]}
      >
        <Card
          variant="gradient"
          gradientType={getGradientTypeForIndex(index)}
          elevation="medium"
          hoverable
          onPress={() => navigation.navigate('Note', { note: item })}
          style={styles.noteItem}
        >
          <View style={styles.noteContent}>
            <Text style={[styles.noteTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title || '无标题笔记'}
            </Text>

            <Text style={[styles.noteExcerpt, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.content || '无内容'}
            </Text>

            <View style={styles.noteFooter}>
              <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
                {formatDate(item.updatedAt)}
              </Text>

              <View style={styles.noteActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Note', { note: item })}
                  style={styles.actionButton}
                >
                  <Icon name="pencil" size={16} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeleteNote(item.id)}
                  style={styles.actionButton}
                >
                  <Icon name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Card>
      </Animated.View>
    );
  };

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  };

  // 根据索引获取渐变类型
  const getGradientTypeForIndex = (index) => {
    const types = ['primary', 'secondary', 'success', 'info'];
    return types[index % types.length];
  };

  // 根据索引获取渐变色
  const getGradientForIndex = (index) => {
    const gradients = [
      colors.gradients.primary,
      colors.gradients.secondary,
      colors.gradients.success,
      colors.gradients.info,
    ];

    return gradients[index % gradients.length];
  };

  const handleDeleteNote = async (id) => {
    try {
      await notesApi.delete(id);
      dispatch(deleteNote(id));
    } catch (error) {
      console.error('删除笔记失败:', error);
    }
  };

  // 计算FAB动画样式
  const fabStyle = {
    transform: [
      { scale: fabAnim },
    ],
  };

  // 计算头部动画样式
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [150, 60],
    extrapolate: 'clamp',
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const headerContentOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 渐变头部 */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <LinearGradient
          colors={headerGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />

        <Animated.Text
          style={[
            styles.headerTitle,
            { opacity: headerTitleOpacity, color: '#FFFFFF' }
          ]}
        >
          我的笔记
        </Animated.Text>

        <Animated.View
          style={[
            styles.headerContent,
            { opacity: headerContentOpacity }
          ]}
        >
          <Text style={styles.headerMainTitle}>我的笔记</Text>
          <Text style={styles.headerSubtitle}>
            共 {notes.length} 条笔记
          </Text>
        </Animated.View>
      </Animated.View>

      {/* 笔记列表 */}
      <Animated.FlatList
        data={notes}
        renderItem={renderNoteItem}
        keyExtractor={item => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Icon name="document-text-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              暂无笔记
            </Text>
            <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
              点击右下角按钮创建新笔记
            </Text>
          </View>
        )}
      />

      {/* 浮动按钮 */}
      <View style={styles.buttonContainer}>
        <Animated.View style={[fabStyle, { marginBottom: 16 }]}>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => navigation.navigate('AIAssistant')}
          >
            <LinearGradient
              colors={colors.gradients.secondary}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              borderRadius={24}
            />
            <Icon name="chatbubble-ellipses" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={fabStyle}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('Note', { note: null })}
          >
            <LinearGradient
              colors={colors.gradients.primary}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              borderRadius={28}
            />
            <Icon name="add" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // 容器样式
  container: {
    flex: 1,
    position: 'relative',
  },

  // 头部样式
  header: {
    width: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.LARGE,
    paddingBottom: SPACING.MEDIUM,
    zIndex: 10,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    position: 'absolute',
    bottom: SPACING.MEDIUM,
    left: SPACING.LARGE,
  },

  headerContent: {
    width: '100%',
  },

  headerMainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: SPACING.TINY,
  },

  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // 列表样式
  listContainer: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingTop: SPACING.MEDIUM,
    paddingBottom: SPACING.XXLARGE * 2,
  },

  noteItemContainer: {
    marginBottom: SPACING.MEDIUM,
  },

  noteItem: {
    width: '100%',
  },

  noteContent: {
    padding: SPACING.MEDIUM,
  },

  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.SMALL,
  },

  noteExcerpt: {
    fontSize: 14,
    marginBottom: SPACING.MEDIUM,
    lineHeight: 20,
  },

  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.SMALL,
  },

  noteDate: {
    fontSize: 12,
  },

  noteActions: {
    flexDirection: 'row',
  },

  actionButton: {
    padding: SPACING.SMALL,
    marginLeft: SPACING.SMALL,
  },

  // 空状态样式
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.XXLARGE * 2,
  },

  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: SPACING.MEDIUM,
  },

  emptySubText: {
    fontSize: 14,
    marginTop: SPACING.SMALL,
    textAlign: 'center',
  },

  // 按钮样式
  buttonContainer: {
    position: 'absolute',
    right: SPACING.LARGE,
    bottom: SPACING.LARGE,
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 100,
  },

  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.LARGE,
    overflow: 'hidden',
  },

  aiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.MEDIUM,
    overflow: 'hidden',
  },
});

export default HomeScreen;