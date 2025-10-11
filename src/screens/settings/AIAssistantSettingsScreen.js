import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import AIAssistantModule from '../../native/AIAssistantModule';
// 使用MongoDB替代AsyncStorage
import realmService from '../../services/database/realmService';

// 存储键
const STORAGE_KEYS = {
  AI_ENGINE: 'ai_engine',
  BAIDU_API_KEY: 'baidu_api_key',
  BAIDU_SECRET_KEY: 'baidu_secret_key',
};

const AIAssistantSettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [aiEngine, setAiEngine] = useState(AIAssistantModule.ENGINE_BAIDU);
  const [baiduApiKey, setBaiduApiKey] = useState('');
  const [baiduSecretKey, setBaiduSecretKey] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configStatus, setConfigStatus] = useState('');

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  // 加载保存的设置
  const loadSettings = async () => {
    try {
      // 从MongoDB获取AI助手设置
      const aiSettings = await realmService.findOne('ai_settings', { type: 'assistant_config' });

      if (aiSettings) {
        if (aiSettings.engine) {
          setAiEngine(aiSettings.engine);
        }

        if (aiSettings.baidu_api_key) {
          setBaiduApiKey(aiSettings.baidu_api_key);
        }

        if (aiSettings.baidu_secret_key) {
          setBaiduSecretKey(aiSettings.baidu_secret_key);
        }
      }
    } catch (error) {
      console.error('加载AI助手设置失败:', error);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    try {
      // 保存到MongoDB
      // 查找现有设置
      const existingSettings = await realmService.findOne('ai_settings', { type: 'assistant_config' });

      if (existingSettings) {
        // 更新现有设置
        await realmService.update('ai_settings', existingSettings._id, {
          engine: aiEngine,
          baidu_api_key: baiduApiKey,
          baidu_secret_key: baiduSecretKey,
          updated_at: new Date()
        });
      } else {
        // 创建新设置
        await realmService.create('ai_settings', {
          _id: new Realm.BSON.ObjectId().toHexString(),
          type: 'assistant_config',
          engine: aiEngine,
          baidu_api_key: baiduApiKey,
          baidu_secret_key: baiduSecretKey,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      Alert.alert('成功', '设置已保存');
    } catch (error) {
      console.error('保存AI助手设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  // 配置百度AI
  const configureBaiduAI = async () => {
    if (!baiduApiKey || !baiduSecretKey) {
      Alert.alert('错误', '请输入百度AI的API密钥和Secret密钥');
      return;
    }

    setIsConfiguring(true);
    setConfigStatus('正在配置百度AI...');

    try {
      const result = await AIAssistantModule.configureBaiduAI({
        apiKey: baiduApiKey,
        secretKey: baiduSecretKey,
      });

      setConfigStatus('配置成功！访问令牌已获取。');
      setAiEngine(AIAssistantModule.ENGINE_BAIDU);

      // 更新Realm中的引擎设置
      // 查找现有设置
      const existingSettings = await realmService.findOne('ai_settings', { type: 'assistant_config' });

      if (existingSettings) {
        // 更新现有设置
        await realmService.update('ai_settings', existingSettings._id, {
          engine: AIAssistantModule.ENGINE_BAIDU,
          updated_at: new Date()
        });
      } else {
        // 创建新设置
        await realmService.create('ai_settings', {
          _id: new Realm.BSON.ObjectId().toHexString(),
          type: 'assistant_config',
          engine: AIAssistantModule.ENGINE_BAIDU,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      Alert.alert('成功', '百度AI配置成功');
    } catch (error) {
      console.error('配置百度AI失败:', error);
      setConfigStatus(`配置失败: ${error.message}`);
      Alert.alert('错误', `配置百度AI失败: ${error.message}`);
    } finally {
      setIsConfiguring(false);
    }
  };

  // 测试AI助手
  const testAIAssistant = async () => {
    try {
      const result = await AIAssistantModule.sendMessage('你好，请介绍一下你自己', aiEngine);
      Alert.alert('AI助手回复', result.text);
    } catch (error) {
      console.error('测试AI助手失败:', error);
      Alert.alert('错误', `测试AI助手失败: ${error.message}`);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>AI助手设置</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>AI引擎选择</Text>



        <View style={styles.option}>
          <Text style={[styles.optionText, { color: theme.colors.text }]}>使用百度AI引擎</Text>
          <Switch
            value={aiEngine === AIAssistantModule.ENGINE_BAIDU}
            onValueChange={(value) => {
              if (value) {
                if (!baiduApiKey || !baiduSecretKey) {
                  Alert.alert('提示', '请先配置百度AI密钥');
                  return;
                }
                setAiEngine(AIAssistantModule.ENGINE_BAIDU);
              }
            }}
            trackColor={{ false: '#767577', true: theme.colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>百度AI配置</Text>

        <Text style={[styles.label, { color: theme.colors.text }]}>API密钥</Text>
        <TextInput
          style={[styles.input, {
            color: theme.colors.text,
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          }]}
          value={baiduApiKey}
          onChangeText={setBaiduApiKey}
          placeholder="输入百度AI的API密钥"
          placeholderTextColor={theme.colors.text + '80'}
        />

        <Text style={[styles.label, { color: theme.colors.text }]}>Secret密钥</Text>
        <TextInput
          style={[styles.input, {
            color: theme.colors.text,
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          }]}
          value={baiduSecretKey}
          onChangeText={setBaiduSecretKey}
          placeholder="输入百度AI的Secret密钥"
          placeholderTextColor={theme.colors.text + '80'}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={configureBaiduAI}
          disabled={isConfiguring}
        >
          {isConfiguring ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>配置百度AI</Text>
          )}
        </TouchableOpacity>

        {configStatus ? (
          <Text style={[styles.statusText, { color: theme.colors.text }]}>
            {configStatus}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={testAIAssistant}
        >
          <Text style={styles.buttonText}>测试AI助手</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary, marginTop: 10 }]}
          onPress={saveSettings}
        >
          <Text style={styles.buttonText}>保存设置</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.note, { color: theme.colors.text }]}>
          注意：百度AI引擎提供高级的对话能力，需要网络连接和API密钥。
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionText: {
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    marginTop: 8,
    fontSize: 14,
  },
  note: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});

export default AIAssistantSettingsScreen;
