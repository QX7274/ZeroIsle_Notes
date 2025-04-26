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
 */
const NoteDetail = ({
  note = {},
  onEdit,
  onDelete,
  onBack,
  relatedNotes = [],
  onRelatedNotePress,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 本地状态
  const [showFullContent, setShowFullContent] = useState(false);
  
  // 处理分享
  const handleShare = async () => {
    try {
      await Share.share({
        title: note.title,
        message: `${note.title}\n\n${note.content}\n\n来自零屿笔记`,
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
    if (!note.tags || note.tags.length === 0) return null;
    
    return (
      <View style={styles.tagsContainer}>
        {note.tags.map(tag => (
          <View
            key={tag.id}
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
              #{tag.name}
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
    if (!note.content) return null;
    
    const contentToShow = showFullContent
      ? note.content
      : note.content.length > 500
        ? `${note.content.substring(0, 500)}...`
        : note.content;
    
    return (
      <>
        <Text
          variant="body"
          size="medium"
          style={styles.noteContent}
        >
          {contentToShow}
        </Text>
        
        {note.content.length > 500 && (
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
            {note.title}
          </Text>
          
          <View style={styles.metaContainer}>
            {note.category && (
              <View style={[
                styles.categoryBadge,
                { backgroundColor: note.category.color || colors.primary }
              ]}>
                <Text
                  variant="body"
                  size="small"
                  color="card"
                >
                  {note.category.name}
                </Text>
              </View>
            )}
            
            <Text
              variant="body"
              size="small"
              color="hint"
              style={styles.dateText}
            >
              {formatDate(note.updated_at || note.created_at)}
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
    padding: 16,
  },
  noteTitle: {
    marginBottom: 16,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  dateText: {
    marginTop: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tagItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  contentCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  noteContent: {
    lineHeight: 24,
  },
  showMoreButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  relatedNotesContainer: {
    padding: 16,
    paddingTop: 0,
  },
  relatedNotesTitle: {
    marginBottom: 12,
  },
  relatedNoteCard: {
    marginBottom: 12,
    padding: 12,
  },
  relatedNoteExcerpt: {
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  actionGroup: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginHorizontal: 4,
  },
});

export default NoteDetail;
