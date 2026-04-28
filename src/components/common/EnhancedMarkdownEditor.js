/**
 * Enhanced Markdown Editor with Real-time Preview
 * Features:
 * - Split-pane view (editor + preview)
 * - Real-time rendering on input changes
 * - Complete markdown support
 * - Syntax highlighting
 * - Performance optimized with debouncing
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Text,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import AdvancedMarkdownPreview from './AdvancedMarkdownPreview';
import MarkdownToolbar from './MarkdownToolbar';
import useMarkdownPreview from '../../hooks/useMarkdownPreview';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Enhanced Markdown Editor Component
 * @param {string} value - Current markdown content
 * @param {function} onChange - Callback when content changes
 * @param {object} style - Custom styles
 * @param {boolean} readOnly - Whether editor is read-only
 * @param {string} placeholder - Placeholder text
 * @param {boolean} showPreview - Whether to show preview pane
 * @param {string} viewMode - 'split', 'editor', 'preview'
 */
const EnhancedMarkdownEditor = ({
  value = '',
  onChange,
  style,
  readOnly = false,
  placeholder = '开始输入 Markdown 内容...',
  showPreview = true,
  viewMode = 'split',
  onWikiLinkPress,
  onBlockReferencePress,
  onOpenBlockReferenceSearch,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  const [content, setContent] = useState(value);
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const {
    previewContent,
    isUpdating,
    validation,
    stats,
  } = useMarkdownPreview(content);

  const editorRef = useRef(null);

  // Handle markdown insertion from toolbar
  const handleMarkdownInsert = useCallback((before, after = '') => {
    const { start, end } = selection;
    const selectedText = content.substring(start, end);
    const replacement = before + selectedText + after;
    const newContent = content.substring(0, start) + replacement + content.substring(end);

    handleContentChange(newContent);

    // Update selection
    setTimeout(() => {
      const newStart = start + before.length;
      const newEnd = newStart + selectedText.length;
      setSelection({ start: newStart, end: newEnd });
      if (editorRef.current) {
        editorRef.current.setNativeProps({
          selection: { start: newStart, end: newEnd },
        });
      }
    }, 100);
  }, [content, selection, handleContentChange]);

  // Handle link press in preview
  const handleLinkPress = useCallback((url) => {
    console.log('Link pressed:', url);
    // Handle link navigation here
  }, []);

  // Handle task toggle in preview
  const handleTaskToggle = useCallback((taskId, checked) => {
    console.log('Task toggled:', taskId, checked);
    // Handle task state change here
  }, []);

  // Handle content change
  const handleContentChange = useCallback((text) => {
    setContent(text);
    if (onChange) {
      onChange(text);
    }

    // Check for block reference trigger
    if (text.endsWith('((') && onOpenBlockReferenceSearch) {
      onOpenBlockReferenceSearch();
    }
  }, [onChange, onOpenBlockReferenceSearch]);

  // Handle selection change
  const handleSelectionChange = useCallback((event) => {
    setSelection(event.nativeEvent.selection);
  }, []);

  // Update content when value prop changes
  useEffect(() => {
    if (value !== content) {
      setContent(value);
    }
  }, [value]);

  const styles = getStyles(colors, dimensions);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, style]}
    >
      {/* Enhanced Toolbar */}
      {!readOnly && (
        <MarkdownToolbar
          onInsert={handleMarkdownInsert}
          selection={selection}
          content={content}
          disabled={readOnly}
        />
      )}

      {/* View Mode Toggle */}
      {showPreview && (
        <View style={styles.viewModeContainer}>
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, currentViewMode === 'editor' && styles.activeToggle]}
              onPress={() => setCurrentViewMode('editor')}
            >
              <Icon name="edit" size={16} color={currentViewMode === 'editor' ? colors.primary : colors.text} />
              <Text style={[styles.toggleText, currentViewMode === 'editor' && styles.activeToggleText]}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, currentViewMode === 'split' && styles.activeToggle]}
              onPress={() => setCurrentViewMode('split')}
            >
              <Icon name="view-column" size={16} color={currentViewMode === 'split' ? colors.primary : colors.text} />
              <Text style={[styles.toggleText, currentViewMode === 'split' && styles.activeToggleText]}>分屏</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, currentViewMode === 'preview' && styles.activeToggle]}
              onPress={() => setCurrentViewMode('preview')}
            >
              <Icon name="visibility" size={16} color={currentViewMode === 'preview' ? colors.primary : colors.text} />
              <Text style={[styles.toggleText, currentViewMode === 'preview' && styles.activeToggleText]}>预览</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content Area */}
      <View style={styles.contentContainer}>
        {/* Editor Pane */}
        {(currentViewMode === 'editor' || currentViewMode === 'split') && (
          <View style={[
            styles.editorPane,
            currentViewMode === 'split' && styles.splitPane,
          ]}>
            <TextInput
              ref={editorRef}
              style={styles.editor}
              value={content}
              onChangeText={handleContentChange}
              onSelectionChange={handleSelectionChange}
              multiline
              textAlignVertical="top"
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              editable={!readOnly}
              scrollEnabled={true}
            />
          </View>
        )}

        {/* Preview Pane */}
        {(currentViewMode === 'preview' || currentViewMode === 'split') && showPreview && (
          <View style={[
            styles.previewPane,
            currentViewMode === 'split' && styles.splitPane,
          ]}>
            <AdvancedMarkdownPreview
              content={content}
              style={styles.preview}
              scrollEnabled={true}
              onLinkPress={handleLinkPress}
              onTaskToggle={handleTaskToggle}
              onWikiLinkPress={onWikiLinkPress}
              onBlockReferencePress={onBlockReferencePress}
              enableMath={true}
              enableSyntaxHighlighting={true}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

// Styles function
const getStyles = (colors, dimensions) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  viewModeContainer: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  activeToggle: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    marginLeft: 4,
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  editorPane: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewPane: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splitPane: {
    borderRightWidth: 0.5,
    borderRightColor: colors.border,
  },
  editor: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 24,
  },
  preview: {
    flex: 1,
  },
});

export default EnhancedMarkdownEditor;
