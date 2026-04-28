import { Platform, PermissionsAndroid } from 'react-native';
import Sound from 'react-native-sound';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { analyticsService } from '../analytics/analyticsService';
import aiService from '../ai/EnhancedAIService';

// 启用Sound模块的错误日?
Sound.setCategory('Playback');

class AudioService {
  constructor() {
    // 延迟初始化 AudioRecorderPlayer，避免构造函数调用错误
    this.audioRecorderPlayer = null;
    this.isRecording = false;
    this.currentSound = null;
  }

  /**
   * 初始化 AudioRecorderPlayer（延迟初始化）
   */
  _initAudioRecorderPlayer() {
    if (this.audioRecorderPlayer) {
      return; // 已初始化
    }

    try {
      // 尝试直接实例化
      this.audioRecorderPlayer = new AudioRecorderPlayer();
      console.log('AudioService: AudioRecorderPlayer 初始化成功');
    } catch (e) {
      console.warn('AudioService: 初始化 AudioRecorderPlayer 失败，音频功能将不可用:', e.message);
      this.audioRecorderPlayer = null;
    }
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '录音权限',
            message: '需要录音权限来录制音频',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('请求录音权限错误:', err);
        throw err;
      }
    }
    return true;
  }

  /**
   * 获取安全的音频配置常量
   */
  getAudioConstants() {
    try {
      // 尝试获取AudioRecorderPlayer的常量
      if (AudioRecorderPlayer) {
        return {
          AudioEncoderAndroid: AudioRecorderPlayer.AudioEncoderAndroid?.AAC || 3,
          AudioSourceAndroid: AudioRecorderPlayer.AudioSourceAndroid?.MIC || 1,
          AVEncoderAudioQualityKeyIOS: AudioRecorderPlayer.AVEncoderAudioQualityIOSType?.high || 2,
          AVNumberOfChannelsKeyIOS: 2,
          AVFormatIDKeyIOS: AudioRecorderPlayer.AVEncodingOption?.aac || 'aac',
          OutputFormatAndroid: AudioRecorderPlayer.OutputFormatAndroid?.AAC_ADTS || 3,
        };
      }
    } catch (error) {
      console.warn('AudioService: 获取音频常量失败，使用默认值:', error);
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

  async startRecording(options = {}) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('没有录音权限');
      }

      // 初始化 AudioRecorderPlayer
      this._initAudioRecorderPlayer();

      // 检查AudioRecorderPlayer是否可用
      if (!this.audioRecorderPlayer) {
        throw new Error('音频录制器不可用');
      }

      // 设置录音参数
      const audioSet = {
        ...this.getAudioConstants(),
        ...options,
      };

      // 生成录音文件路径
      const path = Platform.select({
        ios: 'recording.m4a',
        android: `sdcard/recording_${Date.now()}.mp3`,
      });

      // 开始录音
      const result = await this.audioRecorderPlayer.startRecorder(path, audioSet);
      this.isRecording = true;

      // 开始计时
      this.audioRecorderPlayer.addRecordBackListener((e) => {
        // 可以在这里处理录音时间更新
      });

      analyticsService.trackAudioAction('start_recording');
      return result;
    } catch (error) {
      console.error('开始录音错误:', error);
      analyticsService.trackError(error, { action: 'start_recording' });
      throw error;
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording) {
        // 业务语义：当前未在录音时无结果可停止，返回 null（非错误）
        return null;
      }

      // 停止录音
      const result = await this.audioRecorderPlayer.stopRecorder();
      this.isRecording = false;

      // 移除监听�?
      this.audioRecorderPlayer.removeRecordBackListener();

      analyticsService.trackAudioAction('stop_recording', { uri: result });
      return result;
    } catch (error) {
      console.error('停止录音错误:', error);
      analyticsService.trackError(error, { action: 'stop_recording' });
      throw error;
    }
  }

  async transcribeAudio(uri) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const text = await aiService.transcribeAudio(blob);
      analyticsService.trackAudioAction('transcribe', { uri });
      return text;
    } catch (error) {
      console.error('音频转写错误:', error);
      analyticsService.trackError(error, { action: 'transcribe' });
      throw error;
    }
  }

  async playAudio(uri) {
    return this.playSound(uri);
  }

  async playSound(filePath) {
    return new Promise((resolve, reject) => {
      try {
        // 如果有正在播放的音频，先停止
        if (this.currentSound) {
          this.currentSound.stop();
          this.currentSound.release();
        }

        // 创建新的Sound实例
        this.currentSound = new Sound(filePath, '', (error) => {
          if (error) {
            console.error('加载音频失败:', error);
            reject(error);
            return;
          }

          // 播放音频
          this.currentSound.play((success) => {
            if (success) {
              resolve(true);
            } else {
              reject(new Error('播放音频失败'));
            }
            this.currentSound.release();
            this.currentSound = null;
          });
        });

        analyticsService.trackAudioAction('play', { uri: filePath });
      } catch (error) {
        console.error('播放音频错误:', error);
        analyticsService.trackError(error, { action: 'play_audio' });
        reject(error);
      }
    });
  }

  stopPlayback() {
    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound.release();
      this.currentSound = null;
      analyticsService.trackAudioAction('stop_playback');
    }
  }
}

const audioService = new AudioService();

module.exports = audioService;
module.exports.default = audioService;
module.exports.audioService = audioService;
module.exports.AudioService = AudioService;
