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
  ScrollView,
  SafeAreaView
} from 'react-native';
import useOrientation, { ORIENTATION } from '../../utils/hooks/useOrientation';
import RenameDialog from '../../components/common/RenameDialog';
import DocumentPicker, { types } from 'react-native-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { apiWrapper } from '../../services/api/apiWrapper';
import { setNotes as setNotesAction, addNote, deleteNote, selectAllNotes, updateNote } from '../../redux/slices/notesSlice';
import Icon from 'react-native-vector-icons/Ionicons';
import { Text } from 'react-native'; // 直接从react-native导入Text组件
import UnifiedSearchBar from '../../components/search/UnifiedSearchBar';
import SortControl from '../../components/home/SortControl';
// OfflineIndicator 已移除
import { offlineStorageService } from '../../services/offline';
import NetInfo from '@react-native-community/netinfo';
import CreateContentModal from '../../components/common/CreateContentModal';
import CanvasStyleModal from '../../components/canvas/CanvasStyleModal';
import NoteStyleModal from '../../components/note/NoteStyleModal';
import preloadService from '../../services/document/preloadService';
import RNFS from 'react-native-fs';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  // 使用selectAllNotes选择器获取所有笔记
  const allNotes = useSelector(selectAllNotes);

  // 记录Redux状态
  const notesState = useSelector(state => state.notes);
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 获取屏幕方向信息
  const { orientation, isLandscape, screenWidth, screenHeight } = useOrientation();
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [showCanvasStyleModal, setShowCanvasStyleModal] = useState(false);
  const [showNoteStyleModal, setShowNoteStyleModal] = useState(false);
  const [sortOption, setSortOption] = useState('updated_desc');
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [noteToRename, setNoteToRename] = useState(null);

  // 加载排序偏好和初始化离线存储
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        console.log('开始初始化 HomeScreen...');

        // 加载排序偏好
        try {
          // 确保离线存储服务已初始化
          if (!offlineStorageService.initialized) {
            await offlineStorageService.initialize();
          }

          // 使用realmService直接获取数据
          const { realmService } = require('../../services/database/realmService');
          const sortPreference = await realmService.findOne('settings', { key: 'home_sort_preference' });

          if (sortPreference && sortPreference.value) {
            setSortOption(sortPreference.value);
            console.log('已加载排序偏好:', sortPreference.value);
          }
        } catch (sortError) {
          console.warn('加载排序偏好失败:', sortError);
          // 使用默认排序选项
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
          if (!offlineStorageService.initialized) {
            console.log('在后台初始化离线存储服务...');
            offlineStorageService.initialize().catch(err => {
              console.warn('后台初始化离线存储服务失败:', err);
            });
          } else {
            console.log('离线存储服务已初始化');
          }

          // 无限画布存储已移除

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

  // 创建无限画布
  const createCanvas = () => {
    setShowCreateOptions(false);
    setShowCanvasStyleModal(true);
  };

  // 处理画布样式选择
  const handleCanvasStyleSelect = (style, name) => {
    const canvasTitle = name || `无限画布 ${new Date().toLocaleString()}`;
    const canvasId = `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    navigation.navigate('InfiniteCanvas', {
      title: canvasTitle,
      noteId: canvasId,
      canvasStyle: style
    });
  };

  // 创建新建笔记
  const createNote = () => {
    setShowCreateOptions(false);
    setShowNoteStyleModal(true);
  };

  // 处理笔记样式选择
  const handleNoteStyleSelect = (style, name) => {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    navigation.navigate('PagedNote', {
      title: name,
      noteId: noteId,
      noteStyle: style
    });
  };

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
          console.log('加载笔记超时，尝试从备份恢复');
          resolve({ success: false, timeout: true });
        }, 10000); // 10秒超时，增加超时时间
      });

      // 首先尝试从本地存储获取笔记，带超时
      const offlineResponsePromise = apiWrapper.getAllNotes();
      const offlineResponse = await Promise.race([offlineResponsePromise, timeoutPromise]);

      // 如果超时，尝试从AsyncStorage备份恢复
      if (offlineResponse.timeout) {
        console.log('API请求超时，尝试从AsyncStorage备份恢复');

        try {
          console.log('尝试从MongoDB获取备份笔记...');
          try {
            // 使用realmService直接获取备份笔记
            const { realmService } = require('../../services/database/realmService');
            const backupNotesObj = await realmService.findOne('settings', { key: 'BACKUP_NOTES' });
            const backupNotes = backupNotesObj && backupNotesObj.value ? JSON.parse(backupNotesObj.value) : null;

            if (backupNotes && Array.isArray(backupNotes) && backupNotes.length > 0) {
              console.log(`从MongoDB备份恢复了 ${backupNotes.length} 条笔记`);
              dispatch(setNotesAction(backupNotes));
            } else {
              console.log('MongoDB中没有备份笔记，返回空数组');
              dispatch(setNotesAction([]));
            }
          } catch (mongoError) {
            console.log('从MongoDB获取备份笔记失败，但这是正常的，因为可能是新用户:', mongoError);
            // 对于新用户，返回空数组而不是错误
            dispatch(setNotesAction([]));
          }

          setIsLoading(false);
          return; // 提前返回，避免重复设置 isLoading
        } catch (backupError) {
          console.error('从AsyncStorage恢复备份失败:', backupError);
          dispatch(setNotesAction([]));
          setIsLoading(false);
          return; // 提前返回，避免重复设置 isLoading
        }
      }

      console.log('获取笔记响应:', offlineResponse);

      if (offlineResponse && offlineResponse.success && offlineResponse.data && offlineResponse.data.length > 0) {
        // 如果有笔记，使用这些笔记
        console.log('使用获取到的笔记数据:', offlineResponse.data.length, '条笔记');

        // 使用导出的action creator设置笔记
        dispatch(setNotesAction(offlineResponse.data));

        // 调试：检查canvas类型的笔记
        const canvasNotes = offlineResponse.data.filter(note => note.type === 'canvas');
        console.log('HomeScreen: 加载的canvas类型笔记数量:', canvasNotes.length);
        canvasNotes.forEach(note => {
          console.log('HomeScreen: canvas笔记详情:', {
            id: note._id || note.id,
            title: note.title,
            type: note.type,
            canvasStyle: note.canvasStyle
          });
        });

        // 启动智能预加载
        startIntelligentPreload(offlineResponse.data);
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

  // 智能预加载
  const startIntelligentPreload = (notesList) => {
    try {
      // 过滤出文档类型的笔记
      const documentNotes = notesList.filter(note => {
        const fileType = note.file_type || '';
        return ['pdf', 'docx', 'doc', 'pptx', 'ppt'].includes(fileType.toLowerCase());
      });

      // 按更新时间排序，获取最近访问的文档
      const recentDocuments = documentNotes
        .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
        .slice(0, 10) // 只预加载前10个
        .map(note => ({
          uri: note.uri || note.file_uri || note.file_path,
          type: note.file_type?.toLowerCase(),
          title: note.title
        }))
        .filter(doc => doc.uri && doc.type);

      if (recentDocuments.length > 0) {
        console.log('HomeScreen: 启动智能预加载，文档数量:', recentDocuments.length);
        preloadService.intelligentPreload(recentDocuments);
      }
    } catch (error) {
      console.error('HomeScreen: 智能预加载失败:', error);
    }
  };

  // 导入PDF文件
  const importPDF = async () => {
    try {
      const results = await DocumentPicker.pick({
        type: [types.pdf],
        allowMultiSelection: false,
        // 确保使用正确的API获取文件访问权限
        mode: 'import',  // 使用import模式而不是open模式
        copyTo: 'documentDirectory', // 复制到文档目录而不是缓存目录
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
          const response = await apiWrapper.importNote(formData);
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
          const noteId = Date.now() + '_' + Math.random().toString(36).substring(2, 11);

          // 创建metadata对象
          const metadataObj = {
            pdfPath: file.uri,
            fileSize: file.size || null,
            pageCount: null, // PDF页数，后续可以添加
            lastOpenedPage: 1, // 上次打开的页码
            lastOpenedTime: new Date().toISOString(), // 上次打开时间
            fileCopyUri: file.fileCopyUri || null // 保存文件复制后的URI
          };

          // 将metadata转换为字符串
          const metadataString = JSON.stringify(metadataObj);

          const localNote = {
            id: noteId,
            _id: noteId, // 同时设置_id字段，确保兼容性
            title: file.name ? file.name.split('.')[0] : 'PDF文档', // 使用文件名作为标题
            content: `PDF文件: ${file.name || '未命名文档'}`, // 明确标记为PDF文件

            // 统一文件类型标识 - 确保这些字段被正确设置
            type: 'pdf',
            file_type: 'pdf',

            // 文件信息 - 确保这些字段被正确设置
            file_name: file.name || `document_${Date.now()}.pdf`, // 保存原始文件名
            file_uri: file.uri,
            uri: file.uri, // 添加uri字段作为备用
            path: file.uri, // 添加path字段作为备用
            file_path: file.uri, // 添加file_path字段作为备用
            url: file.uri, // 添加url字段作为备用

            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_synced: false,
            is_offline: true,
            imported: true,

            // 不再使用预览图，而是使用纯色背景
            preview_image: null,

            // 添加metadata，确保是字符串类型
            metadata: metadataString,

            // 确保tags是字符串数组
            tags: []
          };

          // 保存到离线存储
          try {
            await offlineStorageService.saveNote(localNote);
            console.log('HomeScreen: PDF文件保存成功:', { action: 'saveNote', id: localNote._id || localNote.id, type: localNote.file_type || localNote.type });
          } catch (e) {
            console.warn('HomeScreen: PDF文件保存失败:', e);
          }

          // 使用addNote添加单个笔记，避免覆盖现有数据
          dispatch(addNote(localNote));
          console.log('HomeScreen: PDF文件导入完成，笔记ID:', localNote._id);

          // 日志已在上面的try-catch块中输出
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
        mode: 'import',  // 使用import模式而不是open模式
        copyTo: 'documentDirectory', // 复制到文档目录而不是缓存目录
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
          const response = await apiWrapper.importNote(formData);

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
  }
  // 导入PPT文件
  const importPPT = async () => {
    try {
      console.log('HomeScreen: 开始导入PPT文件');

      // 使用更宽松的文件类型选择
      let results;
      try {
        const pptTypes = Platform.select({
          android: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
          ios: ['com.microsoft.powerpoint.ppt', 'org.openxmlformats.presentationml.presentation']
        });
        results = await DocumentPicker.pick({
          type: pptTypes,
          allowMultiSelection: false,
          mode: 'import',
          copyTo: 'documentDirectory'
        });
      } catch (typeError) {
        console.warn('HomeScreen: 特定类型选择失败，尝试所有文件类型:', typeError);
        // 如果特定类型失败，尝试所有文件类型
        results = await DocumentPicker.pick({
          type: [DocumentPicker.types.allFiles],
          allowMultiSelection: false,
          mode: 'import',
          copyTo: 'documentDirectory'
        });
      }
      if (results && results.length > 0) {
        const file = results[0];
        console.log('HomeScreen: 选择的PPT文件:', file);

        // 验证文件扩展名
        const fileName = file.name || '';
        const isPPTFile = /\.(ppt|pptx)$/i.test(fileName);

        if (!isPPTFile) {
          Alert.alert('错误', '请选择PPT或PPTX格式的文件');
          return;
        }

        const noteId = `${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
        const localNote = {
          id: noteId,
          _id: noteId,
          title: file.name ? file.name.replace(/\.(pptx|ppt)$/i, '') : 'PPT文档',
          content: `PPT文件: ${file.name || '未命名'}`,
          type: (file.name||'').toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt',
          file_type: (file.name||'').toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt',
          file_name: file.name || `document_${Date.now()}.pptx`,
          file_uri: file.uri || file.fileCopyUri,
          uri: file.uri || file.fileCopyUri,
          path: file.uri || file.fileCopyUri,
          file_path: file.uri || file.fileCopyUri,
          url: file.uri || file.fileCopyUri,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_synced: false,
          is_offline: true,
          imported: true,
          preview_image: null,
          metadata: JSON.stringify({ filePath: file.uri || file.fileCopyUri, fileSize: file.size || null, lastOpenedTime: new Date().toISOString() }),
          tags: []
        };
        try {
          await offlineStorageService.saveNote(localNote);
          console.log('HomeScreen: Word文件保存成功:', { action: 'saveNote', id: localNote._id || localNote.id, type: localNote.file_type || localNote.type });
        } catch (e) {
          console.warn('HomeScreen: Word文件保存失败:', e);
        }

        // 使用addNote添加单个笔记，避免覆盖现有数据
        dispatch(addNote(localNote));
        console.log('HomeScreen: PPT文件导入完成，笔记ID:', localNote._id);

        // 日志已在上面的try-catch块中输出
        Alert.alert('成功', '已添加到列表，点击即可打开预览');
      }
    } catch (error) {
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入PPT失败:', error);
        Alert.alert('错误', error.message || '导入PPT失败，请稍后重试');
      }
    }
  };

  // 导入Markdown/TXT 文件
  const importMarkdown = useCallback(async () => {
    try {
      const mdTypes = Platform.select({ ios: ['net.daringfireball.markdown', types.plainText], android: ['text/markdown', 'text/plain'] });
      let results = await DocumentPicker.pick({ type: mdTypes, allowMultiSelection: false, mode: 'import', copyTo: 'documentDirectory' });
      const okExt = (name='') => /\.(md|markdown|txt)$/i.test(name);
      if (!results || results.length === 0 || !okExt(results[0]?.name || results[0]?.fileCopyUri || '')) {
        try { results = await DocumentPicker.pick({ type: [types.allFiles], allowMultiSelection: false, mode: 'import', copyTo: 'documentDirectory' }); } catch (err) {
          console.error('导入Markdown文件失败:', err);
          Alert.alert('导入失败', '无法选择文件，请检查权限或重试。');
          return;
        }
      }
      if (results && results.length > 0) {
        const file = results[0];
        const noteId = `${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
        const localNote = {
          id: noteId,
          _id: noteId,
          title: file.name ? file.name.replace(/\.(md|markdown|txt)$/i, '') : 'Markdown/TXT',
          content: '',
          type: 'markdown',
          file_type: 'markdown',
          file_name: file.name || `document_${Date.now()}.md`,
          file_uri: file.uri || file.fileCopyUri,
          uri: file.uri || file.fileCopyUri,
          path: file.uri || file.fileCopyUri,
          file_path: file.uri || file.fileCopyUri,
          url: file.uri || file.fileCopyUri,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_synced: false,
          is_offline: true,
          imported: true,
          preview_image: null,
          metadata: JSON.stringify({ filePath: file.uri || file.fileCopyUri, fileSize: file.size || null, lastOpenedTime: new Date().toISOString() }),
          tags: []
        };
        try {
          await offlineStorageService.saveNote(localNote);
          console.log('HomeScreen: Markdown文件保存成功:', { action: 'saveNote', id: localNote._id || localNote.id, type: localNote.file_type || localNote.type });
        } catch (e) {
          console.warn('HomeScreen: Markdown文件保存失败:', e);
        }

        // 使用addNote添加单个笔记，避免覆盖现有数据
        dispatch(addNote(localNote));
        console.log('HomeScreen: Markdown文件导入完成，笔记ID:', localNote._id);

        // 日志已在上面的try-catch块中输出
        Alert.alert('成功', '已添加到列表，点击即可打开预览');
      }
    } catch (error) {
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入Markdown/TXT失败:', error);
        Alert.alert('错误', error.message || '导入失败，请稍后重试');
      }
    }
  }, []);


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
      const noteId = Date.now() + '_' + Math.random().toString(36).substring(2, 11);

      // 创建metadata对象
      const metadataObj = {
        filePath: fileUri,
        fileSize: file.size || null,
        lastOpenedTime: new Date().toISOString()
      };

      // 将metadata转换为字符串
      const metadataString = JSON.stringify(metadataObj);

      const localNote = {
        id: noteId,
        _id: noteId, // 同时设置_id字段，确保兼容性
        title: file.name ? file.name.split('.')[0] : 'Word文档',
        content: `Word文件: ${file.name || '未命名文档'}`, // 明确标记为Word文件

        // 统一文件类型标识 - 确保这些字段被正确设置
        type: file.name && file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'doc',
        file_type: file.name && file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'doc',

        // 文件信息 - 确保这些字段被正确设置
        file_name: file.name || `document_${Date.now()}.docx`,
        file_uri: fileUri,
        uri: fileUri, // 添加uri字段作为备用
        path: fileUri, // 添加path字段作为备用
        file_path: fileUri, // 添加file_path字段作为备用
        url: fileUri, // 添加url字段作为备用

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
        imported: true,

        // 不再使用预览图，而是使用纯色背景
        preview_image: null,

        // 添加metadata，确保是字符串类型
        metadata: metadataString,

        // 确保tags是字符串数组
        tags: []
      };

      // 添加到Redux状态
      dispatch(addNote(localNote));

      // 保存到本地存储 - 使用多种方式确保持久化
      try {
        // 1. 使用notesApi保存到离线存储
        const saveResult = await apiWrapper.saveOfflineNote(localNote);
        console.log('笔记已保存到离线存储:', saveResult);

        // 2. 使用数据服务直接保存到MongoDB数据库
        try {
          // 使用MongoDB数据服务保存笔记
          const savedNote = await apiWrapper.saveOfflineNote(localNote);
          console.log('笔记已直接保存到MongoDB数据库:', savedNote.id);
        } catch (dbError) {
          console.error('直接保存到MongoDB数据库失败:', dbError);
        }

        // 3. 使用MongoDB作为额外备份
        try {
          const existingNotes = await offlineStorageService.getItem('BACKUP_NOTES') || [];
          existingNotes.push(localNote);
          await offlineStorageService.setItem('BACKUP_NOTES', existingNotes);
          console.log('笔记已备份到MongoDB');
        } catch (storageError) {
          console.error('备份到MongoDB失败:', storageError);
        }
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

  const renderNoteItem = ({ item, index }) => {
    // 防止item为null或undefined
    if (!item) {
      console.warn('renderNoteItem收到无效的item:', item);
      return null;
    }

    console.log('渲染笔记项:', item, '索引:', index);

    // 根据笔记类型渲染不同的封面
    const renderCover = () => {
      console.log('渲染封面，笔记数据:', item);

      // 安全地获取内容，处理可能的循环引用
      let content = '';
      try {
        if (item.content) {
          if (typeof item.content === 'string') {
            content = item.content;
          } else if (typeof item.content === 'object' && item.content !== null) {
            if (item.content.reference === 'circular') {
              content = ''; // 处理循环引用
            } else {
              content = String(item.content);
            }
          }
        }
      } catch (error) {
        console.warn('处理笔记内容失败:', error);
        content = '';
      }

      // 检查是否是PDF文件
      const type = (item.type || '').toString().toLowerCase().trim();
      const fileType = (item.file_type || '').toString().toLowerCase().trim();
      const fileName = (item.file_name || '').toString().toLowerCase().trim();
      const fileUri = (item.file_uri || '').toString().toLowerCase().trim();

      const isPdf =
        fileType === 'pdf' ||
        type === 'pdf' ||
        fileName.endsWith('.pdf') ||
        fileUri.endsWith('.pdf');

      console.log('isPdf:', isPdf, { type, fileType, fileName, fileUri });

      if (isPdf) {
        // PDF封面 - 使用纯色背景
        return (
          <View style={[styles.coverContainer, styles.pdfBackground]}>
            <Icon name="document-text" size={30} color="#E53935" />
            <Text style={{ color: '#E53935', fontSize: 12, marginTop: 4 }}>PDF</Text>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#E53935' }]} />
          </View>
        );
      }
      // 检查是否是Word文件
      else if (
        item.file_type === 'word' ||
        item.type === 'word' ||
        (item.file_name && (item.file_name.toLowerCase().endsWith('.docx') || item.file_name.toLowerCase().endsWith('.doc'))) ||
        content.includes('word') ||
        content.includes('docx') ||
        content.includes('doc')
      ) {
        // Word封面 - 使用纯色背景
        return (
          <View style={[styles.coverContainer, styles.wordBackground]}>
            <Icon name="document" size={30} color="#1976D2" />
            <Text style={{ color: '#1976D2', fontSize: 12, marginTop: 4 }}>Word</Text>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#1976D2' }]} />
          </View>
        );
      }
      // 检查是否是图片
      else if (
        item.type === 'image' ||
        (item.file_name && (
          item.file_name.toLowerCase().endsWith('.jpg') ||
          item.file_name.toLowerCase().endsWith('.jpeg') ||
          item.file_name.toLowerCase().endsWith('.png') ||
          item.file_name.toLowerCase().endsWith('.gif')
        ))
      ) {
        // 图片封面 - 使用纯色背景
        return (
          <View style={[styles.coverContainer, styles.imageBackground]}>
            <Icon name="image" size={30} color="#4CAF50" />
            <Text style={{ color: '#4CAF50', fontSize: 12, marginTop: 4 }}>图片</Text>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#4CAF50' }]} />
          </View>
        );
      }
      // 检查是否是Markdown/TXT
      else if (
        fileType === 'markdown' || type === 'markdown' ||
        (item.file_name && (item.file_name.toLowerCase().endsWith('.md') || item.file_name.toLowerCase().endsWith('.markdown') || item.file_name.toLowerCase().endsWith('.txt')))
      ) {
        return (
          <View style={[styles.coverContainer, styles.markdownBackground]}>
            <Icon name="code-slash" size={30} color="#455A64" />
            <Text style={{ color: '#455A64', fontSize: 12, marginTop: 4 }}>Markdown</Text>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#455A64' }]} />
          </View>
        );
      }
      // 检查是否是PPT/PPTX
      else if (
        fileType === 'ppt' || fileType === 'pptx' || type === 'ppt' || type === 'pptx' ||
        (item.file_name && (item.file_name.toLowerCase().endsWith('.ppt') || item.file_name.toLowerCase().endsWith('.pptx')))
      ) {
        return (
          <View style={[styles.coverContainer, styles.pptBackground]}>
            <Icon name="easel" size={30} color="#FF7043" />
            <Text style={{ color: '#FF7043', fontSize: 12, marginTop: 4 }}>PPT</Text>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#FF7043' }]} />
          </View>
        );
      }
      // 检查是否是画布
      else if (item.type === 'canvas') {
        console.log('HomeScreen: 渲染画布封面，数据:', {
          type: item.type,
          title: item.title,
          canvasStyle: item.canvasStyle,
          id: item._id || item.id
        });
        // 画布封面 - 使用纯色背景
        return (
          <View style={[styles.coverContainer, styles.canvasBackground]}>
            <Icon name="brush" size={30} color="#9C27B0" />
            <Text style={{ color: '#9C27B0', fontSize: 12, marginTop: 4 }}>画布</Text>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#9C27B0' }]} />
          </View>
        );
      }
      
      // 默认文本笔记封面
      else {
        console.log('handleFilePress - 进入默认文本笔记分支:', item); // 添加默认分支日志
        return (
          <View style={[styles.coverContainer, styles.textBackground]}>
            <Icon name="document-text-outline" size={30} color="#2196F3" />
            <Text style={{ color: '#2196F3', fontSize: 12, marginTop: 4 }}>笔记</Text>
            <View style={[styles.fileTypeIndicator, { backgroundColor: '#2196F3' }]} />
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

    // 处理文件点击
    const handleFilePress = (item) => {
      // 统一提取可能的文件 uri
      const possibleUris = [item.file_uri, item.uri, item.path, item.file_path, item.url].filter(Boolean);

      // 文件类型判定（统一小写）
      const name = (item.file_name || item.title || '').toLowerCase();
      const uri = (possibleUris[0] || '').toLowerCase();
      const type = (item.file_type || item.type || '').toLowerCase().trim();

      const isPdf = type === 'pdf' || name.endsWith('.pdf') || uri.endsWith('.pdf');
      const isDoc = ['doc', 'docx', 'word'].some(t => type === t) || name.endsWith('.doc') || name.endsWith('.docx') || uri.endsWith('.doc') || uri.endsWith('.docx');
      const isPpt = ['ppt', 'pptx'].some(t => type === t) || name.endsWith('.ppt') || name.endsWith('.pptx') || uri.endsWith('.ppt') || uri.endsWith('.pptx');
      const isMd  = ['markdown', 'txt', 'text'].some(t => type === t) || name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt') || uri.endsWith('.md') || uri.endsWith('.markdown') || uri.endsWith('.txt');

      const detection = {
        fileName: item.file_name || item.title || '',
        fileType: item.file_type || item.type || '',
        fileUri: possibleUris[0] || null,
        detectedType: { isPdf, isDoc, isPpt, isMd }
      };
      console.log('File type detection:', detection);

      if (!possibleUris.length && (isPdf || isDoc || isPpt || isMd)) {
        console.log('Routing decision:', { decision: 'invalid-file-uri', ...detection });
        Alert.alert('文件错误', '无法打开文件，路径不存在或导入失败。请删除后重新导入。');
        return;
      }

      if (isPdf) {
        const params = {
          uri: possibleUris[0],
          title: item.title || (item.file_name ? item.file_name.split('.')[0] : '未命名PDF'),
          noteId: item._id || item.id || `temp_${Date.now()}`,
        };
        console.log('Navigation params:', { screen: 'PDFViewer', params });
        navigation.navigate('PDFViewer', params);
        return;
      }
      if (isDoc) {
        const params = {
          uri: possibleUris[0],
          title: item.title || (item.file_name ? item.file_name.split('.')[0] : '未命名文档'),
          noteId: item._id || item.id || `temp_${Date.now()}`,
          type: name.endsWith('.docx') || uri.endsWith('.docx') ? 'docx' : 'doc'
        };
        console.log('Navigation params:', { screen: 'DocViewer', params });
        navigation.navigate('DocViewer', params);
        return;
      }
      if (isPpt) {
        const params = {
          uri: possibleUris[0],
          title: item.title || (item.file_name ? item.file_name.split('.')[0] : '演示文稿'),
          noteId: item._id || item.id || `temp_${Date.now()}`,
          type: 'pptx'
        };
        console.log('Navigation params:', { screen: 'PPTViewer', params });
        navigation.navigate('PPTViewer', params);
        return;
      }
      if (isMd) {
        const params = {
          uri: possibleUris[0],
          title: item.title || (item.file_name ? item.file_name.split('.')[0] : 'Markdown'),
          noteId: item._id || item.id || `temp_${Date.now()}`,
        };
        console.log('Navigation params:', { screen: 'MarkdownViewer', params });
        navigation.navigate('MarkdownViewer', params);
        return;
      }

      if (item.type === 'canvas') {
        const canvasId = item._id || item.id || `temp_${Date.now()}`;
        navigation.navigate('InfiniteCanvas', { canvasId, title: item.title || '无限草稿' });
        return;
      }

      if (item.type === 'paged_note') {
        const noteId = item._id || item.id || `temp_${Date.now()}`;
        navigation.navigate('PagedNote', {
          noteId,
          title: item.title || '新建笔记',
          noteStyle: item.noteStyle || 'blank'
        });
        return;
      }

      // 默认文本笔记
      navigation.navigate('Note', { note: item });
    };


    // 根据屏幕方向计算笔记项的宽度
    const columnCount = isLandscape ? 4 : 3; // 横屏4列，竖屏3列
    // 统一计算方式，确保横竖屏边距一致
    const totalPadding = 32; // 左右两侧各16的内边距
    const totalGap = (columnCount - 1) * 10; // 项目之间的间距总和
    const itemWidth = (screenWidth - totalPadding - totalGap) / columnCount;

    return (
      <View style={[
        styles.noteItem,
        {
          backgroundColor: colors.card,
          width: itemWidth // 动态设置宽度
        }
      ]}>
        {/* 只有点击背景区域才执行打开操作 */}
        <TouchableOpacity
          onPress={(e) => { e.persist(); handleFilePress(item); }}
          style={styles.coverTouchable}
          activeOpacity={0.7}
          delayPressIn={100} // 增加延迟，减少误触
          pressRetentionOffset={{ top: 20, left: 20, bottom: 20, right: 20 }} // 增加触摸区域
        >
          {/* 封面 */}
          {renderCover()}

          {/* 标题 */}
          <Text style={[styles.noteTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title || (item.file_name ? item.file_name.split('.')[0] : '未命名笔记')}
          </Text>

          {/* 底部区域 - 日期和操作按钮 */}
          <View style={styles.noteFooter}>
            <Text style={[styles.noteDate, { color: colors.textSecondary }]}>
              {formatDate(item.updatedAt || item.updated_at || item.created_at || new Date().toISOString())}
            </Text>

            <View style={styles.actionButtons}>
              {/* 编辑名称按钮 */}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡
                  handleRenameNote(item);
                }}
                style={[styles.actionButton, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}
                hitSlop={{ top: 10, right: 5, bottom: 10, left: 5 }}
              >
                <Icon name="create-outline" size={16} color={colors.primary} />
              </TouchableOpacity>

              {/* 导出/分享按钮 */}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡
                  handleExportNote(item);
                }}
                style={[styles.actionButton, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}
                hitSlop={{ top: 10, right: 5, bottom: 10, left: 5 }}
              >
                <Icon name="share-outline" size={16} color="#4CAF50" />
              </TouchableOpacity>

              {/* 删除按钮 */}
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation(); // 阻止事件冒泡
                  // 安全地获取ID，优先使用_id，其次使用id
                  const noteId = item._id || item.id;
                  handleDeleteNote(noteId);
                }}
                style={[styles.actionButton, { backgroundColor: 'rgba(229, 57, 53, 0.1)' }]}
                hitSlop={{ top: 10, right: 5, bottom: 10, left: 5 }}
              >
                <Icon name="trash-outline" size={16} color="#E53935" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // 处理笔记重命名 - 优化为立即响应
  const handleRenameNote = (note) => {
    // 防止note为null或undefined
    if (!note) {
      console.warn('handleRenameNote收到无效的note:', note);
      return;
    }

    console.log('重命名笔记:', note);

    // 确保笔记有ID
    if (!note._id && !note.id) {
      console.warn('笔记没有有效的ID:', note);
      Alert.alert('错误', '无法重命名笔记：ID无效');
      return;
    }

    // 使用平台兼容的方式获取用户输入
    if (Platform.OS === 'ios') {
      // iOS 使用 Alert.prompt
      Alert.prompt(
        '重命名笔记',
        '请输入新的名称',
        [
          {
            text: '取消',
            style: 'cancel'
          },
          {
            text: '确定',
            onPress: (newTitle) => {
              if (newTitle && newTitle.trim()) {
                // 在iOS上，Alert.prompt关闭后才会执行这个回调
                // 所以我们可以直接调用updateNoteTitle
                updateNoteTitle(note, newTitle.trim());
              }
            }
          }
        ],
        'plain-text',
        note.title || ''
      );
    } else {
      // Android 使用自定义对话框
      // 保存要重命名的笔记引用
      setNoteToRename(note);
      // 显示对话框
      setRenameDialogVisible(true);
    }
  };

  // 更新笔记标题的辅助函数 - 立即更新UI，后台执行数据操作
  const updateNoteTitle = (note, newTitle) => {
    try {
      console.log('更新笔记标题:', newTitle);

      // 安全地获取ID
      const noteId = note._id || note.id;
      if (!noteId) {
        console.error('无法获取笔记ID:', note);
        Alert.alert('错误', '无法重命名笔记：ID无效');
        return false;
      }

      // 创建更新后的笔记对象
      const updatedNote = {
        ...note,
        title: newTitle,
        updated_at: new Date().toISOString()
      };

      // 确保笔记同时有id和_id字段
      if (note._id && !updatedNote.id) {
        updatedNote.id = note._id;
      }
      if (note.id && !updatedNote._id) {
        updatedNote._id = note.id;
      }

      // 1. 立即更新Redux状态，确保UI立即响应
      dispatch(updateNote({
        id: noteId,
        noteData: updatedNote
      }));

      // 2. 立即关闭对话框
      if (Platform.OS === 'android') {
        setRenameDialogVisible(false);
      }

      // 3. 立即显示成功消息（可选，如果想要更快的体验可以移除）
      // Alert.alert('成功', '重命名成功');

      // 4. 在后台异步执行数据库操作，完全不阻塞UI
      requestAnimationFrame(() => {
        // 强制刷新笔记列表，确保UI立即更新
        const updatedNotesList = notes.map(n => {
          const currentId = n._id || n.id;
          return currentId === noteId ? updatedNote : n;
        });
        setNotes([...updatedNotesList]);

        // 在后台尝试更新数据库
        setTimeout(() => {
          apiWrapper.updateNote(noteId, updatedNote)
            .then((result) => {
              console.log('笔记已在后台通过API更新:', result);
              // 静默处理，不打扰用户
            })
            .catch(error => {
              console.error('后台更新数据库失败，但UI已更新:', error);
              // 静默处理，不打扰用户
            });
        }, 100); // 稍微延迟以确保UI更新优先
      });

      return true; // 返回成功，允许调用者立即继续
    } catch (error) {
      console.error('重命名笔记失败:', error);
      // 只在真正的错误情况下显示警告
      Alert.alert('错误', '重命名失败: ' + (error.message || '未知错误'));
      return false;
    }
  };

  // 处理笔记导出/分享
  const handleExportNote = (note) => {
    Alert.alert(
      '导出/分享',
      '选择操作',
      [
        {
          text: '导出到设备',
          onPress: async () => {
            try {
              // 根据笔记类型执行不同的导出操作
              if (note.file_uri) {
                // 如果是文件类型的笔记，直接导出文件
                const RNFS = require('react-native-fs');
                const fileName = note.title || '导出文件';
                const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}${getFileExtension(note.file_uri)}`;

                await RNFS.copyFile(note.file_uri, destPath);
                Alert.alert('成功', `文件已导出到: ${destPath}`);
              } else {
                // 如果是文本笔记，导出为TXT文件
                const RNFS = require('react-native-fs');
                const fileName = `${note.title || '笔记'}.txt`;
                const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;

                await RNFS.writeFile(destPath, note.content || '', 'utf8');
                Alert.alert('成功', `笔记已导出到: ${destPath}`);
              }
            } catch (error) {
              console.error('导出笔记失败:', error);
              Alert.alert('错误', '导出失败，请稍后重试');
            }
          }
        },
        {
          text: '分享',
          onPress: () => {
            // 分享功能可以在这里实现
            Alert.alert('提示', '分享功能即将推出');
          }
        },
        {
          text: '取消',
          style: 'cancel'
        }
      ]
    );
  };

  // 获取文件扩展名
  const getFileExtension = (uri) => {
    if (!uri) return '';
    const parts = uri.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  };

  // 处理笔记删除
  const handleDeleteNote = async (noteId) => {
    try {
      // 安全地获取ID，处理可能的undefined或对象
      let id = noteId;

      // 如果ID是undefined，尝试从当前选中的笔记中获取
      if (id === undefined) {
        console.warn('删除笔记时ID为undefined，尝试从当前选中的笔记中获取');
        return;
      }

      // 如果ID是对象，尝试获取_id或id属性
      if (typeof id === 'object' && id !== null) {
        id = id._id || id.id;
        if (!id) {
          console.error('无法从对象中获取有效的ID:', noteId);
          Alert.alert('错误', '无法删除笔记：ID无效');
          return;
        }
      }

      // 确保ID是字符串
      id = String(id);

      Alert.alert(
        '确认删除',
        '确定要删除这个笔记吗？此操作无法撤销。',
        [
          {
            text: '取消',
            style: 'cancel'
          },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await apiWrapper.deleteNote(id);
                if (result && result.success) {
                  console.log('笔记已通过API删除:', result);
                  dispatch(deleteNote(id));

                  // 从本地笔记列表中移除
                  const updatedNotes = notes.filter(note => {
                    const noteId = note._id || note.id;
                    return noteId !== id;
                  });
                  setNotes(updatedNotes);
                } else {
                  console.warn('API返回成功但结果异常:', result);
                  Alert.alert('部分成功', '笔记可能未完全从数据库中删除');
                }
              } catch (deleteError) {
                console.error('删除笔记失败:', deleteError);
                Alert.alert('错误', '删除失败: ' + (deleteError.message || '未知错误'));
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('删除笔记失败:', error);
      Alert.alert('错误', '删除失败，请稍后重试');
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderLoader()}

      {/* 头部区域 - 固定在顶部 */}
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

      {/* 搜索栏和排序控件放在同一行 */}
      <View style={[
        styles.searchSortContainer,
        // 横屏时调整样式
        isLandscape && {
          paddingHorizontal: 24,
          paddingVertical: 10,
        }
      ]}>
        {/* 搜索栏 - 占据大部分空间 */}
        <View style={[
          styles.searchBarContainer,
          // 横屏时调整搜索栏宽度
          isLandscape && {
            flex: 0.9,
            marginRight: 16,
          }
        ]}>
          <UnifiedSearchBar
            searchScope="home"
            resultScreenName="SearchResults"
            onSearch={handleSearch}
          />
        </View>

        {/* 排序控件 - 占据较小空间 */}
        <View style={[
          styles.sortControlContainer,
          // 横屏时调整排序控件宽度
          isLandscape && {
            flex: 0.1,
          }
        ]}>
          <SortControl
            onSortChange={handleSortChange}
            initialSortOption={sortOption}
            compact={true} // 添加紧凑模式属性，如果SortControl组件支持的话
          />
        </View>
      </View>

      {/* 可滚动内容区域 */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {notes && notes.length > 0 ? (
          <FlatList
            key={`flatlist-${isLandscape ? 'landscape' : 'portrait'}`} // 添加基于屏幕方向的key
            data={notes.filter(note => note && (note._id || note.id))} // 过滤掉无效的笔记
            renderItem={renderNoteItem}
            keyExtractor={item => {
              // 安全地提取ID
              if (!item) return `invalid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

              // 优先使用_id字段
              if (item._id !== undefined) {
                return typeof item._id === 'object' ? item._id.toString() : String(item._id);
              }

              // 其次使用id字段
              if (item.id !== undefined) {
                return typeof item.id === 'object' ? item.id.toString() : String(item.id);
              }

              // 如果都没有，生成一个临时ID
              return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            }}
            contentContainerStyle={styles.listContainer}
            numColumns={isLandscape ? 4 : 3} // 横屏时显示4列，竖屏时显示3列
            columnWrapperStyle={[
              styles.columnWrapper,
              { justifyContent: 'flex-start' } // 从左到右排列
            ]}
            getItemLayout={(_, index) => {
              // 根据屏幕方向计算每个项目的宽度
              const columnCount = isLandscape ? 4 : 3;
              // 统一计算方式，确保横竖屏边距一致
              const totalPadding = 32; // 左右两侧各16的内边距
              const totalGap = (columnCount - 1) * 10; // 项目之间的间距总和
              const itemWidth = (screenWidth - totalPadding - totalGap) / columnCount;
              return {
                length: itemWidth,
                offset: itemWidth * Math.floor(index / columnCount),
                index,
              };
            }}
            scrollEnabled={false} // 禁用FlatList的滚动，由外层ScrollView处理
          />
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {/* 悬浮按钮 - 固定在右下角，横屏时调整位置 */}
      <View style={[
        styles.buttonContainer,
        // 横屏模式下的样式调整
        isLandscape && {
          right: 32,
          bottom: 32,
        }
      ]}>
        <TouchableOpacity
          style={[
            styles.addButton,
            { backgroundColor: colors.primary },
            // 横屏模式下的样式调整
            isLandscape && {
              width: 60,
              height: 60,
              borderRadius: 30,
            }
          ]}
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
          onCreateNote={createNote}
          onCreateLinedNote={() => Alert.alert('提示', '普通笔记功能已移除，请使用Markdown导入')}
          onImportMarkdown={importMarkdown}
          onImportPDF={importPDF}
          onImportWord={importWord}
          onImportPPT={importPPT}
          onCreateCanvas={createCanvas}
          navigation={navigation}
        />

        {/* 画布样式选择弹窗 */}
        <CanvasStyleModal
          visible={showCanvasStyleModal}
          onClose={() => setShowCanvasStyleModal(false)}
          onSelect={handleCanvasStyleSelect}
        />

        {/* 笔记样式选择弹窗 */}
        <NoteStyleModal
          visible={showNoteStyleModal}
          onClose={() => setShowNoteStyleModal(false)}
          onSelect={handleNoteStyleSelect}
        />
      </View>

      {/* 重命名对话框 - 仅在 Android 上使用 */}
      <RenameDialog
        visible={renameDialogVisible}
        onClose={() => setRenameDialogVisible(false)}
        onSubmit={(newTitle) => {
          if (noteToRename && newTitle && newTitle.trim()) {
            // 立即关闭对话框，然后更新标题
            setRenameDialogVisible(false);
            // 使用requestAnimationFrame确保对话框关闭动画开始后再执行更新
            requestAnimationFrame(() => {
              updateNoteTitle(noteToRename, newTitle.trim());
            });
          } else {
            // 如果输入无效，也关闭对话框
            setRenameDialogVisible(false);
          }
        }}
        title="重命名笔记"
        message="请输入新的名称"
        initialValue={noteToRename?.title || ''}
      />
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  // 滚动容器样式
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  // 滚动内容容器样式
  scrollContentContainer: {
    flexGrow: 1, // 允许内容拉伸以填充可用空间
    paddingBottom: 100, // 底部添加额外的内边距，确保内容不被底部按钮遮挡
  },
  // 搜索栏和排序控件的容器
  searchSortContainer: {
    flexDirection: 'row', // 水平排列
    alignItems: 'center', // 垂直居中
    justifyContent: 'space-between', // 两端对齐
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.95)', // 与头部相同的背景色
    zIndex: 9, // 确保在滚动内容之上，但在头部之下
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  // 搜索栏容器
  searchBarContainer: {
    flex: 0.85, // 占85%的空间
    marginRight: 10, // 右侧添加间距
  },
  // 排序控件容器
  sortControlContainer: {
    flex: 0.15, // 占据15%的空间
    alignItems: 'flex-end', // 右对齐
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
    backgroundColor: 'rgba(255,255,255,0.95)', // 添加背景色，确保内容滚动时头部不透明
    zIndex: 10, // 确保头部在其他内容之上
  },
  headerTitle: {
    flex: 1,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  listContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16 // 统一左右边距
  },
  columnWrapper: {
    justifyContent: 'flex-start', // 从左到右排列
    paddingHorizontal: 0, // 移除额外的水平内边距，由listContainer控制
    gap: 10, // 添加间距
  },
  noteItem: {
    padding: 8, // 减小内边距
    borderRadius: 10, // 减小圆角
    marginBottom: 12, // 减小底部边距
    elevation: 2, // 减小阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    // 宽度将在renderNoteItem中动态设置
    margin: 0, // 移除外边距，由FlatList的columnWrapper控制间距
    // 移除marginRight，使用columnWrapper的gap属性控制间���
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  noteTitle: {
    fontSize: 12, // 减小字体大小
    fontWeight: '600',
    marginTop: 4, // 减小边距
    marginBottom: 2, // 减小边距
    lineHeight: 16, // 减小行高
  },
  noteContent: {
    fontSize: 11, // 减小字体大小
    marginBottom: 4, // 减小边距
    lineHeight: 14, // 减小行高
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between', // 两端对齐
    alignItems: 'center',
    marginTop: 4, // 增加边距
    paddingTop: 4, // 增加上内边距
    paddingBottom: 2, // 增加下内边距
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.05)', // 边框颜色
  },
  noteDate: {
    fontSize: 9, // 字体大小
    fontWeight: '400',
    color: 'rgba(0,0,0,0.5)', // 设置颜色
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cloudIcon: {
    marginRight: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 3,
    borderRadius: 8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  coverTouchable: {
    width: '100%',
    flex: 1,
  },
  // 封面样式
  coverContainer: {
    height: undefined, // 高度将根据屏幕方向动态计算
    aspectRatio: 1.8, // 增加宽高比，使卡片更扁一些
    width: '100%', // 确保宽度占满父容器
    borderRadius: 6, // 减小圆角
    backgroundColor: '#FFF8E1', // 默认淡黄色背景
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6, // 减小底部边距
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    position: 'relative',
  },
  // 不同类型的背景颜色
  pdfBackground: {
    backgroundColor: '#FFEBEE', // 淡红色背景用于PDF
  },
  wordBackground: {
    backgroundColor: '#E3F2FD', // 淡蓝色背景用于Word
  },
  imageBackground: {
    backgroundColor: '#E8F5E9', // 淡绿色背景用于图片
  },
  markdownBackground: {
    backgroundColor: '#ECEFF1', // 灰蓝色背景用于Markdown/TXT
  },
  pptBackground: {
    backgroundColor: '#FBE9E7', // 淡橙色背景用于PPT
  },
  canvasBackground: {
    backgroundColor: '#F3E5F5', // 淡紫色背景用于画布
  },
  textBackground: {
    backgroundColor: '#cee7faff', // 淡蓝色背景用于文本
    //backgroundColor: '#FFF8E1', // 淡黄色背景用于文本
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
    top: 4, // 减小边距
    right: 4, // 减小边距
    width: 20, // 减小尺寸
    height: 20, // 减小尺寸
    borderRadius: 10, // 减小圆角
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1, // 减小阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1, // 减小阴影
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