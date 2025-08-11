/**
 * 后台加载管理器
 * 管理文档的后台加载、状态持久化和任务队列
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { documentCacheService } from '../cache/DocumentCacheService';

class BackgroundLoadManager {
  constructor() {
    this.loadingTasks = new Map();
    this.taskQueue = [];
    this.isProcessing = false;
    this.maxConcurrentTasks = 3;
    this.currentTasks = 0;
    
    // 存储键
    this.STORAGE_KEYS = {
      LOADING_STATES: 'bg_loading_states',
      TASK_QUEUE: 'bg_task_queue',
      LOAD_PROGRESS: 'bg_load_progress_'
    };
    
    this.init();
  }

  /**
   * 初始化后台加载管理器
   */
  async init() {
    try {
      console.log('BackgroundLoadManager: 初始化后台加载管理器');
      
      // 恢复加载状态
      await this.restoreLoadingStates();
      
      // 恢复任务队列
      await this.restoreTaskQueue();
      
      // 监听应用状态变化
      this.setupAppStateListener();
      
      // 开始处理队列
      this.processQueue();
      
      console.log('BackgroundLoadManager: 初始化完成');
    } catch (error) {
      console.error('BackgroundLoadManager: 初始化失败:', error);
    }
  }

  /**
   * 设置应用状态监听器
   */
  setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
      console.log('BackgroundLoadManager: 应用状态变化:', nextAppState);
      
      if (nextAppState === 'background') {
        // 应用进入后台，保存状态
        this.saveLoadingStates();
        this.saveTaskQueue();
      } else if (nextAppState === 'active') {
        // 应用回到前台，恢复处理
        this.processQueue();
      }
    });
  }

  /**
   * 添加后台加载任务
   */
  async addBackgroundTask(taskId, taskConfig) {
    try {
      console.log(`BackgroundLoadManager: 添加后台任务 ${taskId}`);
      
      const task = {
        id: taskId,
        type: taskConfig.type || 'document',
        uri: taskConfig.uri,
        title: taskConfig.title,
        priority: taskConfig.priority || 'normal',
        createdAt: Date.now(),
        status: 'pending',
        progress: 0,
        retryCount: 0,
        maxRetries: taskConfig.maxRetries || 3,
        ...taskConfig
      };

      // 添加到任务队列
      this.taskQueue.push(task);
      this.loadingTasks.set(taskId, task);
      
      // 保存状态
      await this.saveTaskQueue();
      await this.saveLoadingStates();
      
      // 开始处理
      this.processQueue();
      
      return task;
    } catch (error) {
      console.error(`BackgroundLoadManager: 添加任务 ${taskId} 失败:`, error);
      throw error;
    }
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId, progress, status = null) {
    try {
      const task = this.loadingTasks.get(taskId);
      if (!task) return;

      task.progress = Math.max(0, Math.min(100, progress));
      if (status) task.status = status;
      task.updatedAt = Date.now();

      // 保存进度
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.LOAD_PROGRESS + taskId,
        JSON.stringify({
          progress: task.progress,
          status: task.status,
          updatedAt: task.updatedAt
        })
      );

      console.log(`BackgroundLoadManager: 任务 ${taskId} 进度更新: ${progress}%`);
    } catch (error) {
      console.warn(`BackgroundLoadManager: 更新任务 ${taskId} 进度失败:`, error);
    }
  }

  /**
   * 完成任务
   */
  async completeTask(taskId, result = null) {
    try {
      const task = this.loadingTasks.get(taskId);
      if (!task) return;

      task.status = 'completed';
      task.progress = 100;
      task.completedAt = Date.now();
      task.result = result;

      console.log(`BackgroundLoadManager: 任务 ${taskId} 完成`);
      
      // 如果有结果，缓存它
      if (result) {
        await documentCacheService.cacheDocument(taskId, result, {
          type: task.type,
          uri: task.uri,
          title: task.title,
          completedAt: task.completedAt
        });
      }

      // 从队列中移除
      this.removeTaskFromQueue(taskId);
      this.currentTasks--;
      
      // 清理进度存储
      await AsyncStorage.removeItem(this.STORAGE_KEYS.LOAD_PROGRESS + taskId);
      
      // 继续处理队列
      this.processQueue();
    } catch (error) {
      console.error(`BackgroundLoadManager: 完成任务 ${taskId} 失败:`, error);
    }
  }

  /**
   * 任务失败处理
   */
  async failTask(taskId, error) {
    try {
      const task = this.loadingTasks.get(taskId);
      if (!task) return;

      task.retryCount++;
      task.lastError = error.message || String(error);
      task.updatedAt = Date.now();

      if (task.retryCount < task.maxRetries) {
        // 重试任务
        task.status = 'retrying';
        console.log(`BackgroundLoadManager: 任务 ${taskId} 重试 (${task.retryCount}/${task.maxRetries})`);
        
        // 延迟重试
        setTimeout(() => {
          this.processQueue();
        }, Math.pow(2, task.retryCount) * 1000); // 指数退避
      } else {
        // 任务彻底失败
        task.status = 'failed';
        console.error(`BackgroundLoadManager: 任务 ${taskId} 失败:`, error);
        
        this.removeTaskFromQueue(taskId);
        this.currentTasks--;
        
        // 清理进度存储
        await AsyncStorage.removeItem(this.STORAGE_KEYS.LOAD_PROGRESS + taskId);
      }

      await this.saveLoadingStates();
    } catch (saveError) {
      console.error(`BackgroundLoadManager: 处理任务 ${taskId} 失败时出错:`, saveError);
    }
  }

  /**
   * 处理任务队列
   */
  async processQueue() {
    if (this.isProcessing || this.currentTasks >= this.maxConcurrentTasks) {
      return;
    }

    this.isProcessing = true;

    try {
      // 按优先级排序任务
      const pendingTasks = this.taskQueue
        .filter(task => task.status === 'pending' || task.status === 'retrying')
        .sort((a, b) => {
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
        });

      for (const task of pendingTasks) {
        if (this.currentTasks >= this.maxConcurrentTasks) break;

        this.currentTasks++;
        task.status = 'loading';
        task.startedAt = Date.now();

        // 异步处理任务
        this.processTask(task).catch(error => {
          this.failTask(task.id, error);
        });
      }
    } catch (error) {
      console.error('BackgroundLoadManager: 处理队列失败:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 处理单个任务
   */
  async processTask(task) {
    try {
      console.log(`BackgroundLoadManager: 开始处理任务 ${task.id}`);
      
      await this.updateTaskProgress(task.id, 10, 'loading');

      let result;
      
      switch (task.type) {
        case 'document':
          result = await this.loadDocument(task);
          break;
        case 'pdf':
          result = await this.loadPDF(task);
          break;
        case 'word':
          result = await this.loadWord(task);
          break;
        case 'ppt':
          result = await this.loadPPT(task);
          break;
        case 'markdown':
          result = await this.loadMarkdown(task);
          break;
        default:
          throw new Error(`不支持的任务类型: ${task.type}`);
      }

      await this.completeTask(task.id, result);
    } catch (error) {
      await this.failTask(task.id, error);
    }
  }

  /**
   * 加载文档
   */
  async loadDocument(task) {
    const RNFS = require('react-native-fs');
    
    await this.updateTaskProgress(task.id, 30);
    
    // 读取文件
    const content = await RNFS.readFile(task.uri, 'utf8');
    
    await this.updateTaskProgress(task.id, 80);
    
    return {
      type: 'text',
      content,
      uri: task.uri,
      title: task.title
    };
  }

  /**
   * 加载Word文档
   */
  async loadWord(task) {
    const RNFS = require('react-native-fs');
    
    await this.updateTaskProgress(task.id, 20);
    
    // 读取为base64
    const base64Data = await RNFS.readFile(task.uri, 'base64');
    
    await this.updateTaskProgress(task.id, 60);
    
    return {
      type: 'word',
      base64: base64Data,
      uri: task.uri,
      title: task.title
    };
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId) {
    const task = this.loadingTasks.get(taskId);
    return task ? {
      id: task.id,
      status: task.status,
      progress: task.progress,
      error: task.lastError
    } : null;
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId) {
    try {
      const task = this.loadingTasks.get(taskId);
      if (!task) return;

      task.status = 'cancelled';
      this.removeTaskFromQueue(taskId);
      this.loadingTasks.delete(taskId);
      
      if (task.status === 'loading') {
        this.currentTasks--;
      }

      await AsyncStorage.removeItem(this.STORAGE_KEYS.LOAD_PROGRESS + taskId);
      await this.saveLoadingStates();
      
      console.log(`BackgroundLoadManager: 任务 ${taskId} 已取消`);
    } catch (error) {
      console.error(`BackgroundLoadManager: 取消任务 ${taskId} 失败:`, error);
    }
  }

  /**
   * 从队列中移除任务
   */
  removeTaskFromQueue(taskId) {
    this.taskQueue = this.taskQueue.filter(task => task.id !== taskId);
  }

  /**
   * 保存加载状态
   */
  async saveLoadingStates() {
    try {
      const states = Array.from(this.loadingTasks.entries()).map(([id, task]) => [id, {
        id: task.id,
        type: task.type,
        uri: task.uri,
        title: task.title,
        status: task.status,
        progress: task.progress,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }]);
      
      await AsyncStorage.setItem(this.STORAGE_KEYS.LOADING_STATES, JSON.stringify(states));
    } catch (error) {
      console.warn('BackgroundLoadManager: 保存加载状态失败:', error);
    }
  }

  /**
   * 恢复加载状态
   */
  async restoreLoadingStates() {
    try {
      const states = await AsyncStorage.getItem(this.STORAGE_KEYS.LOADING_STATES);
      if (states) {
        const parsedStates = JSON.parse(states);
        this.loadingTasks = new Map(parsedStates);
        console.log(`BackgroundLoadManager: 恢复了 ${parsedStates.length} 个加载状态`);
      }
    } catch (error) {
      console.warn('BackgroundLoadManager: 恢复加载状态失败:', error);
    }
  }

  /**
   * 保存任务队列
   */
  async saveTaskQueue() {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.TASK_QUEUE, JSON.stringify(this.taskQueue));
    } catch (error) {
      console.warn('BackgroundLoadManager: 保存任务队列失败:', error);
    }
  }

  /**
   * 恢复任务队列
   */
  async restoreTaskQueue() {
    try {
      const queue = await AsyncStorage.getItem(this.STORAGE_KEYS.TASK_QUEUE);
      if (queue) {
        this.taskQueue = JSON.parse(queue);
        console.log(`BackgroundLoadManager: 恢复了 ${this.taskQueue.length} 个任务`);
      }
    } catch (error) {
      console.warn('BackgroundLoadManager: 恢复任务队列失败:', error);
    }
  }
}

// 创建单例实例
export const backgroundLoadManager = new BackgroundLoadManager();
export default backgroundLoadManager;
