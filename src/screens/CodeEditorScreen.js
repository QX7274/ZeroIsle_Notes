import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { CodeEditor, CodeRunner } from '../components/code';
import { analyticsService } from '../services/analytics';

const CodeEditorScreen = () => {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [showRunner, setShowRunner] = useState(false);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    analyticsService.trackCodeAction('edit_code', {
      language,
      codeLength: newCode.length,
    });
  };

  const toggleRunner = () => {
    setShowRunner(!showRunner);
    analyticsService.trackCodeAction('toggle_runner', {
      isVisible: !showRunner,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          代码编辑器
        </Text>
        <TouchableOpacity
          style={[styles.runnerButton, { backgroundColor: theme.colors.primary }]}
          onPress={toggleRunner}
        >
          <Text style={[styles.runnerButtonText, { color: theme.colors.text }]}>
            {showRunner ? '隐藏运行器' : '显示运行器'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.editorContainer}>
        <CodeEditor
          initialCode={code}
          language={language}
          onCodeChange={handleCodeChange}
        />
      </View>

      {showRunner && (
        <View style={styles.runnerContainer}>
          <CodeRunner code={code} language={language} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  runnerButton: {
    padding: 8,
    borderRadius: 4,
  },
  runnerButtonText: {
    fontSize: 14,
  },
  editorContainer: {
    flex: 1,
  },
  runnerContainer: {
    height: '40%',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
});

export default CodeEditorScreen;