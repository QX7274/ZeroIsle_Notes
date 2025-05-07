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
import DocumentPicker, { types } from 'react-native-document-picker';
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
import NetInfo from '@react-native-community/netinfo';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  // 从Redux中获取笔记列表
  const notesState = useSelector(state => state.notes);
  const allNotes = useSelector(state => {
    console.log('Redux笔记状态:', state.notes);
    // 尝试多种方式获取笔记数据
    if (state.notes && state.notes.ids && state.notes.entities) {
      // 使用实体适配器格式
      return state.notes.ids.map(id => state.notes.entities[id]);
    } else if (Array.isArray(state.notes.notes)) {
      // 使用notes数组
      return state.notes.notes;
    } else if (state.notes.entities) {
      // 直接使用entities对象
      return Object.values(state.notes.entities);
    } else {
      // 返回空数组
      console.log('无法从Redux中获取笔记数据');
      return [];
    }
  });
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

  // 同步离线笔记到云端
  const syncNotesToCloud = async () => {
    try {
      setIsLoading(true);

      // 获取网络状态
      const networkStatus = await NetInfo.fetch();
      if (!networkStatus.isConnected) {
        Alert.alert('错误', '无网络连接，无法同步到云端');
        setIsLoading(false);
        return;
      }

      // 获取离线笔记
      const offlineNotes = await offlineStorageService.getNotes();
      const unsyncedNotes = offlineNotes.filter(note => !note.is_synced);

      if (unsyncedNotes.length === 0) {
        Alert.alert('提示', '没有需要同步的笔记');
        setIsLoading(false);
        return;
      }

      // 显示确认对话框
      Alert.alert(
        '同步到云端',
        `发现${unsyncedNotes.length}个未同步的笔记，是否同步到云端？`,
        [
          {
            text: '取消',
            style: 'cancel',
            onPress: () => setIsLoading(false)
          },
          {
            text: '同步',
            onPress: async () => {
              try {
                // 执行同步
                const result = await offlineStorageService.syncPendingOperations();

                if (result.success) {
                  Alert.alert('成功', `成功同步${result.syncedCount}个笔记到云端`);
                  loadNotes(); // 重新加载笔记列表
                } else {
                  throw new Error(result.message || '同步失败');
                }
              } catch (error) {
                console.error('同步笔记失败:', error);
                Alert.alert('错误', error.message || '同步笔记失败，请稍后重试');
              } finally {
                setIsLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('准备同步笔记失败:', error);
      Alert.alert('错误', error.message || '准备同步笔记失败，请稍后重试');
      setIsLoading(false);
    }
  };

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

      // 首先尝试从本地存储获取笔记
      const offlineResponse = await notesApi.getOfflineNotes();
      console.log('获取离线笔记响应:', offlineResponse);

      if (offlineResponse && offlineResponse.success && offlineResponse.data && offlineResponse.data.length > 0) {
        // 如果有离线笔记，使用离线笔记
        console.log('使用离线笔记数据:', offlineResponse.data.length, '条笔记');

        // 直接设置到Redux状态，而不是使用updateNote thunk
        dispatch({ type: 'notes/setNotes', payload: offlineResponse.data });
      } else {
        // 如果没有离线笔记，创建一些测试数据
        console.log('没有离线笔记，创建测试数据');
        const testNotes = [
          {
            id: 'test_1',
            title: '计算机网络（第8版）',
            content: '计算机网络是指将地理位置不同的具有独立功能的多台计算机及其外部设备，通过通信线路连接起来...',
            file_type: 'pdf',
            file_name: '计算机网络（第8版）.pdf',
            created_at: '2023/4/21 08:14 PM',
            updated_at: '2023/4/21 08:14 PM',
            is_synced: true,
            preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
          },
          {
            id: 'test_2',
            title: 'SVN备忘录',
            content: 'SVN是Subversion的简称，是一个开放源代码的版本控制系统...',
            file_type: 'word',
            file_name: 'SVN备忘录.docx',
            created_at: '2023/4/5 11:37 AM',
            updated_at: '2023/4/5 11:37 AM',
            is_synced: true,
            preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
          },
          {
            id: 'test_3',
            title: '微积分',
            content: '微积分是高等数学中研究函数的微分和积分的数学分支...\n\n微积分的基本概念包括：\n1. 极限\n2. 导数\n3. 积分\n4. 微分方程\n\n微积分在物理学、工程学、经济学和计算机科学等领域有广泛应用。',
            file_type: 'text',
            file_name: '微积分.txt',
            created_at: '2023/3/24 06:52 PM',
            updated_at: '2023/3/24 06:52 PM',
            is_synced: true
          },
          {
            id: 'test_4',
            title: '线性代数',
            content: '线性代数是数学的一个分支，它的研究对象是向量、向量空间（或称线性空间）、线性变换和有限维的线性方程组...\n\n线性代数的基本概念包括：\n1. 矩阵\n2. 行列式\n3. 特征值和特征向量\n4. 向量空间\n\n线性代数在计算机图形学、机器学习和量子力学等领域有重要应用。',
            file_type: 'text',
            file_name: '线性代数.txt',
            created_at: '2023/3/22 01:14 PM',
            updated_at: '2023/3/22 01:14 PM',
            is_synced: true
          },
          {
            id: 'test_5',
            title: '概率论与数理统计',
            content: '概率论与数理统计是研究随机现象数量规律的数学分支...',
            file_type: 'pdf',
            file_name: '概率论与数理统计.pdf',
            created_at: '2023/5/4 11:35 AM',
            updated_at: '2023/5/4 11:35 AM',
            is_synced: true,
            preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
          },
          {
            id: 'test_6',
            title: '2023年考研30题（真题版）',
            content: '2023年考研数学真题及解析...',
            file_type: 'pdf',
            file_name: '2023年考研30题（真题版）.pdf',
            created_at: '2023/2/24 11:08 AM',
            updated_at: '2023/2/24 11:08 AM',
            is_synced: true
          },
          {
            id: 'test_7',
            title: '数据结构与算法',
            content: '数据结构是计算机存储、组织数据的方式。算法是解决特定问题的一系列操作...\n\n常见的数据结构包括：\n1. 数组\n2. 链表\n3. 栈和队列\n4. 树和图\n\n常见的算法包括：\n1. 排序算法\n2. 搜索算法\n3. 动态规划\n4. 贪心算法',
            file_type: 'text',
            file_name: '数据结构与算法.txt',
            created_at: '2023/6/15 03:22 PM',
            updated_at: '2023/6/15 03:22 PM',
            is_synced: true
          },
          {
            id: 'test_8',
            title: '机器学习基础',
            content: '机器学习是人工智能的一个分支，它使用统计学方法让计算机系统能够"学习"...',
            file_type: 'word',
            file_name: '机器学习基础.docx',
            created_at: '2023/7/10 09:45 AM',
            updated_at: '2023/7/10 09:45 AM',
            is_synced: true,
            preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
          }
        ];

        // 保存测试数据到离线存储
        for (const note of testNotes) {
          await offlineStorageService.saveNote(note);
        }

        // 直接设置到Redux状态
        dispatch({ type: 'notes/setNotes', payload: testNotes });
      }

      // 然后尝试从服务器获取笔记（不影响离线笔记的显示）
      try {
        const response = await notesApi.getAllNotes();
        console.log('获取在线笔记响应:', response);
        if (response && response.success) {
          // 如果在线获取成功，更新Redux状态
          dispatch({ type: 'notes/setNotes', payload: response.data });
        }
      } catch (error) {
        console.log('在线获取笔记失败，继续使用离线数据:', error.message);
        // 在线获取失败不影响用户体验，继续使用离线数据
      }
    } catch (error) {
      console.error('加载笔记失败:', error);
      // 不显示弹窗，避免影响用户体验
      console.error('错误详情:', error);

      // 加载失败时，显示测试数据
      const testNotes = [
        {
          id: 'test_1',
          title: '计算机网络（第8版）',
          content: '计算机网络是指将地理位置不同的具有独立功能的多台计算机及其外部设备，通过通信线路连接起来...',
          file_type: 'pdf',
          file_name: '计算机网络（第8版）.pdf',
          created_at: '2023/4/21 08:14 PM',
          updated_at: '2023/4/21 08:14 PM',
          is_synced: true,
          preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
        },
        {
          id: 'test_2',
          title: 'SVN备忘录',
          content: 'SVN是Subversion的简称，是一个开放源代码的版本控制系统...',
          file_type: 'word',
          file_name: 'SVN备忘录.docx',
          created_at: '2023/4/5 11:37 AM',
          updated_at: '2023/4/5 11:37 AM',
          is_synced: true,
          preview_image: 'https://img-blog.csdnimg.cn/20200627111426602.png'
        }
      ];

      // 直接设置到Redux状态
      dispatch({ type: 'notes/setNotes', payload: testNotes });
    } finally {
      setIsLoading(false);
    }
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

        // 调用实际的导入API
        const response = await notesApi.importNote(formData);
        console.log('PDF导入结果:', response);

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

        // 调用实际的导入API
        const response = await notesApi.importNote(formData);
        console.log('Word导入结果:', response);

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
        {/* 上传云端按钮 */}
        {(
          <TouchableOpacity
            style={[styles.syncButton, { backgroundColor: colors.secondary }]}
            onPress={syncNotesToCloud}
          >
            <View style={styles.syncButtonInner}>
              <Icon name="cloud-upload" size={24} color={colors.onSecondary} />
            </View>
          </TouchableOpacity>
        )}

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