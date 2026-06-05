import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { UnifiedSearchBar } from '../../components/search';
import { EmptyState } from '../../components/common';
import { SkeletonListCards } from '../../components/common/Skeleton';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants/dimensions';
import { fetchKnowledgeBaseNodes } from '../../redux/slices/knowledgeBaseSlice';

const ContentTab = ({ kbId }) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const { nodes, nodesStatus } = useSelector((state) => state.knowledgeBase);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (kbId) {
      dispatch(fetchKnowledgeBaseNodes(kbId));
    }
  }, [kbId, dispatch]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) {return nodes;}
    return nodes.filter(node =>
      node.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.description && node.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [nodes, searchQuery]);

  const getNodeIcon = (type) => {
    switch (type) {
      case 'note': return { name: 'note', color: theme.colors.primary };
      case 'concept': return { name: 'bubble-chart', color: theme.colors.success };
      case 'document': return { name: 'description', color: theme.colors.warning };
      default: return { name: 'grain', color: theme.colors.textSecondary };
    }
  };

  const openNodeDetail = (node) => {
    navigation.navigate('NodeDetail', { id: node.id, title: node.title });
  };

  const openKnowledgeNodeEdit = () => {
    navigation.navigate('KnowledgeNodeEdit', { kbId });
  };

  const renderNodeItem = ({ item }) => {
    const iconInfo = getNodeIcon(item.type);
    return (
      <TouchableOpacity style={styles.nodeItem} onPress={() => openNodeDetail(item)}>
        <View style={[styles.nodeIconContainer, { backgroundColor: iconInfo.color + '20' }]}>
            <Icon name={iconInfo.name} size={24} color={iconInfo.color} />
        </View>
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeTitle}>{item.title}</Text>
          <Text style={styles.nodeDescription} numberOfLines={1}>{item.description || '暂无描述'}</Text>
        </View>
        <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (nodesStatus === 'loading') {
    return (
      <View style={styles.loader}>
        <SkeletonListCards count={6} cardHeight={80} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UnifiedSearchBar
        placeholder="在知识库中搜索内容..."
        onSearch={setSearchQuery}
        style={styles.searchBar}
      />
      <FlatList
        data={filteredNodes}
        renderItem={renderNodeItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<EmptyState message="知识库中还没有内容，点击右下角 + 开始创建吧" icon="menu-book" />}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.small }} />}
      />
      <TouchableOpacity style={styles.fab} onPress={openKnowledgeNodeEdit}>
        <Icon name="add" size={30} color={theme.colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    margin: SPACING.medium,
    marginBottom: SPACING.small,
  },
  listContainer: {
    paddingHorizontal: SPACING.medium,
    paddingBottom: 80, // for FAB
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  nodeIconContainer: {
      width: 42,
      height: 42,
      borderRadius: BORDER_RADIUS.medium,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.medium,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeTitle: {
    fontSize: FONT_SIZES.medium,
    fontWeight: '600',
    color: theme.colors.text,
  },
  nodeDescription: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: SPACING.large,
    bottom: SPACING.large,
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default ContentTab;
