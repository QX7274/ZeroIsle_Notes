/**
 * 思维导图模板屏幕
 * 用于选择思维导图模板
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';
import { Button, EmptyState } from '../../components/common';
import analyticsService from '../../services/analytics/analyticsService';
import mindMapTemplateApi from '../../services/api/mindMapTemplateApi';

const { width } = Dimensions.get('window');
const TEMPLATE_WIDTH = (width - 48) / 2;

const MindMapTemplateScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // 状态
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [error, setError] = useState(null);

  // 模板类型
  const templateTypes = [
    { id: 'all', name: '全部', icon: 'view-dashboard' },
    { id: 'general', name: '通用', icon: 'shape' },
    { id: 'project', name: '项目', icon: 'briefcase' },
    { id: 'study', name: '学习', icon: 'book-open' },
    { id: 'brainstorm', name: '头脑风暴', icon: 'lightbulb-on' },
  ];

  // 加载模板
  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (selectedType !== 'all') {
        params.type = selectedType;
      }

      const response = await mindMapTemplateApi.getTemplates(params);

      if (response.success) {
        // 成功获取数据
        if (response.data && Array.isArray(response.data.results)) {
          setTemplates(response.data.results);
          analyticsService.trackEvent('view_mind_map_templates', { count: response.data.results.length });
        } else {
          console.warn('思维导图模板API返回的数据格式不正确:', response.data);
          setError('服务器返回数据格式不正确');
          setTemplates([]);
        }
      } else {
        // 请求失败，但可能有备用数据
        console.error('API加载思维导图模板失败:', response.message);

        if (response.isNetworkError) {
          setError('网络连接失败，请检查网络设置');
        } else if (response.statusCode === 401) {
          setError('登录已过期，请重新登录');
        } else if (response.statusCode === 500) {
          setError('服务器错误，请稍后重试');
        } else {
          setError('加载模板失败，使用示例数据');
        }

        // 使用响应中的备用数据
        if (response.data && Array.isArray(response.data.results)) {
          setTemplates(response.data.results);
        }
      }
    } catch (err) {
      console.error('加载思维导图模板失败:', err);
      setError('加载模板失败，请稍后重试');
      analyticsService.trackError(err, { action: 'load_mind_map_templates' });
      setTemplates([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 首次加载
  useEffect(() => {
    loadTemplates();
  }, [selectedType]);

  // 刷新列表
  const handleRefresh = () => {
    setRefreshing(true);
    loadTemplates();
  };

  // 使用模板
  const handleUseTemplate = async (template) => {
    try {
      const response = await mindMapTemplateApi.useTemplate(template.id);

      if (response.success) {
        analyticsService.trackEvent('use_mind_map_template', { id: template.id });

        // 导航到编辑页面
        navigation.replace('MindMapEdit', { mindMapId: response.data.id });
      } else {
        // 使用失败，但可能有备用数据
        console.error('使用模板失败:', response.message);

        if (response.data && response.data.id) {
          // 如果有备用ID，仍然导航到编辑页面
          analyticsService.trackEvent('use_mind_map_template', { id: template.id, fallback: true });
          navigation.replace('MindMapEdit', { mindMapId: response.data.id });
        } else {
          Alert.alert('错误', response.message || '使用模板失败，请稍后重试');
          analyticsService.trackError(new Error(response.message), { action: 'use_mind_map_template' });
        }
      }
    } catch (err) {
      console.error('使用模板失败:', err);
      Alert.alert('错误', '使用模板失败，请稍后重试');
      analyticsService.trackError(err, { action: 'use_mind_map_template' });
    }
  };

  // 渲染模板类型选项
  const renderTypeOption = (type) => (
    <TouchableOpacity
      key={type.id}
      style={[
        styles.typeOption,
        selectedType === type.id && { backgroundColor: colors.primaryLight }
      ]}
      onPress={() => setSelectedType(type.id)}
    >
      <Icon
        name={type.icon}
        size={20}
        color={selectedType === type.id ? colors.primary : colors.text}
      />
      <Text
        style={[
          styles.typeText,
          { color: selectedType === type.id ? colors.primary : colors.text }
        ]}
      >
        {type.name}
      </Text>
    </TouchableOpacity>
  );

  // 渲染模板项
  const renderTemplateItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.templateItem, { backgroundColor: colors.card }]}
      onPress={() => handleUseTemplate(item)}
    >
      <View style={styles.templateImageContainer}>
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.templateImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.templatePlaceholder, { backgroundColor: colors.primaryLight }]}>
            <Icon name="chart-bubble" size={40} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.templateInfo}>
        <Text style={[styles.templateTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.templateType, { color: colors.textSecondary }]}>
          {templateTypes.find(t => t.id === item.type)?.name || '通用'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.useButton, { backgroundColor: colors.primary }]}
        onPress={() => handleUseTemplate(item)}
      >
        <Text style={styles.useButtonText}>使用</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // 渲染空状态
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <EmptyState
        icon="view-dashboard"
        title="没有模板"
        message={selectedType !== 'all' ? "当前分类下没有模板" : "暂无可用模板"}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>思维导图模板</Text>
        </View>

        {/* 类型过滤器 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeContainer}
        >
          {templateTypes.map(renderTypeOption)}
        </ScrollView>
      </View>

      {/* 模板列表 */}
      <FlatList
        data={templates}
        renderItem={renderTemplateItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmptyState}
      />

      {/* 加载指示器 */}
      {loading && !refreshing && (
        <ActivityIndicator
          style={styles.loader}
          size="large"
          color={colors.primary}
        />
      )}

      {/* 错误提示 */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="重试" onPress={loadTemplates} />
        </View>
      )}
    </View>
  );
};

// 样式
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  typeContainer: {
    paddingVertical: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  typeText: {
    marginLeft: 4,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  templateItem: {
    width: TEMPLATE_WIDTH,
    borderRadius: 8,
    marginBottom: 16,
    marginRight: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  templateImageContainer: {
    width: '100%',
    height: TEMPLATE_WIDTH * 0.75,
    backgroundColor: colors.background,
  },
  templateImage: {
    width: '100%',
    height: '100%',
  },
  templatePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    padding: 12,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  templateType: {
    fontSize: 12,
  },
  useButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  useButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    marginBottom: 16,
  },
});

export default MindMapTemplateScreen;
