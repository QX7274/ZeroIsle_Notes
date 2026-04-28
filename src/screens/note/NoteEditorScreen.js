import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { View, StyleSheet, Alert, Text, FlatList, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { MarkdownEditorIntegration } from '../../components/common';
import realmService from '../../services/database/realmService';
import { addBlockIdsToMarkdown } from '../../utils/markdownBlockUtils';
import { Realm } from '@realm/react';
import BlockReferenceModal from '../../components/common/BlockReferenceModal';

import VersionHistoryDrawer from './components/VersionHistoryDrawer';
import DiffView from './components/DiffView';
import { compareVersions, restoreVersion } from '../../services/api/noteVersionApi';

// Helper function to find block content by its ID
const findBlockContentById = async (blockId) => {
  const realm = await realmService.getRealm();
  const allNotes = realm.objects('Note');
  // Regex to find a line ending with the block ID
  const searchRegex = new RegExp(`(.*)(\s\^${blockId})$`, 'm');

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
        const realm = await realmService.getRealm();
        const noteObject = realm.objectForPrimaryKey('Note', noteId);
        if (noteObject) {
          setNote(noteObject);
          setContent(noteObject.content || '');
          navigation.setOptions({ title: noteObject.title || 'Edit Note' });
        }
      }
    };
    loadNote();
  }, [noteId, navigation, note?.title]);

  const findBacklinks = async () => {
    if (note) {
      const realm = await realmService.getRealm();
      // 优化: 使用 Realm 原生查询 (C++ 层执行) 替代 JS filter
      // 性能提升 10-100 倍,不阻塞主线程
      const linkingNotes = realm.objects('Note').filtered('content CONTAINS[c] $0', `[[${note.title}]]`);
      setBacklinks(Array.from(linkingNotes));
    }
  };

  useEffect(() => {
    findBacklinks();
  }, [note?.title]);

  const handleSave = async (newContent) => {
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
      } catch (error) {
        console.error('Failed to save note:', error);
        Alert.alert('Error', 'Failed to save note. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

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
              const newNote = await realmService.create('Note', {
                _id: new Realm.BSON.UUID().toHexString(),
                title: title,
                content: '',
                created_at: new Date(),
                updated_at: new Date(),
              });
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

  const handleChange = (val) => {
    setContent(val);
    setIsDirty(true);
  };

  const guardBeforeAction = (proceed) => {
    if (!isDirty) {return proceed();}
    Alert.alert(
      '未保存的更改',
      '当前笔记有未保存的更改，是否先保存？',
      [
        { text: '取消', style: 'cancel' },
        { text: '放弃并继续', style: 'destructive', onPress: () => proceed() },
        { text: '保存后继续', onPress: async () => { await handleSave(content); proceed(); } },
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
          <TouchableOpacity onPress={() => setShowHistory(true)}>
            <Icon name="history" size={24} color={theme.colors.primary} style={{ marginRight: 15 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSave(content)} disabled={isSaving}>
            <Icon
              name="save"
              size={24}
              color={isDirty ? theme.colors.primary : theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, theme, isDirty, isSaving, saveSuccess, content]);

  // 优化: 缓存正则表达式，避免在 renderItem 中重复创建
  const backlinkRegex = useMemo(() => {
    if (!note?.title) {return null;}
    return new RegExp(`\\[\\[${note.title}\\]\\]`);
  }, [note?.title]);

  // 渲染 backlink 项 (优化: useCallback)
  const renderBacklinkItem = useCallback(({ item }) => {
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
      <TouchableOpacity onPress={() => navigation.push('NoteEditor', { noteId: item._id })} style={styles.backlinkCard}>
        <Text style={styles.backlinkTitle}>{item.title}</Text>
        <Text style={styles.backlinkContext} numberOfLines={2}>{context}</Text>
      </TouchableOpacity>
    );
  }, [backlinkRegex, navigation]);

  if (!note) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{ marginTop: 10, color: theme.colors.textSecondary }}>正在加载笔记...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MarkdownEditorIntegration
        value={content}
        onChange={setContent}
        onSave={() => handleSave(content)}
        onWikiLinkPress={handleWikiLinkPress}
        onBlockReferencePress={handleBlockReferencePress}
        onOpenBlockReferenceSearch={() => setShowBlockReferenceModal(true)}
      />

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
  backlinksContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    maxHeight: 200,
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

