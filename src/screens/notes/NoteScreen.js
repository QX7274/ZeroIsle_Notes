import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchNotes,
  fetchCategories,
  createNote,
  updateNote,
  deleteNote,
  syncOfflineNotes,
  importNote
} from '../../redux/slices/notesSlice';
import { fetchTags } from '../../redux/slices/tagsSlice';
import DocumentPicker from 'react-native-document-picker';
import ImagePicker from 'react-native-image-picker';
import {
  NoteList,
  NoteEditor,
  NoteDetail,
  NoteToolbar,
  OfflineAIToolbar,
  HandwritingRecognizer
} from '../../components/notes';
import { Button } from '../../components/common';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { offlineStorageService } from '../../services/offline/offlineStorage';

const NoteScreen = ({ navigation, route }) => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme, colors;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('NoteScreen: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          background: '#FFFFFF',
          primary: '#007AFF',
          error: '#FF3B30',
          text: '#000000',
          card: '#FFFFFF',
        }
      };
    }
    colors = theme.colors;
  } catch (error) {
    console.error('NoteScreen: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        background: '#FFFFFF',
        primary: '#007AFF',
        error: '#FF3B30',
        text: '#000000',
        card: '#FFFFFF',
      }
    };
    colors = theme.colors;
  }
  const dispatch = useDispatch();

  // 从Redux获取状态
  const notes = useSelector(state => state.notes.notes);
  const categories = useSelector(state => state.notes.categories);
  const tags = useSelector(state => state.notes.tags);
  const currentNote = useSelector(state => state.notes.currentNote);
  const isLoading = useSelector(state => state.notes.isLoading);
  const error = useSelector(state => state.notes.error);

  // 本地状态
  const [view, setView] = useState('list'); // list, detail, edit
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [layout, setLayout] = useState('list'); // list, grid
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [activeTool, setActiveTool] = useState('pen');
  const [activeColor, setActiveColor] = useState('#000000');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [showHandwritingRecognizer, setShowHandwritingRecognizer] = useState(false);

  // 初始化
  useEffect(() => {
    loadData();

    // 如果有路由参数，处理它们
    if (route.params) {
      if (route.params.noteId) {
        handleViewNote({ id: route.params.noteId });
      }
    }

    // 监听网络状态
    const unsubscribe = offlineStorageService.addListener(event => {
      if (event.type === 'connectionChange' || event.type === 'offlineModeChange') {
        setIsOffline(!offlineStorageService.getStatus().isOnline);
      }
    });

    // 获取当前网络状态
    setIsOffline(!offlineStorageService.getStatus().isOnline);

    return () => unsubscribe();
  }, [dispatch, route.params]);

  // 加载数据
  const loadData = async () => {
    try {
      // 获取笔记列表
      dispatch(fetchNotes());

      // 获取分类和标签
      dispatch(fetchCategories());
      dispatch(fetchTags());
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 查看笔记详情
  const handleViewNote = (note) => {
    setSelectedNote(note);
    setView('detail');

    // 更新导航标题
    navigation.setOptions({
      title: note.title || '笔记详情',
    });
  };

  // 编辑笔记
  const handleEditNote = (note) => {
    setSelectedNote(note);
    setView('edit');

    // 更新导航标题
    navigation.setOptions({
      title: note ? '编辑笔记' : '新建笔记',
    });
  };

  // 创建新笔记
  const handleCreateNote = () => {
    Alert.alert(
      '新建笔记',
      '选择笔记类型',
      [
        {
          text: '空白笔记',
          onPress: () => {
            setSelectedNote({
              title: '',
              content: '',
              type: 'note',
              template: 'blank'
            });
            setView('edit');
            navigation.setOptions({ title: '新建笔记' });
          },
        },
        {
          text: '横格笔记',
          onPress: () => {
            setSelectedNote({
              title: '',
              content: '',
              type: 'note',
              template: 'lined'
            });
            setView('edit');
            navigation.setOptions({ title: '新建横格笔记' });
          },
        },
        {
          text: '方格笔记',
          onPress: () => {
            setSelectedNote({
              title: '',
              content: '',
              type: 'note',
              template: 'grid'
            });
            setView('edit');
            navigation.setOptions({ title: '新建方格笔记' });
          },
        },
        {
          text: '清单笔记',
          onPress: () => {
            setSelectedNote({
              title: '',
              content: '- [ ] 待办事项1\n- [ ] 待办事项2\n- [ ] 待办事项3',
              type: 'note',
              template: 'checklist'
            });
            setView('edit');
            navigation.setOptions({ title: '新建清单笔记' });
          },
        },
        {
          text: '日记模板',
          onPress: () => {
            const today = new Date().toLocaleDateString('zh-CN');
            setSelectedNote({
              title: `日记 - ${today}`,
              content: `# ${today} 日记\n\n## 今日心情\n\n## 今日总结\n\n## 明日计划`,
              type: 'note',
              template: 'diary'
            });
            setView('edit');
            navigation.setOptions({ title: '新建日记' });
          },
        },
        {
          text: '无限画布',
          onPress: () => handleCreateCanvas(),
        },
        {
          text: '导入文件',
          onPress: () => handleImportNote(),
        },
        {
          text: '取消',
          style: 'cancel',
        },
      ]
    );
  };

  // 保存笔记
  const handleSaveNote = async (note) => {
    try {
      console.log('开始保存笔记:', note.title);

      if (note.id) {
        // 更新笔记
        console.log('更新现有笔记:', note.id);
        try {
          const result = await dispatch(updateNote({
            id: note.id,
            noteData: note,
          })).unwrap();

          console.log('笔记更新成功:', result);

          // 更新成功后返回详情页
          handleViewNote(note);

          // 显示成功提示
          ToastAndroid.show('笔记已保存', ToastAndroid.SHORT);
        } catch (updateError) {
          console.error('更新笔记失败:', updateError);

          // 即使更新失败，也尝试返回详情页，避免用户卡在编辑页面
          handleViewNote(note);

          // 显示错误提示
          Alert.alert('保存提示', '笔记已本地保存，但同步到服务器失败，将在网络恢复后自动同步');
        }
      } else {
        // 创建新笔记
        console.log('创建新笔记');

        // 设置超时，确保不会一直等待
        let timeoutId = null;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('创建笔记超时，但笔记可能已保存'));
          }, 10000); // 10秒超时
        });

        try {
          // 创建一个可以被取消的Promise
          const createPromise = dispatch(createNote(note));

          // 使用Promise.race确保不会一直等待
          const actionResult = await Promise.race([createPromise, timeoutPromise]);
          console.log('创建笔记action结果:', actionResult);

          // 清除超时
          if (timeoutId) clearTimeout(timeoutId);

          // 检查是否有错误
          if (actionResult.error) {
            console.error('创建笔记返回错误:', actionResult.error);

            // 尝试从错误中提取有用信息
            if (actionResult.payload && actionResult.payload.data) {
              const emergencyNote = actionResult.payload.data;
              console.log('从错误中提取紧急笔记数据:', emergencyNote);

              // 显示警告提示
              ToastAndroid.show('笔记已创建，但可能存在问题', ToastAndroid.LONG);

              // 使用紧急笔记数据
              handleViewNote(emergencyNote);
              return;
            }

            throw new Error(actionResult.error.message || '创建笔记失败');
          }

          // 解包结果
          const result = actionResult.payload;
          console.log('创建笔记成功，结果:', result);

          // 创建成功后返回详情页
          if (result) {
            // 提取笔记数据，处理不同的响应格式
            let noteData = null;

            if (result.data) {
              noteData = result.data;
            } else if (typeof result === 'object') {
              noteData = result;
            }

            if (noteData && noteData.id) {
              console.log('使用返回的笔记数据:', noteData);
              handleViewNote(noteData);

              // 显示成功提示
              ToastAndroid.show('笔记已保存', ToastAndroid.SHORT);

              // 如果是离线创建的笔记，显示额外提示
              if (result.isOffline || noteData.isOffline) {
                ToastAndroid.show('笔记已离线保存，将在网络恢复后同步', ToastAndroid.LONG);
              }

              return;
            }
          }

          // 如果没有有效的笔记数据，但操作成功
          console.warn('创建笔记成功但返回结果无效');

          // 返回列表页
          handleBackToList();

          // 显示通用成功提示
          ToastAndroid.show('笔记已保存', ToastAndroid.SHORT);
        } catch (error) {
          // 清除超时
          if (timeoutId) clearTimeout(timeoutId);

          console.error('创建笔记过程中出错:', error);

          // 如果是超时错误，显示特殊提示
          if (error.message && error.message.includes('超时')) {
            ToastAndroid.show('创建笔记超时，请检查笔记列表', ToastAndroid.LONG);
            handleBackToList();
            return;
          }

          console.error('创建笔记失败:', error);

          // 显示错误，但不阻止用户继续操作
          Alert.alert(
            '保存提示',
            '笔记创建过程中遇到问题，但已尝试本地保存。请检查笔记列表。',
            [
              {
                text: '确定',
                onPress: () => handleBackToList() // 返回列表页
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('保存笔记过程中发生错误:', error);

      // 显示错误提示
      Alert.alert('错误', error.message || '保存笔记失败，请重试');

      // 即使出错，也尝试返回列表页，避免用户卡在编辑页面
      handleBackToList();
    }
  };

  // 删除笔记
  const handleDeleteNote = (note) => {
    Alert.alert(
      '确认删除',
      `确定要删除笔记"${note.title}"吗？此操作不可恢复。`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteNote(note.id)).unwrap();

              // 删除成功后返回列表页
              handleBackToList();

              // 显示成功提示
              Alert.alert('提示', '笔记已删除');
            } catch (error) {
              Alert.alert('错误', error.message || '删除笔记失败');
            }
          },
        },
      ]
    );
  };

  // 返回列表页
  const handleBackToList = () => {
    setView('list');
    setSelectedNote(null);

    // 更新导航标题
    navigation.setOptions({
      title: '笔记',
    });
  };

  // 切换布局
  const toggleLayout = () => {
    setLayout(layout === 'list' ? 'grid' : 'list');
  };

  // 导入笔记
  const handleImportNote = () => {
    Alert.alert(
      '导入文件',
      '选择要导入的文件类型',
      [
        {
          text: 'PDF文档',
          onPress: () => importPDF(),
        },
        {
          text: 'Word文档',
          onPress: () => importWord(),
        },
        {
          text: '图片',
          onPress: () => importImage(),
        },
        {
          text: '取消',
          style: 'cancel',
        },
      ]
    );
  };

  // 导入PDF
  const importPDF = async () => {
    try {
      // 使用文档选择器选择PDF文件
      const results = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        console.log('选择的PDF文件:', file);

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
          size: file.size || 0,
          path: file.path || file.uri,
        };

        console.log('准备添加到FormData的文件对象:', fileObj);
        formData.append('file', fileObj);
        formData.append('type', 'pdf');

        console.log('准备导入PDF，FormData:', formData);

        // 调用导入API
        const result = await dispatch(importNote(formData)).unwrap();
        console.log('PDF导入结果:', result);

        // 导入成功后查看笔记
        if (result) {
          handleViewNote(result);
          ToastAndroid.show('PDF导入成功', ToastAndroid.SHORT);
        }
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入PDF错误:', err);
        Alert.alert('导入失败', err.message || '请稍后重试');
      }
    }
  };

  // 导入Word
  const importWord = async () => {
    try {
      // 使用文档选择器选择Word文件
      const results = await DocumentPicker.pick({
        type: [DocumentPicker.types.docx, DocumentPicker.types.doc],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        console.log('选择的Word文件:', file);

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
          size: file.size || 0,
          path: file.path || file.uri,
        };

        console.log('准备添加到FormData的文件对象:', fileObj);
        formData.append('file', fileObj);
        formData.append('type', 'word');

        console.log('准备导入Word，FormData:', formData);

        // 调用导入API
        const result = await dispatch(importNote(formData)).unwrap();
        console.log('Word导入结果:', result);

        // 导入成功后查看笔记
        if (result) {
          handleViewNote(result);
          ToastAndroid.show('Word文档导入成功', ToastAndroid.SHORT);
        }
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入Word错误:', err);
        Alert.alert('导入失败', err.message || '请稍后重试');
      }
    }
  };

  // 导入图片
  const importImage = async () => {
    try {
      // 使用图片选择器选择图片
      const res = await ImagePicker.launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
      });

      if (res.didCancel) return;

      // 创建FormData对象
      const formData = new FormData();
      formData.append('file', {
        uri: res.assets[0].uri,
        type: res.assets[0].type,
        name: res.assets[0].fileName,
        size: res.assets[0].fileSize || 0,
        path: res.assets[0].uri,
      });
      formData.append('type', 'image');

      // 调用导入API
      const result = await dispatch(importNote(formData)).unwrap();

      // 导入成功后查看笔记
      if (result) {
        handleViewNote(result);
        ToastAndroid.show('图片导入成功', ToastAndroid.SHORT);
      }
    } catch (err) {
      console.error('导入图片错误:', err);
      Alert.alert('导入失败', err.message || '请稍后重试');
    }
  };

  // 创建无限画布
  const handleCreateCanvas = () => {
    try {
      console.log('开始创建无限画布...');

      // 直接导航到InfiniteCanvas屏幕，而不是创建笔记
      // 这样可以避免数据库操作和笔记保存过程中的问题
      navigation.navigate('InfiniteCanvas');

      // 记录分析事件
      analyticsService.trackEvent('create_infinite_canvas');
    } catch (error) {
      console.error('创建无限画布失败:', error);

      // 显示错误提示，但不阻止用户继续操作
      ToastAndroid.show('创建画布失败，请重试', ToastAndroid.SHORT);
    }
  };

  // 处理工具变化
  const handleToolChange = (tool, options) => {
    setActiveTool(tool);

    if (options) {
      if (options.color) {
        setActiveColor(options.color);
      }

      if (options.strokeWidth) {
        setActiveStrokeWidth(options.strokeWidth);
      }
    }
  };

  // 处理颜色变化
  const handleColorChange = (color) => {
    setActiveColor(color);
  };

  // 处理笔粗细变化
  const handleStrokeWidthChange = (width) => {
    setActiveStrokeWidth(width);
  };

  // 处理文本选择
  const handleTextSelection = (text) => {
    setSelectedText(text);
  };

  // 处理手写识别
  const handleShowHandwritingRecognizer = () => {
    setShowHandwritingRecognizer(true);
  };

  // 处理手写识别结果
  const handleHandwritingRecognized = (text) => {
    if (selectedNote && view === 'edit') {
      // 将识别的文本插入到笔记中
      const updatedNote = {
        ...selectedNote,
        content: selectedNote.content + '\n\n' + text
      };
      setSelectedNote(updatedNote);
      ToastAndroid.show('手写文本已插入', ToastAndroid.SHORT);
    }

    // 关闭手写识别器
    setShowHandwritingRecognizer(false);
  };

  // 处理AI处理结果
  const handleAIProcessResult = (result, toolId) => {
    // 根据工具类型处理结果
    switch (toolId) {
      case 'translate':
        // 显示翻译结果
        Alert.alert('翻译结果', result, [
          { text: '取消', style: 'cancel' },
          {
            text: '替换原文',
            onPress: () => {
              if (selectedNote && view === 'edit' && selectedText) {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content.replace(selectedText, result)
                };
                setSelectedNote(updatedNote);
              }
            }
          }
        ]);
        break;

      case 'code_recognition':
        // 将识别的代码插入到笔记中
        if (selectedNote && view === 'edit') {
          const updatedNote = {
            ...selectedNote,
            content: selectedNote.content + '\n\n```\n' + result + '\n```'
          };
          setSelectedNote(updatedNote);
          ToastAndroid.show('代码已插入', ToastAndroid.SHORT);
        }
        break;

      case 'summarize':
        // 显示摘要结果
        Alert.alert('摘要', result, [
          { text: '关闭', style: 'cancel' },
          {
            text: '插入笔记',
            onPress: () => {
              if (selectedNote && view === 'edit') {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content + '\n\n### 摘要\n' + result
                };
                setSelectedNote(updatedNote);
              }
            }
          }
        ]);
        break;

      case 'extract_keywords':
        // 显示关键词结果
        Alert.alert('关键词', result, [
          { text: '关闭', style: 'cancel' },
          {
            text: '添加为标签',
            onPress: () => {
              if (selectedNote && view === 'edit') {
                // 将关键词添加为标签
                const keywords = result.split(/[,，、\s]+/).filter(k => k.trim());
                const updatedNote = {
                  ...selectedNote,
                  tags: [...(selectedNote.tags || []), ...keywords]
                };
                setSelectedNote(updatedNote);
                ToastAndroid.show('已添加为标签', ToastAndroid.SHORT);
              }
            }
          }
        ]);
        break;

      case 'explain':
        // 显示解释结果
        Alert.alert('解释', result, [
          { text: '关闭', style: 'cancel' },
          {
            text: '插入笔记',
            onPress: () => {
              if (selectedNote && view === 'edit') {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content + '\n\n### 解释\n' + result
                };
                setSelectedNote(updatedNote);
              }
            }
          }
        ]);
        break;

      case 'rewrite':
        // 显示改写结果并提供替换选项
        Alert.alert('改写结果', result, [
          { text: '取消', style: 'cancel' },
          {
            text: '替换原文',
            onPress: () => {
              if (selectedNote && view === 'edit' && selectedText) {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content.replace(selectedText, result)
                };
                setSelectedNote(updatedNote);
              }
            }
          }
        ]);
        break;

      case 'grammar':
        // 显示语法检查结果
        Alert.alert('语法检查', result, [
          { text: '取消', style: 'cancel' },
          {
            text: '应用修改',
            onPress: () => {
              if (selectedNote && view === 'edit' && selectedText) {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content.replace(selectedText, result)
                };
                setSelectedNote(updatedNote);
              }
            }
          }
        ]);
        break;

      case 'simplify':
        // 显示简化结果
        Alert.alert('简化结果', result, [
          { text: '取消', style: 'cancel' },
          {
            text: '替换原文',
            onPress: () => {
              if (selectedNote && view === 'edit' && selectedText) {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content.replace(selectedText, result)
                };
                setSelectedNote(updatedNote);
              }
            }
          }
        ]);
        break;

      case 'math_formula':
        // 显示数学公式识别结果
        Alert.alert('数学公式识别结果', result, [
          { text: '取消', style: 'cancel' },
          {
            text: '插入LaTeX',
            onPress: () => {
              if (selectedNote && view === 'edit') {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content + '\n\n$$\n' + result + '\n$$'
                };
                setSelectedNote(updatedNote);
                ToastAndroid.show('LaTeX公式已插入', ToastAndroid.SHORT);
              }
            }
          }
        ]);
        break;

      default:
        // 处理其他工具的结果
        Alert.alert('AI处理结果', result, [
          { text: '关闭', style: 'cancel' },
          {
            text: '插入笔记',
            onPress: () => {
              if (selectedNote && view === 'edit') {
                const updatedNote = {
                  ...selectedNote,
                  content: selectedNote.content + '\n\n' + result
                };
                setSelectedNote(updatedNote);
              }
            }
          }
        ]);
    }
  };

  // 渲染加载状态
  if (isLoading && (!notes || notes.length === 0)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 渲染错误状态
  if (error && (!notes || notes.length === 0)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color={colors.error} />
          <Text
            variant="body"
            size="large"
            color="error"
            center
            style={styles.errorText}
          >
            {error}
          </Text>
          <Button
            title="重试"
            onPress={loadData}
            type="outline"
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  // 渲染笔记列表
  if (view === 'list') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <NoteList
          notes={notes}
          onNotePress={handleViewNote}
          onEditPress={handleEditNote}
          onDeletePress={handleDeleteNote}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          loading={isLoading}
          layout={layout}
          emptyText="暂无笔记，点击右下角按钮创建"
        />

        {/* 浮动按钮 */}
        <View style={styles.fabContainer}>
          <Button
            title=""
            onPress={toggleLayout}
            style={[styles.layoutButton, { backgroundColor: colors.card }]}
            textStyle={{ color: colors.text }}
            size="small"
          >
            <Icon
              name={layout === 'list' ? 'grid-view' : 'view-list'}
              size={24}
              color={colors.text}
            />
          </Button>

          {/* 创建笔记按钮 */}
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreateOptions(!showCreateOptions)}
          >
            <View style={styles.addButtonInner}>
              <Icon name="add" size={28} color={colors.card} />
            </View>
          </TouchableOpacity>

          {/* 创建选项菜单 */}
          {showCreateOptions && (
            <View style={[styles.createOptionsContainer, { backgroundColor: colors.card }]}>
              <TouchableOpacity
                style={styles.createOption}
                onPress={() => {
                  setShowCreateOptions(false);
                  handleCreateNote();
                }}
              >
                <Icon name="note-add" size={22} color={colors.primary} />
                <Text
                  variant="body"
                  size="medium"
                  style={styles.createOptionText}
                >
                  新建笔记
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createOption}
                onPress={() => {
                  setShowCreateOptions(false);
                  handleImportNote();
                }}
              >
                <Icon name="upload-file" size={22} color={colors.primary} />
                <Text
                  variant="body"
                  size="medium"
                  style={styles.createOptionText}
                >
                  导入文件
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createOption}
                onPress={() => {
                  setShowCreateOptions(false);
                  handleCreateCanvas();
                }}
              >
                <Icon name="dashboard-customize" size={22} color={colors.primary} />
                <Text
                  variant="body"
                  size="medium"
                  style={styles.createOptionText}
                >
                  无限画布
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // 渲染笔记详情
  if (view === 'detail') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* AI工具栏 */}
        <NoteToolbar
          isEditMode={false}
          selectedText={selectedText}
          onAIProcessResult={handleAIProcessResult}
        />

        <NoteDetail
          note={selectedNote}
          onEdit={() => handleEditNote(selectedNote)}
          onDelete={() => handleDeleteNote(selectedNote)}
          onBack={handleBackToList}
          relatedNotes={[]} // 相关笔记，可以从API获取
          onRelatedNotePress={handleViewNote}
          onTextSelection={handleTextSelection}
        />
      </View>
    );
  }

  // 渲染笔记编辑器
  if (view === 'edit') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.editorHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToList}
          >
            <Icon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text
            variant="heading"
            level="h6"
            style={styles.editorTitle}
          >
            {selectedNote?.title || '新建笔记'}
          </Text>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={() => handleSaveNote(selectedNote)}
          >
            <Icon name="save" size={20} color="#fff" />
            <Text variant="body" size="small" color="white" style={styles.saveButtonText}>
              保存
            </Text>
          </TouchableOpacity>
        </View>

        {/* 工具栏 */}
        <View style={styles.toolbarsContainer}>
          <NoteToolbar
            onToolChange={handleToolChange}
            onColorChange={handleColorChange}
            onStrokeWidthChange={handleStrokeWidthChange}
            onAIProcessResult={handleAIProcessResult}
            selectedText={selectedText}
            isEditMode={true}
          />

          {/* 离线AI工具栏 */}
          <OfflineAIToolbar
            onRecognizeHandwriting={handleShowHandwritingRecognizer}
          />
        </View>

        <View style={styles.editorContent}>
          <NoteEditor
            note={selectedNote}
            onSave={handleSaveNote}
            onCancel={handleBackToList}
            categories={categories}
            tags={tags}
            loading={isLoading}
            activeTool={activeTool}
            activeColor={activeColor}
            activeStrokeWidth={activeStrokeWidth}
            onTextSelection={handleTextSelection}
          />
        </View>

        {/* 手写识别器 */}
        <HandwritingRecognizer
          visible={showHandwritingRecognizer}
          onClose={() => setShowHandwritingRecognizer(false)}
          onRecognized={handleHandwritingRecognized}
        />
      </View>
    );
  }

  // 默认渲染
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    minWidth: 120,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  layoutButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  createOptionsContainer: {
    position: 'absolute',
    bottom: 76,
    right: 0,
    width: 180,
    borderRadius: 16,
    padding: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginVertical: 2,
  },
  createOptionText: {
    marginLeft: 12,
    fontWeight: '500',
  },
  // 编辑器样式
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  editorTitle: {
    flex: 1,
    marginLeft: 16,
    fontSize: 18,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  saveButtonText: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  toolbarsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  editorContent: {
    flex: 1,
  },
});

// 确保正确导出 NoteScreen 组件
export default NoteScreen;