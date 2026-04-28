/**
 * API测试组件
 * 用于测试API接口
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import realmService from '../../services/database/realmService';
import { API_BASE_URL } from '../../config/api';

const ApiTestComponent = () => {
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSendRequest = async () => {
    try {
      setLoading(true);
      setError(null);
      setResponse(null);

      // 构建请求配置
      const config = {
        method: method.toLowerCase(),
        url: url.startsWith('/') ? `${API_BASE_URL}${url}` : url,
        headers: headers ? JSON.parse(headers) : {},
      };

      // 添加认证令牌
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered('key = "token"');
      const token = item.length > 0 ? item[0].value : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // 添加请求体
      if (['post', 'put', 'patch'].includes(method.toLowerCase()) && body) {
        config.data = JSON.parse(body);
      }

      // 发送请求
      const result = await axios(config);
      setResponse({
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        data: result.data,
      });
    } catch (err) {
      setError({
        message: err.message,
        response: err.response ? {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data,
        } : null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>API测试工具</Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>请求URL</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="输入API URL"
            placeholderTextColor={colors.placeholder}
            value={url}
            onChangeText={setUrl}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>请求方法</Text>
          <View style={styles.methodButtons}>
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.methodButton,
                  {
                    backgroundColor: method === m ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setMethod(m)}
              >
                <Text style={{ color: method === m ? '#fff' : colors.text }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>请求头 (JSON格式)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, height: 100 }]}
            placeholder='{"Content-Type": "application/json"}'
            placeholderTextColor={colors.placeholder}
            value={headers}
            onChangeText={setHeaders}
            multiline
          />
        </View>

        {['POST', 'PUT', 'PATCH'].includes(method) && (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>请求体 (JSON格式)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, height: 150 }]}
              placeholder='{"key": "value"}'
              placeholderTextColor={colors.placeholder}
              value={body}
              onChangeText={setBody}
              multiline
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={handleSendRequest}
          disabled={loading || !url}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>发送请求</Text>
          )}
        </TouchableOpacity>

        {error && (
          <View style={[styles.responseContainer, { borderColor: colors.error }]}>
            <Text style={[styles.responseTitle, { color: colors.error }]}>错误</Text>
            <Text style={[styles.responseText, { color: colors.text }]}>{error.message}</Text>
            {error.response && (
              <>
                <Text style={[styles.responseSubtitle, { color: colors.text }]}>
                  状态: {error.response.status} {error.response.statusText}
                </Text>
                <Text style={[styles.responseSubtitle, { color: colors.text }]}>响应数据:</Text>
                <ScrollView style={styles.dataScroll}>
                  <Text style={[styles.responseData, { color: colors.text }]}>
                    {JSON.stringify(error.response.data, null, 2)}
                  </Text>
                </ScrollView>
              </>
            )}
          </View>
        )}

        {response && (
          <View style={[styles.responseContainer, { borderColor: colors.success }]}>
            <Text style={[styles.responseTitle, { color: colors.success }]}>
              成功 ({response.status} {response.statusText})
            </Text>
            <Text style={[styles.responseSubtitle, { color: colors.text }]}>响应数据:</Text>
            <ScrollView style={styles.dataScroll}>
              <Text style={[styles.responseData, { color: colors.text }]}>
                {JSON.stringify(response.data, null, 2)}
              </Text>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  methodButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  sendButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  responseContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  responseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  responseSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  responseText: {
    fontSize: 16,
  },
  dataScroll: {
    maxHeight: 300,
  },
  responseData: {
    fontFamily: 'monospace',
    fontSize: 14,
  },
});

export default ApiTestComponent;
