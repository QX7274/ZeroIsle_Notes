/**
 * Advanced Markdown Toolbar Component
 * Provides comprehensive formatting tools for markdown editing
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { getActiveFormats } from '../../utils/editorUtils';

/**
 * Markdown Toolbar Component
 * @param {function} onInsert - Callback for inserting markdown
 * @param {object} selection - Current text selection
 * @param {string} content - Current editor content
 * @param {boolean} disabled - Whether toolbar is disabled
 */
const MarkdownToolbar = ({
  onInsert,
  selection = { start: 0, end: 0 },
  content = '',
  disabled = false,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showHeaderOptions, setShowHeaderOptions] = useState(false);

  // Get selected text
  const getSelectedText = useCallback(() => {
    return content.substring(selection.start, selection.end);
  }, [content, selection]);

  // Basic formatting actions
  const activeFormats = getActiveFormats(content, selection);

  // Basic formatting actions
  const formatActions = [
    {
      icon: 'format-bold',
      title: '粗体',
      action: () => onInsert('**', '**'),
      shortcut: 'Ctrl+B',
      key: 'bold',
    },
    {
      icon: 'format-italic',
      title: '斜体',
      action: () => onInsert('*', '*'),
      shortcut: 'Ctrl+I',
      key: 'italic',
    },
    {
      icon: 'format-strikethrough',
      title: '删除线',
      action: () => onInsert('~~', '~~'),
      shortcut: 'Ctrl+Shift+X',
      key: 'strikethrough',
    },
    {
      icon: 'format-underlined',
      title: '下划线',
      action: () => onInsert('__', '__'),
      shortcut: 'Ctrl+U',
      key: 'underline',
    },
  ];

  // Header actions
  const headerActions = [
    {
      icon: 'title',
      title: 'H1',
      action: () => onInsert('# ', ''),
      level: 1,
    },
    {
      icon: 'title',
      title: 'H2',
      action: () => onInsert('## ', ''),
      level: 2,
    },
    {
      icon: 'title',
      title: 'H3',
      action: () => onInsert('### ', ''),
      level: 3,
    },
    {
      icon: 'title',
      title: 'H4',
      action: () => onInsert('#### ', ''),
      level: 4,
    },
  ];

  // List and structure actions
  const structureActions = [
    {
      icon: 'format-list-bulleted',
      title: '无序列表',
      action: () => insertList('- '),
      key: 'bullet',
    },
    {
      icon: 'format-list-numbered',
      title: '有序列表',
      action: () => insertList('1. '),
      key: 'number',
    },
    {
      icon: 'checklist',
      title: '任务列表',
      action: () => insertList('- [ ] '),
      key: 'task',
    },
    {
      icon: 'format-quote',
      title: '引用',
      action: () => onInsert('> ', ''),
      key: 'quote',
    },
  ];

  // Media and advanced actions
  const advancedActions = [
    {
      icon: 'code',
      title: '行内代码',
      action: () => onInsert('`', '`'),
      key: 'code',
    },
    {
      icon: 'code-block',
      title: '代码块',
      action: () => insertCodeBlock(),
    },
    {
      icon: 'link',
      title: '链接',
      action: () => handleLinkInsert(),
    },
    {
      icon: 'image',
      title: '图片',
      action: () => handleImageInsert(),
    },
    {
      icon: 'table-chart',
      title: '表格',
      action: () => setShowTableModal(true),
    },
    {
      icon: 'horizontal-rule',
      title: '分割线',
      action: () => onInsert('\n---\n', ''),
    },
  ];

  // Insert list with proper formatting
  const insertList = useCallback((prefix) => {
    const selectedText = getSelectedText();
    if (selectedText) {
      const lines = selectedText.split('\n');
      const formattedLines = lines.map(line => line.trim() ? `${prefix}${line.trim()}` : '');
      onInsert('', formattedLines.join('\n'));
    } else {
      onInsert(prefix, '');
    }
  }, [getSelectedText, onInsert]);

  // Insert code block
  const insertCodeBlock = useCallback(() => {
    const selectedText = getSelectedText();
    if (selectedText) {
      onInsert('```\n', '\n```');
    } else {
      onInsert('```javascript\n', '\n```');
    }
  }, [getSelectedText, onInsert]);

  // Handle link insertion
  const handleLinkInsert = useCallback(() => {
    const selectedText = getSelectedText();
    if (selectedText) {
      setLinkText(selectedText);
    }
    setShowLinkModal(true);
  }, [getSelectedText]);

  // Handle image insertion
  const handleImageInsert = useCallback(() => {
    const selectedText = getSelectedText();
    if (selectedText) {
      setImageAlt(selectedText);
    }
    setShowImageModal(true);
  }, [getSelectedText]);

  // Insert link
  const insertLink = useCallback(() => {
    if (!linkUrl.trim()) {
      Alert.alert('错误', '请输入链接地址');
      return;
    }

    const text = linkText.trim() || '链接文本';
    onInsert('', `[${text}](${linkUrl.trim()})`);

    // Reset modal state
    setLinkText('');
    setLinkUrl('');
    setShowLinkModal(false);
  }, [linkText, linkUrl, onInsert]);

  // Insert image
  const insertImage = useCallback(() => {
    if (!imageUrl.trim()) {
      Alert.alert('错误', '请输入图片地址');
      return;
    }

    const alt = imageAlt.trim() || '图片';
    onInsert('', `![${alt}](${imageUrl.trim()})`);

    // Reset modal state
    setImageAlt('');
    setImageUrl('');
    setShowImageModal(false);
  }, [imageAlt, imageUrl, onInsert]);

  // Insert table
  const insertTable = useCallback(() => {
    if (tableRows < 1 || tableCols < 1) {
      Alert.alert('错误', '表格行数和列数必须大于0');
      return;
    }

    let table = '';

    // Header row
    const headerCells = Array(tableCols).fill('标题').map((cell, i) => `${cell}${i + 1}`);
    table += `| ${headerCells.join(' | ')} |\n`;

    // Separator row
    const separators = Array(tableCols).fill('---');
    table += `| ${separators.join(' | ')} |\n`;

    // Data rows
    for (let i = 0; i < tableRows - 1; i++) {
      const dataCells = Array(tableCols).fill('内容');
      table += `| ${dataCells.join(' | ')} |\n`;
    }

    onInsert('\n', table);
    setShowTableModal(false);
  }, [tableRows, tableCols, onInsert]);

  // Render toolbar button
  const renderToolbarButton = useCallback((action, index) => {
    const isActive = activeFormats.has(action.key);
    return (
      <TouchableOpacity
        key={index}
        style={[styles.toolbarButton, isActive && styles.activeButton, disabled && styles.disabledButton]}
        onPress={action.action}
        disabled={disabled}
      >
        <Icon
          name={action.icon}
          size={22}
          color={isActive ? colors.primary : (disabled ? colors.textSecondary : colors.text)}
        />
      </TouchableOpacity>
    );
  }, [colors, disabled, styles, activeFormats]);



  const styles = getStyles(colors, dimensions);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Basic formatting */}
        <View style={styles.buttonGroup}>
          {formatActions.map(renderToolbarButton)}
        </View>

        <View style={styles.divider} />

        {/* Headers */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.toolbarButton, disabled && styles.disabledButton]}
            onPress={() => setShowHeaderOptions(true)}
            disabled={disabled}
          >
            <Icon name="title" size={22} color={disabled ? colors.textSecondary : colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Lists and structure */}
        <View style={styles.buttonGroup}>
          {structureActions.map(renderToolbarButton)}
        </View>

        <View style={styles.divider} />

        {/* Advanced features */}
        <View style={styles.buttonGroup}>
          {advancedActions.map(renderToolbarButton)}
        </View>
      </ScrollView>

      {/* Link Modal */}
      <Modal
        visible={showLinkModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>插入链接</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="链接文本"
              placeholderTextColor={colors.textSecondary}
              value={linkText}
              onChangeText={setLinkText}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="链接地址 (https://...)"
              placeholderTextColor={colors.textSecondary}
              value={linkUrl}
              onChangeText={setLinkUrl}
              keyboardType="url"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLinkModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={insertLink}
              >
                <Text style={styles.confirmButtonText}>插入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>插入图片</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="图片描述"
              placeholderTextColor={colors.textSecondary}
              value={imageAlt}
              onChangeText={setImageAlt}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="图片地址 (https://...)"
              placeholderTextColor={colors.textSecondary}
              value={imageUrl}
              onChangeText={setImageUrl}
              keyboardType="url"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowImageModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={insertImage}
              >
                <Text style={styles.confirmButtonText}>插入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Table Modal */}
      <Modal
        visible={showTableModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>插入表格</Text>

            <View style={styles.tableInputRow}>
              <Text style={styles.tableInputLabel}>行数:</Text>
              <TextInput
                style={styles.tableInput}
                value={tableRows.toString()}
                onChangeText={(text) => setTableRows(parseInt(text) || 1)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.tableInputRow}>
              <Text style={styles.tableInputLabel}>列数:</Text>
              <TextInput
                style={styles.tableInput}
                value={tableCols.toString()}
                onChangeText={(text) => setTableCols(parseInt(text) || 1)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTableModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={insertTable}
              >
                <Text style={styles.confirmButtonText}>插入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header Options Modal */}
      <Modal
        visible={showHeaderOptions}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHeaderOptions(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowHeaderOptions(false)}>
          <View style={styles.headerOptionsContent}>
            {headerActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.headerOptionButton}
                onPress={() => {
                  action.action();
                  setShowHeaderOptions(false);
                }}
              >
                <Text style={[styles.headerOptionText, { fontSize: 20 - action.level * 2 }]}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Styles
const getStyles = (colors, dimensions) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarButton: {
    padding: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  activeButton: {
    backgroundColor: colors.primary + '20',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 20, // Make divider slightly smaller than button height
    backgroundColor: colors.border,
    marginHorizontal: 6,
    alignSelf: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Table input styles
  tableInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableInputLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  tableInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 8,
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  headerOptionsContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 10,
    width: '80%',
    maxWidth: 400,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  headerOptionButton: {
    padding: 12,
    alignItems: 'center',
  },
  headerOptionText: {
    fontWeight: 'bold',
    color: colors.text,
  },
});

export default MarkdownToolbar;
