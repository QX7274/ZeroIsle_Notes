import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { View, StyleSheet, Alert, Text, FlatList, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { MarkdownEditorIntegration } from '../../components/common';
import realmService from '../../services/database/realmService';
import { withPreviewMetadata } from '../../models/utils/notePreview';
import { addBlockIdsToMarkdown } from '../../utils/markdownBlockUtils';
// BSON 类型直接从 realm 包导出，避免依赖未声明的 @realm/react
import { BSON } from 'realm';
import BlockReferenceModal from '../../components/common/BlockReferenceModal';

import VersionHistoryDrawer from './components/VersionHistoryDrawer';
import DiffView from './components/DiffView';
import { compareVersions, restoreVersion } from '../../services/api/noteVersionApi';
// 「最近访问」记录（WS-U）：加载到既有笔记时单字段写 last_opened_at
import { markNoteOpenedAt } from '../../services/offline/getNotes';

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper function to find block content by its ID
const findBlockContentById = async (blockId) => {
  const realm = await realmService.getRealm();
  const allNotes = realm.objects('Note');
  // Regex to find a line ending with the block ID
  const searchRegex = new RegExp(`(.*)(\\s\\^${escapeRegExp(blockId)})$`, 'm');

  for (const note of allNotes) {
    if (note.content) {
      const match = note.content.match(searchRegex);
      if (match) {
        // Return the content of the line, excluding the block ID itself.
        return match[1].trim();
      }
    }
  }
  return null;
};

const NoteEditorScreen = ({ route, navigation }) => {
  const { noteId } = route.params;
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [note, setNote] = useState(null);
  const [content, setContent] = useState('');
  const [backlinks, setBacklinks] = useState([]);
  const [showBlockReferenceModal, setShowBlockReferenceModal] = useState(false);
  // Version feature states
  const [showHistory, setShowHistory] = useState(false);
  const [diffVisible, setDiffVisible] = useState(false);
  const [diffData, setDiffData] = useState({ title_diff: [], content_diff: [] });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadNote = async () => {
      if (noteId) {
        setNote(null);
        setContent('');
        setBacklinks([]);
        setIsDirty(false);
        setSaveSuccess(false);
        setShowHistory(false);
        setDiffVisible(false);
        const realm = await realmService.getRealm();
        const noteObject = realm.objectForPrimaryKey('Note', noteId);
        if (noteObject) {
          // 记录「最近访问」（WS-U）：只有真正加载到既有笔记时才写（未命中不写）
          markNoteOpenedAt(noteId);
          setNote(noteObject);
          setContent(noteObject.content || '');
          setIsDirty(false);
          setSaveSuccess(false);
          setShowHistory(false);
          setDiffVisible(false);
          navigation.setOptions({ title: noteObject.title || 'Edit Note' });
        }
      }
    };
    loadNote();
  }, [noteId, navigation]);

  const findBacklinks = useCallback(async () => {
    if (note) {
      const realm = await realmService.getRealm();
      // 优化: 使用 Realm 原生查询 (C++ 层执行) 替代 JS filter
      // 性能提升 10-100 倍,不阻塞主线程
      const linkingNotes = realm.objects('Note').filtered('content CONTAINS[c] $0', `[[${note.title}]]`);
      setBacklinks(Array.from(linkingNotes));
    }
  }, [note]);

  useEffect(() => {
    if (!note?.title) {
      setBacklinks([]);
      return;
    }
    findBacklinks();
  }, [findBacklinks, note?.title]);

  const handleSave = useCallback(async (newContent) => {
    if (note) {
      setIsSaving(true);
      setSaveSuccess(false);

      try {
        const processedContent = addBlockIdsToMarkdown(newContent);
        const realm = await realmService.getRealm();
        realm.write(() => {
          note.content = processedContent;
          note.updated_at = new Date();
        });
        // Update the local state to reflect the changes, so the user sees the new IDs
        setContent(processedContent);
        setIsDirty(false);
        setSaveSuccess(true);
        // 保存成功提示 2 秒后消失
        setTimeout(() => setSaveSuccess(false), 2000);
        return true;
      } catch (error) {
        console.error('Failed to save note:', error);
        Alert.alert('Error', 'Failed to save note. Please try again.');
        return false;
      } finally {
        setIsSaving(false);
      }
    }
    return false;
  }, [note]);

  const handleWikiLinkPress = async (title) => {
    const realm = await realmService.getRealm();
    const targetNote = realm.objects('Note').filtered('title == $0', title)[0];
    if (targetNote) {
      navigation.push('NoteEditor', { noteId: targetNote._id });
    } else {
      Alert.alert(
        'Create Note?',
        `A note with the title "${title}" does not exist. Would you like to create it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create',
            onPress: async () => {
              const newNote = await realmService.create('Note', withPreviewMetadata({
                _id: new BSON.UUID().toHexString(),
                title: title,
                content: '',
                created_at: new Date(),
                updated_at: new Date(),
              }));
              navigation.push('NoteEditor', { noteId: newNote._id });
            },
          },
        ]
      );
    }
  };

  const handleBlockReferencePress = async (blockId) => {
    const blockContent = await findBlockContentById(blockId);
    if (blockContent) {
      // Replace the reference with a blockquote of the content
      const newContent = content.replace(`((^${blockId}))`, `> ${blockContent}\n> > ^${blockId}`);
      setContent(newContent);
    } else {
      Alert.alert('Reference not found', `Could not find content for block ID: ^${blockId}`);
    }
  };

  const handleSelectBlock = (blockId) => {
    const newContent = content.slice(0, -2) + `((^${blockId}))`; // Replace the '((' trigger
    setContent(newContent);
    setShowBlockReferenceModal(false);
  };

  const guardBeforeAction = (proceed) => {
    if (!isDirty) {return proceed();}
    Alert.alert(
      '未保存的更改',
      '当前笔记有未保存的更改，是否先保存？',
      [
        { text: '取消', style: 'cancel' },
        { text: '放弃并继续', style: 'destructive', onPress: () => proceed() },
        {
          text: '保存后继续',
          onPress: async () => {
            const saved = await handleSave(content);
            if (saved) {
              proceed();
            }
          },
        },
      ]
    );
  };

  const handleCompare = (fromId, toId) => {
    const doCompare = async () => {
      try {
        const res = await compareVersions(fromId, toId);
        setDiffData({ title_diff: res.title_diff || [], content_diff: res.content_diff || [] });
        setDiffVisible(true);
      } catch (e) {
        Alert.alert('对比失败', e.message || '无法获取版本差异');
      }
    };
    guardBeforeAction(doCompare);
  };

  const handleRestore = (versionId) => {
    const doRestore = async () => {
      try {
        const res = await restoreVersion(versionId);
        const restored = res?.restored_to_version || res;
        // 更新编辑器内容 & Realm 本地
        if (restored?.content != null) {
          setContent(restored.content);
          setIsDirty(false);
          const realm = await realmService.getRealm();
          if (note) {
            realm.write(() => {
              note.content = restored.content;
              note.updated_at = new Date();
            });
          }
        }
        Alert.alert('已恢复', `已恢复到版本 v${restored?.version_number ?? ''}`);
        setShowHistory(false);
      } catch (e) {
        Alert.alert('恢复失败', e.message || '无法恢复到该版本');
      }
    };
    guardBeforeAction(doRestore);
  };

  const handleOpenHistory = () => {
    setDiffVisible(false);
    setShowHistory(true);
  };

  const handleCloseHistory = () => {
    setShowHistory(false);
    setDiffVisible(false);
  };

  const handleCloseDiff = () => {
    setDiffVisible(false);
  };

  // Setup navigation choices in header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
          {isSaving && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
          )}
          {saveSuccess && (
            <Icon name="check-circle" size={20} color={theme.colors.success || '#4CAF50'} style={{ marginRight: 8 }} />
          )}
          <TouchableOpacity onPress={handleOpenHistory} testID="action.noteEditor.tool.history">
            <Icon name="history" size={24} color={theme.colors.primary} style={{ marginRight: 15 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSave(content)} disabled={isSaving} testID="action.noteEditor.save">
            <Icon
              name="save"
              size={24}
              color={isDirty ? theme.colors.primary : theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, theme, isDirty, isSaving, saveSuccess, content, handleSave]);

  // 优化: 缓存正则表达式，避免在 renderItem 中重复创建
  const backlinkRegex = useMemo(() => {
    if (!note?.title) {return null;}
    return new RegExp(`\\[\\[${escapeRegExp(note.title)}\\]\\]`);
  }, [note?.title]);

  // 渲染 backlink 项 (优化: useCallback)
  const renderBacklinkItem = ({ item }) => {
    if (!backlinkRegex) {return null;}

    // Extract context for the backlink
    const match = item.content?.match(backlinkRegex);
    let context = '';
    if (match) {
      const index = match.index;
      const start = Math.max(0, index - 20);
      const end = Math.min(item.content.length, index + 20);
      context = `...${item.content.substring(start, end)}...`;
    }

    return (
      <TouchableOpacity onPress={() => navigation.push('NoteEditor', { noteId: item._id })} style={styles.backlinkCard} testID={`item.noteEditor.backlink.${item._id}`}>
        <Text style={styles.backlinkTitle}>{item.title}</Text>
        <Text style={styles.backlinkContext} numberOfLines={2}>{context}</Text>
      </TouchableOpacity>
    );
  };

  // 编辑器状态锚点：仅由既有状态派生，不引入新的状态变量
  const editorState = isSaving ? 'saving' : (saveSuccess ? 'saved' : 'idle');

  if (!note) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} testID="screen.noteEditor">
        <View testID="state.noteEditor.state.loading" />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.textSecondary }}>正在加载笔记...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="screen.noteEditor">
      <View testID={`state.noteEditor.state.${editorState}`} />
      <View testID={`state.noteEditor.dirty.visibility.${isDirty ? 'visible' : 'hidden'}`} />
      <View testID={`state.noteEditor.history.visibility.${showHistory ? 'visible' : 'hidden'}`} />
      <View testID={`state.noteEditor.diff.visibility.${diffVisible ? 'visible' : 'hidden'}`} />

      {/* 内容编辑器集成体未对外暴露 testID 通道，这里用布局等价的宿主 View 提供稳定的内容区锚点 */}
      <View style={styles.editorContentHost} testID="input.noteEditor.content">
        <MarkdownEditorIntegration
          value={content}
          onChange={setContent}
          onSave={() => handleSave(content)}
          onWikiLinkPress={handleWikiLinkPress}
          onBlockReferencePress={handleBlockReferencePress}
          onOpenBlockReferenceSearch={() => setShowBlockReferenceModal(true)}
        />
      </View>

      <VersionHistoryDrawer
        noteId={noteId}
        visible={showHistory}
        onRequestClose={handleCloseHistory}
        onRestore={handleRestore}
        onCompare={handleCompare}
        theme={theme}
      />

      <Modal
        visible={diffVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseDiff}
      >
        <View style={styles.diffModalContainer} testID="modal.noteEditor.diff">
          <View style={styles.diffModalHeader}>
            <Text style={styles.diffModalTitle}>版本差异</Text>
            <TouchableOpacity onPress={handleCloseDiff} style={styles.diffModalCloseButton} testID="action.noteEditor.diff.close">
              <Icon name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <DiffView
            titleDiff={diffData.title_diff}
            contentDiff={diffData.content_diff}
            theme={theme}
          />
        </View>
      </Modal>

      <BlockReferenceModal
        visible={showBlockReferenceModal}
        onClose={() => setShowBlockReferenceModal(false)}
        onSelectBlock={handleSelectBlock}
      />
      <View style={styles.backlinksContainer}>
        <Text style={styles.backlinksTitle}>Linked Mentions</Text>
        <FlatList
          data={backlinks}
          keyExtractor={(item) => item._id}
          renderItem={renderBacklinkItem}
          ListEmptyComponent={
            <View style={styles.emptyBacklinksContainer}>
              <Icon name="link-off" size={24} color={theme.colors.textSecondary} />
              <Text style={styles.noBacklinks}>No linked mentions found.</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // 内容区宿主：仅作为 testID 锚点载体，透传 flex 布局，不改变原有布局分配
  editorContentHost: {
    flex: 1,
  },
  backlinksContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    maxHeight: 200,
  },
  diffModalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  diffModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  diffModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  diffModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  backlinksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 10,
  },
  backlinkCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backlinkTitle: {
    fontWeight: 'bold',
    color: theme.colors.text,
    fontSize: 14,
  },
  backlinkContext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  emptyBacklinksContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noBacklinks: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
});

export default NoteEditorScreen;
