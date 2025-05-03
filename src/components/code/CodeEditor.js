import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { analyticsService } from '../../services/analytics';

const CodeEditor = ({ initialCode = '', language = 'javascript', onCodeChange, onLanguageChange, readOnly = false }) => {
  const [code, setCode] = useState(initialCode);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [lineNumbers, setLineNumbers] = useState([]);

  useEffect(() => {
    updateLineNumbers(initialCode);
  }, [initialCode]);

  const updateLineNumbers = (text) => {
    const lines = text.split('\n');
    setLineNumbers(Array.from({ length: lines.length }, (_, i) => i + 1));
  };

  const handleCodeChange = (text) => {
    setCode(text);
    updateLineNumbers(text);
    if (onCodeChange) {
      onCodeChange(text);
    }
    analyticsService.trackCodeAction('edit_code', { language: selectedLanguage });
  };

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    analyticsService.trackCodeAction('change_language', { language: lang });
  };

  const handleCopy = () => {
    // 复制代码到剪贴板
    analyticsService.trackCodeAction('copy_code', { language: selectedLanguage });
  };

  const handleFormat = () => {
    // 格式化代码
    analyticsService.trackCodeAction('format_code', { language: selectedLanguage });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>代码编辑器</Text>
        <Picker
          selectedValue={selectedLanguage}
          style={styles.languagePicker}
          onValueChange={handleLanguageChange}
          enabled={!readOnly}
        >
          <Picker.Item label="JavaScript" value="javascript" />
          <Picker.Item label="Python" value="python" />
          <Picker.Item label="Java" value="java" />
          <Picker.Item label="C++" value="cpp" />
          <Picker.Item label="HTML" value="html" />
          <Picker.Item label="CSS" value="css" />
          <Picker.Item label="SQL" value="sql" />
        </Picker>
      </View>

      <View style={styles.editorContainer}>
        <View style={styles.lineNumbers}>
          {lineNumbers.map((num) => (
            <Text key={num} style={styles.lineNumber}>
              {num}
            </Text>
          ))}
        </View>
        <ScrollView style={styles.codeScrollView}>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={handleCodeChange}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            editable={!readOnly}
          />
        </ScrollView>
      </View>

      {!readOnly && (
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleCopy}>
            <Text style={styles.toolbarButtonText}>复制</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleFormat}>
            <Text style={styles.toolbarButtonText}>格式化</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
    margin: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  languagePicker: {
    width: 150,
    color: '#fff',
    backgroundColor: '#444',
  },
  editorContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
  },
  lineNumbers: {
    width: 40,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#252525',
  },
  lineNumber: {
    color: '#858585',
    fontSize: 12,
    lineHeight: 20,
  },
  codeScrollView: {
    flex: 1,
  },
  codeInput: {
    flex: 1,
    color: '#d4d4d4',
    fontSize: 14,
    fontFamily: 'monospace',
    padding: 8,
    lineHeight: 20,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: '#333',
  },
  toolbarButton: {
    backgroundColor: '#007acc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 8,
  },
  toolbarButtonText: {
    color: '#fff',
    fontSize: 12,
  },
});

export default CodeEditor;
