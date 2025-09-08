import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import fileHistoryService from '../../services/fileHistoryService';

/**
 * 文件历史导航组件
 * 显示最近打开的文件列表，支持快速切换和删除
 */
const FileHistoryNavigation = ({
  currentFileId,
  noteId,
  onFileSelect,
  navigation,
  visible = true
}) => {
  const { colors } = useTheme();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // 加载历史记录
    loadHistory();

    // 添加监听器
    const listener = (newHistory) => {
      setHistory(newHistory);
    };
    fileHistoryService.addListener(listener);

    return () => {
      fileHistoryService.removeListener(listener);
    };
  }, []);

  const loadHistory = () => {
    const historyData = fileHistoryService.getHistory(10); // 显示最近10个文件
    setHistory(historyData);
  };

  // 监听历史记录变化，自动更新显示
  useEffect(() => {
    const listener = (newHistory) => {
      // 确保获取最新的排序结果
      const sortedHistory = fileHistoryService.getHistory(10);
      setHistory(sortedHistory);
    };
    
    fileHistoryService.addListener(listener);
    
    return () => {
      fileHistoryService.removeListener(listener);
    };
  }, []);

  const handleFileSelect = (file) => {
    const effectiveCurrentFileId = currentFileId || noteId;
    if (file.id === effectiveCurrentFileId || file.noteId === effectiveCurrentFileId) {
      return; // 当前文件，不需要切换
    }

    if (onFileSelect) {
      onFileSelect(file);
    } else if (navigation) {
      // 根据文件类型导航到相应的查看器
      navigateToViewer(file);
    }
  };

  const navigateToViewer = (file) => {
    const { type, uri, title, fileName, id, noteType } = file;

    let screenName = 'PDFViewer'; // 默认
    let params = {
      uri,
      title,
      fileName,
      noteId: id,
      type,
      fromFileHistory: true // 标识从文件历史进入
    };

    // 根据文件类型或笔记类型确定导航目标
    if (noteType === 'card') {
      screenName = 'CardNote';
      params = {
        noteId: id,
        title: title || fileName,
        content: '',
        fromFileHistory: true
      };
    } else if (noteType === 'paged_note') {
      screenName = 'FluidPagedNote';
      params = {
        noteId: id,
        title: title || fileName,
        noteStyle: 'blank',
        fromFileHistory: true
      };
    } else if (noteType === 'canvas' || type === 'canvas') {
      screenName = 'InfiniteCanvas';
      params = {
        noteId: id,
        title: title || fileName,
        canvasStyle: 'white',
        fromFileHistory: true
      };
    } else {
      // 文档类型
      switch (type) {
        case 'pdf':
          screenName = 'PDFViewer';
          break;
        case 'word':
        case 'doc':
        case 'docx':
          screenName = 'DocViewer';
          break;
        case 'powerpoint':
        case 'ppt':
        case 'pptx':
          screenName = 'PPTViewer';
          break;
        case 'markdown':
        case 'md':
          screenName = 'MarkdownViewer';
          break;
        default:
          screenName = 'PDFViewer';
      }
    }

    // 导航时重置到主页，然后导航到目标页面
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: screenName, params }
      ],
    });
  };

  const handleRemoveFile = (fileId, fileName) => {
    Alert.alert(
      '移除文件',
      `确定要从历史记录中移除"${fileName}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '移除', 
          style: 'destructive',
          onPress: () => {
            fileHistoryService.removeFile(fileId);
          }
        }
      ]
    );
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return 'picture-as-pdf';
      case 'word':
      case 'doc':
      case 'docx':
        return 'description';
      case 'powerpoint':
      case 'ppt':
      case 'pptx':
        return 'slideshow';
      case 'markdown':
      case 'md':
        return 'notes';
      default:
        return 'insert-drive-file';
    }
  };

  const truncateFileName = (name, maxLength = 15) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  if (!visible || history.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {history.slice(0, 8).map((file) => {
          const effectiveCurrentFileId = currentFileId || noteId;
          const isCurrentFile = file.id === effectiveCurrentFileId || file.noteId === effectiveCurrentFileId;

          return (
            <TouchableOpacity
              key={file.id}
              style={[
                styles.fileItem,
                {
                  backgroundColor: isCurrentFile ? colors.primaryContainer : colors.background,
                  borderColor: isCurrentFile ? colors.primary : colors.outline
                }
              ]}
              onPress={() => handleFileSelect(file)}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveFile(file.id, file.fileName)}
                hitSlop={{ top: 3, bottom: 3, left: 3, right: 3 }}
              >
                <Icon name="close" size={8} color={colors.onSurfaceVariant} />
              </TouchableOpacity>

              <Text
                style={[
                  styles.fileName,
                  {
                    color: isCurrentFile ? colors.onPrimaryContainer : colors.onSurface,
                    fontWeight: isCurrentFile ? '600' : '400'
                  }
                ]}
                numberOfLines={1}
              >
                {truncateFileName(file.fileName || file.title, 10)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    height: 30,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 6,
    paddingRight: 6,
  },
  fileItem: {
    minWidth: 70,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(245, 7, 7, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fileName: {
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 12,
  },
});

export default FileHistoryNavigation;
