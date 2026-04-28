"""
实时转写服务
提供流式音频处理和实时转写功能
"""

import os
import logging
import tempfile
import threading
import time
import uuid
import json
import base64
import numpy as np
from queue import Queue
from django.utils import timezone
from django.conf import settings

from voice_recognition.models import Transcription
from voice_recognition.utils.netcheck import is_network_available

logger = logging.getLogger('backend')

# 尝试导入必要的库
try:
    import torch
    import librosa
    import soundfile as sf
    from faster_whisper import WhisperModel
    REALTIME_TRANSCRIPTION_AVAILABLE = True
except ImportError:
    REALTIME_TRANSCRIPTION_AVAILABLE = False
    # 仅在调试级别记录，避免在每次启动时显示警告
    logger.debug("未安装实时转写所需的库，实时转写功能不可用")


class RealtimeTranscriptionService:
    """
    实时转写服务类
    提供流式音频处理和实时转写功能
    """

    # 单例模式
    _instance = None
    _lock = None

    def __new__(cls, *args, **kwargs):
        if cls._lock is None:
            import threading
            cls._lock = threading.Lock()

        with cls._lock:
            if cls._instance is None:
                cls._instance = super(RealtimeTranscriptionService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        """初始化"""
        # 避免重复初始化
        if getattr(self, '_initialized', False):
            return

        # 模型配置
        self.model_size = "small"  # 使用小模型以提高实时性能
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.compute_type = "float16" if self.device == "cuda" else "float32"

        # 转写模型
        self.model = None

        # 会话管理
        self.sessions = {}

        # 初始化模型
        if REALTIME_TRANSCRIPTION_AVAILABLE:
            try:
                # 加载模型
                self.model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type
                )
                logger.info(f"实时转写模型初始化成功，使用设备: {self.device}")
            except Exception as e:
                logger.error(f"实时转写模型初始化失败: {e}")

        # 初始化会话锁
        self.session_lock = threading.Lock()

        # 初始化完成标记
        self._initialized = True

    def create_session(self, user_id, language=None):
        """
        创建实时转写会话

        Args:
            user_id: 用户ID
            language: 语言代码，如'zh'、'en'等

        Returns:
            str: 会话ID
        """
        if not REALTIME_TRANSCRIPTION_AVAILABLE or self.model is None:
            logger.warning("实时转写功能不可用")
            return None

        with self.session_lock:
            # 生成会话ID
            session_id = str(uuid.uuid4())

            # 创建会话
            self.sessions[session_id] = {
                'user_id': user_id,
                'created_at': timezone.now(),
                'last_active': timezone.now(),
                'language': language or 'zh',
                'audio_queue': Queue(),
                'result_queue': Queue(),
                'is_processing': False,
                'is_finished': False,
                'thread': None,
                'audio_buffer': [],
                'sample_rate': 16000,
                'interim_results': [],
                'final_results': [],
                'transcription_id': None
            }

            # 启动处理线程
            self._start_processing_thread(session_id)

            return session_id

    def _start_processing_thread(self, session_id):
        """
        启动音频处理线程

        Args:
            session_id: 会话ID
        """
        if session_id not in self.sessions:
            return

        session = self.sessions[session_id]

        # 创建处理线程
        thread = threading.Thread(
            target=self._process_audio_stream,
            args=(session_id,),
            daemon=True
        )

        # 启动线程
        session['is_processing'] = True
        thread.start()

        # 保存线程引用
        session['thread'] = thread

    def _process_audio_stream(self, session_id):
        """
        处理音频流

        Args:
            session_id: 会话ID
        """
        if session_id not in self.sessions:
            return

        session = self.sessions[session_id]
        audio_buffer = []
        last_process_time = time.time()

        try:
            while session['is_processing'] and not session['is_finished']:
                # 检查是否有新的音频数据
                if not session['audio_queue'].empty():
                    # 获取音频数据
                    audio_data = session['audio_queue'].get()

                    # 如果是None，表示结束
                    if audio_data is None:
                        break

                    # 添加到缓冲区
                    audio_buffer.extend(audio_data)

                    # 更新最后活动时间
                    session['last_active'] = timezone.now()

                # 定期处理缓冲区中的音频
                current_time = time.time()
                if len(audio_buffer) > 0 and (current_time - last_process_time > 0.5 or len(audio_buffer) > session['sample_rate']):
                    # 处理音频
                    self._process_audio_chunk(session_id, audio_buffer)

                    # 清空缓冲区
                    audio_buffer = []

                    # 更新处理时间
                    last_process_time = current_time

                # 避免CPU占用过高
                time.sleep(0.01)

            # 处理剩余的音频
            if len(audio_buffer) > 0:
                self._process_audio_chunk(session_id, audio_buffer)

            # 标记会话已完成
            session['is_finished'] = True

            # 生成最终结果
            self._generate_final_result(session_id)

        except Exception as e:
            logger.error(f"处理音频流失败: {e}")

            # 标记会话已完成
            session['is_finished'] = True
            session['is_processing'] = False

    def _process_audio_chunk(self, session_id, audio_data):
        """
        处理音频块
        增强版：添加噪声过滤和更高效的处理

        Args:
            session_id: 会话ID
            audio_data: 音频数据
        """
        if session_id not in self.sessions:
            return

        session = self.sessions[session_id]

        try:
            # 转换为numpy数组
            audio_np = np.array(audio_data, dtype=np.float32)

            # 应用噪声过滤
            audio_np = self._apply_noise_reduction(audio_np, session['sample_rate'])

            # 应用音量归一化
            audio_np = self._normalize_audio(audio_np)

            # 转写音频 - 直接使用 numpy 数组，消除磁盘 I/O 延迟
            segments, info = self.model.transcribe(
                audio_np,
                language=session['language'],
                task="transcribe",
                beam_size=1,  # 保持小的beam size以提高速度
                best_of=1,    # 保持小的best_of以提高速度
                temperature=0.0,  # 确定性输出
                vad_filter=True,  # 语音活动检测
                vad_parameters={
                    'threshold': 0.5,
                    'min_speech_duration_ms': 250,
                    'max_speech_duration_s': 30,
                    'min_silence_duration_ms': 500
                },
                word_timestamps=True
            )

            # 处理转写结果 (与之前相同)
            result_text = ""
            words_with_timestamps = []

            for segment in segments:
                result_text += segment.text
                if hasattr(segment, 'words') and segment.words:
                    for word in segment.words:
                        words_with_timestamps.append({
                            'word': word.word,
                            'start': word.start,
                            'end': word.end,
                            'probability': word.probability
                        })

            if result_text.strip():
                result_obj = {
                    'text': result_text.strip(),
                    'timestamp': time.time(),
                    'words': words_with_timestamps,
                    'language': info.language,
                    'language_probability': info.language_probability
                }
                session['interim_results'].append(result_obj)
                session['result_queue'].put({
                    'type': 'interim',
                    'text': result_text.strip(),
                    'timestamp': time.time(),
                    'words': words_with_timestamps,
                    'language': info.language
                })

        except Exception as e:
            logger.error(f"处理音频块失败: {e}")

    def _apply_noise_reduction(self, audio_data, sample_rate):
        """
        应用噪声过滤

        Args:
            audio_data: 音频数据
            sample_rate: 采样率

        Returns:
            numpy.ndarray: 过滤后的音频数据
        """
        try:
            # 如果音频太短，直接返回
            if len(audio_data) < sample_rate * 0.1:  # 少于100ms
                return audio_data

            # 简单的高通滤波器 - 去除低频噪声
            from scipy import signal

            # 设计高通滤波器，截止频率为100Hz
            b, a = signal.butter(4, 100/(sample_rate/2), 'highpass')

            # 应用滤波器
            filtered_audio = signal.filtfilt(b, a, audio_data)

            # 简单的噪声门限 - 抑制低于阈值的信号
            noise_threshold = 0.005  # 调整此值以适应不同的噪声环境
            gate_audio = np.copy(filtered_audio)
            gate_audio[np.abs(gate_audio) < noise_threshold] = 0

            return gate_audio
        except Exception as e:
            logger.warning(f"应用噪声过滤失败，使用原始音频: {e}")
            return audio_data

    def _normalize_audio(self, audio_data):
        """
        音量归一化

        Args:
            audio_data: 音频数据

        Returns:
            numpy.ndarray: 归一化后的音频数据
        """
        try:
            # 如果音频太安静，直接返回
            if np.max(np.abs(audio_data)) < 0.001:
                return audio_data

            # 计算RMS值
            rms = np.sqrt(np.mean(audio_data**2))

            # 如果RMS太小，可能是静音，直接返回
            if rms < 0.001:
                return audio_data

            # 目标RMS值 - 适中的音量
            target_rms = 0.2

            # 计算增益
            gain = target_rms / rms

            # 限制增益范围，避免过度放大噪声
            gain = min(max(gain, 0.1), 3.0)

            # 应用增益
            normalized_audio = audio_data * gain

            # 限制幅度，避免削波
            normalized_audio = np.clip(normalized_audio, -0.95, 0.95)

            return normalized_audio
        except Exception as e:
            logger.warning(f"音量归一化失败，使用原始音频: {e}")
            return audio_data

    def _generate_final_result(self, session_id):
        """
        生成最终转写结果
        增强版：更智能的文本处理和格式化

        Args:
            session_id: 会话ID
        """
        if session_id not in self.sessions:
            return

        session = self.sessions[session_id]

        try:
            # 收集所有临时结果
            interim_results = session['interim_results']

            # 如果没有结果，直接返回
            if not interim_results:
                logger.warning(f"会话 {session_id} 没有临时结果")
                session['is_finished'] = True
                session['is_processing'] = False
                return

            # 智能合并文本 - 处理重复和连贯性
            processed_text = self._smart_merge_text(interim_results)

            # 如果有足够的文本，进行最终处理
            if len(processed_text) > 10:
                # 计算会话持续时间
                session_duration = (timezone.now() - session['created_at']).total_seconds()

                # 创建转写记录
                transcription = Transcription(
                    user_id=session['user_id'],
                    text=processed_text,
                    language=session['language'],
                    duration=session_duration,
                    status='completed',
                    source='realtime',
                    created_at=session['created_at'],
                    updated_at=timezone.now()
                )

                # 构建更准确的分段
                segments = self._build_accurate_segments(interim_results, session['created_at'])

                # 保存分段信息
                transcription.segments = segments
                transcription.save()

                # 保存转写ID
                session['transcription_id'] = str(transcription.id)

                # 将最终结果放入队列
                session['result_queue'].put({
                    'type': 'final',
                    'text': processed_text,
                    'transcription_id': str(transcription.id),
                    'timestamp': time.time(),
                    'duration': session_duration,
                    'segments': segments
                })
            else:
                logger.warning(f"会话 {session_id} 文本太短，不创建转写记录")

                # 仍然返回处理后的文本
                session['result_queue'].put({
                    'type': 'final',
                    'text': processed_text,
                    'timestamp': time.time(),
                    'duration': (timezone.now() - session['created_at']).total_seconds()
                })

            # 标记会话已完成
            session['is_finished'] = True
            session['is_processing'] = False

        except Exception as e:
            logger.error(f"生成最终转写结果失败: {e}")

            # 确保会话被标记为已完成
            session['is_finished'] = True
            session['is_processing'] = False

    def _smart_merge_text(self, interim_results):
        """
        智能合并文本，处理重复和连贯性

        Args:
            interim_results: 临时结果列表

        Returns:
            str: 处理后的文本
        """
        if not interim_results:
            return ""

        # 如果只有一个结果，直接返回
        if len(interim_results) == 1:
            return interim_results[0]['text']

        # 收集所有文本片段
        text_segments = []
        for result in interim_results:
            text = result.get('text', '')
            if text:
                text_segments.append(text)

        # 如果没有文本片段，返回空字符串
        if not text_segments:
            return ""

        # 使用文本重叠检测合并片段
        merged_text = text_segments[0]

        for i in range(1, len(text_segments)):
            current_text = text_segments[i]

            # 检查重叠
            overlap_found = False
            for overlap_size in range(min(len(merged_text), len(current_text)), 0, -1):
                if merged_text[-overlap_size:] == current_text[:overlap_size]:
                    # 找到重叠，合并文本
                    merged_text = merged_text + current_text[overlap_size:]
                    overlap_found = True
                    break

            # 如果没有找到重叠，添加空格并附加
            if not overlap_found:
                merged_text = merged_text + " " + current_text

        # 清理文本 - 修复标点和空格
        cleaned_text = self._clean_text(merged_text)

        return cleaned_text

    def _clean_text(self, text):
        """
        清理文本，修复标点和空格 - 增强版
        专门优化中文文本处理

        Args:
            text: 原始文本

        Returns:
            str: 清理后的文本
        """
        import re

        # 替换多个空格为单个空格
        cleaned = ' '.join(text.split())

        # 中文标点符号列表
        cn_puncts = ['，', '。', '！', '？', '；', '：', '、', '"', '"', ''', ''', '（', '）', '【', '】', '《', '》']
        en_puncts = [',', '.', '!', '?', ';', ':', '/', '"', '"', "'", "'", '(', ')', '[', ']', '<', '>']

        # 1. 修复中文标点前的空格
        for punct in cn_puncts:
            cleaned = cleaned.replace(' ' + punct, punct)

        # 2. 修复英文标点前的空格（除了左括号等）
        for punct in [',', '.', '!', '?', ':', ';', ')', ']', '}']:
            cleaned = cleaned.replace(' ' + punct, punct)

        # 3. 确保英文标点后有空格（如果后面跟的是英文字符）
        for punct in [',', '.', '!', '?', ':', ';']:
            # 使用正则表达式确保只在标点后面是英文字母时添加空格
            cleaned = re.sub(f'{punct}([a-zA-Z])', f'{punct} \\1', cleaned)

        # 4. 修复中英文混合时的空格问题
        # 在中文和英文之间添加空格
        cleaned = re.sub(r'([a-zA-Z])([\u4e00-\u9fff])', r'\1 \2', cleaned)
        cleaned = re.sub(r'([\u4e00-\u9fff])([a-zA-Z])', r'\1 \2', cleaned)

        # 5. 修复数字和单位之间的空格
        cleaned = re.sub(r'(\d)([a-zA-Z])', r'\1 \2', cleaned)

        # 6. 修复重复的标点符号
        for punct in cn_puncts + en_puncts:
            cleaned = re.sub(f'{re.escape(punct)}{re.escape(punct)}+', punct, cleaned)

        # 7. 修复错误的中英文标点混用
        punct_pairs = zip(cn_puncts, en_puncts)
        for cn, en in punct_pairs:
            # 如果中文内容中出现了英文标点，替换为中文标点
            if re.search(r'[\u4e00-\u9fff]', cleaned):
                cleaned = cleaned.replace(en, cn)

        # 8. 修复句子结构
        # 确保句子以正确的标点结束
        if cleaned and not re.search(r'[。！？.!?]$', cleaned):
            # 检查最后一个字符是否是中文
            if re.search(r'[\u4e00-\u9fff]$', cleaned):
                cleaned += '。'
            elif re.search(r'[a-zA-Z]$', cleaned):
                cleaned += '.'

        # 9. 修复错误的空格
        # 删除中文标点周围的所有空格
        for punct in cn_puncts:
            cleaned = cleaned.replace(' ' + punct + ' ', punct)
            cleaned = cleaned.replace(' ' + punct, punct)
            cleaned = cleaned.replace(punct + ' ', punct)

        # 10. 修复引号问题
        cleaned = cleaned.replace(' " ', ' "')
        cleaned = cleaned.replace(' " ', '" ')
        cleaned = cleaned.replace(' ' ', ' '')
        cleaned = cleaned.replace(' ' ', '' ')

        # 11. 最终清理 - 删除多余空格
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        return cleaned

    def _build_accurate_segments(self, interim_results, session_start_time):
        """
        构建更准确的分段信息

        Args:
            interim_results: 临时结果列表
            session_start_time: 会话开始时间

        Returns:
            list: 分段列表
        """
        segments = []
        session_start_timestamp = session_start_time.timestamp()

        for i, result in enumerate(interim_results):
            # 获取基本信息
            text = result.get('text', '')
            timestamp = result.get('timestamp', 0)
            words = result.get('words', [])

            # 计算相对时间
            relative_start = timestamp - session_start_timestamp

            # 如果有单词级时间戳，使用它们计算更准确的持续时间
            if words:
                # 找到第一个和最后一个单词的时间戳
                first_word = words[0]
                last_word = words[-1]

                word_start = first_word.get('start', 0)
                word_end = last_word.get('end', word_start + 2.0)

                # 计算持续时间
                duration = word_end - word_start

                # 创建分段
                segments.append({
                    'id': i,
                    'start': relative_start,
                    'end': relative_start + duration,
                    'text': text,
                    'words': words
                })
            else:
                # 如果没有单词级时间戳，使用估计的持续时间
                estimated_duration = len(text.split()) * 0.3  # 每个单词约0.3秒

                segments.append({
                    'id': i,
                    'start': relative_start,
                    'end': relative_start + max(1.0, estimated_duration),
                    'text': text
                })

        return segments

    def add_audio_chunk(self, session_id, audio_chunk):
        """
        添加音频块

        Args:
            session_id: 会话ID
            audio_chunk: 音频数据块（base64编码的字符串或音频数据数组）

        Returns:
            bool: 是否成功
        """
        if session_id not in self.sessions:
            logger.warning(f"会话 {session_id} 不存在")
            return False

        session = self.sessions[session_id]

        # 检查会话是否已结束
        if session['is_finished']:
            logger.warning(f"会话 {session_id} 已结束")
            return False

        try:
            # 解析音频数据
            if isinstance(audio_chunk, str):
                # 解码base64
                audio_data = base64.b64decode(audio_chunk)

                # 转换为浮点数组
                audio_array = np.frombuffer(audio_data, dtype=np.float32)
            else:
                audio_array = np.array(audio_chunk, dtype=np.float32)

            # 添加到队列
            session['audio_queue'].put(audio_array.tolist())

            # 更新最后活动时间
            session['last_active'] = timezone.now()

            return True

        except Exception as e:
            logger.error(f"添加音频块失败: {e}")
            return False

    def get_results(self, session_id):
        """
        获取转写结果

        Args:
            session_id: 会话ID

        Returns:
            list: 转写结果列表
        """
        if session_id not in self.sessions:
            logger.warning(f"会话 {session_id} 不存在")
            return []

        session = self.sessions[session_id]
        results = []

        # 获取所有可用结果
        while not session['result_queue'].empty():
            results.append(session['result_queue'].get())

        return results

    def finish_session(self, session_id):
        """
        结束会话

        Args:
            session_id: 会话ID

        Returns:
            dict: 最终结果
        """
        with self.session_lock:
            if session_id not in self.sessions:
                logger.warning(f"会话 {session_id} 不存在")
                return None

            session = self.sessions[session_id]

            # 标记会话结束
            session['is_finished'] = True

            # 添加结束标记
            session['audio_queue'].put(None)

        # 等待处理完成 (释放锁后再等待线程合并)
        if session['thread'] and session['thread'].is_alive():
            session['thread'].join(timeout=5.0)

        # 获取最终结果
        final_result = None
        while not session['result_queue'].empty():
            result = session['result_queue'].get()
            if result['type'] == 'final':
                final_result = result

        # 清理会话 (重新加锁执行 pop)
        with self.session_lock:
            self.sessions.pop(session_id, None)

        return final_result

    def get_session_status(self, session_id):
        """
        获取会话状态

        Args:
            session_id: 会话ID

        Returns:
            dict: 会话状态
        """
        if session_id not in self.sessions:
            return {
                'exists': False,
                'message': '会话不存在'
            }

        session = self.sessions[session_id]

        return {
            'exists': True,
            'is_processing': session['is_processing'],
            'is_finished': session['is_finished'],
            'created_at': session['created_at'].isoformat(),
            'last_active': session['last_active'].isoformat(),
            'language': session['language'],
            'interim_results_count': len(session['interim_results']),
            'transcription_id': session['transcription_id']
        }

    def clean_inactive_sessions(self, max_age_minutes=30):
        """
        清理不活跃的会话

        Args:
            max_age_minutes: 最大不活跃时间（分钟）

        Returns:
            int: 清理的会话数量
        """
        now = timezone.now()
        sessions_to_remove = []

        # 查找不活跃的会话
        for session_id, session in self.sessions.items():
            # 计算不活跃时间
            inactive_time = (now - session['last_active']).total_seconds() / 60

            # 如果超过最大不活跃时间，标记为删除
            if inactive_time > max_age_minutes:
                sessions_to_remove.append(session_id)

        # 结束并删除会话
        for session_id in sessions_to_remove:
            self.finish_session(session_id)

        return len(sessions_to_remove)
