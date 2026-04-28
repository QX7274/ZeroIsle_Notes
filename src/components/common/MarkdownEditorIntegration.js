/**
 * Markdown Editor Integration Component
 * Provides a complete markdown editing solution with real-time preview
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import VirtualizedMarkdownEditor from './VirtualizedMarkdownEditor';
import EnhancedMarkdownEditor from './EnhancedMarkdownEditor';
import AdvancedMarkdownPreview from './AdvancedMarkdownPreview';

/**
 * Markdown Editor Integration Component
 * @param {string} value - Current markdown content
 * @param {function} onChange - Content change callback
 * @param {object} style - Custom styles
 * @param {boolean} readOnly - Whether editor is read-only
 * @param {string} placeholder - Placeholder text
 * @param {boolean} showPreview - Whether to show preview
 * @param {string} viewMode - Initial view mode ('split', 'editor', 'preview')
 * @param {boolean} enablePerformanceMode - Use performance-optimized editor
 * @param {boolean} enableFullscreen - Allow fullscreen editing
 * @param {function} onSave - Save callback
 * @param {function} onCancel - Cancel callback
 */
const MarkdownEditorIntegration = ({
  value = '',
  onChange,
  style,
  readOnly = false,
  placeholder = '开始输入 Markdown 内容...',
  showPreview = true,
  viewMode = 'split',
  enablePerformanceMode = true,
  enableFullscreen = true,
  onSave,
  onCancel,
  onWikiLinkPress,
  onBlockReferencePress,
  onOpenBlockReferenceSearch,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentContent, setCurrentContent] = useState(value);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Handle content change
  const handleContentChange = useCallback((newContent) => {
    setCurrentContent(newContent);
    setHasUnsavedChanges(newContent !== value);

    if (onChange) {
      onChange(newContent);
    }
  }, [value, onChange]);

  // Handle save
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(currentContent);
      setHasUnsavedChanges(false);
    }
  }, [currentContent, onSave]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        '未保存的更改',
        '您有未保存的更改，确定要取消吗？',
        [
          { text: '继续编辑', style: 'cancel' },
          {
            text: '放弃更改',
            style: 'destructive',
            onPress: () => {
              setCurrentContent(value);
              setHasUnsavedChanges(false);
              if (onCancel) {
                onCancel();
              }
            },
          },
        ]
      );
    } else {
      if (onCancel) {
        onCancel();
      }
    }
  }, [hasUnsavedChanges, value, onCancel]);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Choose editor component based on performance mode
  const EditorComponent = enablePerformanceMode ? VirtualizedMarkdownEditor : EnhancedMarkdownEditor;

  // Render action buttons
  const ActionButtons = useMemo(() => (
    <View style={styles.actionButtons}>
      {enableFullscreen && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={toggleFullscreen}
        >
          <Icon
            name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>
      )}

      {onSave && (
        <TouchableOpacity
          style={[styles.actionButton, hasUnsavedChanges && styles.saveButton]}
          onPress={handleSave}
          disabled={!hasUnsavedChanges}
        >
          <Icon
            name="save"
            size={20}
            color={hasUnsavedChanges ? '#FFFFFF' : colors.textSecondary}
          />
        </TouchableOpacity>
      )}

      {onCancel && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCancel}
        >
          <Icon name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  ), [
    enableFullscreen, isFullscreen, toggleFullscreen, colors,
    onSave, handleSave, hasUnsavedChanges,
    onCancel, handleCancel, styles,
  ]);

  // Render editor content
  const EditorContent = useMemo(() => (
    <View style={styles.editorContainer}>
      <EditorComponent
        value={currentContent}
        onChange={handleContentChange}
        readOnly={readOnly}
        placeholder={placeholder}
        showPreview={showPreview}
        viewMode={viewMode}
        style={styles.editor}
        onWikiLinkPress={onWikiLinkPress}
        onBlockReferencePress={onBlockReferencePress}
        onOpenBlockReferenceSearch={onOpenBlockReferenceSearch}
      />
    </View>
  ), [
    EditorComponent, currentContent, handleContentChange, readOnly,
    placeholder, showPreview, viewMode, styles, onWikiLinkPress, onBlockReferencePress, onOpenBlockReferenceSearch,
  ]);

  const styles = getStyles(colors, dimensions);

  // Render in fullscreen modal if enabled
  if (isFullscreen) {
    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={toggleFullscreen}
      >
        <View style={styles.fullscreenContainer}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>Markdown 编辑器</Text>
            {ActionButtons}
          </View>
          {EditorContent}
        </View>
      </Modal>
    );
  }

  // Render inline editor
  return (
    <View style={[styles.container, style]}>
      {(enableFullscreen || onSave || onCancel) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {hasUnsavedChanges && (
              <View style={styles.unsavedIndicator}>
                <Icon name="fiber-manual-record" size={8} color={colors.warning || '#FF9500'} />
                <Text style={styles.unsavedText}>未保存</Text>
              </View>
            )}
          </View>
          {ActionButtons}
        </View>
      )}
      {EditorContent}
    </View>
  );
};

// Styles
const getStyles = (colors, dimensions) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerLeft: {
    flex: 1,
  },
  unsavedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unsavedText: {
    marginLeft: 4,
    fontSize: 12,
    color: colors.warning || '#FF9500',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  editorContainer: {
    flex: 1,
  },
  editor: {
    flex: 1,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50, // Account for status bar
  },
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
});

export default MarkdownEditorIntegration;
