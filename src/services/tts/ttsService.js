import Tts from 'react-native-tts';
import { Platform } from 'react-native';
import { analyticsService } from '../analytics/analyticsService';

class TtsService {
  constructor() {
    this.initialized = false;
    this.init();
  }

  async init() {
    try {
      // 初始化TTS引擎
      if (Platform.OS === 'android') {
        await Tts.getInitStatus();
      }
      
      // 设置默认语言
      await Tts.setDefaultLanguage('zh-CN');
      
      // 设置语�?
      await Tts.setDefaultRate(0.5);
      
      // 设置音量
      await Tts.setDefaultVoice('com.apple.ttsbundle.Ting-Ting-compact');
      
      // 添加事件监听
      Tts.addEventListener('tts-start', this.onStart);
      Tts.addEventListener('tts-finish', this.onFinish);
      Tts.addEventListener('tts-cancel', this.onCancel);
      Tts.addEventListener('tts-error', this.onError);
      
      this.initialized = true;
      analyticsService.trackEvent('tts_initialized');
    } catch (error) {
      console.error('TTS初始化错�?', error);
      analyticsService.trackError(error, { action: 'tts_init' });
    }
  }

  onStart = (event) => {
    analyticsService.trackEvent('tts_started');
  };

  onFinish = (event) => {
    analyticsService.trackEvent('tts_finished');
  };

  onCancel = (event) => {
    analyticsService.trackEvent('tts_cancelled');
  };

  onError = (error) => {
    console.error('TTS错误:', error);
    analyticsService.trackError(error, { action: 'tts_error' });
  };

  async speak(text, options = {}) {
    try {
      if (!this.initialized) {
        await this.init();
      }
      
      // 停止当前正在播放的语�?
      await this.stop();
      
      // 设置语言
      if (options.language) {
        await Tts.setDefaultLanguage(options.language);
      }
      
      // 设置语�?
      if (options.rate) {
        await Tts.setDefaultRate(options.rate);
      }
      
      // 设置音量
      if (options.volume) {
        await Tts.setDefaultVoice(options.volume);
      }
      
      // 开始播�?
      await Tts.speak(text);
      
      analyticsService.trackEvent('tts_speak', { textLength: text.length });
    } catch (error) {
      console.error('TTS播放错误:', error);
      analyticsService.trackError(error, { action: 'tts_speak' });
      throw error;
    }
  }

  async stop() {
    try {
      await Tts.stop();
      analyticsService.trackEvent('tts_stopped');
    } catch (error) {
      console.error('TTS停止错误:', error);
      analyticsService.trackError(error, { action: 'tts_stop' });
    }
  }

  async getAvailableVoices() {
    try {
      const voices = await Tts.voices();
      return voices.filter(v => v.language);
    } catch (error) {
      console.error('获取TTS声音列表错误:', error);
      analyticsService.trackError(error, { action: 'tts_get_voices' });
      return [];
    }
  }
}

export const ttsService = new TtsService();

