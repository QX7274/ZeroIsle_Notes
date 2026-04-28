import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import devModeService from '../../services/auth/devModeService';
import devModeApiClient from '../../services/api/devModeApiClient';

/**
 * 开发者模式快速进入组件
 * 提供开发者账户的快速访问功能和热点连接
 */
const DevModeQuickAccess = () => {
  const [isDevMode, setIsDevMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [apiTestResults, setApiTestResults] = useState([]);

  useEffect(() => {
    checkDevModeStatus();
  }, []);

  const checkDevModeStatus = async () => {
    try {
      const status = devModeService.getDevModeStatus();
      setIsDevMode(status.isActive);

      // 检查连接状态
      const connStatus = devModeApiClient.getConnectionStatus();
      setConnectionStatus(connStatus.status);
    } catch (error) {
      console.error('检查开发者模式状态失败:', error);
    }
  };

  const handleEnableDevMode = async () => {
    try {
      setIsLoading(true);
      const success = await devModeService.enableDevMode();

      if (success) {
        setIsDevMode(true);
        Alert.alert('成功', '开发者模式已启用，可以快速进入系统');
      } else {
        Alert.alert('错误', '启用开发者模式失败');
      }
    } catch (error) {
      Alert.alert('错误', `启用开发者模式失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableDevMode = async () => {
    Alert.alert(
      '确认',
      '确定要禁用开发者模式吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const success = await devModeService.disableDevMode();

              if (success) {
                setIsDevMode(false);
                setConnectionStatus('disconnected');
                setApiTestResults([]);
                Alert.alert('成功', '开发者模式已禁用');
              } else {
                Alert.alert('错误', '禁用开发者模式失败');
              }
            } catch (error) {
              Alert.alert('错误', `禁用开发者模式失败: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleQuickEnter = () => {
    if (isDevMode) {
      Alert.alert('开发者模式', '您已经在开发者模式中');
    } else {
      handleEnableDevMode();
    }
  };

  const handleScanHotspots = async () => {
    try {
      setIsLoading(true);
      console.log('开始扫描热点...');

      const connections = await devModeApiClient.scanHotspots();

      if (connections.length > 0) {
        // 选择第一个可用连接
        const bestConnection = connections[0];
        const result = await devModeApiClient.connectToBackend(bestConnection.url);

        if (result.success) {
          setConnectionStatus('connected');
          Alert.alert('成功', `已连接到热点: ${bestConnection.url}`);

          // 自动测试API端点
          await handleTestEndpoints();
        } else {
          Alert.alert('错误', `连接失败: ${result.error}`);
        }
      } else {
        Alert.alert('提示', '未发现可用的热点连接');
      }
    } catch (error) {
      Alert.alert('错误', `扫描热点失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestEndpoints = async () => {
    try {
      setIsLoading(true);
      console.log('开始测试API端点...');

      const results = await devModeApiClient.testAllEndpoints();
      setApiTestResults(results);

      const successCount = results.filter(r => r.success).length;
      Alert.alert('测试完成', `API端点测试完成，成功: ${successCount}/${results.length}`);

    } catch (error) {
      Alert.alert('错误', `测试API端点失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await devModeApiClient.disconnectFromBackend();
      setConnectionStatus('disconnected');
      setApiTestResults([]);
      Alert.alert('成功', '已断开热点连接');
    } catch (error) {
      Alert.alert('错误', `断开连接失败: ${error.message}`);
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'failed':
        return '连接失败';
      default:
        return '未连接';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return '#666';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 主按钮 */}
      <TouchableOpacity
        style={[styles.button, isDevMode && styles.buttonActive]}
        onPress={handleQuickEnter}
        disabled={isLoading}
      >
        <Icon
          name={isDevMode ? 'code-working' : 'code-slash'}
          size={20}
          color={isDevMode ? '#4CAF50' : '#666'}
        />
        <Text style={[styles.buttonText, isDevMode && styles.buttonTextActive]}>
          {isDevMode ? '开发者模式已启用' : '快速进入开发者模式'}
        </Text>
      </TouchableOpacity>

      {/* 连接状态 */}
      {isDevMode && (
        <View style={styles.statusContainer}>
          <Icon
            name="wifi"
            size={16}
            color={getConnectionStatusColor()}
          />
          <Text style={[styles.statusText, { color: getConnectionStatusColor() }]}>
            热点状态: {getConnectionStatusText()}
          </Text>
        </View>
      )}

      {/* 热点连接按钮 */}
      {isDevMode && connectionStatus === 'disconnected' && (
        <TouchableOpacity
          style={styles.hotspotButton}
          onPress={handleScanHotspots}
          disabled={isLoading}
        >
          <Icon name="wifi" size={16} color="#007AFF" />
          <Text style={styles.hotspotButtonText}>扫描并连接热点</Text>
        </TouchableOpacity>
      )}

      {/* 已连接状态下的操作 */}
      {isDevMode && connectionStatus === 'connected' && (
        <View style={styles.connectedActions}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestEndpoints}
            disabled={isLoading}
          >
            <Icon name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.testButtonText}>测试API端点</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
            disabled={isLoading}
          >
            <Icon name="close-circle" size={16} color="#F44336" />
            <Text style={styles.disconnectButtonText}>断开连接</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* API测试结果 */}
      {apiTestResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>API端点测试结果:</Text>
          {apiTestResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <Icon
                name={result.success ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={result.success ? '#4CAF50' : '#F44336'}
              />
              <Text style={styles.resultText}>
                {result.name}: {result.success ? '成功' : '失败'}
                {!result.success && result.error && ` (${result.error})`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 禁用开发者模式按钮 */}
      {isDevMode && (
        <TouchableOpacity
          style={styles.disableButton}
          onPress={handleDisableDevMode}
          disabled={isLoading}
        >
          <Icon name="close-circle" size={16} color="#F44336" />
          <Text style={styles.disableButtonText}>禁用开发者模式</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  buttonActive: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  buttonTextActive: {
    color: '#4CAF50',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  hotspotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  hotspotButtonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  connectedActions: {
    marginTop: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  testButtonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  disconnectButtonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  resultsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  disableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  disableButtonText: {
    fontSize: 12,
    color: '#F44336',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default DevModeQuickAccess;
