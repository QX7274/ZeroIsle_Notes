import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  Text, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { updateNote } from '../../redux/slices/notesSlice';
import { offlineStorageService } from '../../services/offline';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import FileHistoryNavigation from '../../components/viewer/FileHistoryNavigation';
import fileHistoryService from '../../services/fileHistoryService';
import CheckboxTextInput from '../../components/note/CheckboxTextInput';
import Icon from 'react-native-vector-icons/MaterialIcons';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';

/**
 * 卡片笔记屏幕
 * 类似备忘录的简单文本编辑界面
 * 支持语音转文字、会议纪要等功能
 */
const CardNoteScreen = ({ route, navigation }) => {
  const { noteId, title: initialTitle = '新建笔记', content: initialContent = '' } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const { width: screenWidth } = Dimensions.get('window');
  
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  
  const contentInputRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);

  // 组件加载时恢复笔记数据
  useEffect(() => {
    const loadNote = async () => {
      if (noteId) {
        try {
          console.log('CardNoteScreen: 尝试加载笔记:', noteId);
          const savedNote = await offlineStorageService.getNote(noteId);
          if (savedNote) {
            console.log('CardNoteScreen: 成功加载笔记:', savedNote);
            setTitle(savedNote.title || '无标题');
            setContent(savedNote.content || '');
            setWordCount(savedNote.word_count || 0);
          } else {
            console.log('CardNoteScreen: 未找到保存的笔记，使用初始值');
          }
        } catch (error) {
          console.error('CardNoteScreen: 加载笔记失败:', error);
        }
      }
    };

    loadNote();
  }, [noteId]);

  useEffect(() => {
    // 计算字数
    const count = content.replace(/\s/g, '').length;
    setWordCount(count);

    // 自动保存（仅在有内容变化时）
    if (content.trim() || title.trim()) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        saveNote();
      }, 2000); // 2秒后自动保存
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content]);

  const saveNote = async () => {
    try {
      // 如果没有内容，不保存
      if (!content.trim() && !title.trim()) {
        return { success: true };
      }

      const currentNoteId = noteId || `card_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const noteData = {
        _id: currentNoteId,
        id: currentNoteId,
        title: title || '无标题',
        content,
        type: 'card',
        noteType: 'card', // 添加noteType字段
        file_type: 'card',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        word_count: wordCount,
        is_deleted: false,
        is_synced: false,
        is_offline: true, // 标记为离线笔记
        user_id: 'current_user'
      };

      console.log('CardNoteScreen: 开始保存笔记:', noteData);
      await offlineStorageService.saveNote(noteData);
      dispatch(updateNote(noteData));

      console.log('CardNoteScreen: 笔记保存成功');
      return { success: true };
    } catch (error) {
      console.error('CardNoteScreen: 笔记保存失败:', error);
      throw error;
    }
  };

  const handleStartRecording = () => {
    Alert.alert(
      '语音转文字',
      '语音转文字功能正在开发中，敬请期待！',
      [{ text: '确定', style: 'default' }]
    );
  };

  const handleExportNote = () => {
    Alert.alert(
      '导出笔记',
      '选择导出格式',
      [
        { text: '取消', style: 'cancel' },
        { text: '纯文本', onPress: () => exportAsText() },
        { text: 'Markdown', onPress: () => exportAsMarkdown() },
        { text: '分享', onPress: () => shareNote() }
      ]
    );
  };

  const exportAsText = () => {
    // 导出为纯文本功能
    Alert.alert('提示', '纯文本导出功能正在开发中');
  };

  const exportAsMarkdown = () => {
    // 导出为Markdown功能
    Alert.alert('提示', 'Markdown导出功能正在开发中');
  };

  const shareNote = () => {
    // 分享笔记功能
    Alert.alert('提示', '分享功能正在开发中');
  };

  const handleFormatText = (format) => {
    const selection = contentInputRef.current?.selection || { start: 0, end: 0 };
    const beforeText = content.substring(0, selection.start);
    const selectedText = content.substring(selection.start, selection.end);
    const afterText = content.substring(selection.end);

    let formattedText = selectedText;

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'heading':
        formattedText = `# ${selectedText}`;
        break;
      case 'bullet':
        formattedText = `• ${selectedText}`;
        break;
      case 'number':
        formattedText = `1. ${selectedText}`;
        break;
      default:
        break;
    }

    setContent(beforeText + formattedText + afterText);
  };

  const handleMeetingNotes = () => {
    const meetingTemplate = `会议纪要
时间：${new Date().toLocaleString()}
参会人员：
会议主题：
会议内容：
1. 
2. 
3. 

待办事项：
□ 
□ 
□ 

下次会议时间：
`;
    setContent(content + '\n\n' + meetingTemplate);
    setShowToolbar(false);
  };

  const handleInsertTemplate = (template) => {
    let templateText = '';

    switch (template) {
      case 'todo':
        templateText = `📋 待办清单
□
□
□
□

完成情况：0/4`;
        break;
      case 'diary':
        templateText = `📖 日记 - ${new Date().toLocaleDateString()}

🌤️ 今天的心情：
📝 今天做了什么：
💡 今天学到了什么：
🎯 明天的计划：
⭐ 今日亮点：`;
        break;
      case 'idea':
        templateText = `💡 创意想法
⏰ 时间：${new Date().toLocaleString()}
🎯 想法描述：

📊 可行性分析：
✅ 下一步行动：
🔗 相关资源：`;
        break;
      case 'reading':
        templateText = `📚 读书笔记
📖 书名：
✍️ 作者：
📅 阅读日期：${new Date().toLocaleDateString()}

🔑 核心观点：
💭 个人感悟：
📝 重要摘录：
⭐ 评分：/10`;
        break;
      case 'project':
        templateText = `🚀 项目规划
📋 项目名称：
🎯 项目目标：
📅 开始时间：${new Date().toLocaleDateString()}
⏰ 预计完成：

📝 主要任务：
□
□
□

🎯 里程碑：
📊 进度跟踪：0%`;
        break;
      case 'review':
        templateText = `🔄 周/月回顾
📅 回顾期间：${new Date().toLocaleDateString()}

✅ 完成的事情：
•
•
•

❌ 未完成的事情：
•
•

💡 经验教训：
🎯 下期目标：`;
        break;
      default:
        break;
    }

    setContent(content + '\n\n' + templateText);
    setShowToolbar(false);
  };

  const renderToolbar = () => (
    <View style={[styles.toolbar, { backgroundColor: colors.surface }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity 
          style={[styles.toolButton, { backgroundColor: colors.primary }]}
          onPress={handleStartRecording}
        >
          <Icon name="mic" size={20} color={colors.onPrimary} />
          <Text style={[styles.toolButtonText, { color: colors.onPrimary }]}>语音转文字</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.toolButton, { backgroundColor: colors.secondary }]}
          onPress={handleMeetingNotes}
        >
          <Icon name="event-note" size={20} color={colors.onSecondary} />
          <Text style={[styles.toolButtonText, { color: colors.onSecondary }]}>会议纪要</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toolButton, { backgroundColor: '#4CAF50' }]}
          onPress={() => handleInsertTemplate('todo')}
        >
          <Icon name="check-box" size={20} color="white" />
          <Text style={[styles.toolButtonText, { color: 'white' }]}>待办清单</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, { backgroundColor: '#FF9800' }]}
          onPress={() => handleInsertTemplate('diary')}
        >
          <Icon name="book" size={20} color="white" />
          <Text style={[styles.toolButtonText, { color: 'white' }]}>日记模板</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, { backgroundColor: '#9C27B0' }]}
          onPress={() => handleInsertTemplate('idea')}
        >
          <Icon name="lightbulb-outline" size={20} color="white" />
          <Text style={[styles.toolButtonText, { color: 'white' }]}>创意想法</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, { backgroundColor: '#607D8B' }]}
          onPress={() => handleInsertTemplate('reading')}
        >
          <Icon name="library-books" size={20} color="white" />
          <Text style={[styles.toolButtonText, { color: 'white' }]}>读书笔记</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, { backgroundColor: '#795548' }]}
          onPress={() => handleInsertTemplate('project')}
        >
          <Icon name="assignment" size={20} color="white" />
          <Text style={[styles.toolButtonText, { color: 'white' }]}>项目规划</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, { backgroundColor: '#009688' }]}
          onPress={() => handleInsertTemplate('review')}
        >
          <Icon name="rate-review" size={20} color="white" />
          <Text style={[styles.toolButtonText, { color: 'white' }]}>周期回顾</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ViewerLayout
        colors={colors}
        title={title}
        noteId={noteId}
        navigation={navigation}
        showHistoryNavigation={true}
        onBack={() => {
          saveNote();
          navigation.goBack();
        }}
        showToolbar={true}
        headerLeft={
          <BackButton
            onPress={() => {
              saveNote();
              navigation.goBack();
            }}
            color={colors.primary}
            background={colors.primary + '20'}
          />
        }
        headerRight={
          <View style={styles.headerRight}>
            <SaveButton
              onSave={saveNote}
              text="保存"
              showSuccessToast={true}
              showErrorAlert={true}
              style={styles.saveButton}
            />
            <Text style={[styles.wordCount, { color: colors.onSurface }]}>
              {wordCount} 字
            </Text>
          </View>
        }
      >
        <View style={styles.content}>
          {/* 标题输入 */}
          <TextInput
            style={[styles.titleInput, { 
              color: colors.onSurface, 
              borderBottomColor: colors.outline 
            }]}
            value={title}
            onChangeText={setTitle}
            placeholder="输入标题..."
            placeholderTextColor={colors.onSurfaceVariant}
            fontSize={20}
            fontWeight="bold"
            multiline={false}
            returnKeyType="next"
            onSubmitEditing={() => contentInputRef.current?.focus()}
          />
          
          {/* 工具栏 */}
          {showToolbar && renderToolbar()}
          
          {/* 内容输入 */}
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <CheckboxTextInput
              value={content}
              onChangeText={setContent}
              placeholder="开始输入内容..."
              style={[styles.contentInput, {
                color: colors.onSurface,
                minHeight: screenWidth * 0.8 // 确保有足够的输入空间
              }]}
              multiline
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
            />
          </ScrollView>
        </View>

        {/* 底部浮动工具栏 */}
        <View style={[styles.floatingToolbar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.secondary }]}
            onPress={handleExportNote}
          >
            <Icon name="share" size={16} color={colors.onSecondary} />
            <Text style={[styles.buttonText, { color: colors.onSecondary }]}>导出</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.primary }]}
            onPress={() => {/* TODO: 实现语音转文字功能 */}}
          >
            <Icon name="mic" size={16} color={colors.onPrimary} />
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>语音</Text>
          </TouchableOpacity>
        </View>
      </ViewerLayout>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveButton: {
    // 保存按钮样式
  },
  wordCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  exportButton: {
    padding: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  toolbarToggle: {
    padding: 8,
    borderRadius: 20,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  toolbar: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    gap: 6,
  },
  toolButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentScroll: {
    flex: 1,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  floatingToolbar: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default CardNoteScreen;
