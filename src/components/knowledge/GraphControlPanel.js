import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING } from '../../utils/constants/dimensions';
import { UnifiedSearchBar } from '../../components/search';

/**
 * 知识图谱控制面板组件
 * 提供图谱过滤、搜索、布局调整等功能
 */
const GraphControlPanel = ({
  onFilterChange,
  onLayoutChange,
  onSearch,
  onDepthChange,
  expanded = false,
  onToggleExpand,
}) => {
  const { theme } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({
    notes: true,
    tags: true,
    concepts: true,
  });
  const [depth, setDepth] = useState(2);
  const [layout, setLayout] = useState('force');

  // 处理过滤器变化
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // 处理布局变化
  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    if (onSearch && searchText.trim()) {
      onSearch(searchText);
    }
  };

  // 处理深度变化
  const handleDepthChange = (newDepth) => {
    setDepth(newDepth);
    if (onDepthChange) {
      onDepthChange(newDepth);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.cardBackground },
        expanded ? styles.expandedContainer : styles.collapsedContainer,
      ]}
    >
      <TouchableOpacity
        style={styles.expandButton}
        onPress={onToggleExpand}
      >
        <Icon
          name={expanded ? 'keyboard-arrow-left' : 'keyboard-arrow-right'}
          size={24}
          color={theme.text}
        />
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.content}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>搜索</Text>
          <View style={styles.searchContainer}>
            <UnifiedSearchBar
              searchScope="knowledge_graph"
              placeholder="搜索节点..."
              style={styles.searchBar}
              onSearch={(results) => {
                if (onSearch && results && results.length > 0) {
                  onSearch(results);
                }
              }}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>过滤器</Text>
          <View style={styles.filterContainer}>
            <View style={styles.filterItem}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>笔记</Text>
              <Switch
                value={filters.notes}
                onValueChange={(value) => handleFilterChange('notes', value)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.filterItem}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>标签</Text>
              <Switch
                value={filters.tags}
                onValueChange={(value) => handleFilterChange('tags', value)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.filterItem}>
              <Text style={[styles.filterLabel, { color: theme.text }]}>概念</Text>
              <Switch
                value={filters.concepts}
                onValueChange={(value) => handleFilterChange('concepts', value)}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>深度</Text>
          <View style={styles.depthContainer}>
            {[1, 2, 3, 4].map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.depthButton,
                  depth === d && { backgroundColor: theme.primary },
                ]}
                onPress={() => handleDepthChange(d)}
              >
                <Text
                  style={[
                    styles.depthButtonText,
                    { color: depth === d ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>布局</Text>
          <View style={styles.layoutContainer}>
            <TouchableOpacity
              style={[
                styles.layoutButton,
                layout === 'force' && { backgroundColor: theme.primary },
              ]}
              onPress={() => handleLayoutChange('force')}
            >
              <Text
                style={[
                  styles.layoutButtonText,
                  { color: layout === 'force' ? '#FFFFFF' : theme.text },
                ]}
              >
                力导向
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.layoutButton,
                layout === 'radial' && { backgroundColor: theme.primary },
              ]}
              onPress={() => handleLayoutChange('radial')}
            >
              <Text
                style={[
                  styles.layoutButtonText,
                  { color: layout === 'radial' ? '#FFFFFF' : theme.text },
                ]}
              >
                放射状
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.layoutButton,
                layout === 'tree' && { backgroundColor: theme.primary },
              ]}
              onPress={() => handleLayoutChange('tree')}
            >
              <Text
                style={[
                  styles.layoutButtonText,
                  { color: layout === 'tree' ? '#FFFFFF' : theme.text },
                ]}
              >
                树状
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,0,0,0.1)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  expandedContainer: {
    width: 250,
  },
  collapsedContainer: {
    width: 40,
  },
  expandButton: {
    padding: SPACING.SMALL,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  content: {
    flex: 1,
    padding: SPACING.MEDIUM,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: SPACING.MEDIUM,
    marginBottom: SPACING.SMALL,
  },
  searchContainer: {
    marginBottom: SPACING.MEDIUM,
  },
  searchBar: {
    marginVertical: 0,
  },
  filterContainer: {
    marginVertical: SPACING.SMALL,
  },
  filterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
  },
  filterLabel: {
    fontSize: 14,
  },
  depthContainer: {
    flexDirection: 'row',
    marginVertical: SPACING.SMALL,
  },
  depthButton: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: SPACING.SMALL,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  depthButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  layoutContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: SPACING.SMALL,
  },
  layoutButton: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    borderRadius: 4,
    marginRight: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  layoutButtonText: {
    fontSize: 14,
  },
});

export default GraphControlPanel;
