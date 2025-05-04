# 文本转语音服务目录

本目录包含与文本转语音(TTS)相关的服务。

## 文件列表

- **ttsService.js**: 文本转语音服务，提供将文本转换为语音的功能

## 使用方法

```javascript
import { ttsService } from '../services/tts';

// 将文本转换为语音
ttsService.speak('你好，世界').then(() => {
  console.log('语音播放完成');
});

// 停止语音
ttsService.stop().then(() => {
  console.log('语音已停止');
});

// 设置语音参数
ttsService.setOptions({
  rate: 0.5,  // 语速
  pitch: 1.0, // 音调
  language: 'zh-CN' // 语言
}).then(() => {
  console.log('语音参数设置成功');
});
```
