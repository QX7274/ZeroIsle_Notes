import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AIAssistantModule from '../native/AIAssistantModule';

// 存储键
const STORAGE_KEYS = {
  AI_ENGINE: 'ai_engine',
  AI_MODEL: 'ai_model',
  AI_SETTINGS: 'ai_settings',
  BAIDU_API_KEY: 'baidu_api_key',
  BAIDU_SECRET_KEY: 'baidu_secret_key',
  XUNFEI_APP_ID: 'xunfei_app_id',
  XUNFEI_API_KEY: 'xunfei_api_key',
  XUNFEI_API_SECRET: 'xunfei_api_secret',
  ZHIPU_API_KEY: 'zhipu_api_key',
  QIANFAN_API_KEY: 'qianfan_api_key',
  QIANFAN_SECRET_KEY: 'qianfan_secret_key',
  MOONSHOT_API_KEY: 'moonshot_api_key',
  STREAM_RESPONSE: 'stream_response',
  VOICE_ENABLED: 'voice_enabled',
  MARKDOWN_ENABLED: 'markdown_enabled',
};

const AIAssistantSettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [aiEngine, setAiEngine] = useState(AIAssistantModule.ENGINE_LOCAL);
  const [aiModel, setAiModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  
  // 百度文心一言设置
  const [baiduApiKey, setBaiduApiKey] = useState('');
  const [baiduSecretKey, setBaiduSecretKey] = useState('');
  
  // 讯飞星火设置
  const [xunfeiAppId, setXunfeiAppId] = useState('');
  const [xunfeiApiKey, setXunfeiApiKey] = useState('');
  const [xunfeiApiSecret, setXunfeiApiSecret] = useState('');
  
  // 智谱ChatGLM设置
  const [zhipuApiKey, setZhipuApiKey] = useState('');
  
  // 千帆大模型设置
  const [qianfanApiKey, setQianfanApiKey] = useState('');
  const [qianfanSecretKey, setQianfanSecretKey] = useState('');
  
  // Moonshot AI设置
  const [moonshotApiKey, setMoonshotApiKey] = useState('');
  
  // 功能开关
  const [streamResponse, setStreamResponse] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [markdownEnabled, setMarkdownEnabled] = useState(true);

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  // 加载设置
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      // 加载引擎和模型设置
      const savedEngine = await AsyncStorage.getItem(STORAGE_KEYS.AI_ENGINE);
      if (savedEngine) {
        setAiEngine(savedEngine);
      }
      
      const savedModel = await AsyncStorage.getItem(STORAGE_KEYS.AI_MODEL);
      if (savedModel) {
        setAiModel(savedModel);
      }
      
      // 加载百度设置
      const savedBaiduApiKey = await AsyncStorage.getItem(STORAGE_KEYS.BAIDU_API_KEY);
      if (savedBaiduApiKey) {
        setBaiduApiKey(savedBaiduApiKey);
      }
      
      const savedBaiduSecretKey = await AsyncStorage.getItem(STORAGE_KEYS.BAIDU_SECRET_KEY);
      if (savedBaiduSecretKey) {
        setBaiduSecretKey(savedBaiduSecretKey);
      }
      
      // 加载讯飞设置
      const savedXunfeiAppId = await AsyncStorage.getItem(STORAGE_KEYS.XUNFEI_APP_ID);
      if (savedXunfeiAppId) {
        setXunfeiAppId(savedXunfeiAppId);
      }
      
      const savedXunfeiApiKey = await AsyncStorage.getItem(STORAGE_KEYS.XUNFEI_API_KEY);
      if (savedXunfeiApiKey) {
        setXunfeiApiKey(savedXunfeiApiKey);
      }
      
      const savedXunfeiApiSecret = await AsyncStorage.getItem(STORAGE_KEYS.XUNFEI_API_SECRET);
      if (savedXunfeiApiSecret) {
        setXunfeiApiSecret(savedXunfeiApiSecret);
      }
      
      // 加载智谱设置
      const savedZhipuApiKey = await AsyncStorage.getItem(STORAGE_KEYS.ZHIPU_API_KEY);
      if (savedZhipuApiKey) {
        setZhipuApiKey(savedZhipuApiKey);
      }
      
      // 加载千帆设置
      const savedQianfanApiKey = await AsyncStorage.getItem(STORAGE_KEYS.QIANFAN_API_KEY);
      if (savedQianfanApiKey) {
        setQianfanApiKey(savedQianfanApiKey);
      }
      
      const savedQianfanSecretKey = await AsyncStorage.getItem(STORAGE_KEYS.QIANFAN_SECRET_KEY);
      if (savedQianfanSecretKey) {
        setQianfanSecretKey(savedQianfanSecretKey);
      }
      
      // 加载Moonshot设置
      const savedMoonshotApiKey = await AsyncStorage.getItem(STORAGE_KEYS.MOONSHOT_API_KEY);
      if (savedMoonshotApiKey) {
        setMoonshotApiKey(savedMoonshotApiKey);
      }
      
      // 加载功能开关
      const savedStreamResponse = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_RESPONSE);
      if (savedStreamResponse !== null) {
        setStreamResponse(savedStreamResponse === 'true');
      }
      
      const savedVoiceEnabled = await AsyncStorage.getItem(STORAGE_KEYS.VOICE_ENABLED);
      if (savedVoiceEnabled !== null) {
        setVoiceEnabled(savedVoiceEnabled === 'true');
      }
      
      const savedMarkdownEnabled = await AsyncStorage.getItem(STORAGE_KEYS.MARKDOWN_ENABLED);
      if (savedMarkdownEnabled !== null) {
        setMarkdownEnabled(savedMarkdownEnabled === 'true');
      }
      
    } catch (error) {
      console.error('加载AI设置失败:', error);
      Alert.alert('错误', `加载设置失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    try {
      setIsConfiguring(true);
      
      // 保存引擎和模型设置
      await AsyncStorage.setItem(STORAGE_KEYS.AI_ENGINE, aiEngine);
      if (aiModel) {
        await AsyncStorage.setItem(STORAGE_KEYS.AI_MODEL, aiModel);
      }
      
      // 保存百度设置
      if (baiduApiKey) {
        await AsyncStorage.setItem(STORAGE_KEYS.BAIDU_API_KEY, baiduApiKey);
      }
      if (baiduSecretKey) {
        await AsyncStorage.setItem(STORAGE_KEYS.BAIDU_SECRET_KEY, baiduSecretKey);
      }
      
      // 保存讯飞设置
      if (xunfeiAppId) {
        await AsyncStorage.setItem(STORAGE_KEYS.XUNFEI_APP_ID, xunfeiAppId);
      }
      if (xunfeiApiKey) {
        await AsyncStorage.setItem(STORAGE_KEYS.XUNFEI_API_KEY, xunfeiApiKey);
      }
      if (xunfeiApiSecret) {
        await AsyncStorage.setItem(STORAGE_KEYS.XUNFEI_API_SECRET, xunfeiApiSecret);
      }
      
      // 保存智谱设置
      if (zhipuApiKey) {
        await AsyncStorage.setItem(STORAGE_KEYS.ZHIPU_API_KEY, zhipuApiKey);
      }
      
      // 保存千帆设置
      if (qianfanApiKey) {
        await AsyncStorage.setItem(STORAGE_KEYS.QIANFAN_API_KEY, qianfanApiKey);
      }
      if (qianfanSecretKey) {
        await AsyncStorage.setItem(STORAGE_KEYS.QIANFAN_SECRET_KEY, qianfanSecretKey);
      }
      
      // 保存Moonshot设置
      if (moonshotApiKey) {
        await AsyncStorage.setItem(STORAGE_KEYS.MOONSHOT_API_KEY, moonshotApiKey);
      }
      
      // 保存功能开关
      await AsyncStorage.setItem(STORAGE_KEYS.STREAM_RESPONSE, String(streamResponse));
      await AsyncStorage.setItem(STORAGE_KEYS.VOICE_ENABLED, String(voiceEnabled));
      await AsyncStorage.setItem(STORAGE_KEYS.MARKDOWN_ENABLED, String(markdownEnabled));
      
      // 配置相应的AI引擎
      if (aiEngine === AIAssistantModule.ENGINE_BAIDU && baiduApiKey && baiduSecretKey) {
        await AIAssistantModule.configureBaiduAI({
          apiKey: baiduApiKey,
          secretKey: baiduSecretKey,
        });
      } else if (aiEngine === AIAssistantModule.ENGINE_XUNFEI && xunfeiAppId && xunfeiApiKey && xunfeiApiSecret) {
        await AIAssistantModule.configureXunfeiAI({
          appId: xunfeiAppId,
          apiKey: xunfeiApiKey,
          apiSecret: xunfeiApiSecret,
        });
      } else if (aiEngine === AIAssistantModule.ENGINE_ZHIPU && zhipuApiKey) {
        await AIAssistantModule.configureZhipuAI({
          apiKey: zhipuApiKey,
        });
      } else if (aiEngine === AIAssistantModule.ENGINE_QIANFAN && qianfanApiKey && qianfanSecretKey) {
        await AIAssistantModule.configureQianfanAI({
          apiKey: qianfanApiKey,
          secretKey: qianfanSecretKey,
        });
      } else if (aiEngine === AIAssistantModule.ENGINE_MOONSHOT && moonshotApiKey) {
        await AIAssistantModule.configureMoonshotAI({
          apiKey: moonshotApiKey,
        });
      }
      
      Alert.alert('成功', '设置已保存');
      navigation.goBack();
    } catch (error) {
      console.error('保存AI设置失败:', error);
      Alert.alert('错误', `保存设置失败: ${error.message}`);
    } finally {
      setIsConfiguring(false);
    }
  };

  // 选择引擎
  const selectEngine = (engine) => {
    setAiEngine(engine);
    
    // 根据引擎设置默认模型
    switch (engine) {
      case AIAssistantModule.ENGINE_BAIDU:
        setAiModel(AIAssistantModule.MODEL_ERNIE_BOT);
        break;
      case AIAssistantModule.ENGINE_XUNFEI:
        setAiModel(AIAssistantModule.MODEL_SPARK_DESK);
        break;
      case AIAssistantModule.ENGINE_ZHIPU:
        setAiModel(AIAssistantModule.MODEL_CHATGLM_TURBO);
        break;
      case AIAssistantModule.ENGINE_QIANFAN:
        setAiModel(AIAssistantModule.MODEL_QIANFAN_LLAMA);
        break;
      case AIAssistantModule.ENGINE_MOONSHOT:
        setAiModel(AIAssistantModule.MODEL_MOONSHOT_V1);
        break;
      default:
        setAiModel('');
        break;
    }
  };

  // 渲染引擎选择按钮
  const renderEngineButton = (engine, label) => {
    const isSelected = aiEngine === engine;
    
    return (
      <TouchableOpacity
        style={[
          styles.engineButton,
          isSelected && { backgroundColor: theme.colors.primary },
        ]}
        onPress={() => selectEngine(engine)}
      >
        <Text
          style={[
            styles.engineButtonText,
            isSelected && { color: '#fff' },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // 渲染模型选择按钮
  const renderModelButton = (model, label) => {
    const isSelected = aiModel === model;
    
    return (
      <TouchableOpacity
        style={[
          styles.modelButton,
          isSelected && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary },
        ]}
        onPress={() => setAiModel(model)}
      >
        <Text
          style={[
            styles.modelButtonText,
            isSelected && { color: theme.colors.primary },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>加载设置中...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>AI助手设置</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>选择AI引擎</Text>
          <View style={styles.engineButtons}>
            {renderEngineButton(AIAssistantModule.ENGINE_LOCAL, '本地引擎')}
            {renderEngineButton(AIAssistantModule.ENGINE_BAIDU, '百度文心一言')}
            {renderEngineButton(AIAssistantModule.ENGINE_XUNFEI, '讯飞星火')}
            {renderEngineButton(AIAssistantModule.ENGINE_ZHIPU, '智谱ChatGLM')}
            {renderEngineButton(AIAssistantModule.ENGINE_QIANFAN, '千帆大模型')}
            {renderEngineButton(AIAssistantModule.ENGINE_MOONSHOT, 'Moonshot AI')}
          </View>
        </View>

        {aiEngine === AIAssistantModule.ENGINE_BAIDU && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>百度文心一言设置</Text>
            <View style={styles.modelButtons}>
              {renderModelButton(AIAssistantModule.MODEL_ERNIE_BOT, 'ERNIE Bot')}
              {renderModelButton(AIAssistantModule.MODEL_ERNIE_BOT_TURBO, 'ERNIE Bot Turbo')}
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>API Key</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={baiduApiKey}
                onChangeText={setBaiduApiKey}
                placeholder="输入百度API Key"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Secret Key</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={baiduSecretKey}
                onChangeText={setBaiduSecretKey}
                placeholder="输入百度Secret Key"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
          </View>
        )}

        {aiEngine === AIAssistantModule.ENGINE_XUNFEI && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>讯飞星火设置</Text>
            <View style={styles.modelButtons}>
              {renderModelButton(AIAssistantModule.MODEL_SPARK_DESK, '星火认知大模型')}
              {renderModelButton(AIAssistantModule.MODEL_SPARK_DESK_V3, '星火认知大模型V3')}
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>App ID</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={xunfeiAppId}
                onChangeText={setXunfeiAppId}
                placeholder="输入讯飞App ID"
                placeholderTextColor={theme.colors.text + '80'}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>API Key</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={xunfeiApiKey}
                onChangeText={setXunfeiApiKey}
                placeholder="输入讯飞API Key"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>API Secret</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={xunfeiApiSecret}
                onChangeText={setXunfeiApiSecret}
                placeholder="输入讯飞API Secret"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
          </View>
        )}

        {aiEngine === AIAssistantModule.ENGINE_ZHIPU && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>智谱ChatGLM设置</Text>
            <View style={styles.modelButtons}>
              {renderModelButton(AIAssistantModule.MODEL_CHATGLM_TURBO, 'ChatGLM Turbo')}
              {renderModelButton(AIAssistantModule.MODEL_CHATGLM_PRO, 'ChatGLM Pro')}
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>API Key</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={zhipuApiKey}
                onChangeText={setZhipuApiKey}
                placeholder="输入智谱API Key"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
          </View>
        )}

        {aiEngine === AIAssistantModule.ENGINE_QIANFAN && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>千帆大模型设置</Text>
            <View style={styles.modelButtons}>
              {renderModelButton(AIAssistantModule.MODEL_QIANFAN_BLOOMZ, 'BLOOMZ-7B')}
              {renderModelButton(AIAssistantModule.MODEL_QIANFAN_LLAMA, 'Llama-2-7B')}
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>API Key</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={qianfanApiKey}
                onChangeText={setQianfanApiKey}
                placeholder="输入千帆API Key"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Secret Key</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={qianfanSecretKey}
                onChangeText={setQianfanSecretKey}
                placeholder="输入千帆Secret Key"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
          </View>
        )}

        {aiEngine === AIAssistantModule.ENGINE_MOONSHOT && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Moonshot AI设置</Text>
            <View style={styles.modelButtons}>
              {renderModelButton(AIAssistantModule.MODEL_MOONSHOT_V1, 'Moonshot V1')}
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>API Key</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                value={moonshotApiKey}
                onChangeText={setMoonshotApiKey}
                placeholder="输入Moonshot API Key"
                placeholderTextColor={theme.colors.text + '80'}
                secureTextEntry
              />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>功能设置</Text>
          
          <View style={styles.switchItem}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>流式响应</Text>
            <Switch
              value={streamResponse}
              onValueChange={setStreamResponse}
              trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
              thumbColor={streamResponse ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.switchItem}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>语音功能</Text>
            <Switch
              value={voiceEnabled}
              onValueChange={setVoiceEnabled}
              trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
              thumbColor={voiceEnabled ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.switchItem}>
            <Text style={[styles.switchLabel, { color: theme.colors.text }]}>Markdown支持</Text>
            <Switch
              value={markdownEnabled}
              onValueChange={setMarkdownEnabled}
              trackColor={{ false: '#767577', true: theme.colors.primary + '80' }}
              thumbColor={markdownEnabled ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={saveSettings}
          disabled={isConfiguring}
        >
          {isConfiguring ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>保存设置</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  engineButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  engineButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    margin: 4,
  },
  engineButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modelButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginHorizontal: -4,
  },
  modelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    margin: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modelButtonText: {
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  switchLabel: {
    fontSize: 16,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AIAssistantSettingsScreen;
