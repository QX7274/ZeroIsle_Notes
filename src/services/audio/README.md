# 音频服务目录

本目录包含与音频处理相关的服务。

## 文件列表

- **audioService.js**: 音频服务，提供音频录制、播放、暂停等功能

## 使用方法

```javascript
import { audioService } from '../services/audio';

// 开始录音
audioService.startRecording().then(() => {
  console.log('开始录音');
});

// 停止录音
audioService.stopRecording().then(result => {
  console.log('录音文件路径:', result.filePath);
});

// 播放音频
audioService.play(filePath).then(() => {
  console.log('开始播放');
});

// 暂停播放
audioService.pause().then(() => {
  console.log('暂停播放');
});
```
