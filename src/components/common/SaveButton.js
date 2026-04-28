/**
 * 统一的保存按钮组件
 * 用于所有文档查看器，确保保存功能的一致性
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import realmService from '../../services/database/realmService';

const SaveButton = ({
  onSave,
  disabled = false,
  loading = false,
  text = '保存',
  style = {},
  textStyle = {},
  showSuccessToast = true,
  showErrorAlert = true,
}) => {
  const { colors } = useTheme();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (disabled || loading || isSaving || !onSave) {return;}

    try {
      setIsSaving(true);

      // 执行保存操作
      await onSave();

      // 显示成功提示
      if (showSuccessToast) {
        Alert.alert('保存成功', '内容已保存到本地', [{ text: '确定' }]);
      }

    } catch (error) {
      console.error('SaveButton: 保存失败:', error);

      // 显示错误提示
      if (showErrorAlert) {
        Alert.alert(
          '保存失败',
          error.message || '保存时发生未知错误，请重试',
          [{ text: '确定' }]
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isDisabled = disabled || loading || isSaving;
  const isLoading = loading || isSaving;

  return (
    <TouchableOpacity
      style={[
        styles.saveButton,
        {
          backgroundColor: isDisabled ? colors.disabled : colors.primary,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
      onPress={handleSave}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color="#fff"
          style={styles.loadingIndicator}
        />
      ) : (
        <Text style={[styles.saveButtonText, textStyle]}>
          {text}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// 预定义的保存按钮变体
export const SaveButtonVariants = {
  // 标准保存按钮
  Standard: (props) => <SaveButton {...props} />,

  // 紧凑型保存按钮
  Compact: (props) => (
    <SaveButton
      {...props}
      style={[styles.compactButton, props.style]}
      textStyle={[styles.compactText, props.textStyle]}
    />
  ),

  // 大型保存按钮
  Large: (props) => (
    <SaveButton
      {...props}
      style={[styles.largeButton, props.style]}
      textStyle={[styles.largeText, props.textStyle]}
    />
  ),

  // 文本型保存按钮
  Text: (props) => (
    <SaveButton
      {...props}
      style={[styles.textButton, props.style]}
      textStyle={[styles.textButtonText, props.textStyle]}
    />
  ),
};

// 保存功能工具函数
export const SaveUtils = {
  async _getWritableRealm(service) {
    if (!service) {
      throw new Error('Realm 服务不可用');
    }

    if (service.realmOpenFailed || !service?.canUseRealmForWrites?.()) {
      const err = new Error('Realm 不可用，已跳过本次保存');
      err.code = 'REALM_UNAVAILABLE';
      throw err;
    }

    return await service.getRealm();
  },

  /**
   * Word文档保存
   */
  async saveWordDocument(documentId, content, realmService) {
    try {
      // 获取现有文档数据
      const realm = await SaveUtils._getWritableRealm(realmService);
      const existingNote = realm.objectForPrimaryKey('Note', documentId);

      // 创建完整的文档对象进行整体存储
      const documentData = {
        _id: documentId,
        id: documentId,
        title: existingNote?.title || 'Word文档',
        content: content,
        type: 'word',
        file_type: 'docx',
        file_name: existingNote?.file_name || 'document.docx',
        file_uri: existingNote?.file_uri || `word://${documentId}`,
        uri: existingNote?.uri || `word://${documentId}`,
        created_at: existingNote?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
        imported: existingNote?.imported || false,
        metadata: existingNote?.metadata || '{}',
        tags: existingNote?.tags || [],
      };

      // 使用整体存储
      const writeRealm = await SaveUtils._getWritableRealm(realmService);
      writeRealm.write(() => {
        writeRealm.create('Note', documentData);
      });
      console.log('SaveUtils: Word文档整体保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: Word文档保存失败:', error);
      throw new Error('Word文档保存失败：' + error.message);
    }
  },

  /**
   * PDF注释保存
   */
  async savePDFAnnotations(documentId, annotations, realmService) {
    try {
      // 获取现有PDF数据
      const realm = await SaveUtils._getWritableRealm(realmService);
      const existingNote = realm.objectForPrimaryKey('Note', documentId);

      // 创建完整的PDF对象进行整体存储
      const pdfData = {
        _id: documentId,
        id: documentId,
        title: existingNote?.title || 'PDF文档',
        content: existingNote?.content || '',
        type: 'pdf',
        file_type: 'pdf',
        file_name: existingNote?.file_name || 'document.pdf',
        file_uri: existingNote?.file_uri || `pdf://${documentId}`,
        uri: existingNote?.uri || `pdf://${documentId}`,
        annotations: JSON.stringify(annotations),
        created_at: existingNote?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
        imported: existingNote?.imported || false,
        metadata: existingNote?.metadata || '{}',
        tags: existingNote?.tags || [],
      };

      // 使用整体存储
      const writeRealm = await SaveUtils._getWritableRealm(realmService);
      writeRealm.write(() => {
        writeRealm.create('Note', pdfData);
      });
      console.log('SaveUtils: PDF注释整体保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: PDF注释保存失败:', error);
      throw new Error('PDF注释保存失败：' + error.message);
    }
  },

  /**
   * Markdown内容保存
   */
  async saveMarkdownContent(documentId, content, realmService) {
    try {
      // 获取现有Markdown数据
      const realm = await SaveUtils._getWritableRealm(realmService);
      const existingNote = realm.objectForPrimaryKey('Note', documentId);

      // 创建完整的Markdown对象进行整体存储
      const markdownData = {
        _id: documentId,
        id: documentId,
        title: existingNote?.title || 'Markdown文档',
        content: content,
        type: 'markdown',
        file_type: 'md',
        file_name: existingNote?.file_name || 'document.md',
        file_uri: existingNote?.file_uri || `markdown://${documentId}`,
        uri: existingNote?.uri || `markdown://${documentId}`,
        created_at: existingNote?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
        imported: existingNote?.imported || false,
        metadata: existingNote?.metadata || '{}',
        tags: existingNote?.tags || [],
      };

      // 使用整体存储
      const writeRealm = await SaveUtils._getWritableRealm(realmService);
      writeRealm.write(() => {
        writeRealm.create('Note', markdownData);
      });
      console.log('SaveUtils: Markdown内容整体保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: Markdown内容保存失败:', error);
      throw new Error('Markdown内容保存失败：' + error.message);
    }
  },

  /**
   * PPT注释保存
   */
  async savePPTAnnotations(documentId, annotations, realmService) {
    try {
      // 获取现有PPT数据
      const realm = await SaveUtils._getWritableRealm(realmService);
      const existingNote = realm.objectForPrimaryKey('Note', documentId);

      // 创建完整的PPT对象进行整体存储
      const pptData = {
        _id: documentId,
        id: documentId,
        title: existingNote?.title || 'PPT文档',
        content: existingNote?.content || '',
        type: 'powerpoint',
        file_type: 'pptx',
        file_name: existingNote?.file_name || 'document.pptx',
        file_uri: existingNote?.file_uri || `powerpoint://${documentId}`,
        uri: existingNote?.uri || `powerpoint://${documentId}`,
        annotations: JSON.stringify(annotations),
        created_at: existingNote?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
        imported: existingNote?.imported || false,
        metadata: existingNote?.metadata || '{}',
        tags: existingNote?.tags || [],
      };

      // 使用整体存储
      const writeRealm = await SaveUtils._getWritableRealm(realmService);
      writeRealm.write(() => {
        writeRealm.create('Note', pptData);
      });
      console.log('SaveUtils: PPT注释整体保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: PPT注释保存失败:', error);
      throw new Error('PPT注释保存失败：' + error.message);
    }
  },

  /**
   * 无限画布保存
   */
  async saveCanvasData(canvasId, canvasData, infiniteCanvasStorage, realmService) {
    try {
      let saveSuccess = false;

      // 优先保存到专门的画布存储
      try {
        await infiniteCanvasStorage.saveCanvas(canvasData);
        console.log('SaveUtils: 画布数据保存到infiniteCanvasStorage成功');
        saveSuccess = true;
      } catch (storageError) {
        console.warn('SaveUtils: infiniteCanvasStorage保存失败:', storageError);
      }

      // 备用保存到通用存储
      try {
        const realm = await SaveUtils._getWritableRealm(realmService);
        realm.write(() => {
          realm.create('InfiniteCanvas', canvasData);
        });
        console.log('SaveUtils: 画布数据保存到realmService成功');
        saveSuccess = true;
      } catch (realmError) {
        console.warn('SaveUtils: realmService保存失败:', realmError);
      }

      if (!saveSuccess) {
        throw new Error('所有保存方式都失败了');
      }

      return true;
    } catch (error) {
      console.error('SaveUtils: 画布数据保存失败:', error);
      throw new Error('画布数据保存失败：' + error.message);
    }
  },

  /**
   * 通用笔记保存
   */
  async saveNoteContent(noteId, content, type, realmService) {
    try {
      const noteData = {
        _id: noteId,
        id: noteId,
        content,
        type,
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
      };

      const realm = await SaveUtils._getWritableRealm(realmService);
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', noteId);
        if (note) {
          Object.assign(note, noteData);
        }
      });
      console.log('SaveUtils: 笔记内容保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: 笔记内容保存失败:', error);
      throw new Error('笔记内容保存失败：' + error.message);
    }
  },
};

const styles = StyleSheet.create({
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  loadingIndicator: {
    marginRight: 0,
  },
  // 紧凑型样式
  compactButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 24,
    borderRadius: 4,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // 大型样式
  largeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 36,
    borderRadius: 8,
  },
  largeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 文本型样式
  textButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 24,
  },
  textButtonText: {
    color: '#2f80ed',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default SaveButton;
