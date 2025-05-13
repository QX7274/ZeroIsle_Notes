/**
 * AI工具栏组件
 * 提供翻译、代码识别等AI功能
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { noteAIService } from '../../services/notes/noteAIService';
import { chatHistoryService as aiHistoryService } from '../../services/ai/chatHistoryService';

// AI工具类型
const AI_TOOLS = [
  { id: 'translate', label: '翻译', icon: 'translate', description: '翻译选中的文本' },
  { id: 'code_recognition', label: '代码识别', icon: 'code', description: '识别并格式化代码' },
  { id: 'math_formula', label: '数学公式', icon: 'functions', description: '识别数学公式并转换为LaTeX' },
  { id: 'summarize', label: '摘要', icon: 'summarize', description: '生成文本摘要' },
  { id: 'extract_keywords', label: '提取关键词', icon: 'key', description: '从文本中提取关键词' },
  { id: 'explain', label: '解释', icon: 'help', description: '解释选中的内容' },
  { id: 'rewrite', label: '改写', icon: 'edit', description: '改写选中的文本' },
  { id: 'grammar', label: '语法检查', icon: 'spellcheck', description: '检查文本的语法和拼写' },
  { id: 'simplify', label: '简化', icon: 'auto-awesome', description: '简化复杂的文本' },
];

const AIToolbar = ({ onToolSelect, selectedText, onProcessResult }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [showToolModal, setShowToolModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([]);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 加载历史记录
  const loadHistory = async () => {
    try {
      const historyItems = await aiHistoryService.getHistory({ limit: 10 });
      setHistory(historyItems);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  };

  // 处理工具选择
  const handleToolSelect = async (tool) => {
    setSelectedTool(tool);
    setShowToolModal(false);

    if (!selectedText) {
      Alert.alert('提示', '请先选择文本');
      return;
    }

    try {
      setIsProcessing(true);

      // 调用AI处理API
      const result = await processWithAI(tool.id, selectedText);

      // 处理结果
      if (result) {
        const outputText = result.result || result.translated_text || result.data;

        // 添加到历史记录
        await aiHistoryService.addHistory({
          tool: tool.id,
          input: selectedText,
          output: outputText,
          timestamp: new Date()
        });

        // 刷新历史记录
        loadHistory();

        // 调用结果处理函数
        onProcessResult(outputText, tool.id);
      } else {
        throw new Error('处理失败，未返回结果');
      }
    } catch (error) {
      console.error(`AI处理失败 (${tool.id}):`, error);
      Alert.alert('处理失败', error.message || '无法处理选中的文本，请稍后重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 使用AI处理文本
  const processWithAI = async (toolId, text) => {
    try {
      let result;

      // 根据工具类型调用不同的API
      switch (toolId) {
        case 'translate':
          result = await noteAIService.translateText(text);
          break;
        case 'code_recognition':
          result = await noteAIService.recognizeCode(text);
          break;
        case 'math_formula':
          result = await noteAIService.recognizeMathFormula(text);
          break;
        case 'summarize':
          result = await noteAIService.summarizeText(text);
          break;
        case 'extract_keywords':
          result = await noteAIService.extractKeywords(text);
          break;
        case 'explain':
          result = await noteAIService.explainText(text);
          break;
        case 'rewrite':
          result = await noteAIService.rewriteText(text);
          break;
        case 'grammar':
        case 'simplify':
        default:
          // 对于其他工具，使用通用处理API
          result = await noteAIService.processText(text, toolId);
          break;
      }

      return result;
    } catch (error) {
      console.error('AI处理请求失败:', error);
      throw error;
    }
  };

  // 渲染工具按钮
  const renderToolButtons = () => {
    // 显示常用工具
    const commonTools = AI_TOOLS.slice(0, 4);

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsContainer}
      >
        {commonTools.map(tool => (
          <TouchableOpacity
            key={tool.id}
            style={[
              styles.toolButton,
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            onPress={() => handleToolSelect(tool)}
          >
            <Icon name={tool.icon} size={20} color={colors.primary} />
            <Text
              variant="body"
              size="small"
              color="text"
              style={styles.toolButtonText}
            >
              {tool.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[
            styles.toolButton,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
          onPress={() => setShowHistoryModal(true)}
        >
          <Icon name="history" size={20} color={colors.textSecondary} />
          <Text
            variant="body"
            size="small"
            color="textSecondary"
            style={styles.toolButtonText}
          >
            历史
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toolButton,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
          onPress={() => setShowToolModal(true)}
        >
          <Icon name="more-horiz" size={20} color={colors.textSecondary} />
          <Text
            variant="body"
            size="small"
            color="textSecondary"
            style={styles.toolButtonText}
          >
            更多
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // 渲染工具选择模态框
  const renderToolModal = () => (
    <Modal
      visible={showToolModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowToolModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">AI工具</Text>
            <TouchableOpacity onPress={() => setShowToolModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.toolGrid}>
            {AI_TOOLS.map(tool => (
              <TouchableOpacity
                key={tool.id}
                style={[
                  styles.gridToolButton,
                  { backgroundColor: colors.background, borderColor: colors.border }
                ]}
                onPress={() => handleToolSelect(tool)}
              >
                <Icon name={tool.icon} size={24} color={colors.primary} />
                <Text
                  variant="body"
                  size="medium"
                  color="text"
                  style={styles.gridToolText}
                >
                  {tool.label}
                </Text>
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={styles.gridToolDescription}
                >
                  {tool.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  // 渲染加载指示器
  const renderLoader = () => {
    if (isProcessing) {
      return (
        <View style={[styles.loaderContainer, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
          <View style={[styles.loaderContent, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              color="text"
              style={styles.loaderText}
            >
              正在处理...
            </Text>
          </View>
        </View>
      );
    }
    return null;
  };

  // 处理历史记录项点击
  const handleHistoryItemPress = (item) => {
    // 关闭历史记录模态框
    setShowHistoryModal(false);

    // 调用结果处理函数
    onProcessResult(item.output, item.tool);
  };

  // 渲染历史记录模态框
  const renderHistoryModal = () => (
    <Modal
      visible={showHistoryModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowHistoryModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">历史记录</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon name="history" size={48} color={colors.textSecondary} />
              <Text
                variant="body"
                size="medium"
                color="textSecondary"
                style={styles.emptyHistoryText}
              >
                暂无历史记录
              </Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.historyItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleHistoryItemPress(item)}
                >
                  <View style={styles.historyItemHeader}>
                    <View style={styles.historyItemTool}>
                      <Icon
                        name={AI_TOOLS.find(tool => tool.id === item.tool)?.icon || 'psychology'}
                        size={16}
                        color={colors.primary}
                      />
                      <Text
                        variant="body"
                        size="small"
                        color="primary"
                        style={styles.historyItemToolText}
                      >
                        {AI_TOOLS.find(tool => tool.id === item.tool)?.label || item.tool}
                      </Text>
                    </View>
                    <Text
                      variant="caption"
                      color="textSecondary"
                    >
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </View>

                  <Text
                    variant="body"
                    size="small"
                    color="textSecondary"
                    numberOfLines={1}
                    style={styles.historyItemInput}
                  >
                    输入: {item.input}
                  </Text>

                  <Text
                    variant="body"
                    size="small"
                    color="text"
                    numberOfLines={2}
                    style={styles.historyItemOutput}
                  >
                    {item.output}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.historyList}
            />
          )}

          {history.length > 0 && (
            <TouchableOpacity
              style={[styles.clearHistoryButton, { backgroundColor: colors.error }]}
              onPress={async () => {
                await aiHistoryService.clearHistory();
                loadHistory();
              }}
            >
              <Icon name="delete" size={16} color="#fff" />
              <Text
                variant="body"
                size="small"
                color="white"
                style={styles.clearHistoryButtonText}
              >
                清除历史记录
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderToolButtons()}
      {renderToolModal()}
      {renderHistoryModal()}
      {renderLoader()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  toolsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toolButtonText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  gridToolButton: {
    width: '46%',
    margin: '2%',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  gridToolText: {
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 15,
  },
  gridToolDescription: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loaderContent: {
    padding: 24,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loaderText: {
    marginLeft: 20,
    fontSize: 16,
    fontWeight: '500',
  },
  // 历史记录样式
  historyList: {
    maxHeight: 450,
  },
  historyItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyItemTool: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(67, 97, 238, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyItemToolText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  historyItemInput: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  historyItemOutput: {
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
  },
  emptyHistory: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
  },
  clearHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    margin: 16,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  clearHistoryButtonText: {
    marginLeft: 10,
    fontWeight: '600',
  },
});

export default AIToolbar;
