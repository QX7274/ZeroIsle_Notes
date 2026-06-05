/**
 * 思维导图模板屏幕
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  ScrollView,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext';
import { Button, EmptyState } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import analyticsService from '../../services/analytics/analyticsService';
import mindMapTemplateApi from '../../services/api/mindMapTemplateApi';

const { width } = Dimensions.get('window');
const TEMPLATE_WIDTH = (width - 48) / 2;

const MindMapTemplateScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [error, setError] = useState(null);

  const notifyNonBlocking = (message) => {
    setError(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const templateTypes = [
    { id: 'all', name: '全部', icon: 'view-dashboard' },
    { id: 'general', name: '通用', icon: 'shape' },
    { id: 'project', name: '项目', icon: 'briefcase' },
    { id: 'study', name: '学习', icon: 'book-open' },
    { id: 'brainstorm', name: '头脑风暴', icon: 'lightbulb-on' },
  ];

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (selectedType !== 'all') {
        params.type = selectedType;
      }

      const response = await mindMapTemplateApi.getTemplates(params);
      if (!response.success || !Array.isArray(response.data?.results)) {
        throw new Error('加载模板失败');
      }

      setTemplates(response.data.results);
      analyticsService.trackEvent('view_mind_map_templates', {
        count: response.data.results.length,
        local_first: true,
      });
    } catch (err) {
      console.error('加载思维导图模板失败:', err);
      setTemplates([]);
      setError(err?.message || '加载模板失败，请稍后重试');
      analyticsService.trackError(err, { action: 'load_mind_map_templates' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedType]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTemplates();
  };

  const handleUseTemplate = async (template) => {
    try {
      const response = await mindMapTemplateApi.useTemplate(template.id);
      if (!response.success || !response.data?.id) {
        throw new Error('使用模板失败');
      }

      analyticsService.trackEvent('use_mind_map_template', {
        id: template.id,
        local_first: true,
      });
      navigation.replace('MindMapEdit', { mindMapId: response.data.id });
    } catch (err) {
      console.error('使用模板失败:', err);
      notifyNonBlocking(err?.message || '使用模板失败，请稍后重试');
      analyticsService.trackError(err, { action: 'use_mind_map_template' });
    }
  };

  const renderTypeOption = (type) => (
    <TouchableOpacity
      key={type.id}
      style={[
        styles.typeOption,
        selectedType === type.id && { backgroundColor: colors.primaryLight },
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
          { color: selectedType === type.id ? colors.primary : colors.text },
        ]}
      >
        {type.name}
      </Text>
    </TouchableOpacity>
  );

  const renderTemplateItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.templateItem, { backgroundColor: colors.card }]}
      onPress={() => handleUseTemplate(item)}
      activeOpacity={0.85}
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
          {templateTypes.find((type) => type.id === item.type)?.name || '通用'}
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.mindMapTemplate.back"
            style={styles.backButton}
          />
          <Text style={styles.headerTitle}>思维导图模板</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeContainer}
        >
          {templateTypes.map(renderTypeOption)}
        </ScrollView>
      </View>

      <FlatList
        data={templates}
        renderItem={renderTemplateItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={loading ? null : (
          <EmptyState
            icon="view-dashboard"
            title="没有模板"
            message={selectedType !== 'all' ? '当前分类下没有模板' : '暂无可用模板'}
          />
        )}
      />

      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : null}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="重试" onPress={loadTemplates} />
        </View>
      ) : null}
    </SafeAreaView>
  );
};

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
    marginRight: 12,
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
