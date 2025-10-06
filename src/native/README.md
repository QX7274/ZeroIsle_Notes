# 原生模块

本目录包含零屿笔记应用中使用的原生模块，用于与设备原生功能交互，提供 JavaScript 无法直接访问的功能。

## 概述

原生模块是 React Native 应用中连接 JavaScript 代码和原生平台（iOS 和 Android）代码的桥梁。通过原生模块，我们可以访问设备的硬件功能、系统 API 和第三方原生库，从而扩展应用的功能。

在零屿笔记应用中，我们使用原生模块实现以下功能：

1. 离线 AI 模型推理
2. 相机和图像处理
3. 通知管理
4. 光学字符识别 (OCR)
5. 提醒和日历集成
6. 文本翻译
7. 语音识别和转写
8. 文件系统访问
9. 生物识别认证
10. 手写识别

## 模块列表

### AIAssistantModule

AI 助手原生模块，用于与设备上的 AI 功能交互。

- **loadModel**: 加载 AI 模型
- **unloadModel**: 卸载 AI 模型
- **generateText**: 生成文本
- **analyzeText**: 分析文本
- **generateTags**: 生成标签
- **generateSummary**: 生成摘要

### CameraModule

相机原生模块，用于访问设备相机功能。

- **takePicture**: 拍摄照片
- **startRecording**: 开始录制视频
- **stopRecording**: 停止录制视频
- **scanDocument**: 扫描文档
- **getCameraPermission**: 获取相机权限

### NotificationChannelModule

通知渠道原生模块，用于管理 Android 通知渠道。

- **createChannel**: 创建通知渠道
- **deleteChannel**: 删除通知渠道
- **getChannels**: 获取所有通知渠道
- **checkChannelExists**: 检查通知渠道是否存在

### ReminderModule

提醒原生模块，用于管理设备提醒功能。

- **createReminder**: 创建提醒
- **updateReminder**: 更新提醒
- **deleteReminder**: 删除提醒
- **getReminders**: 获取所有提醒
- **getReminderById**: 获取指定提醒
- **getCalendarPermission**: 获取日历权限

### TranslationModule

翻译原生模块，用于进行文本翻译。

- **translateText**: 翻译文本
- **detectLanguage**: 检测语言
- **getAvailableLanguages**: 获取可用语言列表
- **downloadLanguageModel**: 下载语言模型
- **deleteLanguageModel**: 删除语言模型

### VoiceRecognitionModule

语音识别原生模块，用于进行语音识别。

- **start**: 开始语音识别
- **stop**: 停止语音识别
- **cancel**: 取消语音识别
- **getRecognitionStatus**: 获取识别状态
- **getMicrophonePermission**: 获取麦克风权限

### FileSystemModule

文件系统原生模块，用于访问设备文件系统。

- **readFile**: 读取文件
- **writeFile**: 写入文件
- **deleteFile**: 删除文件
- **listFiles**: 列出目录中的文件
- **createDirectory**: 创建目录
- **getStoragePermission**: 获取存储权限

### BiometricAuthModule

生物识别认证原生模块，用于进行生物识别认证。

- **authenticate**: 进行认证
- **isBiometricAvailable**: 检查生物识别是否可用
- **getBiometricTypes**: 获取可用的生物识别类型

## 使用方法

### 导入原生模块

```javascript
import {
  VoiceRecognitionModule,
  AIAssistantModule
} from '../native';
```
```

### 使用语音识别模块

```javascript
// 使用语音识别模块进行语音识别
async function handleVoiceRecognition() {
  try {
    // 检查麦克风权限
    const hasPermission = await VoiceRecognitionModule.getMicrophonePermission();

    if (!hasPermission) {
      showErrorToast('需要麦克风权限才能进行语音识别');
      return;
    }

    // 开始语音识别
    setIsRecording(true);

    // 添加识别结果监听器
    const subscription = VoiceRecognitionModule.addListener('onResult', (result) => {
      setRecognizedText(result.text);
    });

    // 开始识别
    await VoiceRecognitionModule.start({
      language: 'zh-CN',
      maxDuration: 60000, // 最长录音时间（毫秒）
      partialResults: true // 返回部分结果
    });

    return () => {
      // 清理监听器
      subscription.remove();
    };
  } catch (error) {
    console.error('语音识别错误:', error);
    showErrorToast('语音识别失败');
    setIsRecording(false);
  }
}

// 停止语音识别
async function stopVoiceRecognition() {
  try {
    const result = await VoiceRecognitionModule.stop();
    setIsRecording(false);
    return result;
  } catch (error) {
    console.error('停止语音识别错误:', error);
    setIsRecording(false);
    return null;
  }
}
```

### 使用 AI 助手模块

```javascript
// 使用 AI 助手模块生成文本摘要
async function generateSummary(text) {
  try {
    // 检查模型是否已加载
    const isLoaded = await AIAssistantModule.isModelLoaded('text-summarization');

    if (!isLoaded) {
      // 显示加载指示器
      setIsLoadingModel(true);

      // 加载模型
      await AIAssistantModule.loadModel('text-summarization', {
        modelPath: 'models/text-summarization',
        quantized: true // 使用量化模型，减少内存占用
      });

      setIsLoadingModel(false);
    }

    // 生成摘要
    const summary = await AIAssistantModule.generateSummary(text, {
      maxLength: 100,
      minLength: 30,
      temperature: 0.7
    });

    return summary;
  } catch (error) {
    console.error('生成摘要错误:', error);
    showErrorToast('生成摘要失败');
    return null;
  }
}
```

## 注意事项

1. **权限管理**: 使用原生模块前，确保已获取相应的权限（相机、麦克风、存储等）。

2. **错误处理**: 原生模块可能抛出异常，确保使用 try/catch 捕获并处理这些异常。

3. **资源管理**: 某些原生模块（如相机、语音识别）使用设备资源，使用完毕后应及时释放。

4. **平台差异**: 注意 iOS 和 Android 平台的差异，某些功能可能只在特定平台上可用。

5. **性能考虑**: 原生模块调用涉及 JavaScript 和原生代码之间的桥接，频繁调用可能影响性能。

6. **版本兼容性**: 原生模块可能依赖特定版本的 React Native 或第三方库，升级时需注意兼容性。

7. **调试**: 原生模块的调试可能比较复杂，建议使用日志记录和原生调试工具。

8. **内存管理**: 某些原生模块（如 AI 模型）可能占用大量内存，注意内存管理。
