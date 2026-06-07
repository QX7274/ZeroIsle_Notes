import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import AIAssistantModule from '../../native/AIAssistantModule';
import realmService from '../../services/database/realmService';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { showToast } from '../../components/common/ToastHelper';

const STORAGE_KEYS = {
  AI_ENGINE: 'ai_engine',
  BAIDU_CONFIG: 'ai_baidu_config',
};

const AIAssistantSettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const colors = theme.colors || theme;
  const insets = useSafeAreaInsets();
  const [aiEngine, setAiEngine] = useState(AIAssistantModule.ENGINE_BAIDU);
  const [baiduApiKey, setBaiduApiKey] = useState('');
  const [baiduSecretKey, setBaiduSecretKey] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configStatus, setConfigStatus] = useState('');
  const pageState = isLoading || isConfiguring ? 'busy' : 'ready';
  const hasKeys = Boolean(baiduApiKey && baiduSecretKey);
  const configStatusState = configStatus
    ? (configStatus.includes('失败') ? 'error' : 'success')
    : 'idle';
  const statusToneStyles = configStatusState === 'error'
    ? {
      backgroundColor: 'rgba(220,38,38,0.08)',
      borderColor: 'rgba(220,38,38,0.18)',
      iconColor: '#DC2626',
      iconName: 'error-outline',
    }
    : {
      backgroundColor: 'rgba(37,99,235,0.08)',
      borderColor: 'rgba(37,99,235,0.18)',
      iconColor: '#2563EB',
      iconName: 'info-outline',
    };

  useEffect(() => {
    loadSettings();
  }, []);

  const readStorageItem = async (key) => {
    const item = await realmService.findOne('StorageItem', { key });
    return item?.value ?? null;
  };

  const upsertStorageItem = async (key, value) => {
    const now = new Date();
    const existingItem = await realmService.findOne('StorageItem', { key });

    if (existingItem) {
      await realmService.update('StorageItem', key, {
        value,
        updated_at: now,
      });
      return;
    }

    await realmService.create('StorageItem', {
      key,
      value,
      created_at: now,
      updated_at: now,
    });
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const savedEngine = await readStorageItem(STORAGE_KEYS.AI_ENGINE);
      if (savedEngine) {
        setAiEngine(savedEngine);
      }

      const rawBaiduConfig = await readStorageItem(STORAGE_KEYS.BAIDU_CONFIG);
      if (rawBaiduConfig) {
        try {
          const parsedConfig = JSON.parse(rawBaiduConfig);
          if (parsedConfig?.apiKey) {
            setBaiduApiKey(parsedConfig.apiKey);
          }
          if (parsedConfig?.secretKey) {
            setBaiduSecretKey(parsedConfig.secretKey);
          }
        } catch (parseError) {
          console.warn('解析 AI 助手本地配置失败:', parseError);
          setConfigStatus('本地配置已损坏，请重新填写百度 AI 密钥');
        }
      }
    } catch (error) {
      console.error('加载 AI 助手设置失败:', error);
      setConfigStatus('加载配置失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      await upsertStorageItem(STORAGE_KEYS.AI_ENGINE, aiEngine);
      await upsertStorageItem(
        STORAGE_KEYS.BAIDU_CONFIG,
        JSON.stringify({
          apiKey: baiduApiKey.trim(),
          secretKey: baiduSecretKey.trim(),
        })
      );
      setConfigStatus('设置已保存，可继续配置或测试 AI 助手');
      showToast.success('设置已保存');
    } catch (error) {
      console.error('保存 AI 助手设置失败:', error);
      showToast.error('保存设置失败，请稍后重试');
    }
  };

  const configureBaiduAI = async () => {
    if (!hasKeys) {
      showToast.warning('请先填写百度 AI 的 API Key 和 Secret Key');
      return;
    }

    setIsConfiguring(true);
    setConfigStatus('正在配置百度 AI...');

    try {
      await AIAssistantModule.configureBaiduAI({
        apiKey: baiduApiKey,
        secretKey: baiduSecretKey,
      });
      setConfigStatus('配置成功，访问令牌已获取');
      setAiEngine(AIAssistantModule.ENGINE_BAIDU);
      await upsertStorageItem(STORAGE_KEYS.AI_ENGINE, AIAssistantModule.ENGINE_BAIDU);
      await upsertStorageItem(
        STORAGE_KEYS.BAIDU_CONFIG,
        JSON.stringify({
          apiKey: baiduApiKey.trim(),
          secretKey: baiduSecretKey.trim(),
        })
      );

      showToast.success('百度 AI 配置成功');
    } catch (error) {
      console.error('配置百度 AI 失败:', error);
      const message = error?.message || '未知错误';
      setConfigStatus(`配置失败: ${message}`);
      showToast.error(`配置百度 AI 失败: ${message}`);
    } finally {
      setIsConfiguring(false);
    }
  };

  const testAIAssistant = async () => {
    try {
      const result = await AIAssistantModule.sendMessage('你好，请介绍一下你自己', aiEngine);
      showToast.success(result?.text ? `测试成功：${result.text}` : 'AI 助手测试成功');
    } catch (error) {
      console.error('测试 AI 助手失败:', error);
      showToast.error(`测试 AI 助手失败: ${error?.message || '未知错误'}`);
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: '#F3F8FF' }]} testID={`state.settings.aiAssistant.state.${pageState}`}>
      <View testID="state.settings.aiAssistant.visibility.visible" />
      <View testID={`state.settings.aiAssistant.configuring.visibility.${isConfiguring ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.aiAssistant.engine.${aiEngine === AIAssistantModule.ENGINE_BAIDU ? 'baidu' : 'other'}`} />
      <View testID={`state.settings.aiAssistant.keys.visibility.${hasKeys ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.aiAssistant.status.${configStatusState}`} />

      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, styles.glassCard]}>
        <ScreenHeaderBackButton
          onPress={() => navigation?.goBack?.()}
          testID="action.settings.aiAssistant.back"
          style={styles.backButton}
        />
        <Text style={[styles.pageTitle, { color: colors.text }]}>AI 助手设置</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="list.settings.aiAssistant.sections">

        <View style={[styles.section, styles.glassCard]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>AI 引擎选择</Text>
          <View style={styles.option}>
            <Text style={[styles.optionText, { color: colors.text }]}>使用百度 AI 引擎</Text>
            <Switch
              value={aiEngine === AIAssistantModule.ENGINE_BAIDU}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                if (!hasKeys) {
                  showToast.info('请先配置百度 AI 密钥');
                  return;
                }
                setAiEngine(AIAssistantModule.ENGINE_BAIDU);
              }}
              trackColor={{ false: '#BED0EA', true: colors.primary }}
              testID="action.settings.aiAssistant.toggleBaiduEngine"
            />
          </View>
        </View>

        <View style={[styles.section, styles.glassCard]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>百度 AI 配置</Text>

          <Text style={[styles.label, { color: colors.text }]}>API Key</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: 'rgba(255,255,255,0.92)',
                borderColor: 'rgba(76,141,255,0.24)',
              },
            ]}
            value={baiduApiKey}
            onChangeText={setBaiduApiKey}
            placeholder="输入百度 AI 的 API Key"
            placeholderTextColor={(colors.text || '#1F2A37') + '66'}
            testID="input.settings.aiAssistant.baiduApiKey"
          />

          <Text style={[styles.label, { color: colors.text }]}>Secret Key</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: 'rgba(255,255,255,0.92)',
                borderColor: 'rgba(76,141,255,0.24)',
              },
            ]}
            value={baiduSecretKey}
            onChangeText={setBaiduSecretKey}
            placeholder="输入百度 AI 的 Secret Key"
            placeholderTextColor={(colors.text || '#1F2A37') + '66'}
            secureTextEntry
            testID="input.settings.aiAssistant.baiduSecretKey"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={configureBaiduAI}
            disabled={isConfiguring}
            testID="action.settings.aiAssistant.configureBaidu"
          >
            {isConfiguring ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>配置百度 AI</Text>
            )}
          </TouchableOpacity>

          {configStatus ? (
            <View
              style={[
                styles.statusCard,
                {
                  backgroundColor: statusToneStyles.backgroundColor,
                  borderColor: statusToneStyles.borderColor,
                },
              ]}
              testID="state.settings.aiAssistant.statusCard"
            >
              <Icon name={statusToneStyles.iconName} size={18} color={statusToneStyles.iconColor} />
              <Text
                style={[
                  styles.statusText,
                  { color: statusToneStyles.iconColor },
                ]}
                testID="state.settings.aiAssistant.statusText"
              >
                {configStatus}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.section, styles.glassCard]}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={testAIAssistant}
            testID="action.settings.aiAssistant.test"
          >
            <Text style={styles.buttonText}>测试 AI 助手</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 12 }]}
            onPress={saveSettings}
            testID="action.settings.aiAssistant.save"
          >
            <Text style={styles.buttonText}>保存设置</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, styles.glassCard]}>
          <Text style={[styles.note, { color: colors.text }]}>
            注意：百度 AI 引擎提供对话能力，需要网络连接与有效密钥。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  pageTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 28,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionText: {
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    fontSize: 15,
  },
  button: {
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  statusCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default AIAssistantSettingsScreen;
