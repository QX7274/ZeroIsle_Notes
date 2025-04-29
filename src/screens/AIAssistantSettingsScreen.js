import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadSettings,
  saveSettings,
  fetchAvailableModels,
  setAiEngine,
  setAiModel,
  setStreamEnabled,
  setVoiceEnabled,
  setMarkdownEnabled,
  selectAiEngine,
  selectAiModel,
  selectStreamEnabled,
  selectVoiceEnabled,
  selectMarkdownEnabled,
  selectAvailableModels,
  selectIsLoading,
  selectError
} from '../store/slices/aiAssistantSlice';
import { Text } from '../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
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
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const aiEngine = useSelector(selectAiEngine);
  const aiModel = useSelector(selectAiModel);
  const streamEnabled = useSelector(selectStreamEnabled);
  const voiceEnabled = useSelector(selectVoiceEnabled);
  const markdownEnabled = useSelector(selectMarkdownEnabled);
  const availableModels = useSelector(selectAvailableModels);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // 本地状态
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [showAISelector, setShowAISelector] = useState(false);
  const [selectedAI, setSelectedAI] = useState(null);

  // AI引擎选项
  const aiEngineOptions = [
    { id: AIAssistantModule.ENGINE_BAIDU, name: '百度文心一言' },
    { id: AIAssistantModule.ENGINE_XUNFEI, name: '讯飞星火' },
    { id: AIAssistantModule.ENGINE_ZHIPU, name: '智谱ChatGLM' },
    { id: AIAssistantModule.ENGINE_QIANFAN, name: '千帆大模型' },
    { id: AIAssistantModule.ENGINE_MOONSHOT, name: 'Moonshot AI' },
    { id: AIAssistantModule.ENGINE_LOCAL, name: '本地引擎' },
  ];

  // API密钥状态
  const [baiduApiKey, setBaiduApiKey] = useState('');
  const [baiduSecretKey, setBaiduSecretKey] = useState('');
  const [xunfeiAppId, setXunfeiAppId] = useState('');
  const [xunfeiApiKey, setXunfeiApiKey] = useState('');
  const [xunfeiApiSecret, setXunfeiApiSecret] = useState('');
  const [zhipuApiKey, setZhipuApiKey] = useState('');
  const [qianfanApiKey, setQianfanApiKey] = useState('');
  const [qianfanSecretKey, setQianfanSecretKey] = useState('');
  const [moonshotApiKey, setMoonshotApiKey] = useState('');

  // 加载设置
  useEffect(() => {
    // 加载Redux设置
    dispatch(loadSettings());

    // 获取可用模型
    dispatch(fetchAvailableModels());

    // 加载API密钥
    loadApiKeys();

    // 设置当前选中的AI引擎
    const currentEngine = aiEngineOptions.find(option => option.id === aiEngine);
    setSelectedAI(currentEngine || aiEngineOptions[0]);
  }, [dispatch, aiEngine]);

  // 加载API密钥
  const loadApiKeys = async () => {
    try {
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
    } catch (error) {
      console.error('加载API密钥失败:', error);
      Alert.alert('错误', `加载API密钥失败: ${error.message}`);
    }
  };

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      setIsConfiguring(true);

      // 保存Redux设置
      dispatch(saveSettings({
        aiEngine,
        aiModel,
        streamEnabled,
        voiceEnabled,
        markdownEnabled,
      }));

      // 保存API密钥
      await saveApiKeys();

      // 配置相应的AI引擎
      await configureAiEngine();

      Alert.alert('成功', '设置已保存');
      navigation.goBack();
    } catch (error) {
      console.error('保存AI设置失败:', error);
      Alert.alert('错误', `保存设置失败: ${error.message}`);
    } finally {
      setIsConfiguring(false);
    }
  };

  // 保存API密钥
  const saveApiKeys = async () => {
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
  };

  // 配置AI引擎
  const configureAiEngine = async () => {
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
  };

  // 选择引擎
  const handleSelectEngine = (engine) => {
    dispatch(setAiEngine(engine));

    // 更新选中的AI
    const selectedOption = aiEngineOptions.find(option => option.id === engine);
    setSelectedAI(selectedOption);

    // 隐藏选择器
    setShowAISelector(false);

    // 根据引擎设置默认模型
    switch (engine) {
      case AIAssistantModule.ENGINE_BAIDU:
        dispatch(setAiModel(AIAssistantModule.MODEL_ERNIE_BOT));
        break;
      case AIAssistantModule.ENGINE_XUNFEI:
        dispatch(setAiModel(AIAssistantModule.MODEL_SPARK_DESK));
        break;
      case AIAssistantModule.ENGINE_ZHIPU:
        dispatch(setAiModel(AIAssistantModule.MODEL_CHATGLM_TURBO));
        break;
      case AIAssistantModule.ENGINE_QIANFAN:
        dispatch(setAiModel(AIAssistantModule.MODEL_QIANFAN_LLAMA));
        break;
      case AIAssistantModule.ENGINE_MOONSHOT:
        dispatch(setAiModel(AIAssistantModule.MODEL_MOONSHOT_V1));
        break;
      default:
        dispatch(setAiModel(''));
        break;
    }
  };

  // 渲染AI选择器
  const renderAISelector = () => {
    return (
      <Modal
        visible={showAISelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAISelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAISelector(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text
              variant="body"
              size="large"
              bold
              style={styles.modalTitle}
            >
              选择AI引擎
            </Text>

            <FlatList
              data={aiEngineOptions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.aiOptionItem,
                    {
                      backgroundColor: item.id === aiEngine ? colors.primary + '20' : 'transparent',
                      borderBottomColor: colors.border
                    }
                  ]}
                  onPress={() => handleSelectEngine(item.id)}
                >
                  <Text
                    variant="body"
                    size="medium"
                    color={item.id === aiEngine ? 'primary' : 'text'}
                    bold={item.id === aiEngine}
                  >
                    {item.name}
                  </Text>
                  {item.id === aiEngine && (
                    <Icon name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // 渲染引擎选择按钮
  const renderEngineButton = (engine, label) => {
    const isSelected = aiEngine === engine;

    return (
      <TouchableOpacity
        style={[
          styles.engineButton,
          { backgroundColor: isSelected ? colors.primary : colors.card },
          { borderColor: isSelected ? colors.primary : colors.border },
        ]}
        onPress={() => handleSelectEngine(engine)}
      >
        <Text
          variant="body"
          size="medium"
          color={isSelected ? 'card' : 'text'}
          bold={isSelected}
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
          {
            backgroundColor: isSelected ? colors.primary + '20' : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => dispatch(setAiModel(model))}
      >
        <Text
          variant="body"
          size="small"
          color={isSelected ? 'primary' : 'text'}
          bold={isSelected}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          variant="body"
          size="large"
          color="hint"
          center
          style={styles.loadingText}
        >
          加载设置中...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          variant="heading"
          level="h4"
          style={styles.headerTitle}
        >
          AI助手设置
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {renderAISelector()}

      <View style={styles.aiSelectorContainer}>
        <Text
          variant="body"
          size="large"
          bold
          style={styles.aiSelectorLabel}
        >
          当前AI引擎
        </Text>

        <TouchableOpacity
          style={[styles.aiSelectorButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowAISelector(true)}
        >
          <Text
            variant="body"
            size="medium"
            style={styles.aiSelectorText}
          >
            {selectedAI ? selectedAI.name : '选择AI引擎'}
          </Text>
          <Icon name="arrow-drop-down" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.errorLight }]}>
            <Text
              variant="body"
              size="medium"
              color="error"
              center
            >
              {error}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text
            variant="body"
            size="large"
            bold
            style={styles.sectionTitle}
          >
            选择AI引擎
          </Text>
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
          <Text
            variant="body"
            size="large"
            bold
            style={styles.sectionTitle}
          >
            功能设置
          </Text>

          <View style={[styles.switchItem, { borderBottomColor: colors.border }]}>
            <Text
              variant="body"
              size="medium"
              style={styles.switchLabel}
            >
              流式响应
            </Text>
            <Switch
              value={streamEnabled}
              onValueChange={(value) => dispatch(setStreamEnabled(value))}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={streamEnabled ? colors.primary : colors.card}
              ios_backgroundColor={colors.border}
            />
          </View>

          <View style={[styles.switchItem, { borderBottomColor: colors.border }]}>
            <Text
              variant="body"
              size="medium"
              style={styles.switchLabel}
            >
              语音功能
            </Text>
            <Switch
              value={voiceEnabled}
              onValueChange={(value) => dispatch(setVoiceEnabled(value))}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={voiceEnabled ? colors.primary : colors.card}
              ios_backgroundColor={colors.border}
            />
          </View>

          <View style={[styles.switchItem, { borderBottomColor: colors.border }]}>
            <Text
              variant="body"
              size="medium"
              style={styles.switchLabel}
            >
              Markdown支持
            </Text>
            <Switch
              value={markdownEnabled}
              onValueChange={(value) => dispatch(setMarkdownEnabled(value))}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={markdownEnabled ? colors.primary : colors.card}
              ios_backgroundColor={colors.border}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            isConfiguring && { opacity: 0.7 }
          ]}
          onPress={handleSaveSettings}
          disabled={isConfiguring}
        >
          {isConfiguring ? (
            <ActivityIndicator color={colors.card} size="small" />
          ) : (
            <Text
              variant="body"
              size="medium"
              color="card"
              bold
              center
            >
              保存设置
            </Text>
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
  // AI选择器相关样式
  aiSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  aiSelectorLabel: {
    marginBottom: 8,
  },
  aiSelectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  aiSelectorText: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  aiOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
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
