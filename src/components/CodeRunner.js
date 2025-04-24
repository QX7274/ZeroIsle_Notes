import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { codeService } from '../services/codeService';
import { analyticsService } from '../services/analytics';

const LANGUAGE_CONFIGS = {
  javascript: {
    inputType: 'text',
    placeholder: '输入参数 (JSON格式)...',
    formatInput: (input) => {
      try {
        return JSON.parse(input);
      } catch (e) {
        return input;
      }
    },
  },
  python: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  java: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  cpp: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  csharp: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  php: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  ruby: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  swift: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  kotlin: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  go: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  rust: {
    inputType: 'text',
    placeholder: '输入参数 (每行一个参数)...',
    formatInput: (input) => input.split('\n'),
  },
  typescript: {
    inputType: 'text',
    placeholder: '输入参数 (JSON格式)...',
    formatInput: (input) => {
      try {
        return JSON.parse(input);
      } catch (e) {
        return input;
      }
    },
  },
};

const CodeRunner = ({ code, language }) => {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState(LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.javascript);

  useEffect(() => {
    setConfig(LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.javascript);
    setInput('');
    setOutput('');
    setError('');
  }, [language]);

  const handleRun = async () => {
    setIsRunning(true);
    setError('');
    setOutput('');

    try {
      const formattedInput = config.formatInput(input);
      const result = await codeService.runCode(code, language, formattedInput);
      setOutput(result.output);
      
      analyticsService.trackCodeAction('run_code', {
        language,
        codeLength: code.length,
        hasInput: input.length > 0,
      });
    } catch (error) {
      setError(error.message);
      analyticsService.trackError(error, { action: 'run_code' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: theme.colors.text }]}>输入:</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.card,
              color: theme.colors.text,
              borderColor: theme.colors.border,
            },
          ]}
          value={input}
          onChangeText={setInput}
          multiline
          placeholder={config.placeholder}
          placeholderTextColor={theme.colors.text + '80'}
        />
      </View>

      <TouchableOpacity
        style={[styles.runButton, { backgroundColor: theme.colors.primary }]}
        onPress={handleRun}
        disabled={isRunning}
      >
        {isRunning ? (
          <ActivityIndicator color={theme.colors.text} />
        ) : (
          <Text style={[styles.runButtonText, { color: theme.colors.text }]}>
            运行代码
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.outputContainer}>
        <Text style={[styles.label, { color: theme.colors.text }]}>输出:</Text>
        <ScrollView style={styles.output}>
          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : (
            <Text style={[styles.outputText, { color: theme.colors.text }]}>
              {output || '无输出'}
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    height: 100,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  runButton: {
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginBottom: 16,
  },
  runButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  outputContainer: {
    flex: 1,
  },
  output: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
  },
  outputText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  error: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default CodeRunner; 