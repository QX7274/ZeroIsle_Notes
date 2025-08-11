/**
 * 统一的保存按钮组件
 * 用于所有文档查看器，确保保存功能的一致性
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const SaveButton = ({ 
  onSave, 
  disabled = false, 
  loading = false,
  text = '保存',
  style = {},
  textStyle = {},
  showSuccessToast = true,
  showErrorAlert = true
}) => {
  const { colors } = useTheme();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (disabled || loading || isSaving || !onSave) return;

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
        style
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
  )
};

// 保存功能工具函数
export const SaveUtils = {
  /**
   * Word文档保存
   */
  async saveWordDocument(documentId, content, offlineStorageService) {
    try {
      const key = `doc_content_${documentId}`;
      await offlineStorageService.setItem(key, content);
      console.log('SaveUtils: Word文档保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: Word文档保存失败:', error);
      throw new Error('Word文档保存失败：' + error.message);
    }
  },

  /**
   * PDF注释保存
   */
  async savePDFAnnotations(documentId, annotations, offlineStorageService) {
    try {
      const key = `pdf_annotations_${documentId}`;
      await offlineStorageService.setItem(key, JSON.stringify(annotations));
      console.log('SaveUtils: PDF注释保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: PDF注释保存失败:', error);
      throw new Error('PDF注释保存失败：' + error.message);
    }
  },

  /**
   * Markdown内容保存
   */
  async saveMarkdownContent(documentId, content, offlineStorageService) {
    try {
      // 保存到多个位置确保数据不丢失
      const key = `markdown_content_${documentId}`;
      const backupKey = `markdown_${documentId}`;

      // 主要保存位置
      await offlineStorageService.setItem(key, content);

      // 备份保存位置（兼容旧版本）
      await offlineStorageService.setItem(backupKey, content);

      // 更新笔记内容（如果是笔记）
      try {
        const existingNote = await offlineStorageService.getNote(documentId);
        if (existingNote) {
          // 创建一个干净的笔记对象，避免循环引用
          const updatedNote = {
            _id: existingNote._id,
            id: existingNote.id || existingNote._id,
            title: existingNote.title,
            content: content,
            type: existingNote.type,
            file_type: existingNote.file_type,
            file_name: existingNote.file_name,
            file_uri: existingNote.file_uri,
            uri: existingNote.uri,
            path: existingNote.path,
            created_at: existingNote.created_at,
            updated_at: new Date().toISOString(),
            is_synced: false,
            is_offline: existingNote.is_offline,
            imported: existingNote.imported,
            // 确保metadata是字符串
            metadata: typeof existingNote.metadata === 'object' ?
                     JSON.stringify(existingNote.metadata) :
                     (existingNote.metadata || '{}'),
            // 确保tags是字符串数组，过滤掉循环引用对象
            tags: Array.isArray(existingNote.tags) ?
                  existingNote.tags.filter(tag =>
                    typeof tag === 'string' ||
                    (typeof tag === 'object' && tag !== null && !tag.reference)
                  ).map(tag => String(tag)) : [],
            // 处理attachments字段，过滤掉循环引用
            attachments: Array.isArray(existingNote.attachments) ?
                        existingNote.attachments.filter(attachment =>
                          typeof attachment === 'object' &&
                          attachment !== null &&
                          !attachment.reference
                        ) : []
          };
          await offlineStorageService.updateNote(documentId, updatedNote);
          console.log('SaveUtils: 笔记内容已更新');
        }
      } catch (noteError) {
        console.warn('SaveUtils: 更新笔记内容失败:', noteError);
      }

      console.log('SaveUtils: Markdown内容保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: Markdown内容保存失败:', error);
      throw new Error('Markdown内容保存失败：' + error.message);
    }
  },

  /**
   * PPT注释保存
   */
  async savePPTAnnotations(documentId, annotations, offlineStorageService) {
    try {
      const key = `ppt_annotations_${documentId}`;
      await offlineStorageService.setItem(key, JSON.stringify(annotations));
      console.log('SaveUtils: PPT注释保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: PPT注释保存失败:', error);
      throw new Error('PPT注释保存失败：' + error.message);
    }
  },

  /**
   * 无限画布保存
   */
  async saveCanvasData(canvasId, canvasData, infiniteCanvasStorage, offlineStorageService) {
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
        await offlineStorageService.saveCanvas(canvasData);
        console.log('SaveUtils: 画布数据保存到offlineStorageService成功');
        saveSuccess = true;
      } catch (realmError) {
        console.warn('SaveUtils: offlineStorageService保存失败:', realmError);
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
  async saveNoteContent(noteId, content, type, offlineStorageService) {
    try {
      const noteData = {
        _id: noteId,
        id: noteId,
        content,
        type,
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true
      };

      await offlineStorageService.updateNote(noteId, noteData);
      console.log('SaveUtils: 笔记内容保存成功');
      return true;
    } catch (error) {
      console.error('SaveUtils: 笔记内容保存失败:', error);
      throw new Error('笔记内容保存失败：' + error.message);
    }
  }
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
