/**
 * ZeroIsle Notes 应用入口
 * @format
 */

// 首先初始化 Reanimated（必须在最开始）
import 'react-native-reanimated';
import 'react-native-get-random-values';

import React from 'react';
import { AppRegistry, Text, View } from 'react-native';

const RootImportErrorFallback = ({ error }) => {
  const message = error?.message ? String(error.message) : '未知错误';
  const stack = error?.stack ? String(error.stack) : '';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F6FAFF',
        justifyContent: 'center',
        paddingHorizontal: 28,
      }}
    >
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          paddingHorizontal: 22,
          paddingVertical: 24,
          borderWidth: 1,
          borderColor: '#D7E8FF',
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: '#16324A',
            marginBottom: 12,
          }}
        >
          应用启动失败
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 24,
            color: '#47627C',
            marginBottom: 12,
          }}
        >
          根组件在导入阶段发生异常，当前已切换到启动诊断兜底页，避免继续白屏。
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 24,
            color: '#C43D4B',
            marginBottom: stack ? 12 : 0,
          }}
        >
          {message}
        </Text>
        {stack ? (
          <Text
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: '#6A7D90',
            }}
          >
            {stack}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const resolveRootComponent = () => {
  try {
    const resolvedApp = require('./src/App').default;
    console.log('ZeroIsle_Notes 根组件导入成功');
    return resolvedApp;
  } catch (error) {
    console.error('ZeroIsle_Notes 根组件导入失败:', error);
    console.error('ZeroIsle_Notes 根组件导入失败堆栈:', error?.stack || '无堆栈');

    const FallbackComponent = () => <RootImportErrorFallback error={error} />;
    return FallbackComponent;
  }
};

// 设置全局错误处理器（仅用于日志，不忽略致命错误）
if (global.ErrorUtils) {
  const originalHandler = global.ErrorUtils.getGlobalHandler();

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    // 记录错误但不阻止其传播
    if (error && error.message) {
      const msg = error.message;
      console.warn('捕获到错误:', msg, '是否致命:', isFatal);
    }

    // 所有错误都调用原始处理器
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// 注册应用组件
AppRegistry.registerComponent('ZeroIsle_Notes', resolveRootComponent);

console.log('ZeroIsle_Notes 应用已成功注册');
