import { Platform, PermissionsAndroid } from 'react-native';
import Sound from 'react-native-sound';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { analyticsService } from './analytics';
import { aiService } from './aiService';

// 启用Sound模块的错误日志
Sound.setCategory('Playback');

class AudioService {
  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
    this.isRecording = false;
    this.currentSound = null;
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
        return false;
      }
    }
    return true;
  }

  async startRecording(options = {}) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('没有录音权限');
      }

      // 设置录音参数
      const audioSet = {
        AudioEncoderAndroid: AudioRecorderPlayer.AudioEncoderAndroid.AAC,
        AudioSourceAndroid: AudioRecorderPlayer.AudioSourceAndroid.MIC,
        AVEncoderAudioQualityKeyIOS: AudioRecorderPlayer.AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AudioRecorderPlayer.AVEncodingOption.aac,
        OutputFormatAndroid: AudioRecorderPlayer.OutputFormatAndroid.AAC_ADTS,
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
        return null;
      }

      // 停止录音
      const result = await this.audioRecorderPlayer.stopRecorder();
      this.isRecording = false;

      // 移除监听器
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

export const audioService = new AudioService();