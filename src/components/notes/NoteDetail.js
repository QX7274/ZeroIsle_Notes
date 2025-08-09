/**
 * 笔记详情组件
 */
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Linking,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import { Card } from '../common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { formatDate } from '../../utils/dateUtils';

/**
 * 笔记详情组件
 * @param {Object} note - 笔记对象
 * @param {Function} onEdit - 编辑回调
 * @param {Function} onDelete - 删除回调
 * @param {Function} onBack - 返回回调
 * @param {Array} relatedNotes - 相关笔记
 * @param {Function} onRelatedNotePress - 点击相关笔记回调
 * @param {Function} onTextSelection - 文本选择回调
 */
const NoteDetail = ({
  note = {},
  onEdit,
  onDelete,
  onBack,
  relatedNotes = [],
  onRelatedNotePress,
  onTextSelection,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 确保笔记对象有基本字段
  const safeNote = {
    id: note.id || note._id || `temp_${Date.now()}`,
    _id: note._id || note.id || `temp_${Date.now()}`,
    title: note.title || '无标题笔记',
    content: note.content || '',
    type: note.type || 'note',
    updated_at: note.updated_at || note.created_at || new Date().toISOString(),
    created_at: note.created_at || note.updated_at || new Date().toISOString(),
    ...note
  };

  // 本地状态
  const [showFullContent, setShowFullContent] = useState(false);

  // 处理分享
  const handleShare = async () => {
    try {
      await Share.share({
        title: safeNote.title,
        message: `${safeNote.title}\n\n${safeNote.content}\n\n来自零屿笔记`,
      });
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

  // 处理导出
  const handleExport = () => {
    // 导出功能实现
  };

  // 处理链接点击
  const handleLinkPress = (url) => {
    Linking.openURL(url).catch(err => {
      console.error('无法打开链接:', err);
    });
  };

  // 渲染标签
  const renderTags = () => {
    // 确保tags是一个数组
    const tags = Array.isArray(safeNote.tags) ? safeNote.tags : [];
    if (tags.length === 0) return null;

    return (
      <View style={styles.tagsContainer}>
        {tags.map(tag => (
          <View
            key={tag.id || `tag_${Math.random().toString(36).substring(2, 9)}`}
            style={[
              styles.tagItem,
              { backgroundColor: colors.background }
            ]}
          >
            <Text
              variant="body"
              size="small"
              color="hint"
            >
              #{typeof tag === 'string' ? tag : (tag.name || '标签')}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // 渲染相关笔记
  const renderRelatedNotes = () => {
    if (!relatedNotes || relatedNotes.length === 0) return null;

    return (
      <View style={styles.relatedNotesContainer}>
        <Text
          variant="body"
          size="large"
          bold
          style={styles.relatedNotesTitle}
        >
          相关笔记
        </Text>

        {relatedNotes.map(relatedNote => (
          <Card
            key={relatedNote.id}
            style={styles.relatedNoteCard}
            elevation="small"
            onPress={() => onRelatedNotePress && onRelatedNotePress(relatedNote)}
          >
            <Text
              variant="body"
              size="medium"
              bold
              numberOfLines={1}
            >
              {relatedNote.title}
            </Text>

            {relatedNote.content && (
              <Text
                variant="body"
                size="small"
                color="hint"
                numberOfLines={2}
                style={styles.relatedNoteExcerpt}
              >
                {relatedNote.content}
              </Text>
            )}
          </Card>
        ))}
      </View>
    );
  };

  // 渲染笔记内容
  const renderContent = () => {
    if (!safeNote.content) return null;

    const contentToShow = showFullContent
      ? safeNote.content
      : safeNote.content.length > 500
        ? `${safeNote.content.substring(0, 500)}...`
        : safeNote.content;

    return (
      <>
        <Text
          variant="body"
          size="medium"
          style={styles.noteContent}
          selectable={true}
          onSelectionChange={(event) => {
            const { selection } = event.nativeEvent;
            if (selection && selection.start !== selection.end && onTextSelection) {
              const selectedText = safeNote.content.substring(selection.start, selection.end);
              onTextSelection(selectedText);
            }
          }}
        >
          {contentToShow}
        </Text>

        {safeNote.content.length > 500 && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => setShowFullContent(!showFullContent)}
          >
            <Text
              variant="body"
              size="small"
              color="primary"
            >
              {showFullContent ? '收起' : '显示更多'}
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text
            variant="heading"
            level="h2"
            style={styles.noteTitle}
          >
            {safeNote.title}
          </Text>

          <View style={styles.metaContainer}>
            {safeNote.category && (
              <View style={[
                styles.categoryBadge,
                { backgroundColor: safeNote.category.color || colors.primary }
              ]}>
                <Text
                  variant="body"
                  size="small"
                  color="card"
                >
                  {safeNote.category.name || '未分类'}
                </Text>
              </View>
            )}

            <Text
              variant="body"
              size="small"
              color="hint"
              style={styles.dateText}
            >
              {formatDate(safeNote.updated_at || safeNote.created_at)}
            </Text>
          </View>

          {renderTags()}
        </View>

        <Card style={styles.contentCard}>
          {renderContent()}
        </Card>

        {renderRelatedNotes()}
      </ScrollView>

      <View style={[
        styles.actionBar,
        { backgroundColor: colors.card }
      ]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onBack}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.actionGroup}>
          {onEdit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onEdit}
            >
              <Icon name="edit" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Icon name="share" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleExport}
          >
            <Icon name="file-download" size={24} color={colors.text} />
          </TouchableOpacity>

          {onDelete && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onDelete}
            >
              <Icon name="delete" size={24} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  noteTitle: {
    marginBottom: 20,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dateText: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.7,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  tagItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contentCard: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  noteContent: {
    lineHeight: 26,
    fontSize: 16,
  },
  showMoreButton: {
    marginTop: 20,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  relatedNotesContainer: {
    padding: 20,
    paddingTop: 0,
  },
  relatedNotesTitle: {
    marginBottom: 16,
    fontSize: 20,
    fontWeight: '700',
  },
  relatedNoteCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  relatedNoteExcerpt: {
    marginTop: 8,
    lineHeight: 22,
    opacity: 0.8,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  actionGroup: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 10,
    marginHorizontal: 6,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
});

export default NoteDetail;
