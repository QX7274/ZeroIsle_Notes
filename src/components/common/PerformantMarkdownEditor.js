/**
 * Performance-Optimized Markdown Editor
 * Features optimized rendering, virtual scrolling, and smooth typing experience
 */

import React, { useState, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  Platform,
  KeyboardAvoidingView,
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import AdvancedMarkdownPreview from './AdvancedMarkdownPreview';
import MarkdownToolbar from './MarkdownToolbar';
import useMarkdownPreview from '../../hooks/useMarkdownPreview';

/**
 * Performance-optimized Markdown Editor Component
 */
const PerformantMarkdownEditor = memo(({
  value = '',
  onChange,
  style,
  readOnly = false,
  placeholder = '开始输入 Markdown 内容...',
  showPreview = true,
  viewMode = 'split',
  debounceDelay = 150, // Reduced for better responsiveness
  enableSyntaxHighlighting = true,
  enableMath = true,
  maxPreviewUpdatesPerSecond = 10, // Throttle preview updates
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  const [content, setContent] = useState(value);
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [isTyping, setIsTyping] = useState(false);

  const editorRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const pendingUpdateRef = useRef(false);

  // Optimized markdown preview hook with performance settings
  const {
    previewContent,
    isUpdating,
    validation,
    stats,
    forceUpdate,
  } = useMarkdownPreview(content, {
    debounceDelay,
    enableValidation: !isTyping, // Disable validation while typing
    enableStats: !isTyping, // Disable stats calculation while typing
    onContentChange: useCallback((data) => {
      // Only update preview if not typing or enough time has passed
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      const minInterval = 1000 / maxPreviewUpdatesPerSecond;

      if (!isTyping || timeSinceLastUpdate >= minInterval) {
        lastUpdateTimeRef.current = now;
        pendingUpdateRef.current = false;
      } else {
        pendingUpdateRef.current = true;
      }
    }, [isTyping, maxPreviewUpdatesPerSecond]),
  });

  // Handle content change with performance optimizations
  const handleContentChange = useCallback((text) => {
    setContent(text);
    setIsTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing state to false after user stops typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);

      // Force update if there's a pending update
      if (pendingUpdateRef.current) {
        InteractionManager.runAfterInteractions(() => {
          forceUpdate();
        });
      }
    }, debounceDelay + 100);

    if (onChange) {
      onChange(text);
    }
  }, [onChange, debounceDelay, forceUpdate]);

  // Handle selection change
  const handleSelectionChange = useCallback((event) => {
    setSelection(event.nativeEvent.selection);
  }, []);

  // Handle markdown insertion from toolbar
  const handleMarkdownInsert = useCallback((before, after = '') => {
    const { start, end } = selection;
    const selectedText = content.substring(start, end);
    const replacement = before + selectedText + after;
    const newContent = content.substring(0, start) + replacement + content.substring(end);

    handleContentChange(newContent);

    // Update selection after insertion
    requestAnimationFrame(() => {
      const newStart = start + before.length;
      const newEnd = newStart + selectedText.length;
      setSelection({ start: newStart, end: newEnd });

      if (editorRef.current) {
        editorRef.current.setNativeProps({
          selection: { start: newStart, end: newEnd },
        });
      }
    });
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

  // Memoized view mode toggle component
  const ViewModeToggle = useMemo(() => (
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

      {/* Performance indicator */}
      {(isTyping || isUpdating) && (
        <View style={styles.performanceIndicator}>
          <Icon
            name={isTyping ? 'edit' : 'refresh'}
            size={12}
            color={colors.primary}
          />
          <Text style={styles.performanceText}>
            {isTyping ? '输入中...' : '更新中...'}
          </Text>
        </View>
      )}
    </View>
  ), [currentViewMode, colors, styles, isTyping, isUpdating]);

  // Memoized editor component
  const EditorPane = useMemo(() => (
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
        // Performance optimizations
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        blurOnSubmit={false}
        // Reduce re-renders during typing
        selection={selection}
      />
    </View>
  ), [
    currentViewMode, styles, content, handleContentChange, handleSelectionChange,
    placeholder, colors.textSecondary, readOnly, selection,
  ]);

  // Memoized preview component with performance optimizations
  const PreviewPane = useMemo(() => (
    <View style={[
      styles.previewPane,
      currentViewMode === 'split' && styles.splitPane,
    ]}>
      <AdvancedMarkdownPreview
        content={isTyping ? content : previewContent} // Use raw content while typing for better performance
        style={styles.preview}
        scrollEnabled={true}
        onLinkPress={handleLinkPress}
        onTaskToggle={handleTaskToggle}
        enableMath={enableMath && !isTyping} // Disable math rendering while typing
        enableSyntaxHighlighting={enableSyntaxHighlighting && !isTyping} // Disable syntax highlighting while typing
      />
    </View>
  ), [
    currentViewMode, styles, isTyping, content, previewContent,
    handleLinkPress, handleTaskToggle, enableMath, enableSyntaxHighlighting,
  ]);

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
      {showPreview && ViewModeToggle}

      {/* Content Area */}
      <View style={styles.contentContainer}>
        {/* Editor Pane */}
        {(currentViewMode === 'editor' || currentViewMode === 'split') && EditorPane}

        {/* Preview Pane */}
        {(currentViewMode === 'preview' || currentViewMode === 'split') && showPreview && PreviewPane}
      </View>

      {/* Status Bar */}
      {!readOnly && (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            {stats.lines} 行 • {stats.words} 词 • {stats.characters} 字符
          </Text>

          {validation.errors.length > 0 && (
            <View style={styles.errorIndicator}>
              <Icon name="error" size={14} color={colors.error || '#FF3B30'} />
              <Text style={styles.errorText}>{validation.errors.length} 错误</Text>
            </View>
          )}

          {validation.warnings.length > 0 && (
            <View style={styles.warningIndicator}>
              <Icon name="warning" size={14} color={colors.warning || '#FF9500'} />
              <Text style={styles.warningText}>{validation.warnings.length} 警告</Text>
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

// Styles function with performance optimizations
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  performanceText: {
    marginLeft: 4,
    fontSize: 10,
    color: colors.primary,
    fontWeight: '500',
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
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  errorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 11,
    color: colors.error || '#FF3B30',
    marginLeft: 2,
  },
  warningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  warningText: {
    fontSize: 11,
    color: colors.warning || '#FF9500',
    marginLeft: 2,
  },
});

PerformantMarkdownEditor.displayName = 'PerformantMarkdownEditor';

export default PerformantMarkdownEditor;
