/**
 * 原生音频服务
 * 提供完整的录音和播放功能，替代AudioRecorderPlayer
 */
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import Voice from '@react-native-voice/voice';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

class NativeAudioService {
  constructor() {
    this.isRecording = false;
    this.isPlaying = false;
    this.recordingPath = '';
    this.recordingStartTime = 0;
    this.recordingDuration = 0;
    this.recordingTimer = null;
    this.listeners = new Map();
    
    // 直接使用原生AudioRecorderPlayer
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    console.log('NativeAudioService: AudioRecorderPlayer 初始化成功');
    
    // 初始化语音识别
    this.initializeVoice();
  }

  /**
   * 初始化语音识别服务
   */
  initializeVoice() {
    try {
      Voice.onSpeechStart = this.onSpeechStart.bind(this);
      Voice.onSpeechRecognized = this.onSpeechRecognized.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);
      Voice.onSpeechVolumeChanged = this.onSpeechVolumeChanged.bind(this);
      
      console.log('NativeAudioService: 语音识别服务初始化成功');
    } catch (error) {
      console.warn('NativeAudioService: 语音识别初始化失败:', error);
    }
  }

  /**
   * 检查录音权限
   */
  async checkPermissions() {
    if (Platform.OS === 'android') {
      try {
        // 先检查当前权限状态
        const recordPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

        if (recordPermission) {
          console.log('NativeAudioService: 录音权限已授予');
          return true;
        }

        // 如果没有权限，请求权限
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '录音权限',
            message: '应用需要录音权限来使用语音功能',
            buttonNeutral: '稍后询问',
            buttonNegative: '拒绝',
            buttonPositive: '允许',
          }
        );

        const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log('NativeAudioService: 权限请求结果:', hasPermission ? '已授予' : '被拒绝');
        return hasPermission;
      } catch (err) {
        console.error('NativeAudioService: 权限请求失败:', err);
        return false;
      }
    }
    return true; // iOS权限通过Info.plist配置
  }

  /**
   * 获取安全的音频配置常量
   */
  getAudioConstants() {
    try {
      // 尝试获取AudioRecorderPlayer的常量
      if (AudioRecorderPlayer) {
        return {
          AudioEncoderAndroid: AudioRecorderPlayer.AudioEncoderAndroidType?.AAC || 3,
          AudioSourceAndroid: AudioRecorderPlayer.AudioSourceAndroidType?.MIC || 1,
          AVEncoderAudioQualityKeyIOS: AudioRecorderPlayer.AVEncoderAudioQualityIOSType?.high || 2,
          AVNumberOfChannelsKeyIOS: 2,
          AVFormatIDKeyIOS: AudioRecorderPlayer.AVEncodingOption?.aac || 'aac',
          OutputFormatAndroid: AudioRecorderPlayer.OutputFormatAndroidType?.AAC_ADTS || 3,
        };
      }
    } catch (error) {
      console.warn('NativeAudioService: 获取音频常量失败，使用默认值:', error);
    }
    
    // 降级到默认值
    return {
      AudioEncoderAndroid: 3, // AAC
      AudioSourceAndroid: 1,  // MIC
      AVEncoderAudioQualityKeyIOS: 2, // high
      AVNumberOfChannelsKeyIOS: 2,
      AVFormatIDKeyIOS: 'aac',
      OutputFormatAndroid: 3, // AAC_ADTS
    };
  }

  /**
   * 开始录音
   */
  async startRecording(options = {}) {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        throw new Error('录音权限被拒绝');
      }

      if (this.isRecording) {
        throw new Error('正在录音中');
      }

      // 检查AudioRecorderPlayer是否可用
      if (!this.audioRecorderPlayer) {
        throw new Error('音频录制器不可用');
      }

      // 生成录音文件路径
      const timestamp = Date.now();
      const fileName = options.fileName || `recording_${timestamp}`;
      const extension = Platform.OS === 'ios' ? 'm4a' : 'mp3';
      
      this.recordingPath = Platform.select({
        ios: `${RNFS.DocumentDirectoryPath}/${fileName}.${extension}`,
        android: `${RNFS.ExternalDirectoryPath}/${fileName}.${extension}`,
      });

      // 使用安全的音频配置
      const audioSet = {
        ...this.getAudioConstants(),
        ...options,
      };
      
      await this.audioRecorderPlayer.startRecorder(this.recordingPath, audioSet);

      // 可选：同时启动语音识别（保留原有逻辑）
      try { await Voice.start('zh-CN'); } catch (e) { /* 某些设备可能无语音服务，忽略不致命 */ }
      
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.recordingDuration = 0;
      
      // 启动计时器
      this.recordingTimer = setInterval(() => {
        this.recordingDuration = Date.now() - this.recordingStartTime;
        this.notifyListeners('recordingProgress', {
          duration: this.recordingDuration,
          formattedTime: this.formatTime(this.recordingDuration)
        });
      }, 100);

      this.notifyListeners('recordingStart', { path: this.recordingPath });
      console.log('NativeAudioService: 开始录音:', this.recordingPath);
      
      return this.recordingPath;
    } catch (error) {
      console.error('NativeAudioService: 开始录音失败:', error);
      throw error;
    }
  }

  /**
   * 停止录音
   */
  async stopRecording() {
    try {
      if (!this.isRecording) {
        throw new Error('当前没有在录音');
      }
      // 停止录音器
      try { await this.audioRecorderPlayer.stopRecorder(); } catch {}
      // 停止语音识别（若已启动）
      try { await Voice.stop(); } catch {}
      
      this.isRecording = false;
      
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }

      const finalDuration = Date.now() - this.recordingStartTime;
      
      this.notifyListeners('recordingStop', {
        path: this.recordingPath,
        duration: finalDuration,
        formattedTime: this.formatTime(finalDuration)
      });

      console.log('NativeAudioService: 录音结束:', this.recordingPath);
      
      // 校验文件是否存在，若需则补加 file:// 前缀供播放器使用
      const exists = await RNFS.exists(this.recordingPath.replace('file://', ''));
      if (!exists) {
        console.warn('NativeAudioService: 录音文件未找到，路径:', this.recordingPath);
      }

      return {
        path: this.recordingPath,
        duration: finalDuration
      };
    } catch (error) {
      console.error('NativeAudioService: 停止录音失败:', error);
      throw error;
    }
  }

  /**
   * 开始语音转文字
   */
  async startSpeechToText(language = 'zh-CN') {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        throw new Error('录音权限被拒绝');
      }

      await Voice.start(language);
      console.log('NativeAudioService: 开始语音转文字');
    } catch (error) {
      console.error('NativeAudioService: 语音转文字启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止语音转文字
   */
  async stopSpeechToText() {
    try {
      await Voice.stop();
      console.log('NativeAudioService: 停止语音转文字');
    } catch (error) {
      console.error('NativeAudioService: 停止语音转文字失败:', error);
      throw error;
    }
  }

  /**
   * 播放音频文件
   */
  async playAudio(filePath) {
    try {
      // 处理不同的路径格式
      let finalPath = filePath;

      // 如果是相对路径，转换为绝对路径
      if (!filePath.startsWith('/') && !filePath.startsWith('file://')) {
        finalPath = `${RNFS.DocumentDirectoryPath}/${filePath}`;
      }

      // 检查文件是否存在
      const cleanPath = finalPath.replace('file://', '');
      const exists = await RNFS.exists(cleanPath);
      if (!exists) {
        console.error('NativeAudioService: 文件不存在:', cleanPath);
        throw new Error(`音频文件不存在: ${cleanPath}`);
      }

      // 尝试使用AudioRecorderPlayer播放
      try {
        if (!this.audioRecorderPlayer) {
          if (AudioRecorderPlayer && typeof AudioRecorderPlayer === 'function') {
            this.audioRecorderPlayer = new AudioRecorderPlayer();
          } else if (
            AudioRecorderPlayer &&
            typeof AudioRecorderPlayer.default === 'function'
          ) {
            this.audioRecorderPlayer = new AudioRecorderPlayer.default();
          } else {
            throw new Error('AudioRecorderPlayer 不可用');
          }
        }

        const result = await this.audioRecorderPlayer.startPlayer(finalPath);
        console.log('NativeAudioService: 音频播放开始:', result);

        // 添加播放监听器
        this.audioRecorderPlayer.addPlayBackListener((e) => {
          if (e.currentPosition === e.duration) {
            this.audioRecorderPlayer.stopPlayer();
            this.audioRecorderPlayer.removePlayBackListener();
          }
        });

      } catch (playerError) {
        console.warn('AudioRecorderPlayer播放失败，尝试系统播放器:', playerError);

        // 回退到系统默认播放器
        const { FileViewer } = require('react-native-file-viewer');
        await FileViewer.open(cleanPath);
      }

      console.log('NativeAudioService: 播放音频:', finalPath);
    } catch (error) {
      console.error('NativeAudioService: 播放音频失败:', error);
      Alert.alert('播放失败', '无法播放音频文件: ' + error.message);
    }
  }

  /**
   * 格式化时间
   */
  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }


  /**
   * 添加事件监听器
   */
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * 移除事件监听器
   */
  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * 通知监听器
   */
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('监听器回调错误:', error);
        }
      });
    }
  }

  // 语音识别事件处理
  onSpeechStart(e) {
    console.log('语音识别开始:', e);
    this.notifyListeners('speechStart', e);
  }

  onSpeechRecognized(e) {
    console.log('语音识别中:', e);
    this.notifyListeners('speechRecognized', e);
  }

  onSpeechEnd(e) {
    console.log('语音识别结束:', e);
    this.notifyListeners('speechEnd', e);
  }

  onSpeechError(e) {
    console.log('语音识别错误:', e);
    this.notifyListeners('speechError', e);
  }

  onSpeechResults(e) {
    console.log('语音识别结果:', e);
    this.notifyListeners('speechResults', e);
  }

  onSpeechPartialResults(e) {
    console.log('语音识别部分结果:', e);
    this.notifyListeners('speechPartialResults', e);
  }

  onSpeechVolumeChanged(e) {
    this.notifyListeners('speechVolumeChanged', e);
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
    }
    
    Voice.destroy().then(Voice.removeAllListeners);
    this.listeners.clear();
  }
}

// 创建单例实例
const nativeAudioService = new NativeAudioService();

export default nativeAudioService;
