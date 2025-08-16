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
  onFileSelect,
  navigation,
  visible = true,
  compact = false // 新增紧凑模式参数
}) => {
  const { colors } = useTheme();
  const [history, setHistory] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const handleFileSelect = (file) => {
    if (file.id === currentFileId) {
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
    const { type, uri, title, fileName, id } = file;
    
    let screenName = 'PDFViewer'; // 默认
    
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

    navigation.navigate(screenName, {
      uri,
      title,
      fileName,
      noteId: id,
      type,
      fromFileHistory: true // 标识从文件历史进入
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

  const getFileColor = (type) => {
    switch (type) {
      case 'pdf':
        return '#D32F2F';
      case 'word':
      case 'doc':
      case 'docx':
        return '#1976D2';
      case 'powerpoint':
      case 'ppt':
      case 'pptx':
        return '#FF6F00';
      case 'markdown':
      case 'md':
        return '#388E3C';
      default:
        return colors.onSurfaceVariant;
    }
  };

  const truncateFileName = (name, maxLength = 15) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  if (!visible || history.length === 0) {
    return null;
  }

  const displayHistory = isExpanded ? history : history.slice(0, 5);

  return (
    <View style={[
      compact ? styles.compactContainer : styles.container,
      { backgroundColor: colors.surface }
    ]}>
      <View style={compact ? styles.compactHeader : styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="history" size={compact ? 14 : 16} color={colors.onSurfaceVariant} />
        </View>

        {history.length > 5 && !compact && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Icon
              name={isExpanded ? 'expand-less' : 'expand-more'}
              size={16}
              color={colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {displayHistory.map((file, index) => {
          const isCurrentFile = file.id === currentFileId;
          const fileColor = getFileColor(file.type);
          
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
              <View style={styles.fileContent}>
                <View style={styles.fileHeader}>
                  <Icon 
                    name={getFileIcon(file.type)} 
                    size={16} 
                    color={fileColor} 
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveFile(file.id, file.fileName)}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                  >
                    <Icon name="close" size={12} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
                
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
                  {truncateFileName(file.fileName)}
                </Text>
                
                <Text 
                  style={[
                    styles.fileType,
                    { color: isCurrentFile ? colors.onPrimaryContainer : colors.onSurfaceVariant }
                  ]}
                >
                  {file.type.toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2, // 进一步减少垂直padding
    paddingHorizontal: 6, // 进一步减少水平padding
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2, // 进一步减少间距
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3, // 减少间距
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  expandButton: {
    padding: 2,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 6, // 减少间距
    paddingRight: 6,
  },
  fileItem: {
    width: 70, // 缩小宽度
    height: 50, // 缩小高度
    borderRadius: 6,
    borderWidth: 1,
    padding: 4, // 减少内边距
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
  },
  removeButton: {
    padding: 1,
  },
  fileName: {
    fontSize: 9, // 缩小字体
    textAlign: 'center',
    marginBottom: 1,
    lineHeight: 10,
  },
  fileType: {
    fontSize: 7, // 缩小字体
    textAlign: 'center',
    opacity: 0.7,
  },
  // 紧凑模式样式
  compactContainer: {
    paddingVertical: 1, // 进一步减少垂直内边距
    paddingHorizontal: 4, // 进一步减少水平内边距
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 1, // 进一步减少间距
  },
  compactHeaderTitle: {
    fontSize: 9, // 缩小字体
    fontWeight: '500',
  },
});

export default FileHistoryNavigation;
