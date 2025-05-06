import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform,
  Image,
  Dimensions,
  Modal
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { notesApi } from '../../services/api';
import { addNote, updateNote, deleteNote } from '../../redux/slices/notesSlice';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../../components/common/Typography';
import { HomeSearchBar } from '../../components/search';
import SortControl from '../../components/home/SortControl';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineIndicator from '../../components/common/OfflineIndicator';
import { offlineStorageService } from '../../services/offline/offlineStorage';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const allNotes = useSelector(state => state.notes.notes);
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [sortOption, setSortOption] = useState('updated_desc');
  const [isOffline, setIsOffline] = useState(false);

  // 加载排序偏好
  useEffect(() => {
    const loadSortPreference = async () => {
      try {
        const savedSort = await AsyncStorage.getItem('home_sort_preference');
        if (savedSort) {
          setSortOption(savedSort);
        }
      } catch (error) {
        console.error('加载排序偏好失败:', error);
      }
    };

    loadSortPreference();
    loadNotes();
  }, []);

  // 监听网络状态
  useEffect(() => {
    // 获取当前网络状态
    const status = offlineStorageService.getStatus();
    setIsOffline(!status.isOnline);

    // 添加监听器
    const unsubscribe = offlineStorageService.addListener(event => {
      if (event.type === 'connectionChange' || event.type === 'offlineModeChange') {
        setIsOffline(!offlineStorageService.getStatus().isOnline);
      }
    });

    return () => unsubscribe();
  }, []);

  // 当笔记或排序选项变化时，重新排序
  useEffect(() => {
    if (allNotes && allNotes.length > 0) {
      const sortedNotes = sortNotes(allNotes, sortOption);
      setNotes(sortedNotes);
    } else {
      setNotes([]);
    }
  }, [allNotes, sortOption]);

  // 排序笔记
  const sortNotes = useCallback((notesToSort, option) => {
    if (!notesToSort || notesToSort.length === 0) return [];

    const sorted = [...notesToSort];

    switch (option) {
      case 'created_desc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });

      case 'created_asc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateA - dateB;
        });

      case 'updated_desc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0);
          const dateB = new Date(b.updatedAt || b.createdAt || 0);
          return dateB - dateA;
        });

      case 'updated_asc':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0);
          const dateB = new Date(b.updatedAt || b.createdAt || 0);
          return dateA - dateB;
        });

      case 'title_asc':
        return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      case 'title_desc':
        return sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));

      case 'type':
        return sorted.sort((a, b) => {
          // 首先按类型排序
          if (a.type !== b.type) {
            return (a.type || '').localeCompare(b.type || '');
          }
          // 然后按更新时间排序
          const dateA = new Date(a.updatedAt || a.createdAt || 0);
          const dateB = new Date(b.updatedAt || b.createdAt || 0);
          return dateB - dateA;
        });

      default:
        return sorted;
    }
  }, []);

  // 处理排序变化
  const handleSortChange = useCallback((newSortOption) => {
    setSortOption(newSortOption);
  }, []);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await notesApi.getAllNotes();
      console.log('获取笔记响应:', response);
      if (response && response.success) {
        // 这里应该使用 Redux 中的 setNotes action，而不是 updateNote
        // 暂时注释掉，直到我们确定正确的 action
        // dispatch(updateNote(response.data));
      } else {
        console.error('获取笔记失败:', response?.message || '未知错误');
      }
    } catch (error) {
      console.error('加载笔记失败:', error);
      Alert.alert('错误', '加载笔记失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 导入PDF文件
  const importPDF = async () => {
    try {
      const results = await pick({
        type: [types.pdf],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        setIsLoading(true);

        // 调用导入API
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
        formData.append('type', 'pdf');

        // 调用实际的导入API
        const response = await notesApi.importNote(formData);

        if (response.success) {
          setIsLoading(false);
          Alert.alert('成功', '导入PDF成功');
          loadNotes(); // 重新加载笔记列表
        } else {
          throw new Error(response.message || '导入PDF失败');
        }
      }
    } catch (error) {
      setIsLoading(false);
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入PDF失败:', error);
        Alert.alert('错误', error.message || '导入PDF失败，请稍后重试');
      }
    }
  };

  // 导入Word文件
  const importWord = async () => {
    try {
      const results = await pick({
        type: [types.docx, types.doc],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        setIsLoading(true);

        // 调用导入API
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
        formData.append('type', 'word');

        // 调用实际的导入API
        const response = await notesApi.importNote(formData);

        if (response.success) {
          setIsLoading(false);
          Alert.alert('成功', '导入Word文档成功');
          loadNotes(); // 重新加载笔记列表
        } else {
          throw new Error(response.message || '导入Word文档失败');
        }
      }
    } catch (error) {
      setIsLoading(false);
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入Word失败:', error);
        Alert.alert('错误', error.message || '导入Word文档失败，请稍后重试');
      }
    }
  };

  const renderNoteItem = ({ item }) => {
    // 根据笔记类型渲染不同的封面
    const renderCover = () => {
      if (item.type === 'pdf' && item.metadata && item.metadata.pdfPath) {
        // PDF封面
        return (
          <View style={styles.coverContainer}>
            <Icon name="document-text" size={40} color={colors.primary} />
            <Text style={[styles.coverText, { color: colors.text }]}>PDF文档</Text>
          </View>
        );
      } else if (item.type === 'image' && item.metadata && item.metadata.imagePath) {
        // 图片封面
        return (
          <Image
            source={{ uri: item.metadata.imagePath }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        );
      } else if (item.type === 'canvas') {
        // 画布封面
        return (
          <View style={styles.coverContainer}>
            <Icon name="brush" size={40} color={colors.primary} />
            <Text style={[styles.coverText, { color: colors.text }]}>画布</Text>
          </View>
        );
      } else {
        // 默认文本笔记封面
        return (
          <View style={styles.coverContainer}>
            <Text
              style={[styles.coverContent, { color: colors.text }]}
              numberOfLines={5}
            >
              {item.content}
            </Text>
          </View>
        );
      }
    };

    return (
      <TouchableOpacity
        style={[styles.noteItem, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('Note', { note: item })}
      >
        {/* 封面 */}
        {renderCover()}

        {/* 标题和底部信息 */}
        <Text style={[styles.noteTitle, { color: colors.text }]}>
          {item.title}
        </Text>
        <View style={styles.noteFooter}>
          <Text style={[styles.noteDate, { color: colors.text }]}>
            {item.updatedAt}
          </Text>
          <TouchableOpacity
            onPress={() => handleDeleteNote(item.id)}
            style={styles.deleteButton}
          >
            <Icon name="trash-outline" size={20} color={colors.notification} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const handleDeleteNote = async (id) => {
    try {
      await notesApi.delete(id);
      dispatch(deleteNote(id));
    } catch (error) {
      console.error('删除笔记失败:', error);
    }
  };

  // 渲染空状态的欢迎界面
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="document-text-outline" size={80} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>欢迎使用零屿笔记</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        您还没有创建任何笔记，点击右下角的按钮开始创建吧！
      </Text>

      <View style={[styles.aiAssistantCard, { backgroundColor: colors.primaryContainer }]}>
        <View style={styles.aiAssistantHeader}>
          <Icon name="bulb-outline" size={24} color={colors.primary} />
          <Text style={[styles.aiAssistantTitle, { color: colors.text }]}>AI助手</Text>
        </View>
        <Text style={[styles.aiAssistantDesc, { color: colors.textSecondary }]}>
          使用我们的AI助手帮助您更高效地记录和整理笔记，提供智能建议和内容分析。
        </Text>
        <TouchableOpacity
          style={[styles.aiAssistantButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AIAssistant')}
        >
          <Text style={[styles.aiAssistantButtonText, { color: colors.onPrimary }]}>立即体验</Text>
          <Icon name="arrow-forward-outline" size={18} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染加载指示器
  const renderLoader = () => {
    if (isLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return null;
  };

  // 处理搜索结果
  const handleSearch = (results) => {
    // 导航到搜索结果页面
    if (results && results.length > 0) {
      navigation.navigate('SearchResults', { results });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderLoader()}

      {/* 头部区域 */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: `${colors.primary}15`,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            <Icon name="document-text" size={22} color={colors.primary} />
          </View>
          <Text
            variant="heading"
            level="h4"
            style={styles.headerTitle}
          >
            零屿笔记
          </Text>
        </View>
      </View>

      {/* 搜索栏 */}
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <HomeSearchBar onSearch={handleSearch} />
      </View>

      {/* 排序控件 */}
      <SortControl
        onSortChange={handleSortChange}
        initialSortOption={sortOption}
      />

      {notes && notes.length > 0 ? (
        <FlatList
          data={notes}
          renderItem={renderNoteItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
        />
      ) : (
        renderEmptyState()
      )}

      {/* 离线状态指示器 */}
      {isOffline && <OfflineIndicator />}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            // 显示创建选项
            setShowCreateOptions(true);
          }}
        >
          <View style={styles.addButtonInner}>
            <Icon name="add" size={30} color={colors.onPrimary} />
          </View>
          <View style={styles.addButtonPulse} />
        </TouchableOpacity>

        {/* 创建选项弹出菜单 */}
        <Modal
          visible={showCreateOptions}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCreateOptions(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCreateOptions(false)}
          >
            <View style={[styles.createOptionsContainer, { backgroundColor: colors.card }]}>
              <Text
                variant="heading"
                level="h6"
                style={styles.createOptionsTitle}
              >
                创建内容
              </Text>

              <TouchableOpacity
                style={[styles.createOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowCreateOptions(false);
                  navigation.navigate('Note', { note: null, type: 'text' });
                }}
              >
                <View style={[styles.createOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <MaterialIcon name="description" size={24} color={colors.primary} />
                </View>
                <View style={styles.createOptionContent}>
                  <Text
                    variant="body"
                    size="medium"
                    style={styles.createOptionText}
                  >
                    新建笔记
                  </Text>
                  <Text
                    variant="caption"
                    color="textSecondary"
                    style={styles.createOptionDescription}
                  >
                    创建一个新的文本笔记
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowCreateOptions(false);
                  navigation.navigate('Note', { note: null, type: 'styled' });
                }}
              >
                <View style={[styles.createOptionIcon, { backgroundColor: colors.secondaryLight }]}>
                  <MaterialIcon name="format-paint" size={24} color={colors.secondary} />
                </View>
                <View style={styles.createOptionContent}>
                  <Text
                    variant="body"
                    size="medium"
                    style={styles.createOptionText}
                  >
                    样式笔记
                  </Text>
                  <Text
                    variant="caption"
                    color="textSecondary"
                    style={styles.createOptionDescription}
                  >
                    创建带有丰富样式的笔记
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowCreateOptions(false);
                  importPDF();
                }}
              >
                <View style={[styles.createOptionIcon, { backgroundColor: '#FFECEF' }]}>
                  <MaterialIcon name="picture-as-pdf" size={24} color="#E53935" />
                </View>
                <View style={styles.createOptionContent}>
                  <Text
                    variant="body"
                    size="medium"
                    style={styles.createOptionText}
                  >
                    导入PDF
                  </Text>
                  <Text
                    variant="caption"
                    color="textSecondary"
                    style={styles.createOptionDescription}
                  >
                    从设备导入PDF文档
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setShowCreateOptions(false);
                  importWord();
                }}
              >
                <View style={[styles.createOptionIcon, { backgroundColor: '#E3F2FD' }]}>
                  <MaterialIcon name="article" size={24} color="#1976D2" />
                </View>
                <View style={styles.createOptionContent}>
                  <Text
                    variant="body"
                    size="medium"
                    style={styles.createOptionText}
                  >
                    导入Word
                  </Text>
                  <Text
                    variant="caption"
                    color="textSecondary"
                    style={styles.createOptionDescription}
                  >
                    从设备导入Word文档
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createOption}
                onPress={() => {
                  setShowCreateOptions(false);
                  navigation.navigate('Canvas');
                }}
              >
                <View style={[styles.createOptionIcon, { backgroundColor: '#E8F5E9' }]}>
                  <MaterialIcon name="dashboard" size={24} color="#388E3C" />
                </View>
                <View style={styles.createOptionContent}>
                  <Text
                    variant="body"
                    size="medium"
                    style={styles.createOptionText}
                  >
                    无限画布
                  </Text>
                  <Text
                    variant="caption"
                    color="textSecondary"
                    style={styles.createOptionDescription}
                  >
                    创建自由绘画和思维导图
                  </Text>
                </View>
                <MaterialIcon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    flex: 1,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  listContainer: {
    padding: 20
  },
  columnWrapper: {
    justifyContent: 'space-between'
  },
  noteItem: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    width: Dimensions.get('window').width / 2 - 30,
    margin: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 24,
  },
  noteContent: {
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
  },
  noteDate: {
    fontSize: 13,
    opacity: 0.7,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,0,0,0.08)',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 封面样式
  coverContainer: {
    height: 160,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  coverImage: {
    width: '100%',
    height: 160,
    borderRadius: 16
  },
  coverText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  coverContent: {
    padding: 16,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  buttonContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    flexDirection: 'column',
  },
  addButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    position: 'relative',
    zIndex: 1,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  addButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  addButtonPulse: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.6,
    zIndex: -1,
    // 添加动画效果
    animationName: 'pulse',
    animationDuration: '2s',
    animationIterationCount: 'infinite',
  },
  // 加载指示器样式
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    backdropFilter: 'blur(5px)',
  },
  // 空状态样式
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 50,
  },
  // 创建选项弹出菜单样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(5px)',
  },
  createOptionsContainer: {
    width: '90%',
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  createOptionsTitle: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  createOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  createOptionContent: {
    flex: 1,
    marginLeft: 4,
  },
  createOptionText: {
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 18,
  },
  createOptionDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  emptySubtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
    opacity: 0.8,
    paddingHorizontal: 30,
  },
  // AI助手卡片样式
  aiAssistantCard: {
    width: '90%',
    padding: 24,
    borderRadius: 24,
    marginTop: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  aiAssistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  aiAssistantTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 16,
    letterSpacing: -0.5,
  },
  aiAssistantDesc: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    opacity: 0.9,
  },
  aiAssistantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignSelf: 'flex-start',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  aiAssistantButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  }
});

export default HomeScreen;