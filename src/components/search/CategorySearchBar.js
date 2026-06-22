/**
 * 分类搜索栏组件
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Portal } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import MultiModalSearch from './MultiModalSearch';

/**
 * 分类搜索栏组件
 * 点击后展开多模态搜索组件
 */
const CategorySearchBar = ({ onSearch }) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showSearch, setShowSearch] = useState(false);

  // 处理搜索结果
  const handleSearchResult = (results) => {
    setShowSearch(false);
    onSearch?.(results);

    // 如果有结果，导航到搜索结果页面
    if (results && results.length > 0) {
      navigation.navigate('SearchResults', { results, source: 'category' });
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.card,
            borderColor: `${colors.border}80`,
          },
        ]}
        onPress={() => setShowSearch(true)}
        activeOpacity={0.7}
      >
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${colors.primary}10`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 10,
        }}>
          <Icon name="search" size={20} color={colors.primary} />
        </View>
        <Text
          variant="body"
          size="medium"
          color="textSecondary"
          style={styles.placeholder}
        >
          搜索分类、标签、内容...
        </Text>
      </TouchableOpacity>

      {showSearch ? (
        <Portal>
          <View style={[styles.portalOverlay, { backgroundColor: colors.background }]}>
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              <MultiModalSearch
                onSearch={handleSearchResult}
                onCancel={() => setShowSearch(false)}
                searchScope="category"
              />
            </View>
          </View>
        </Portal>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  placeholder: {
    marginLeft: 10,
    flex: 1,
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
  },
  portalOverlay: {
    ...StyleSheet.absoluteFillObject,
    elevation: 16,
  },
});

export default CategorySearchBar;
