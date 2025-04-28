import React, { useState } from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
import runCommunityTests from '../test_api';
import runNotesTests from '../test_notes_api';
import runKnowledgeGraphTests from '../test_knowledge_graph_api';
import runReminderTests from '../test_reminder_api';
import runAiAssistantTests from '../test_ai_assistant_api';
import runSearchTests from '../test_search_api';

/**
 * API测试组件
 * 用于测试前端与后端的API交互
 */
const ApiTestComponent = () => {
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // 重定向控制台输出到组件状态
  const redirectConsole = () => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      setLogs(prevLogs => [...prevLogs, { type: 'log', message }]);
      originalConsoleLog(...args);
    };

    console.error = (...args) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      setLogs(prevLogs => [...prevLogs, { type: 'error', message }]);
      originalConsoleError(...args);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    };
  };

  // 运行社区API测试
  const handleRunCommunityTests = async () => {
    setLogs([]);
    setIsRunning(true);

    const restoreConsole = redirectConsole();

    try {
      await runCommunityTests();
    } catch (error) {
      console.error('社区API测试运行失败:', error);
    } finally {
      restoreConsole();
      setIsRunning(false);
    }
  };

  // 运行笔记API测试
  const handleRunNotesTests = async () => {
    setLogs([]);
    setIsRunning(true);

    const restoreConsole = redirectConsole();

    try {
      await runNotesTests();
    } catch (error) {
      console.error('笔记API测试运行失败:', error);
    } finally {
      restoreConsole();
      setIsRunning(false);
    }
  };

  // 运行知识图谱API测试
  const handleRunKnowledgeGraphTests = async () => {
    setLogs([]);
    setIsRunning(true);

    const restoreConsole = redirectConsole();

    try {
      await runKnowledgeGraphTests();
    } catch (error) {
      console.error('知识图谱API测试运行失败:', error);
    } finally {
      restoreConsole();
      setIsRunning(false);
    }
  };

  // 运行提醒功能API测试
  const handleRunReminderTests = async () => {
    setLogs([]);
    setIsRunning(true);

    const restoreConsole = redirectConsole();

    try {
      await runReminderTests();
    } catch (error) {
      console.error('提醒功能API测试运行失败:', error);
    } finally {
      restoreConsole();
      setIsRunning(false);
    }
  };

  // 运行AI助手API测试
  const handleRunAiAssistantTests = async () => {
    setLogs([]);
    setIsRunning(true);

    const restoreConsole = redirectConsole();

    try {
      await runAiAssistantTests();
    } catch (error) {
      console.error('AI助手API测试运行失败:', error);
    } finally {
      restoreConsole();
      setIsRunning(false);
    }
  };

  // 运行搜索API测试
  const handleRunSearchTests = async () => {
    setLogs([]);
    setIsRunning(true);

    const restoreConsole = redirectConsole();

    try {
      await runSearchTests();
    } catch (error) {
      console.error('搜索API测试运行失败:', error);
    } finally {
      restoreConsole();
      setIsRunning(false);
    }
  };

  // 清除日志
  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API测试</Text>

      <View style={styles.buttonContainer}>
        <View style={styles.buttonRow}>
          <Button
            title="测试社区API"
            onPress={handleRunCommunityTests}
            disabled={isRunning}
          />
          <Button
            title="测试笔记API"
            onPress={handleRunNotesTests}
            disabled={isRunning}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            title="测试知识图谱API"
            onPress={handleRunKnowledgeGraphTests}
            disabled={isRunning}
          />
          <Button
            title="测试提醒API"
            onPress={handleRunReminderTests}
            disabled={isRunning}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            title="测试AI助手API"
            onPress={handleRunAiAssistantTests}
            disabled={isRunning}
          />
          <Button
            title="测试搜索API"
            onPress={handleRunSearchTests}
            disabled={isRunning}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            title="清除日志"
            onPress={handleClearLogs}
            disabled={isRunning}
          />
        </View>
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((log, index) => (
          <Text
            key={index}
            style={[
              styles.logText,
              log.type === 'error' ? styles.errorText : null
            ]}
          >
            {log.message}
          </Text>
        ))}
        {isRunning && (
          <Text style={styles.runningText}>测试运行中...</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logText: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
  errorText: {
    color: 'red',
  },
  runningText: {
    color: 'blue',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ApiTestComponent;
