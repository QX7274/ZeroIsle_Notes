/**
 * 首页搜索栏组件
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import MultiModalSearch from './MultiModalSearch';

/**
 * 首页搜索栏组件
 * 点击后展开多模态搜索组件
 */
const HomeSearchBar = ({ onSearch }) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showSearch, setShowSearch] = useState(false);

  // 处理搜索结果
  const handleSearchResult = (results) => {
    setShowSearch(false);
    onSearch?.(results);
    
    // 如果有结果，导航到搜索结果页面
    if (results && results.length > 0) {
      navigation.navigate('SearchResults', { results });
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.searchBar, { backgroundColor: colors.card }]}
        onPress={() => setShowSearch(true)}
        activeOpacity={0.7}
      >
        <Icon name="search" size={22} color={colors.textSecondary} />
        <Text
          variant="body"
          size="medium"
          color="textSecondary"
          style={styles.placeholder}
        >
          搜索笔记、标签、内容...
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showSearch}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSearch(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <MultiModalSearch
            onSearch={handleSearchResult}
            onCancel={() => setShowSearch(false)}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  placeholder: {
    marginLeft: 8,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
});

export default HomeSearchBar;
