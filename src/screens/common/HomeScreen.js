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
  Dimensions
} from 'react-native';
import DocumentPicker, { types } from 'react-native-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { notesApi } from '../../services/api';
import { setNotes as setNotesAction, deleteNote, selectAllNotes } from '../../redux/slices/notesSlice';
import Icon from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/common/Typography';
import { UnifiedSearchBar } from '../../components/search';
import SortControl from '../../components/home/SortControl';
import AsyncStorage from '@react-native-async-storage/async-storage';
// OfflineIndicator 已移除
import { offlineStorageService } from '../../services/offline/offlineStorage';
import infiniteCanvasStorage from '../../services/offline/infiniteCanvasStorage';
import NetInfo from '@react-native-community/netinfo';
import { CreateContentModal } from '../../components/common';
import RNFS from 'react-native-fs';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  // 使用selectAllNotes选择器获取所有笔记
  const allNotes = useSelector(selectAllNotes);

  // 记录Redux状态
  const notesState = useSelector(state => {
    console.log('Redux笔记状态:', state.notes);
    return state.notes;
  });
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [sortOption, setSortOption] = useState('updated_desc');

  // 加载排序偏好和初始化离线存储
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        console.log('开始初始化 HomeScreen...');

        // 加载排序偏好
        const savedSort = await AsyncStorage.getItem('home_sort_preference');
        if (savedSort) {
          setSortOption(savedSort);
        }

        // 设置超时，确保加载状态不会一直显示
        const timeoutId = setTimeout(() => {
          console.log('初始化超时，强制结束加载状态');
          setIsLoading(false);
        }, 5000); // 5秒超时

        try {
          // 加载笔记 - 不等待离线存储服务初始化
          console.log('直接加载笔记...');
          await loadNotes();

          // 在后台初始化离线存储服务，不阻塞UI
          if (!offlineStorageService.isInitialized) {
            console.log('在后台初始化离线存储服务...');
            offlineStorageService.init().catch(err => {
              console.warn('后台初始化离线存储服务失败:', err);
            });
          } else {
            console.log('离线存储服务已初始化');
          }

          // 在后台初始化无限画布存储，不阻塞UI
          console.log('在后台初始化无限画布存储...');
          infiniteCanvasStorage.initTables().catch(err => {
            console.warn('后台初始化无限画布存储失败:', err);
          });

          console.log('HomeScreen 初始化完成');
        } catch (innerError) {
          console.error('内部初始化失败:', innerError);
          // 即使内部初始化失败，也继续执行，不阻塞UI
        } finally {
          // 清除超时
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error('初始化失败:', error);
      } finally {
        // 确保无论如何都会结束加载状态
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  // 网络状态监听已移除

  // 同步功能已移除

  // 当笔记或排序选项变化时，重新排序
  useEffect(() => {
    console.log('Redux中的笔记状态变化:', allNotes ? allNotes.length : 0, '条笔记');

    if (allNotes && allNotes.length > 0) {
      const sortedNotes = sortNotes(allNotes, sortOption);
      console.log('排序后的笔记:', sortedNotes.length, '条笔记');
      setNotes(sortedNotes);
    } else {
      console.log('没有笔记可显示，设置空数组');
      setNotes([]);
    }
  }, [allNotes, sortOption, isLoading, notesState.isLoading]);

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

  // 创建空笔记列表的函数
  const createTestNotes = () => {
    console.log('创建空笔记列表');
    setIsLoading(true);

    // 使用空数组设置笔记
    dispatch(setNotesAction([]));
    setIsLoading(false);
  };

  const loadNotes = async () => {
    try {
      // 注意：setIsLoading(true) 已经在调用此方法的地方设置
      console.log('开始加载笔记...');

      // 设置超时，确保不会一直等待API响应
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.log('加载笔记超时，返回空数组');
          resolve({ success: false, timeout: true });
        }, 3000); // 3秒超时
      });

      // 首先尝试从本地存储获取笔记，带超时
      const offlineResponsePromise = notesApi.getAllNotes();
      const offlineResponse = await Promise.race([offlineResponsePromise, timeoutPromise]);

      // 如果超时，返回空数组
      if (offlineResponse.timeout) {
        console.log('API请求超时，返回空数组');
        dispatch(setNotesAction([]));
        setIsLoading(false);
        return; // 提前返回，避免重复设置 isLoading
      }

      console.log('获取笔记响应:', offlineResponse);

      if (offlineResponse && offlineResponse.success && offlineResponse.data && offlineResponse.data.length > 0) {
        // 如果有笔记，使用这些笔记
        console.log('使用获取到的笔记数据:', offlineResponse.data.length, '条笔记');

        // 使用导出的action creator设置笔记
        dispatch(setNotesAction(offlineResponse.data));
      } else {
        // 如果没有笔记，返回空数组
        console.log('没有笔记，返回空数组');
        dispatch(setNotesAction([]));
        setIsLoading(false);
        return; // 提前返回，避免重复设置 isLoading
      }

      console.log('笔记加载完成');
      // 注意：setIsLoading(false) 会在调用此方法的 finally 块中设置
    } catch (error) {
      console.error('加载笔记失败:', error);
      // 不显示弹窗，避免影响用户体验
      console.error('错误详情:', error);

      // 加载失败时，返回空数组
      console.log('加载失败，返回空数组');
      dispatch(setNotesAction([]));
      setIsLoading(false);
    }
    // 不在这里设置 setIsLoading(false)，因为调用方会在 finally 块中设置
  };

  // 导入PDF文件
  const importPDF = async () => {
    try {
      const results = await DocumentPicker.pick({
        type: [types.pdf],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        console.log('选择的PDF文件:', file);
        setIsLoading(true);

        // 检查文件是否有效
        if (!file.uri) {
          throw new Error('无效的文件URI');
        }

        // 创建FormData对象
        const formData = new FormData();

        // 确保文件对象包含所有必要的属性
        const fileObj = {
          uri: file.uri || file.fileCopyUri,
          type: file.type || 'application/pdf',
          name: file.name || `document_${Date.now()}.pdf`,
        };

        console.log('准备添加到FormData的文件对象:', fileObj);
        formData.append('file', fileObj);
        formData.append('type', 'pdf');

        console.log('准备导入PDF，FormData:', formData);

        try {
          // 调用实际的导入API
          const response = await notesApi.importNote(formData);
          console.log('PDF导入结果:', response);

          // 即使API返回失败，只要有数据就继续处理
          if (response.success || (response.data && response.data.id)) {
            setIsLoading(false);
            Alert.alert('成功', '导入PDF成功');
            loadNotes(); // 重新加载笔记列表
            return;
          }

          // 如果没有数据，抛出错误
          throw new Error(response.message || '导入PDF失败');
        } catch (importError) {
          console.error('导入PDF过程中出错:', importError);

          // 即使API调用失败，也尝试使用本地导入
          console.log('尝试使用本地导入方式');

          // 创建本地笔记对象
          const localNote = {
            id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
            title: file.name ? file.name.split('.')[0] : '导入的PDF文档',
            content: `导入的PDF文件: ${file.name || '未命名文档'}`,
            file_type: 'pdf',
            file_name: file.name || `document_${Date.now()}.pdf`,
            file_uri: file.uri,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_synced: false,
            is_offline: true,
            preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
          };

          // 添加到Redux状态
          dispatch(setNotesAction([...allNotes, localNote]));

          setIsLoading(false);
          Alert.alert('成功', '导入PDF成功（本地模式）');
          return;
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
      const results = await DocumentPicker.pick({
        type: [types.docx, types.doc],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        console.log('选择的Word文件:', file);
        setIsLoading(true);

        // 检查文件是否有效
        if (!file.uri) {
          throw new Error('无效的文件URI');
        }

        // 检查文件大小，如果太大，直接使用本地导入
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size && file.size > MAX_FILE_SIZE) {
          console.log('文件过大，使用本地导入方式');
          await handleLocalImport(file);
          return;
        }

        // 创建FormData对象
        const formData = new FormData();

        // 确保文件对象包含所有必要的属性
        const fileObj = {
          uri: file.uri || file.fileCopyUri,
          type: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          name: file.name || `document_${Date.now()}.docx`,
        };

        console.log('准备添加到FormData的文件对象:', fileObj);
        formData.append('file', fileObj);
        formData.append('type', 'word');

        console.log('准备导入Word，FormData:', formData);

        try {
          // 设置导入超时
          const importTimeout = setTimeout(() => {
            console.log('导入操作超时，切换到本地导入');
            handleLocalImport(file);
          }, 30000); // 30秒超时

          // 调用实际的导入API
          const response = await notesApi.importNote(formData);

          // 清除超时
          clearTimeout(importTimeout);

          console.log('Word导入结果:', response);

          // 即使API返回失败，只要有数据就继续处理
          if (response.success || (response.data && response.data.id)) {
            setIsLoading(false);
            Alert.alert('成功', '导入Word文档成功');
            loadNotes(); // 重新加载笔记列表
            return;
          }

          // 如果没有数据，使用本地导入
          console.log('API返回失败，使用本地导入方式');
          await handleLocalImport(file);
        } catch (importError) {
          console.error('导入Word过程中出错:', importError);
          await handleLocalImport(file);
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

  // 本地导入处理函数
  const handleLocalImport = async (file) => {
    try {
      console.log('使用本地导入方式处理文件:', file.name);

      // 检查文件是否存在
      try {
        const fileExists = await RNFS.exists(file.uri);
        if (!fileExists) {
          throw new Error('文件不存在或无法访问');
        }
      } catch (fileCheckError) {
        console.error('检查文件存在失败:', fileCheckError);
      }

      // 如果文件URI不是以file://开头，需要复制到应用的文档目录
      let fileUri = file.uri;
      if (!fileUri.startsWith('file://')) {
        try {
          // 创建目标路径
          const fileName = file.name || `document_${Date.now()}.docx`;
          const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

          // 复制文件
          console.log(`复制文件从 ${fileUri} 到 ${destPath}`);
          await RNFS.copyFile(fileUri, destPath);

          // 更新文件URI
          fileUri = `file://${destPath}`;
          console.log('文件已复制到应用目录:', fileUri);
        } catch (copyError) {
          console.error('复制文件失败:', copyError);
          // 继续使用原始URI
        }
      }

      // 创建本地笔记对象
      const localNote = {
        id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
        title: file.name ? file.name.split('.')[0] : '导入的Word文档',
        content: `导入的Word文件: ${file.name || '未命名文档'}`,
        file_type: 'word',
        file_name: file.name || `document_${Date.now()}.docx`,
        file_uri: fileUri,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
        preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
      };

      // 添加到Redux状态
      dispatch(setNotesAction([...allNotes, localNote]));

      // 保存到本地存储
      try {
        await notesApi.saveOfflineNote(localNote);
        console.log('笔记已保存到本地存储');
      } catch (storageError) {
        console.error('保存到本地存储失败:', storageError);
      }

      setIsLoading(false);
      Alert.alert('成功', '导入Word文档成功（本地模式）');
    } catch (error) {
      console.error('本地导入失败:', error);
      setIsLoading(false);
      Alert.alert('错误', '本地导入失败: ' + (error.message || '未知错误'));
    }
  };

  const renderNoteItem = ({ item }) => {
    console.log('渲染笔记项:', item);

    // 根据笔记类型渲染不同的封面
    const renderCover = () => {
      // 检查是否是PDF文件
      if (item.file_type === 'pdf' || item.type === 'pdf' || (item.file_name && item.file_name.toLowerCase().endsWith('.pdf'))) {
        // PDF封面 - 使用文件首页作为预览
        return (
          <View style={styles.coverContainer}>
            <View style={styles.pdfPreview}>
              {item.preview_image ? (
                <Image
                  source={{ uri: item.preview_image }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.pdfPlaceholder}>
                  <Icon name="document-text" size={40} color="#E53935" />
                  <Text style={styles.pdfPlaceholderText}>PDF</Text>
                </View>
              )}
            </View>
            <View style={styles.fileTypeIndicator}>
              <Icon name="document-text" size={16} color="#fff" />
            </View>
          </View>
        );
      }
      // 检查是否是Word文件
      else if (item.file_type === 'word' || item.type === 'word' ||
               (item.file_name && (item.file_name.toLowerCase().endsWith('.docx') || item.file_name.toLowerCase().endsWith('.doc')))) {
        // Word封面 - 使用文件首页作为预览
        return (
          <View style={styles.coverContainer}>
            <View style={styles.wordPreview}>
              {item.preview_image ? (
                <Image
                  source={{ uri: item.preview_image }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.wordPlaceholder}>
                  <Icon name="document" size={40} color="#1976D2" />
                  <Text style={styles.wordPlaceholderText}>Word</Text>
                </View>
              )}
            </View>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#1976D2' }]}>
              <Icon name="document" size={16} color="#fff" />
            </View>
          </View>
        );
      }
      // 检查是否是图片
      else if (item.type === 'image' || (item.file_name &&
              (item.file_name.toLowerCase().endsWith('.jpg') ||
               item.file_name.toLowerCase().endsWith('.jpeg') ||
               item.file_name.toLowerCase().endsWith('.png') ||
               item.file_name.toLowerCase().endsWith('.gif')))) {
        // 图片封面 - 直接使用图片本身
        const imagePath = item.metadata?.imagePath || item.preview_image || item.file_uri;
        return (
          <View style={styles.coverContainer}>
            {imagePath ? (
              <Image
                source={{ uri: imagePath }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image" size={40} color="#4CAF50" />
              </View>
            )}
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#4CAF50' }]}>
              <Icon name="image" size={16} color="#fff" />
            </View>
          </View>
        );
      }
      // 检查是否是画布
      else if (item.type === 'canvas') {
        // 画布封面 - 使用画布预览图或占位符
        return (
          <View style={styles.coverContainer}>
            {item.preview_image ? (
              <Image
                source={{ uri: item.preview_image }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.canvasPreview}>
                <Icon name="brush" size={40} color={colors.primary} />
                <Text style={[styles.canvasPlaceholderText, { color: colors.primary }]}>画布</Text>
              </View>
            )}
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#9C27B0' }]}>
              <Icon name="brush" size={16} color="#fff" />
            </View>
          </View>
        );
      }
      // 默认文本笔记封面
      else {
        return (
          <View style={styles.coverContainer}>
            <View style={styles.textPreview}>
              <Text
                style={[styles.coverContent, { color: colors.text }]}
                numberOfLines={5}
              >
                {item.content || '空白笔记'}
              </Text>
            </View>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#FF9800' }]}>
              <Icon name="document" size={16} color="#fff" />
            </View>
          </View>
        );
      }
    };

    // 格式化日期显示
    const formatDate = (dateString) => {
      if (!dateString) return '未知日期';

      try {
        const date = new Date(dateString);

        // 检查日期是否有效
        if (isNaN(date.getTime())) {
          // 尝试解析自定义格式 (如 "2023/4/21 08:14 PM")
          const parts = dateString.split(' ');
          if (parts.length >= 2) {
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
              return `${dateParts[0]}/${dateParts[1]}/${dateParts[2]} ${parts[1]}`;
            }
          }
          return dateString; // 返回原始字符串
        }

        // 格式化为 "YYYY/M/D HH:MM AM/PM"
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;

        return `${year}/${month}/${day} ${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      } catch (error) {
        console.error('日期格式化错误:', error);
        return dateString; // 出错时返回原始字符串
      }
    };

    // 检查是否有云同步图标
    const hasCloudIcon = item.is_synced || item.synced;

    // 处理文件点击
    const handleFilePress = () => {
      console.log('点击文件:', item);

      // 根据文件类型选择不同的导航目标
      if (item.file_type === 'pdf' || (item.file_name && item.file_name.toLowerCase().endsWith('.pdf'))) {
        // 检查是否有文件URI
        if (!item.file_uri) {
          // 对于测试数据，我们没有实际的文件URI，所以显示内容预览
          navigation.navigate('Note', { note: item });
          return;
        }

        // PDF文件 - 导航到PDF查看器
        navigation.navigate('PDFViewer', {
          uri: item.file_uri,
          title: item.title || (item.file_name ? item.file_name.split('.')[0] : '未命名PDF'),
          noteId: item.id
        });
      }
      else if (item.file_type === 'word' ||
              (item.file_name && (item.file_name.toLowerCase().endsWith('.docx') ||
                                 item.file_name.toLowerCase().endsWith('.doc')))) {
        // 检查是否有文件URI
        if (!item.file_uri) {
          // 对于测试数据，我们没有实际的文件URI，所以显示内容预览
          navigation.navigate('Note', { note: item });
          return;
        }

        // Word文件 - 导航到Word查看器
        navigation.navigate('DocViewer', {
          uri: item.file_uri,
          title: item.title || (item.file_name ? item.file_name.split('.')[0] : '未命名文档'),
          noteId: item.id
        });
      }
      else if (item.type === 'canvas') {
        // 画布 - 导航到画布编辑器
        navigation.navigate('Canvas', { canvasId: item.id });
      }
      else {
        // 默认文本笔记 - 导航到笔记编辑器
        navigation.navigate('Note', { note: item });
      }
    };

    // 处理更多操作
    const handleMoreOptions = (e) => {
      e.stopPropagation(); // 防止触发父元素的点击事件

      // 显示操作菜单（删除、分享等）
      Alert.alert(
        item.title || '笔记操作',
        '选择操作',
        [
          {
            text: '编辑',
            onPress: handleFilePress
          },
          {
            text: '删除',
            onPress: () => handleDeleteNote(item.id),
            style: 'destructive'
          },
          {
            text: '取消',
            style: 'cancel'
          }
        ]
      );
    };

    return (
      <TouchableOpacity
        style={[styles.noteItem, { backgroundColor: colors.card }]}
        onPress={handleFilePress}
        activeOpacity={0.7}
      >
        {/* 封面 */}
        {renderCover()}

        {/* 标题和底部信息 */}
        <Text style={[styles.noteTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title || (item.file_name ? item.file_name.split('.')[0] : '未命名笔记')}
        </Text>
        <View style={styles.noteFooter}>
          <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
            {formatDate(item.updatedAt || item.updated_at)}
          </Text>

          <View style={styles.noteActions}>
            {hasCloudIcon && (
              <View style={styles.cloudIcon}>
                <Icon name="cloud-done" size={16} color={colors.primary} />
              </View>
            )}

            <TouchableOpacity
              onPress={handleMoreOptions}
              style={styles.deleteButton}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Icon name="ellipsis-vertical" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
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

      <View style={[styles.aiAssistantCard, { backgroundColor: colors.secondaryContainer || '#E8F5E9' }]}>
        <View style={styles.aiAssistantHeader}>
          <Icon name="bulb-outline" size={24} color={colors.secondary || '#388E3C'} />
          <Text style={[styles.aiAssistantTitle, { color: colors.text }]}>AI助手</Text>
        </View>
        <Text style={[styles.aiAssistantDesc, { color: colors.textSecondary }]}>
          使用我们的AI助手帮助您更高效地记录和整理笔记，提供智能建议和内容分析。
        </Text>
        <TouchableOpacity
          style={[styles.aiAssistantButton, { backgroundColor: colors.secondary || '#388E3C' }]}
          onPress={() => navigation.navigate('AIAssistant')}
        >
          <Text style={[styles.aiAssistantButtonText, { color: colors.onSecondary || '#FFFFFF' }]}>立即体验</Text>
          <Icon name="arrow-forward-outline" size={18} color={colors.onSecondary || '#FFFFFF'} />
        </TouchableOpacity>
      </View>

      <View style={[styles.aiAssistantCard, { backgroundColor: colors.secondaryContainer || '#E8F5E9', marginTop: 20 }]}>
        <View style={styles.aiAssistantHeader}>
          <Icon name="git-network-outline" size={24} color={colors.secondary || '#388E3C'} />
          <Text style={[styles.aiAssistantTitle, { color: colors.text }]}>知识图谱</Text>
        </View>
        <Text style={[styles.aiAssistantDesc, { color: colors.textSecondary }]}>
          通过知识图谱可视化您的笔记之间的关联，发现知识连接，构建个人知识网络。
        </Text>
        <TouchableOpacity
          style={[styles.aiAssistantButton, { backgroundColor: colors.secondary || '#388E3C' }]}
          onPress={() => navigation.navigate('KnowledgeGraph')}
        >
          <Text style={[styles.aiAssistantButtonText, { color: colors.onSecondary || '#FFFFFF' }]}>查看图谱</Text>
          <Icon name="arrow-forward-outline" size={18} color={colors.onSecondary || '#FFFFFF'} />
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
        <UnifiedSearchBar
          searchScope="home"
          resultScreenName="SearchResults"
          onSearch={handleSearch}
        />
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

      {/* 网络状态指示器已移除 */}

      <View style={styles.buttonContainer}>
        {/* 上传云端按钮已移除 */}

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

        {/* 创建内容弹窗 */}
        <CreateContentModal
          visible={showCreateOptions}
          onClose={() => setShowCreateOptions(false)}
          onCreateNote={() => navigation.navigate('Note', { note: null, type: 'text' })}
          onCreateLinedNote={() => navigation.navigate('Note', { note: null, type: 'lined' })}
          onImportPDF={importPDF}
          onImportWord={importWord}
          onCreateCanvas={() => navigation.navigate('Canvas')}
        />
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
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: Dimensions.get('window').width / 2 - 24,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 18,
  },
  noteContent: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  noteDate: {
    fontSize: 10,
    fontWeight: '400',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cloudIcon: {
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 封面样式
  coverContainer: {
    height: 140,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8
  },
  // PDF预览样式
  pdfPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 57, 53, 0.05)',
  },
  pdfPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 57, 53, 0.05)',
  },
  pdfPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935',
  },
  // Word预览样式
  wordPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 118, 210, 0.05)',
  },
  wordPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(25, 118, 210, 0.05)',
  },
  wordPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  // 图片预览样式
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  // 画布预览样式
  canvasPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
  },
  canvasPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  // 文本预览样式
  textPreview: {
    width: '100%',
    height: '100%',
    padding: 12,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.05)',
  },
  coverText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  coverContent: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.9,
  },
  fileTypeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
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
  syncButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  syncButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 100, // 增加顶部内边距，避免被上方控件遮挡
    paddingBottom: 50,
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
    borderColor: 'rgba(0, 0, 0, 0.05)',
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