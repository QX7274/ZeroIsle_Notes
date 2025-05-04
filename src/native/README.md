# 原生模块

本目录包含应用中使用的原生模块，用于与设备原生功能交互。

## 模块列表

### AIAssistantModule

AI助手原生模块，用于与设备上的AI功能交互。

### CameraModule

相机原生模块，用于访问设备相机功能。

### NotificationChannelModule

通知渠道原生模块，用于管理Android通知渠道。

### OCRModule

OCR原生模块，用于进行光学字符识别。

### ReminderModule

提醒原生模块，用于管理设备提醒功能。

### TranslationModule

翻译原生模块，用于进行文本翻译。

### VoiceRecognitionModule

语音识别原生模块，用于进行语音识别。

## 使用方法

```javascript
import { OCRModule, VoiceRecognitionModule } from '../native';

// 使用OCR模块
async function recognizeText(imageUri) {
  try {
    const result = await OCRModule.recognizeText(imageUri);
    return result;
  } catch (error) {
    console.error('OCR error:', error);
    return null;
  }
}

// 使用语音识别模块
async function startVoiceRecognition() {
  try {
    const result = await VoiceRecognitionModule.start();
    return result;
  } catch (error) {
    console.error('Voice recognition error:', error);
    return null;
  }
}
```
