import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchNotes,
  fetchCategories,
  fetchTags,
  createNote,
  updateNote,
  deleteNote,
  syncOfflineNotes,
  importNote
} from '../store/slices/notesSlice';
import DocumentPicker from 'react-native-document-picker';
import ImagePicker from 'react-native-image-picker';
import { NoteList, NoteEditor, NoteDetail } from '../components/notes';
import { Button } from '../components/common';
import { Text } from '../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { offlineStorageService } from '../services/offlineStorage';
import NoteToolbar from '../components/note/NoteToolbar';

const NoteScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
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
      if (note.id) {
        // 更新笔记
        await dispatch(updateNote({
          id: note.id,
          noteData: note,
        })).unwrap();

        // 更新成功后返回详情页
        handleViewNote(note);
      } else {
        // 创建笔记
        const result = await dispatch(createNote(note)).unwrap();

        // 创建成功后返回详情页
        if (result) {
          handleViewNote(result);

          // 如果是离线创建的笔记，显示提示
          if (result.isOffline) {
            ToastAndroid.show('笔记已离线保存，将在网络恢复后同步', ToastAndroid.LONG);
          }
        } else {
          // 返回列表页
          handleBackToList();
        }
      }
    } catch (error) {
      Alert.alert('错误', error.message || '保存笔记失败');
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
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
      });

      // 创建FormData对象
      const formData = new FormData();
      formData.append('file', {
        uri: res[0].uri,
        type: res[0].type,
        name: res[0].name,
      });
      formData.append('type', 'pdf');

      // 调用导入API
      const result = await dispatch(importNote(formData)).unwrap();

      // 导入成功后查看笔记
      if (result) {
        handleViewNote(result);
        ToastAndroid.show('PDF导入成功', ToastAndroid.SHORT);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('导入PDF错误:', err);
        Alert.alert('导入失败', err.message || '请稍后重试');
      }
    }
  };

  // 导入Word
  const importWord = async () => {
    try {
      // 使用文档选择器选择Word文件
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.docx, DocumentPicker.types.doc],
      });

      // 创建FormData对象
      const formData = new FormData();
      formData.append('file', {
        uri: res[0].uri,
        type: res[0].type,
        name: res[0].name,
      });
      formData.append('type', 'word');

      // 调用导入API
      const result = await dispatch(importNote(formData)).unwrap();

      // 导入成功后查看笔记
      if (result) {
        handleViewNote(result);
        ToastAndroid.show('Word文档导入成功', ToastAndroid.SHORT);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
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
    // 创建新的无限画布笔记
    const canvasNote = {
      title: '无标题画布',
      content: '',
      type: 'canvas',
      metadata: {
        canvasType: 'infinite',
        elements: []
      }
    };

    // 保存画布笔记
    handleSaveNote(canvasNote);
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

  // 处理AI处理结果
  const handleAIProcessResult = (result, toolId) => {
    // 根据工具类型处理结果
    switch (toolId) {
      case 'translate':
        Alert.alert('翻译结果', result);
        break;
      case 'code_recognition':
        // 将识别的代码插入到笔记中
        if (selectedNote && view === 'edit') {
          const updatedNote = {
            ...selectedNote,
            content: selectedNote.content + '\n\n```\n' + result + '\n```'
          };
          setSelectedNote(updatedNote);
        }
        break;
      case 'summarize':
        Alert.alert('摘要', result);
        break;
      case 'extract_keywords':
        Alert.alert('关键词', result);
        break;
      case 'explain':
        Alert.alert('解释', result);
        break;
      case 'rewrite':
        // 将改写的文本插入到笔记中
        if (selectedNote && view === 'edit') {
          const updatedNote = {
            ...selectedNote,
            content: selectedNote.content.replace(selectedText, result)
          };
          setSelectedNote(updatedNote);
        }
        break;
      default:
        Alert.alert('AI处理结果', result);
    }
  };

  // 渲染加载状态
  if (isLoading && notes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 渲染错误状态
  if (error && notes.length === 0) {
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
        {/* 工具栏 */}
        <NoteToolbar
          onToolChange={handleToolChange}
          onColorChange={handleColorChange}
          onStrokeWidthChange={handleStrokeWidthChange}
          onAIProcessResult={handleAIProcessResult}
          selectedText={selectedText}
          isEditMode={true}
        />

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
    bottom: 16,
    right: 16,
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
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  addButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  createOptionsContainer: {
    position: 'absolute',
    bottom: 72,
    right: 0,
    width: 160,
    borderRadius: 12,
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createOptionText: {
    marginLeft: 12,
  },
});

export default NoteScreen;