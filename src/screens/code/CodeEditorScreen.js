import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { CodeEditor, CodeRunner } from '../../components/code';
import { analyticsService } from '../../services/analytics/analyticsService';

const CodeEditorScreen = () => {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [showRunner, setShowRunner] = useState(false);
  const [isTogglingRunner, setIsTogglingRunner] = useState(false);
  const toggleRunnerTimerRef = useRef(null);
  const codeState = isTogglingRunner ? 'busy' : 'ready';

  useEffect(() => () => {
    if (toggleRunnerTimerRef.current) {
      clearTimeout(toggleRunnerTimerRef.current);
      toggleRunnerTimerRef.current = null;
    }
  }, []);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    analyticsService.trackCodeAction('edit_code', {
      language,
      codeLength: newCode.length,
    });
  };

  const toggleRunner = () => {
    if (isTogglingRunner) {return;}
    setIsTogglingRunner(true);
    setShowRunner((prev) => !prev);
    analyticsService.trackCodeAction('toggle_runner', {
      isVisible: !showRunner,
    });
    if (toggleRunnerTimerRef.current) {
      clearTimeout(toggleRunnerTimerRef.current);
    }
    toggleRunnerTimerRef.current = setTimeout(() => {
      setIsTogglingRunner(false);
      toggleRunnerTimerRef.current = null;
    }, 180);
  };

  const handleToggleRunner = () => {
    if (isTogglingRunner) {return;}
    toggleRunner();
  };

  return (
    <View style={[styles.container, { backgroundColor: '#F4FAFF' }]} testID="screen.codeEditor">
      <View testID={`state.code.editor.state.${codeState}`} />
      <View testID={`state.code.runner.visibility.${showRunner ? 'visible' : 'hidden'}`} />
      <View testID={`state.code.runner.toggling.visibility.${isTogglingRunner ? 'visible' : 'hidden'}`} />
      <View
        style={[
          styles.header,
          {
            backgroundColor: `${theme.colors.card}E0`,
            borderBottomColor: 'rgba(33,150,243,0.18)',
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          代码编辑器
        </Text>
        <TouchableOpacity
          style={[
            styles.runnerButton,
            {
              backgroundColor: isTogglingRunner ? `${theme.colors.primary}99` : `${theme.colors.primary}DB`,
            },
          ]}
          onPress={handleToggleRunner}
          disabled={isTogglingRunner}
          testID="action.code.toggleRunner"
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
    borderBottomColor: 'rgba(33,150,243,0.18)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  runnerButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
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
    borderTopColor: 'rgba(33,150,243,0.18)',
  },
});

export default CodeEditorScreen;
