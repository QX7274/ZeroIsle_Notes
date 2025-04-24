import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  TextSelectionChangeEventData,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { aiService } from '../services/aiService';
import { audioService } from '../services/audioService';
import MindMap from './MindMap';
import KnowledgeGraph from './KnowledgeGraph';

const NoteToolbar = ({ content, onContentChange }) => {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translation, setTranslation] = useState('');
  const [targetLang, setTargetLang] = useState('en');
  const [selectedText, setSelectedText] = useState('');
  const [showMindMap, setShowMindMap] = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [mindMapData, setMindMapData] = useState(null);
  const [knowledgeGraphData, setKnowledgeGraphData] = useState(null);

  const handleTextSelectionChange = (event: TextSelectionChangeEventData) => {
    const { selection } = event.nativeEvent;
    if (selection) {
      const start = selection.start;
      const end = selection.end;
      if (start !== end) {
        setSelectedText(content.substring(start, end));
      } else {
        setSelectedText('');
      }
    }
  };

  const handleStartRecording = async () => {
    try {
      await audioService.startRecording();
      setIsRecording(true);
    } catch (error) {
      Alert.alert('错误', '开始录音失败');
    }
  };

  const handleStopRecording = async () => {
    try {
      const uri = await audioService.stopRecording();
      const text = await audioService.transcribeAudio(uri);
      onContentChange(content + '\n' + text);
      setIsRecording(false);
    } catch (error) {
      Alert.alert('错误', '录音转文字失败');
    }
  };

  const handleTranslate = async (text) => {
    try {
      const translated = await aiService.translateText(text, targetLang);
      setTranslation(translated);
      setShowTranslation(true);
    } catch (error) {
      Alert.alert('错误', '翻译失败');
    }
  };

  const handleGenerateMindMap = async () => {
    try {
      const data = await aiService.generateMindMap(content);
      setMindMapData(data);
      setShowMindMap(true);
    } catch (error) {
      Alert.alert('错误', '生成思维导图失败');
    }
  };

  const handleCheckContent = async () => {
    try {
      const result = await aiService.checkContent(content);
      Alert.alert('检查结果', JSON.stringify(result));
    } catch (error) {
      Alert.alert('错误', '内容检查失败');
    }
  };

  const handleSummarize = async () => {
    try {
      const summary = await aiService.summarizeText(content);
      Alert.alert('总结', summary);
    } catch (error) {
      Alert.alert('错误', '生成总结失败');
    }
  };

  const handleGenerateKnowledgeGraph = async () => {
    try {
      const data = await aiService.generateKnowledgeGraph(content);
      setKnowledgeGraphData(data);
      setShowKnowledgeGraph(true);
    } catch (error) {
      Alert.alert('错误', '生成知识图谱失败');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
        >
          <Icon
            name={isRecording ? 'stop-circle' : 'mic'}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => handleTranslate(selectedText || content)}
        >
          <Icon name="language" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleGenerateMindMap}
        >
          <Icon name="git-network" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleCheckContent}
        >
          <Icon name="checkmark-circle" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleSummarize}
        >
          <Icon name="document-text" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleGenerateKnowledgeGraph}
        >
          <Icon name="analytics" size={24} color="#fff" />
        </TouchableOpacity>
      </ScrollView>

      <TextInput
        style={[styles.input, { color: theme.text }]}
        value={content}
        onChangeText={onContentChange}
        multiline
        onSelectionChange={handleTextSelectionChange}
      />

      <Modal
        visible={showTranslation}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTranslation(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>翻译结果</Text>
            <Text style={[styles.translation, { color: theme.text }]}>{translation}</Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowTranslation(false)}
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMindMap}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMindMap(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>思维导图</Text>
            <MindMap data={mindMapData} />
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowMindMap(false)}
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showKnowledgeGraph}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKnowledgeGraph(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>知识图谱</Text>
            <KnowledgeGraph data={knowledgeGraphData} />
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowKnowledgeGraph(false)}
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  input: {
    minHeight: 100,
    padding: 8,
    marginTop: 8,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 16,
    borderRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  translation: {
    fontSize: 16,
    marginBottom: 16,
  },
  closeButton: {
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default NoteToolbar; 