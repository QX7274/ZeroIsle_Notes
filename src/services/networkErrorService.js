/**
 * 网络错误处理服务
 * 统一管理应用中的网络错误显示和处理
 */
class NetworkErrorService {
  constructor() {
    this.errorHandlers = new Map();
    this.isShowingError = false;
    this.globalErrorListeners = new Set();
    this.currentError = null;
    this.currentErrorOptions = null;
  }

  // 添加全局错误监听器
  addGlobalErrorListener(listener) {
    console.log('NetworkErrorService: 添加全局错误监听器，当前数量:', this.globalErrorListeners.size);
    this.globalErrorListeners.add(listener);
    console.log('NetworkErrorService: 全局错误监听器添加成功，新数量:', this.globalErrorListeners.size);
  }

  // 移除全局错误监听器
  removeGlobalErrorListener(listener) {
    console.log('NetworkErrorService: 移除全局错误监听器，当前数量:', this.globalErrorListeners.size);
    this.globalErrorListeners.delete(listener);
    console.log('NetworkErrorService: 全局错误监听器移除成功，新数量:', this.globalErrorListeners.size);
  }

  // 通知所有全局错误监听器
  notifyGlobalErrorListeners(error, options) {
    console.log('NetworkErrorService: 开始通知全局错误监听器:', {
      error: error?.message || error,
      options,
      listenerCount: this.globalErrorListeners.size,
      timestamp: new Date().toISOString(),
    });

    // 为error对象添加必要的属性，以便NetworkErrorAlert组件能正确显示
    const enhancedError = {
      ...error,
      errorType: this.getNetworkErrorType(error),
      userMessage: options.customMessage || this.getUserFriendlyMessage(this.getNetworkErrorType(error)),
    };

    this.currentError = enhancedError;
    this.currentErrorOptions = options;

    this.globalErrorListeners.forEach((listener, index) => {
      try {
        console.log(`NetworkErrorService: 正在通知监听器 ${index + 1}/${this.globalErrorListeners.size}`);
        listener(enhancedError, options);
        console.log(`NetworkErrorService: 监听器 ${index + 1} 通知成功`);
      } catch (err) {
        console.error(`NetworkErrorService: 监听器 ${index + 1} 执行失败:`, err);
      }
    });

    console.log('NetworkErrorService: 全局错误监听器通知完成');
  }

  // 获取当前错误
  getCurrentError() {
    return this.currentError;
  }

  // 清除当前错误
  clearCurrentError() {
    console.log('NetworkErrorService: 清除当前错误');
    this.currentError = null;
    this.currentErrorOptions = null;
  }

  // 判断是否为网络错误
  isNetworkError(error) {
    if (!error) {return false;}

    if (error?.isNetworkError === true) {return true;}

    if (error?.request && !error?.response) {return true;}

    // 已收到明确 HTTP 响应时，说明链路已到达服务端。
    // 这类场景应继续按认证/业务/服务端错误处理，避免把 401/404/500
    // 误接成“网络连接问题”弹窗。
    if (error?.response) {return false;}

    // 检查错误代码
    if (error.code) {
      const networkCodes = [
        'NETWORK_ERROR',
        'ECONNABORTED',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'ERR_NETWORK',
        'ERR_INTERNET_DISCONNECTED',
      ];
      if (networkCodes.includes(error.code)) {return true;}
    }

    // 检查错误消息关键词
    const networkKeywords = [
      'network',
      'connection',
      'timeout',
      'unreachable',
      'refused',
      'aborted',
      'disconnected',
      'offline',
      'no internet',
      'network request failed',
    ];

    const errorMessage = (error.message || '').toLowerCase();
    return networkKeywords.some(keyword => errorMessage.includes(keyword));
  }

  // 获取网络错误类型
  getNetworkErrorType(error) {
    if (!this.isNetworkError(error)) {return 'unknown_error';}

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'timeout_error';
    }

    if (error.code === 'ECONNREFUSED' || error.message?.includes('refused')) {
      return 'network_error';
    }

    if (error.code === 'ENOTFOUND' || error.message?.includes('not found')) {
      return 'not_found_error';
    }

    if (error.message?.includes('network request failed') || error.message === 'Network Error') {
      return 'network_error';
    }

    return 'network_error';
  }

  // 获取用户友好的错误消息
  getUserFriendlyMessage(errorType, customMessage = null) {
    if (customMessage) {return customMessage;}

    const messages = {
      timeout_error: '请求超时，请检查网络连接后重试',
      network_error: '网络连接失败，请检查网络设置后重试',
      not_found_error: '服务器地址无法访问，请检查网络设置',
      unknown_error: '网络连接出现问题，请检查网络设置后重试',
    };

    return messages[errorType] || messages.unknown_error;
  }

  // 显示网络错误（已废弃，现在通过GlobalNetworkErrorHandler显示）
  showNetworkError(error, options = {}) {
    // 这个方法现在只用于日志记录，不再显示Alert
    console.log('网络错误（通过GlobalNetworkErrorHandler显示）:', {
      error: error?.message || error,
      options,
      timestamp: new Date().toISOString(),
    });
  }

  // 处理API错误
  handleApiError(error, options = {}) {
    console.log('NetworkErrorService: 开始处理API错误:', {
      error: error?.message || error,
      options,
      isNetworkError: this.isNetworkError(error),
      timestamp: new Date().toISOString(),
    });

    if (this.isNetworkError(error)) {
      const suppressGlobalUI = options.suppressGlobalUI ?? error?.config?.metadata?.suppressGlobalErrorUI ?? false;
      if (suppressGlobalUI) {
        console.warn('NetworkErrorService: 已按请求级配置静默全局网络提示', {
          context: options.context || 'API调用',
          error: error?.message || error,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      // 为网络错误添加默认重试功能
      const enhancedOptions = {
        ...options,
        onRetry: options.onRetry || this.createDefaultRetryFunction(error, options),
      };

      // 通知全局错误监听器，由GlobalNetworkErrorHandler显示
      console.log('NetworkErrorService: 检测到网络错误，准备通知全局监听器');
      this.notifyGlobalErrorListeners(error, enhancedOptions);

      // 不再使用原生 Alert 兜底，统一交由 NetworkErrorAlert 显示
      if (this.globalErrorListeners.size === 0) {
        console.warn('NetworkErrorService: 未挂载全局网络错误提示组件，已记录错误但不使用原生弹窗兜底');
      }

      // 记录错误日志
      console.warn('API网络错误:', {
        context: options.context || 'API调用',
        error: error?.message || error,
        timestamp: new Date().toISOString(),
      });
    } else {
      // 非网络错误：仅记录日志，避免开发环境告警弹层打断联调流程
      console.log('API错误:', {
        context: options.context || 'API调用',
        error: error?.message || error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 处理文档转换错误
  handleDocumentConversionError(error, options = {}) {
    if (this.isNetworkError(error)) {
      const resolvedContext = options.context || '文档转换';
      const enhancedOptions = {
        ...options,
        context: resolvedContext,
        customMessage: options.customMessage || '文档转换服务连接失败，请检查网络连接后重试',
        onRetry: options.onRetry || this.createDefaultRetryFunction(error, { context: resolvedContext }),
      };

      this.notifyGlobalErrorListeners(error, enhancedOptions);
    } else {
      console.error('文档转换错误:', {
        context: options.context || '文档转换',
        error: error?.message || error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 处理文件上传错误
  handleFileUploadError(error, options = {}) {
    if (this.isNetworkError(error)) {
      const resolvedContext = options.context || '文件上传';
      const enhancedOptions = {
        ...options,
        context: resolvedContext,
        customMessage: options.customMessage || '文件上传失败，请检查网络连接后重试',
        onRetry: options.onRetry || this.createDefaultRetryFunction(error, { context: resolvedContext }),
      };

      this.notifyGlobalErrorListeners(error, enhancedOptions);
    } else {
      console.error('文件上传错误:', {
        context: options.context || '文件上传',
        error: error?.message || error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 处理同步错误
  handleSyncError(error, options = {}) {
    if (this.isNetworkError(error)) {
      const resolvedContext = options.context || '数据同步';
      const enhancedOptions = {
        ...options,
        context: resolvedContext,
        customMessage: options.customMessage || '数据同步失败，请检查网络连接后重试',
        onRetry: options.onRetry || this.createDefaultRetryFunction(error, { context: resolvedContext }),
      };

      this.notifyGlobalErrorListeners(error, enhancedOptions);
    } else {
      console.error('同步错误:', {
        context: options.context || '数据同步',
        error: error?.message || error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 创建默认重试函数
  createDefaultRetryFunction(error, options) {
    return () => {
      console.log('NetworkErrorService: 执行默认重试功能:', {
        context: options.context || 'API调用',
        error: error?.message || error,
        timestamp: new Date().toISOString(),
      });

      // 根据错误类型提供不同的重试建议
      const errorType = this.getNetworkErrorType(error);
      let retryMessage = '';

      switch (errorType) {
        case 'timeout_error':
          retryMessage = '请求超时，建议稍后重试';
          break;
        case 'network_error':
          retryMessage = '网络连接问题，请检查网络设置后重试';
          break;
        case 'not_found_error':
          retryMessage = '服务器地址无法访问，请检查网络设置';
          break;
        default:
          retryMessage = '网络连接出现问题，请检查网络设置后重试';
      }

      console.warn('NetworkErrorService: 默认重试提示已简化为日志输出，避免原生弹窗打断统一交互样式', {
        retryMessage,
      });

      // 记录重试操作
      console.log('NetworkErrorService: 默认重试完成，显示提示:', retryMessage);
    };
  }

  // 清除错误状态
  clearErrorState() {
    this.isShowingError = false;
    this.clearCurrentError();
  }
}

const networkErrorService = new NetworkErrorService();

// 调试信息
console.log('NetworkErrorService: 服务实例创建成功');
console.log('NetworkErrorService: 可用方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(networkErrorService)));
console.log('NetworkErrorService: addGlobalErrorListener类型:', typeof networkErrorService.addGlobalErrorListener);

export default networkErrorService;
