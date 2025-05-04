# 语音组件

本目录包含与语音功能相关的组件。

## 组件列表

### AudioWaveform

音频波形组件，用于显示音频的波形图。

**主要功能**：
- 显示音频波形
- 支持播放进度显示
- 支持波形交互
- 支持波形样式自定义

### RealtimeTranscription

实时转写组件，用于实时将语音转换为文本。

**主要功能**：
- 支持实时语音转写
- 显示转写结果
- 支持转写结果编辑
- 支持转写历史记录

### RecordButton

录音按钮组件，用于控制录音。

**主要功能**：
- 支持开始/停止录音
- 显示录音状态
- 支持录音时长显示
- 支持录音音量显示

### SpeakerLabel

说话人标签组件，用于显示说话人信息。

**主要功能**：
- 显示说话人标签
- 支持说话人颜色区分
- 支持说话人编辑
- 支持说话人合并

### TranscriptionResult

转写结果组件，用于显示语音转写的结果。

**主要功能**：
- 显示转写文本
- 支持分段显示
- 支持时间戳显示
- 支持结果编辑

### VoiceCommandPanel

语音命令面板组件，用于显示和管理语音命令。

**主要功能**：
- 显示可用语音命令
- 支持命令执行
- 支持命令自定义
- 支持命令历史

## 使用方法

```javascript
import { RecordButton, TranscriptionResult, AudioWaveform } from '../components/voice';

function VoiceToTextScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPath, setRecordingPath] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const handleStartRecording = async () => {
    try {
      const path = await startRecording();
      setRecordingPath(path);
      setIsRecording(true);
    } catch (error) {
      console.error('Start recording error:', error);
    }
  };
  
  const handleStopRecording = async () => {
    try {
      await stopRecording();
      setIsRecording(false);
      
      // 转写录音
      setIsTranscribing(true);
      const result = await transcribeAudio(recordingPath);
      setTranscription(result);
      setIsTranscribing(false);
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
      setIsTranscribing(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <RecordButton
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
      />
      
      {recordingPath && (
        <AudioWaveform
          source={recordingPath}
          style={styles.waveform}
        />
      )}
      
      <TranscriptionResult
        transcription={transcription}
        isLoading={isTranscribing}
        onEdit={handleEditTranscription}
      />
    </View>
  );
}

function RealtimeTranscriptionScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  
  const handleStartRecording = async () => {
    try {
      await startRealtimeTranscription((text) => {
        setTranscribedText((prev) => prev + ' ' + text);
      });
      setIsRecording(true);
    } catch (error) {
      console.error('Start realtime transcription error:', error);
    }
  };
  
  const handleStopRecording = async () => {
    try {
      await stopRealtimeTranscription();
      setIsRecording(false);
    } catch (error) {
      console.error('Stop realtime transcription error:', error);
      setIsRecording(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <RecordButton
        isRecording={isRecording}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
      />
      
      <RealtimeTranscription
        text={transcribedText}
        isRecording={isRecording}
      />
    </View>
  );
}
```
