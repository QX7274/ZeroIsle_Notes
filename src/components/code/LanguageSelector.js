/**
 * 编程语言选择器组件
 * 用于选择代码编辑器的编程语言
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { analyticsService } from '../../services/analytics/analyticsService';

// 支持的编程语言列表
const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', icon: 'language-javascript', color: '#f7df1e' },
  { id: 'typescript', name: 'TypeScript', icon: 'language-typescript', color: '#3178c6' },
  { id: 'python', name: 'Python', icon: 'language-python', color: '#3776ab' },
  { id: 'java', name: 'Java', icon: 'language-java', color: '#007396' },
  { id: 'c', name: 'C', icon: 'language-c', color: '#a8b9cc' },
  { id: 'cpp', name: 'C++', icon: 'language-cpp', color: '#00599c' },
  { id: 'csharp', name: 'C#', icon: 'language-csharp', color: '#239120' },
  { id: 'php', name: 'PHP', icon: 'language-php', color: '#777bb4' },
  { id: 'ruby', name: 'Ruby', icon: 'language-ruby', color: '#cc342d' },
  { id: 'go', name: 'Go', icon: 'language-go', color: '#00add8' },
  { id: 'rust', name: 'Rust', icon: 'language-rust', color: '#000000' },
  { id: 'swift', name: 'Swift', icon: 'language-swift', color: '#ffac45' },
  { id: 'kotlin', name: 'Kotlin', icon: 'language-kotlin', color: '#7f52ff' },
  { id: 'html', name: 'HTML', icon: 'language-html5', color: '#e34f26' },
  { id: 'css', name: 'CSS', icon: 'language-css3', color: '#1572b6' },
  { id: 'sql', name: 'SQL', icon: 'database', color: '#4479a1' },
  { id: 'json', name: 'JSON', icon: 'code-json', color: '#000000' },
  { id: 'xml', name: 'XML', icon: 'code-tags', color: '#0060ac' },
  { id: 'markdown', name: 'Markdown', icon: 'language-markdown', color: '#000000' },
  { id: 'bash', name: 'Bash', icon: 'console', color: '#4eaa25' },
  { id: 'shell', name: 'Shell', icon: 'console', color: '#4eaa25' },
  { id: 'yaml', name: 'YAML', icon: 'code-yaml', color: '#cb171e' },
  { id: 'dart', name: 'Dart', icon: 'language-dart', color: '#0175c2' },
  { id: 'r', name: 'R', icon: 'language-r', color: '#276dc3' },
  { id: 'perl', name: 'Perl', icon: 'code-braces', color: '#39457e' },
  { id: 'haskell', name: 'Haskell', icon: 'code-braces', color: '#5e5086' },
  { id: 'scala', name: 'Scala', icon: 'code-braces', color: '#dc322f' },
  { id: 'lua', name: 'Lua', icon: 'code-braces', color: '#000080' },
  { id: 'groovy', name: 'Groovy', icon: 'code-braces', color: '#4298b8' },
  { id: 'elixir', name: 'Elixir', icon: 'code-braces', color: '#4b275f' },
];

/**
 * 编程语言选择器组件
 * @param {string} value - 当前选中的语言ID
 * @param {function} onChange - 语言变更回调
 * @param {boolean} compact - 是否使用紧凑模式
 * @param {object} style - 自定义样式
 */
const LanguageSelector = ({
  value = 'javascript',
  onChange,
  compact = false,
  style,
}) => {
  // 使用主题
  const { theme } = useTheme();
  const { colors } = theme;
  
  // 状态
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLanguages, setFilteredLanguages] = useState(LANGUAGES);
  
  // 当搜索查询变化时，过滤语言列表
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLanguages(LANGUAGES);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = LANGUAGES.filter(
      (lang) =>
        lang.name.toLowerCase().includes(query) ||
        lang.id.toLowerCase().includes(query)
    );
    
    setFilteredLanguages(filtered);
  }, [searchQuery]);
  
  // 获取当前选中的语言
  const getSelectedLanguage = () => {
    return LANGUAGES.find((lang) => lang.id === value) || LANGUAGES[0];
  };
  
  // 处理语言选择
  const handleSelectLanguage = (language) => {
    setModalVisible(false);
    
    if (onChange && language.id !== value) {
      onChange(language.id);
      
      // 记录分析事件
      analyticsService.trackCodeAction('change_language', {
        from: value,
        to: language.id,
      });
    }
  };
  
  // 渲染语言项
  const renderLanguageItem = ({ item }) => {
    const isSelected = item.id === value;
    
    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          isSelected && {
            backgroundColor: `${colors.primary}15`,
          },
        ]}
        onPress={() => handleSelectLanguage(item)}
      >
        <View
          style={[
            styles.languageIconContainer,
            { backgroundColor: `${item.color}20` },
          ]}
        >
          <Text style={{ color: item.color, fontSize: 16 }}>
            {item.name.charAt(0)}
          </Text>
        </View>
        
        <View style={styles.languageInfo}>
          <Text
            variant="body"
            size="medium"
            style={{
              color: isSelected ? colors.primary : colors.text,
              fontWeight: isSelected ? '600' : '400',
            }}
          >
            {item.name}
          </Text>
        </View>
        
        {isSelected && (
          <Icon name="check" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };
  
  // 渲染选择器按钮
  const renderSelectorButton = () => {
    const selectedLanguage = getSelectedLanguage();
    
    return (
      <TouchableOpacity
        style={[
          styles.selectorButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          compact && styles.compactButton,
          style,
        ]}
        onPress={() => setModalVisible(true)}
      >
        <View
          style={[
            styles.languageIconContainer,
            {
              backgroundColor: `${selectedLanguage.color}20`,
              width: compact ? 24 : 28,
              height: compact ? 24 : 28,
            },
          ]}
        >
          <Text style={{ color: selectedLanguage.color, fontSize: compact ? 12 : 14 }}>
            {selectedLanguage.name.charAt(0)}
          </Text>
        </View>
        
        {!compact && (
          <Text
            variant="body"
            size="medium"
            style={{
              color: colors.text,
              marginLeft: 8,
              marginRight: 4,
            }}
          >
            {selectedLanguage.name}
          </Text>
        )}
        
        <Icon
          name="arrow-drop-down"
          size={compact ? 18 : 20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={styles.container}>
      {renderSelectorButton()}
      
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.card },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text
                    variant="heading"
                    level="h6"
                    style={{ color: colors.text }}
                  >
                    选择编程语言
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Icon name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                
                <View
                  style={[
                    styles.searchContainer,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Icon
                    name="search"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={[
                      styles.searchInput,
                      { color: colors.text },
                    ]}
                    placeholder="搜索语言..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => setSearchQuery('')}
                    >
                      <Icon
                        name="clear"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                
                <FlatList
                  data={filteredLanguages}
                  renderItem={renderLanguageItem}
                  keyExtractor={(item) => item.id}
                  style={styles.languageList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Icon
                        name="search-off"
                        size={48}
                        color={colors.textSecondary}
                      />
                      <Text
                        variant="body"
                        size="medium"
                        style={{
                          color: colors.textSecondary,
                          marginTop: 12,
                          textAlign: 'center',
                        }}
                      >
                        未找到匹配的编程语言
                      </Text>
                    </View>
                  }
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  compactButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  languageIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  languageList: {
    maxHeight: 400,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  languageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});

export default LanguageSelector;
