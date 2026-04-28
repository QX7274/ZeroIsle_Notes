/**
 * 退出前自动保存Hook
 * 监听应用生命周期事件，在应用进入后台或退出时自动保存数据
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import realmService from '../services/database/realmService';

/**
 * 使用退出前自动保存功能
 * @param {Function} saveCallback - 保存数据的回调函数
 * @param {Array} deps - 依赖项数组
 */
export const useAutoSaveOnExit = (saveCallback, deps = []) => {
  const appState = useRef(AppState.currentState);
  const saveTimeoutRef = useRef(null);
  const isSavingRef = useRef(false);
  const hasLoggedRealmUnavailableRef = useRef(false);

  useEffect(() => {
    // 创建一个安全的保存函数
    const safeSave = async () => {
      if (isSavingRef.current) {
        console.log('[AutoSave] 保存已在进行中，跳过');
        return;
      }

      if (realmService?.realmOpenFailed || !realmService?.canUseRealmForWrites?.()) {
        if (!hasLoggedRealmUnavailableRef.current) {
          hasLoggedRealmUnavailableRef.current = true;
          console.error('[AutoSave] 跳过自动保存：Realm 不可用（初始化失败或实例未就绪）');
        }
        return;
      }

      try {
        isSavingRef.current = true;
        console.log('🔄 [AutoSave] 应用状态变化，开始保存数据...');

        if (typeof saveCallback === 'function') {
          await saveCallback();
        }

        // 强制刷新Realm数据到磁盘（失败时仅记录，不抛出连锁异常）
        await realmService.forceFlush();
        console.log('✅ [AutoSave] 数据保存完成');
      } catch (error) {
        console.error('❌ [AutoSave] 保存失败:', error);
      } finally {
        isSavingRef.current = false;
      }
    };

    // 监听应用状态变化
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('[AutoSave] AppState变化:', appState.current, '->', nextAppState);

      // 当应用从活动状态进入后台或非活动状态时，保存数据
      if (
        appState.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive')
      ) {
        console.log('🚨 [AutoSave] 应用进入后台，触发自动保存');

        // 清除之前的保存定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // 立即保存
        safeSave();
      }

      // 当应用从后台返回活动状态时，也可以触发一次保存（可选）
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('✅ [AutoSave] 应用返回前台');
      }

      appState.current = nextAppState;
    });

    // 清理函数
    return () => {
      subscription?.remove();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 组件卸载时也保存一次
      console.log('[AutoSave] 组件卸载，执行最后保存');
      safeSave();
    };
  }, [saveCallback, ...deps]);
};

/**
 * 创建一个带有自动保存功能的保存函数
 * @param {Function} saveFunction - 原始保存函数
 * @returns {Function} 包装后的保存函数
 */
export const createAutoSaveFunction = (saveFunction) => {
  let lastSaveTime = 0;
  const MIN_SAVE_INTERVAL = 500; // 最小保存间隔（毫秒）

  return async (...args) => {
    const now = Date.now();

    // 防抖：如果距离上次保存时间太短，跳过
    if (now - lastSaveTime < MIN_SAVE_INTERVAL) {
      console.log('[AutoSave] 保存操作太频繁，跳过');
      return;
    }

    if (realmService?.realmOpenFailed || !realmService?.canUseRealmForWrites?.()) {
      console.error('[AutoSave] 跳过保存函数执行：Realm 不可用');
      return;
    }

    lastSaveTime = now;

    try {
      console.log('[AutoSave] 执行保存...');
      await saveFunction(...args);

      // 保存后立即刷新到磁盘
      await realmService.forceFlush();
      console.log('[AutoSave] 保存并刷新完成');
    } catch (error) {
      console.error('[AutoSave] 保存失败:', error);
      throw error;
    }
  };
};

export default useAutoSaveOnExit;


