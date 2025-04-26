import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';
import { codeService } from '../services/codeService';
import { analyticsService } from '../services/analytics';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

const SUPPORTED_LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
  { id: 'csharp', name: 'C#' },
  { id: 'php', name: 'PHP' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'swift', name: 'Swift' },
  { id: 'kotlin', name: 'Kotlin' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
  { id: 'typescript', name: 'TypeScript' },
];

const CodeEditor = ({
  initialCode = '',
  initialLanguage = 'javascript',
  onCodeChange,
  onLanguageChange,
  readOnly = false,
}) => {
  const { theme } = useTheme();
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(initialLanguage);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    analyticsService.trackCodeAction('open_editor', {
      language,
      codeLength: code.length,
    });
  }, []);

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    onLanguageChange?.(newLanguage);

    analyticsService.trackCodeAction('change_language', {
      fromLanguage: language,
      toLanguage: newLanguage,
    });
  };

  const handleCodeChange = async (text) => {
    setCode(text);
    onCodeChange?.(text);

    // 检测代码并获取建议
    try {
      const result = await codeService.detectCode(text, language);
      if (result.suggestions) {
        setSuggestions(result.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('获取代码建议错误:', error);
    }
  };

  const handleCursorPosition = (event) => {
    setCursorPosition(event.nativeEvent.selection.start);
  };

  const handleSuggestionSelect = async (suggestion) => {
    try {
      const completedCode = await codeService.completeCode(code, language);
      setCode(completedCode);
      setShowSuggestions(false);

      analyticsService.trackCodeAction('use_suggestion', {
        language,
        suggestionType: suggestion.type,
      });
    } catch (error) {
      console.error('应用建议错误:', error);
    }
  };

  const handleFormat = async () => {
    try {
      const formattedCode = await codeService.formatCode(code, language);
      setCode(formattedCode);

      analyticsService.trackCodeAction('format_code', {
        language,
        codeLength: code.length,
      });
    } catch (error) {
      console.error('格式化代码错误:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.toolbar}>
        <View style={styles.languageSelector}>
          <Text style={[styles.label, { color: theme.colors.text }]}>语言:</Text>
          <Picker
            selectedValue={language}
            style={[styles.picker, { color: theme.colors.text }]}
            onValueChange={handleLanguageChange}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Picker.Item
                key={lang.id}
                label={lang.name}
                value={lang.id}
                color={theme.colors.text}
              />
            ))}
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleFormat}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>
            格式化
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.editorContainer}>
        <SyntaxHighlighter
          language={language}
          style={docco}
          customStyle={{
            padding: 16,
            margin: 0,
            backgroundColor: theme.colors.background,
          }}
        >
          {code}
        </SyntaxHighlighter>

        {!readOnly && (
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: 'transparent',
                backgroundColor: 'transparent',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              },
            ]}
            multiline
            value={code}
            onChangeText={handleCodeChange}
            onSelectionChange={handleCursorPosition}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        )}
      </ScrollView>

      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestions, { backgroundColor: theme.colors.card }]}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleSuggestionSelect(suggestion)}
            >
              <Text style={[styles.suggestionText, { color: theme.colors.text }]}>
                {suggestion.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    marginRight: 8,
    fontSize: 14,
  },
  picker: {
    width: 120,
    height: 40,
  },
  button: {
    padding: 8,
    borderRadius: 4,
  },
  buttonText: {
    fontSize: 14,
  },
  editorContainer: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: 16,
  },
  suggestions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  suggestionText: {
    fontSize: 14,
  },
});

export default CodeEditor;