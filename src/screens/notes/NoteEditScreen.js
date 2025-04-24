/**
 * 笔记编辑屏幕
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, Modal, FlatList } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { createNote, fetchNoteById, updateNote, autoSaveNote, getNoteHistory, getNoteVersion, restoreNoteVersion, saveOfflineNote, syncOfflineNotes } from '../../redux/slices/notesSlice';
import { Button, Loading, RichTextEditor, TagSelector, CategorySelector, Toast, NoteShareDialog } from '../../components/common';
import { colors } from '../../utils/constants/colors';
import { dimensions } from '../../utils/constants/dimensions';
import { TIMEOUTS, DEFAULT_SETTINGS } from '../../utils/constants/config';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as categoriesApi from '../../services/api/categoriesApi';
import * as tagsApi from '../../services/api/tagsApi';
import NetInfo from '@react-native-community/netinfo';

const NoteEditScreen = ({ route, navigation }) => {
  const { noteId, isNew } = route.params || {};
  const dispatch = useDispatch();
  const { currentNote, isLoading, error } = useSelector(state => state.notes);
  const { lastSaved, isLoading: isAutoSaving, error: autoSaveError } = useSelector(state => state.notes.autoSave);
  const { versions, isLoading: isLoadingHistory, currentVersion } = useSelector(state => state.notes.history);
  const { unsyncedCount } = useSelector(state => state.notes.offline);
  
  // 笔记状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(null);
  const [tags, setTags] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // 自动保存和历史版本状态
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(DEFAULT_SETTINGS.autoSave);
  const [isOffline, setIsOffline] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showVersionPreview, setShowVersionPreview] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // 分享功能状态
  const [showShareDialog, setShowShareDialog] = useState(false);
  
  // Toast显示计时器和自动保存计时器
  const toastTimerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  
  // 显示Toast消息
  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    
    // 清除现有计时器
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    
    // 设置新计时器，3秒后自动隐藏
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  };
  
  // 分类和标签数据
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // 加载笔记数据
  useEffect(() => {
    if (!isNew && noteId) {
      dispatch(fetchNoteById(noteId));
    }
    
    // 检查网络状态
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = isOffline;
      const isNowOnline = state.isConnected;
      setIsOffline(!isNowOnline);
      
      // 如果从离线状态恢复到在线状态，且有未同步的笔记，则自动触发同步
      if (wasOffline && isNowOnline && unsyncedCount > 0) {
        showToast('网络已恢复，正在同步笔记...');
        handleSyncOfflineNotes();
      }
    });
    
    return () => {
      unsubscribe();
      // 清除所有计时器
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [dispatch, isNew, noteId, isOffline, unsyncedCount]);
  
  // 加载笔记历史版本
  const loadNoteHistory = useCallback(() => {
    if (!isNew && noteId) {
      dispatch(getNoteHistory(noteId));
    }
  }, [dispatch, isNew, noteId]);
  
  // 查看历史版本
  const handleViewHistory = () => {
    loadNoteHistory();
    setShowHistory(true);
  };
  
  // 预览特定版本
  const handlePreviewVersion = (version) => {
    setSelectedVersion(version);
    dispatch(getNoteVersion({ id: noteId, versionId: version.id }));
    setShowVersionPreview(true);
  };
  
  // 恢复到特定版本
  const handleRestoreVersion = () => {
    if (selectedVersion) {
      Alert.alert(
        '恢复版本',
        `确定要恢复到 ${new Date(selectedVersion.created_at).toLocaleString()} 的版本吗？`,
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '恢复', 
            onPress: async () => {
              try {
                await dispatch(restoreNoteVersion({ id: noteId, versionId: selectedVersion.id })).unwrap();
                setShowVersionPreview(false);
                setShowHistory(false);
                showToast('笔记已恢复到历史版本');
              } catch (error) {
                Alert.alert('恢复失败', error.message || '请稍后重试');
              }
            } 
          }
        ]
      );
    }
  };
  
  // 自动保存函数
  const handleAutoSave = useCallback(() => {
    if (!autoSaveEnabled || isNew || !noteId || !hasChanges) return;
    
    // 清除现有计时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // 设置新计时器
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const noteData = {
          title,
          content,
          category_id: category ? category.id : null,
          tag_ids: tags.map(tag => tag.id)
        };
        
        if (isOffline) {
          // 离线模式：保存到本地
          await dispatch(saveOfflineNote({
            id: noteId,
            ...noteData,
            updated_at: new Date().toISOString()
          })).unwrap();
          
          showToast('笔记已离线保存');
        } else {
          // 在线模式：自动保存到服务器
          await dispatch(autoSaveNote({ id: noteId, noteData })).unwrap();
          
          showToast('笔记已自动保存');
        }
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, TIMEOUTS.AUTO_SAVE);
  }, [dispatch, noteId, title, content, category, tags, isNew, hasChanges, autoSaveEnabled, isOffline]);
  
  // 同步离线笔记
  const handleSyncOfflineNotes = async () => {
    if (isOffline) {
      Alert.alert('提示', '当前处于离线状态，无法同步');
      return;
    }
    
    try {
      showToast('正在同步离线笔记...');
      const result = await dispatch(syncOfflineNotes()).unwrap();
      if (result.synced > 0) {
        showToast(`已成功同步 ${result.synced} 条笔记`);
      } else {
        showToast('没有需要同步的笔记');
      }
    } catch (error) {
      console.error('同步失败:', error);
      Alert.alert('同步失败', error.message || '请稍后重试');
    }
  };
  
  // 监听表单变化，触发自动保存
  useEffect(() => {
    if (hasChanges && !isNew) {
      handleAutoSave();
    }
  }, [title, content, category, tags, hasChanges, handleAutoSave, isNew]);

  // 加载分类和标签数据
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categoriesData = await categoriesApi.getCategories();
        setAvailableCategories(categoriesData);
      } catch (error) {
        console.error('获取分类失败:', error);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    const fetchTags = async () => {
      setIsLoadingTags(true);
      try {
        const tagsData = await tagsApi.getTags();
        setAvailableTags(tagsData);
      } catch (error) {
        console.error('获取标签失败:', error);
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchCategories();
    fetchTags();
  }, []);

  // 当获取到笔记数据时，更新表单
  useEffect(() => {
    if (!isNew && currentNote) {
      setTitle(currentNote.title || '');
      setContent(currentNote.content || '');
      setCategory(currentNote.category || null);
      setTags(currentNote.tags || []);
      setHasChanges(false);
    }
  }, [currentNote, isNew]);

  // 监听表单变化
  useEffect(() => {
    if (isNew) {
      setHasChanges(title.trim() !== '' || content.trim() !== '' || category !== null || tags.length > 0);
    } else if (currentNote) {
      const currentTags = currentNote.tags || [];
      const tagsChanged = tags.length !== currentTags.length || 
        tags.some(tag => !currentTags.find(t => t.id === tag.id));
      
      setHasChanges(
        title !== (currentNote.title || '') ||
        content !== (currentNote.content || '') ||
        (category?.id !== (currentNote.category?.id || null)) ||
        tagsChanged
      );
    }
  }, [title, content, category, tags, currentNote, isNew]);

  // 创建新标签
  const handleCreateTag = async (tagName) => {
    try {
      const newTag = await tagsApi.createTag({ name: tagName });
      setAvailableTags([...availableTags, newTag]);
      return newTag;
    } catch (error) {
      Alert.alert('创建标签失败', error.message || '请稍后重试');
      throw error;
    }
  };

  // 创建新分类
  const handleCreateCategory = async (categoryName) => {
    try {
      const newCategory = await categoriesApi.createCategory({ name: categoryName });
      setAvailableCategories([...availableCategories, newCategory]);
      return newCategory;
    } catch (error) {
      Alert.alert('创建分类失败', error.message || '请稍后重试');
      throw error;
    }
  };

  // 保存笔记
  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入笔记标题');
      return;
    }

    setIsSaving(true);

    try {
      const noteData = {
        title,
        content,
        category_id: category ? category.id : null,
        tag_ids: tags.map(tag => tag.id)
      };

      if (isNew) {
        // 创建新笔记
        await dispatch(createNote(noteData)).unwrap();
        navigation.goBack();
      } else {
        // 更新笔记
        await dispatch(updateNote({ id: noteId, noteData })).unwrap();
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('保存失败', error.message || '请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 处理返回
  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        '提示',
        '您有未保存的更改，确定要离开吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '离开', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };
  
  // 切换自动保存
  const toggleAutoSave = () => {
    setAutoSaveEnabled(!autoSaveEnabled);
  };
  
  // 处理分享笔记
  const handleShareNote = () => {
    if (isNew) {
      Alert.alert('提示', '请先保存笔记后再分享');
      return;
    }
    setShowShareDialog(true);
  };
  
  // 关闭分享对话框
  const closeShareDialog = () => {
    setShowShareDialog(false);
  };
  
  // 关闭历史版本模态框
  const closeHistoryModal = () => {
    setShowHistory(false);
    setSelectedVersion(null);
  };
  
  // 关闭版本预览模态框
  const closeVersionPreview = () => {
    setShowVersionPreview(false);
  };
  
  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // 渲染历史版本项
  const renderVersionItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.versionItem} 
      onPress={() => handlePreviewVersion(item)}
    >
      <Text style={styles.versionDate}>{formatDate(item.created_at)}</Text>
      <Icon name="chevron-right" size={20} color={colors.textLight} />
    </TouchableOpacity>
  );

  if (isLoading && !isNew) {
    return <Loading type="fullscreen" text="加载中..." />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? '新建笔记' : '编辑笔记'}</Text>
        <View style={styles.headerActions}>
          {!isNew && (
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={handleViewHistory}
              disabled={isLoadingHistory}
            >
              <Icon name="history" size={22} color={colors.text} />
            </TouchableOpacity>
          )}
          {!isNew && (
            <TouchableOpacity 
              style={[styles.iconButton, autoSaveEnabled && styles.activeIconButton]} 
              onPress={toggleAutoSave}
            >
              <Icon name="save" size={22} color={autoSaveEnabled ? colors.primary : colors.text} />
            </TouchableOpacity>
          )}
          {!isNew && (
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={handleShareNote}
            >
              <Icon name="share" size={22} color={colors.text} />
            </TouchableOpacity>
          )}
          <Button 
            title="保存" 
            onPress={handleSave} 
            loading={isSaving}
            disabled={isSaving || !hasChanges}
            style={styles.saveButton}
            textStyle={styles.saveButtonText}
          />
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <ScrollView style={styles.content}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="笔记标题"
          placeholderTextColor={colors.textLight}
          maxLength={100}
        />
        
        {/* 分类选择器 */}
        <CategorySelector
          selectedCategory={category}
          onCategoryChange={setCategory}
          availableCategories={availableCategories}
          canCreate={true}
          onCreateCategory={handleCreateCategory}
          style={styles.categorySelector}
        />
        
        {/* 标签选择器 */}
        <TagSelector
          selectedTags={tags}
          onTagsChange={setTags}
          availableTags={availableTags}
          canCreate={true}
          onCreateTag={handleCreateTag}
          style={styles.tagSelector}
        />
        
        {/* 富文本编辑器 */}
        <RichTextEditor
          value={content}
          onChange={setContent}
          style={styles.richTextEditor}
          noteId={noteId}
        />
        
        {/* 手写识别和语音转文本功能按钮 */}
        <View style={styles.featureButtonsContainer}>
          <TouchableOpacity 
            style={styles.featureButton} 
            onPress={() => navigation.navigate('HandwritingRecognition', {
              noteId: noteId,
              onRecognized: (text) => {
                setContent(content + '\n' + text);
                setHasChanges(true);
                showToast('手写内容已添加到笔记');
              }
            })}
          >
            <Icon name="edit" size={20} color={colors.white} />
            <Text style={styles.featureButtonText}>手写识别</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.featureButton, styles.voiceButton]} 
            onPress={() => navigation.navigate('VoiceToText', {
              noteId: noteId,
              onTranscribed: (text) => {
                setContent(content + '\n' + text);
                setHasChanges(true);
                showToast('语音内容已添加到笔记');
              }
            })}
          >
            <Icon name="mic" size={20} color={colors.white} />
            <Text style={styles.featureButtonText}>语音转文本</Text>
          </TouchableOpacity>
        </View>
        
        {/* 离线同步状态 */}
        {unsyncedCount > 0 && !isOffline && (
          <TouchableOpacity 
            style={styles.syncButton} 
            onPress={handleSyncOfflineNotes}
          >
            <Icon name="sync" size={16} color={colors.white} />
            <Text style={styles.syncButtonText}>同步{unsyncedCount}条离线笔记</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      
      {/* 自动保存状态提示 */}
      {toastVisible && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
      
      {/* 历史版本模态框 */}
      <Modal
        visible={showHistory}
        transparent={true}
        animationType="slide"
        onRequestClose={closeHistoryModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>历史版本</Text>
              <TouchableOpacity onPress={closeHistoryModal}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {isLoadingHistory ? (
              <Loading type="content" text="加载历史版本中..." />
            ) : (
              <FlatList
                data={versions}
                renderItem={renderVersionItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.versionsList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>暂无历史版本</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
      
      {/* 版本预览模态框 */}
      <Modal
        visible={showVersionPreview}
        transparent={true}
        animationType="slide"
        onRequestClose={closeVersionPreview}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>版本预览</Text>
              <TouchableOpacity onPress={closeVersionPreview}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {isLoadingHistory ? (
              <Loading type="content" text="加载版本内容中..." />
            ) : currentVersion ? (
              <ScrollView style={styles.versionPreview}>
                <Text style={styles.versionDate}>
                  创建于: {formatDate(currentVersion.created_at)}
                </Text>
                <Text style={styles.versionTitle}>{currentVersion.title}</Text>
                <Text style={styles.versionContent}>{currentVersion.content}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>无法加载版本内容</Text>
            )}
            
            <View style={styles.modalFooter}>
              <Button
                title="恢复此版本"
                onPress={handleRestoreVersion}
                disabled={isLoadingHistory || !currentVersion}
                style={styles.restoreButton}
              />
            </View>
          </View>
        </View>
      </Modal>
      
      {/* 分享对话框 */}
      <NoteShareDialog
        visible={showShareDialog}
        onClose={closeShareDialog}
        noteId={noteId}
        noteTitle={title}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: dimensions.spacing.medium,
    paddingVertical: dimensions.spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  featureButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  featureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  voiceButton: {
    backgroundColor: colors.secondary,
    marginRight: 0,
    marginLeft: 8,
  },
  featureButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButton: {
    padding: dimensions.spacing.small,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: dimensions.spacing.small,
    marginRight: dimensions.spacing.small,
  },
  activeIconButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: dimensions.borderRadius.small,
  },
  saveButton: {
    paddingVertical: dimensions.spacing.small,
    paddingHorizontal: dimensions.spacing.medium,
    minWidth: 0,
  },
  saveButtonText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: dimensions.spacing.medium,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    padding: dimensions.spacing.small,
    marginBottom: dimensions.spacing.medium,
  },
  categorySelector: {
    marginBottom: dimensions.spacing.medium,
  },
  tagSelector: {
    marginBottom: dimensions.spacing.medium,
  },
  richTextEditor: {
    minHeight: 300,
    marginBottom: dimensions.spacing.large,
  },
  errorText: {
    color: colors.error,
    padding: dimensions.spacing.medium,
    textAlign: 'center',
  },
  // 离线同步按钮
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: dimensions.spacing.medium,
    borderRadius: dimensions.borderRadius.medium,
    marginVertical: dimensions.spacing.medium,
  },
  syncButtonText: {
    color: colors.white,
    marginLeft: dimensions.spacing.small,
    fontWeight: 'bold',
  },
  // 自动保存提示
  toastContainer: {
    position: 'absolute',
    bottom: dimensions.spacing.extraLarge,
    left: dimensions.spacing.large,
    right: dimensions.spacing.large,
    backgroundColor: colors.toastBackground,
    padding: dimensions.spacing.medium,
    borderRadius: dimensions.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  toastText: {
    color: colors.white,
    fontSize: 14,
  },
  // 历史版本模态框
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: dimensions.borderRadius.medium,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: dimensions.spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  versionsList: {
    padding: dimensions.spacing.medium,
  },
  versionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: dimensions.spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  versionDate: {
    fontSize: 14,
    color: colors.textLight,
  },
  emptyText: {
    textAlign: 'center',
    padding: dimensions.spacing.large,
    color: colors.textLight,
  },
  // 版本预览
  versionPreview: {
    padding: dimensions.spacing.medium,
    maxHeight: 400,
  },
  versionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: dimensions.spacing.medium,
  },
  versionContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalFooter: {
    padding: dimensions.spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  restoreButton: {
    width: '80%',
  },
});

export default NoteEditScreen;