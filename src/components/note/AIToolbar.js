/**
 * AI工具栏组件
 * 提供翻译、代码识别等AI功能
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import axios from 'axios';

// AI工具类型
const AI_TOOLS = [
  { id: 'translate', label: '翻译', icon: 'translate', description: '翻译选中的文本' },
  { id: 'code_recognition', label: '代码识别', icon: 'code', description: '识别并格式化代码' },
  { id: 'summarize', label: '摘要', icon: 'summarize', description: '生成文本摘要' },
  { id: 'extract_keywords', label: '提取关键词', icon: 'key', description: '从文本中提取关键词' },
  { id: 'explain', label: '解释', icon: 'help', description: '解释选中的内容' },
  { id: 'rewrite', label: '改写', icon: 'edit', description: '改写选中的文本' },
];

const AIToolbar = ({ onToolSelect, selectedText, onProcessResult }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  
  // 状态
  const [showToolModal, setShowToolModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
      if (result && result.success) {
        onProcessResult(result.data, tool.id);
      } else {
        throw new Error(result.message || '处理失败');
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
      // 构建请求参数
      const params = {
        text,
        tool: toolId,
      };
      
      // 调用API
      const response = await axios.post('/api/ai/process', params);
      
      return response.data;
    } catch (error) {
      console.error('AI处理请求失败:', error);
      throw error;
    }
  };
  
  // 渲染工具按钮
  const renderToolButtons = () => {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsContainer}
      >
        {AI_TOOLS.map(tool => (
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
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderToolButtons()}
      {renderToolModal()}
      {renderLoader()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  toolsContainer: {
    paddingHorizontal: 16,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  toolButtonText: {
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  gridToolButton: {
    width: '46%',
    margin: '2%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  gridToolText: {
    marginTop: 8,
    textAlign: 'center',
  },
  gridToolDescription: {
    marginTop: 4,
    textAlign: 'center',
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
  },
  loaderContent: {
    padding: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loaderText: {
    marginLeft: 16,
  },
});

export default AIToolbar;
