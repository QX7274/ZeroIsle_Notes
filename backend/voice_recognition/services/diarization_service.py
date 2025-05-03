"""
说话人分离服务
提供音频中的说话人分离功能
支持在线和离线两种模式
增强版支持说话人声纹识别和记忆
"""

import logging
import os
import json
import tempfile
import numpy as np
import time
import uuid
import requests
from django.db import transaction
from django.conf import settings
from django.utils import timezone
from voice_recognition.models import Transcription, Speaker, SpeakerProfile
from voice_recognition.utils.netcheck import is_network_available

# 条件导入librosa，如果没有安装则提供一个占位符
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    # 创建一个占位符模块，避免导入错误
    class LibrosaPlaceholder:
        @staticmethod
        def load(*args, **kwargs):
            raise ImportError("Librosa is not installed. Please install it to use voice recognition features.")

        class feature:
            @staticmethod
            def mfcc(*args, **kwargs):
                raise ImportError("Librosa is not installed. Please install it to use voice recognition features.")

        @staticmethod
        def frames_to_time(*args, **kwargs):
            raise ImportError("Librosa is not installed. Please install it to use voice recognition features.")

# 条件导入pyannote.audio，如果没有安装则提供一个占位符
try:
    from pyannote.audio import Pipeline
    PYANNOTE_AVAILABLE = True
except ImportError:
    PYANNOTE_AVAILABLE = False

logger = logging.getLogger('backend')

class DiarizationService:
    """
    说话人分离服务类
    处理音频中的说话人分离
    支持在线和离线两种模式
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
                cls._instance = super(DiarizationService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, use_online=None):
        """
        初始化

        Args:
            use_online: 是否使用在线服务，None表示自动检测
        """
        # 避免重复初始化
        if getattr(self, '_initialized', False):
            return

        # 设置API密钥
        self.api_key = getattr(settings, 'HF_API_KEY', None)

        # 设置模式
        if use_online is None:
            # 自动检测
            self.use_online = is_network_available() and self.api_key
        else:
            self.use_online = use_online

        # 离线模型
        self.offline_model = None

        # 初始化完成标记
        self._initialized = True

        logger.info(f"说话人分离服务初始化完成，使用{'在线' if self.use_online else '离线'}模式")

    def get_service_status(self):
        """
        获取服务状态

        Returns:
            dict: 服务状态
        """
        return {
            'mode': 'online' if self.use_online else 'offline',
            'api_key_configured': bool(self.api_key),
            'offline_available': PYANNOTE_AVAILABLE or LIBROSA_AVAILABLE,
            'pyannote_available': PYANNOTE_AVAILABLE,
            'librosa_available': LIBROSA_AVAILABLE,
        }

    def process_diarization(self, transcription_id, force_mode=None, use_speaker_recognition=True):
        """
        处理说话人分离

        Args:
            transcription_id: 转录ID
            force_mode: 强制使用指定模式，可选值：'online', 'offline'
            use_speaker_recognition: 是否使用说话人识别功能

        Returns:
            Transcription: 处理后的转录对象
        """
        try:
            # 获取转录对象
            transcription = Transcription.objects.get(id=transcription_id)

            # 检查状态
            if transcription.status != 'completed':
                logger.warning(f"转录 {transcription_id} 状态不是已完成: {transcription.status}")
                return transcription

            # 获取音频文件
            audio_file = transcription.audio_file

            # 确定使用哪种模式
            use_online = self.use_online
            if force_mode == 'online':
                use_online = True
            elif force_mode == 'offline':
                use_online = False

            # 如果强制使用在线模式，但网络不可用，返回错误
            if use_online and force_mode == 'online' and not is_network_available():
                logger.error("网络不可用，无法使用在线模式进行说话人分离")
                raise Exception("网络不可用，无法使用在线模式进行说话人分离")

            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                # 将GridFS文件写入临时文件
                audio_file.file.get(temp_file)
                temp_file_path = temp_file.name

            # 初始化说话人识别服务
            speaker_recognition_service = None
            if use_speaker_recognition:
                try:
                    from voice_recognition.services.speaker_recognition_service import SpeakerRecognitionService
                    speaker_recognition_service = SpeakerRecognitionService()
                except ImportError:
                    logger.warning("未安装说话人识别服务，将使用基本的说话人分离")

            try:
                # 执行说话人分离
                if use_online:
                    logger.info(f"使用在线模式进行说话人分离: {transcription_id}")
                    speakers = self._diarize_audio_online(temp_file_path)
                else:
                    logger.info(f"使用离线模式进行说话人分离: {transcription_id}")
                    speakers = self._diarize_audio_offline(temp_file_path)

                # 如果在线模式失败，尝试离线模式
                if not speakers and use_online and force_mode != 'online':
                    logger.warning("在线说话人分离失败，尝试离线模式")
                    speakers = self._diarize_audio_offline(temp_file_path)

                # 如果离线模式失败，尝试在线模式
                if not speakers and not use_online and force_mode != 'offline' and is_network_available() and self.api_key:
                    logger.warning("离线说话人分离失败，尝试在线模式")
                    speakers = self._diarize_audio_online(temp_file_path)

                # 如果仍然失败，使用简单的说话人分离
                if not speakers:
                    logger.warning("所有说话人分离方法都失败，使用简单的说话人分离")
                    speakers = self._diarize_audio_simple(temp_file_path)

                # 如果启用了说话人识别，为每个说话人提取音频片段并识别
                if speaker_recognition_service and speakers:
                    logger.info(f"使用说话人识别功能进行声纹匹配: {transcription_id}")
                    speakers = self._enhance_with_speaker_recognition(
                        temp_file_path,
                        speakers,
                        transcription.user.id,
                        speaker_recognition_service
                    )
            finally:
                # 删除临时文件
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

            # 如果没有找到说话人，返回原始转录
            if not speakers:
                logger.error(f"未能识别出说话人: {transcription_id}")
                return transcription

            # 创建或获取说话人
            speaker_map = {}
            for speaker_info in speakers:
                speaker_id = speaker_info.get('speaker')
                if speaker_id not in speaker_map:
                    # 检查是否有预先识别的说话人
                    recognized_speaker_id = speaker_info.get('recognized_speaker_id')
                    if recognized_speaker_id:
                        try:
                            # 使用已识别的说话人
                            speaker = Speaker.objects.get(id=recognized_speaker_id)
                            speaker_map[speaker_id] = speaker.id
                            continue
                        except Speaker.DoesNotExist:
                            pass

                    # 查找或创建说话人
                    speaker_name = speaker_info.get('speaker_name', f'说话人 {speaker_id + 1}')
                    speaker = Speaker.objects.create(
                        user=transcription.user,
                        name=speaker_name,
                        display_name=speaker_name,
                        external_id=str(speaker_id),
                        created_at=timezone.now(),
                        updated_at=timezone.now()
                    )
                    speaker_map[speaker_id] = speaker.id

            # 更新转录对象
            with transaction.atomic():
                transcription.is_speaker_diarization = True
                transcription.save(update_fields=['is_speaker_diarization'])

                # 更新分段信息
                segments = transcription.segments
                for i, segment in enumerate(segments):
                    # 根据时间段分配说话人
                    start_time = segment.get('start', 0)
                    end_time = segment.get('end', 0)
                    speaker_id = self._assign_speaker(speakers, start_time, end_time)

                    # 查找对应的说话人信息
                    speaker_info = next((s for s in speakers if s.get('speaker') == speaker_id), None)

                    # 使用映射后的说话人ID
                    segment['speaker'] = speaker_map.get(speaker_id, speaker_id)

                    # 使用识别后的说话人名称或默认名称
                    if speaker_info and speaker_info.get('speaker_name'):
                        segment['speaker_name'] = speaker_info.get('speaker_name')
                    else:
                        segment['speaker_name'] = f'说话人 {speaker_id + 1}'

                transcription.segments = segments
                transcription.save(update_fields=['segments'])

            return transcription
        except Transcription.DoesNotExist:
            logger.error(f"转录 {transcription_id} 不存在")
            raise
        except Exception as e:
            logger.error(f"处理说话人分离失败: {e}")
            raise

    def _enhance_with_speaker_recognition(self, audio_path, speakers, user_id, recognition_service):
        """
        使用说话人识别增强说话人分离结果
        增强版：更智能的说话人识别和匹配

        Args:
            audio_path: 音频文件路径
            speakers: 说话人分离结果
            user_id: 用户ID
            recognition_service: 说话人识别服务

        Returns:
            list: 增强后的说话人列表
        """
        try:
            if not speakers or not recognition_service:
                return speakers

            # 加载音频文件
            y, sr = librosa.load(audio_path, sr=None)

            # 为每个说话人提取音频片段并识别
            speaker_embeddings = {}  # 存储每个说话人的嵌入向量
            speaker_samples = {}     # 存储每个说话人的音频样本
            enhanced_speakers = []

            # 第一步：为每个说话人提取音频样本和特征
            for speaker_info in speakers:
                speaker_id = speaker_info.get('speaker')
                start_time = speaker_info.get('start', 0)
                end_time = speaker_info.get('end', 0)

                # 确保时间范围有效
                if end_time <= start_time or start_time < 0:
                    enhanced_speakers.append(speaker_info)
                    continue

                # 计算音频样本索引
                start_idx = int(start_time * sr)
                end_idx = min(int(end_time * sr), len(y))

                # 提取音频片段
                if end_idx <= start_idx or start_idx >= len(y):
                    enhanced_speakers.append(speaker_info)
                    continue

                speaker_audio = y[start_idx:end_idx]

                # 如果音频片段太短，跳过
                if len(speaker_audio) < sr * 1.0:  # 至少1秒
                    enhanced_speakers.append(speaker_info)
                    continue

                # 收集每个说话人的音频样本
                if speaker_id not in speaker_samples:
                    speaker_samples[speaker_id] = []
                speaker_samples[speaker_id].append({
                    'audio': speaker_audio,
                    'duration': len(speaker_audio) / sr,
                    'info': speaker_info
                })

            # 第二步：为每个说话人选择最佳音频样本进行识别
            for speaker_id, samples in speaker_samples.items():
                # 按持续时间排序，选择最长的几个样本
                samples.sort(key=lambda x: x['duration'], reverse=True)
                best_samples = samples[:min(3, len(samples))]

                # 合并最佳样本
                if len(best_samples) > 1:
                    # 合并音频
                    combined_audio = np.concatenate([s['audio'] for s in best_samples])
                else:
                    combined_audio = best_samples[0]['audio']

                # 保存临时音频文件
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                    temp_file_path = temp_file.name

                try:
                    # 保存音频片段
                    import soundfile as sf
                    sf.write(temp_file_path, combined_audio, sr)

                    # 识别说话人
                    recognized_speaker, similarity, is_new = recognition_service.identify_speaker(
                        temp_file_path, user_id
                    )

                    # 存储识别结果
                    speaker_embeddings[speaker_id] = {
                        'recognized_speaker_id': str(recognized_speaker.id) if recognized_speaker else None,
                        'speaker_name': recognized_speaker.display_name or recognized_speaker.name if recognized_speaker else f'说话人 {speaker_id + 1}',
                        'similarity': similarity,
                        'is_new_speaker': is_new
                    }
                finally:
                    # 删除临时文件
                    if os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)

            # 第三步：应用识别结果到所有片段
            for speaker_info in speakers:
                speaker_id = speaker_info.get('speaker')
                if speaker_id in speaker_embeddings:
                    # 应用识别结果
                    embedding = speaker_embeddings[speaker_id]
                    for key, value in embedding.items():
                        speaker_info[key] = value

                enhanced_speakers.append(speaker_info)

            # 第四步：合并相同说话人的片段
            if enhanced_speakers:
                # 按说话人ID和时间排序
                enhanced_speakers.sort(key=lambda x: (x.get('recognized_speaker_id', ''), x.get('start', 0)))

                merged_speakers = []
                current = enhanced_speakers[0]

                for next_segment in enhanced_speakers[1:]:
                    # 如果是同一个识别出的说话人且时间相近，合并片段
                    if (next_segment.get('recognized_speaker_id') == current.get('recognized_speaker_id') and
                        next_segment.get('recognized_speaker_id') is not None and
                        next_segment.get('start') - current.get('end') < 2.0):  # 2秒内的间隔视为连续

                        # 合并片段
                        current['end'] = next_segment['end']
                    else:
                        # 添加当前片段并移动到下一个
                        merged_speakers.append(current)
                        current = next_segment

                # 添加最后一个片段
                merged_speakers.append(current)

                return merged_speakers

            return enhanced_speakers
        except Exception as e:
            logger.error(f"增强说话人分离结果失败: {e}")
            return speakers

    def _diarize_audio_online(self, audio_file_path):
        """
        使用在线服务执行说话人分离

        Args:
            audio_file_path: 音频文件路径

        Returns:
            list: 说话人列表，每个元素包含说话人ID和时间段
        """
        try:
            if not self.api_key:
                logger.warning("未配置HF API密钥，无法使用在线说话人分离")
                return []

            # 使用HuggingFace API进行说话人分离
            api_url = "https://api-inference.huggingface.co/models/pyannote/speaker-diarization"
            headers = {
                "Authorization": f"Bearer {self.api_key}"
            }

            # 读取音频文件
            with open(audio_file_path, "rb") as f:
                data = f.read()

            # 发送请求
            response = requests.post(api_url, headers=headers, data=data)

            # 检查响应
            if response.status_code != 200:
                logger.error(f"在线说话人分离请求失败: {response.status_code} {response.text}")
                return []

            # 解析结果
            result = response.json()

            # 转换为标准格式
            speakers = []
            for turn in result.get('turns', []):
                speakers.append({
                    'speaker': int(turn.get('speaker', 0)),
                    'start': float(turn.get('start', 0)),
                    'end': float(turn.get('end', 0))
                })

            return speakers
        except Exception as e:
            logger.error(f"在线说话人分离失败: {e}")
            return []

    def _diarize_audio_offline(self, audio_file_path):
        """
        使用离线模型执行说话人分离

        Args:
            audio_file_path: 音频文件路径

        Returns:
            list: 说话人列表，每个元素包含说话人ID和时间段
        """
        try:
            # 尝试使用pyannote.audio
            if PYANNOTE_AVAILABLE:
                return self._diarize_with_pyannote(audio_file_path)

            # 回退到使用librosa和sklearn
            if LIBROSA_AVAILABLE:
                return self._diarize_with_librosa(audio_file_path)

            logger.warning("未安装pyannote.audio或librosa，无法执行离线说话人分离")
            return []
        except Exception as e:
            logger.error(f"离线说话人分离失败: {e}")
            return []

    def _diarize_with_pyannote(self, audio_file_path):
        """
        使用pyannote.audio执行说话人分离

        Args:
            audio_file_path: 音频文件路径

        Returns:
            list: 说话人列表，每个元素包含说话人ID和时间段
        """
        try:
            # 加载预训练模型
            pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization",
                use_auth_token=self.api_key
            )

            # 执行说话人分离
            diarization = pipeline(audio_file_path)

            # 转换为标准格式
            speakers = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speakers.append({
                    'speaker': int(speaker.replace('SPEAKER_', '')),
                    'start': float(turn.start),
                    'end': float(turn.end)
                })

            return speakers
        except Exception as e:
            logger.error(f"使用pyannote执行说话人分离失败: {e}")
            return []

    def _diarize_with_librosa(self, audio_file_path):
        """
        使用librosa和sklearn执行说话人分离
        增强版：使用更多特征和高级聚类算法

        Args:
            audio_file_path: 音频文件路径

        Returns:
            list: 说话人列表，每个元素包含说话人ID和时间段
        """
        try:
            # 加载音频文件
            y, sr = librosa.load(audio_file_path, sr=None)

            # 提取多种特征
            # 1. MFCC特征 - 音色特征
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)

            # 2. 色谱图特征 - 频谱特征
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)

            # 3. 频谱对比度 - 语音/非语音区分
            contrast = librosa.feature.spectral_contrast(y=y, sr=sr)

            # 4. 零交叉率 - 辅助区分不同说话人
            zcr = librosa.feature.zero_crossing_rate(y)

            # 合并特征
            features = np.vstack([
                mfccs,
                chroma,
                contrast,
                zcr
            ])

            # 转置特征矩阵
            features_transposed = features.T

            # 使用sklearn进行聚类
            try:
                from sklearn.cluster import AgglomerativeClustering
                from sklearn.preprocessing import StandardScaler
                from sklearn.decomposition import PCA

                # 标准化特征
                scaler = StandardScaler()
                features_scaled = scaler.fit_transform(features_transposed)

                # 使用PCA降维，保留95%的方差
                pca = PCA(n_components=0.95)
                features_pca = pca.fit_transform(features_scaled)

                # 估计说话人数量 - 使用更智能的方法
                audio_duration = len(y) / sr
                estimated_speakers = max(2, min(5, int(audio_duration / 60) + 1))

                # 使用层次聚类 - 比K-means更适合说话人分离
                clustering = AgglomerativeClustering(
                    n_clusters=estimated_speakers,
                    affinity='euclidean',
                    linkage='ward'
                )
                labels = clustering.fit_predict(features_pca)

                # 平滑标签 - 减少频繁切换
                window_size = 5
                smoothed_labels = np.copy(labels)
                for i in range(window_size, len(labels) - window_size):
                    window = labels[i-window_size:i+window_size+1]
                    # 使用众数平滑
                    from scipy import stats
                    smoothed_labels[i] = stats.mode(window, keepdims=True)[0][0]

                # 将标签转换为时间段
                frame_time = librosa.frames_to_time(np.arange(len(smoothed_labels)), sr=sr)

                # 合并连续的相同标签，并过滤过短的片段
                speakers = []
                current_speaker = smoothed_labels[0]
                start_time = frame_time[0]
                min_segment_duration = 1.0  # 最小片段时长（秒）

                for i in range(1, len(smoothed_labels)):
                    if smoothed_labels[i] != current_speaker:
                        segment_duration = frame_time[i] - start_time
                        if segment_duration >= min_segment_duration:
                            speakers.append({
                                'speaker': int(current_speaker),
                                'start': float(start_time),
                                'end': float(frame_time[i])
                            })
                        current_speaker = smoothed_labels[i]
                        start_time = frame_time[i]

                # 添加最后一个说话人
                segment_duration = frame_time[-1] - start_time
                if segment_duration >= min_segment_duration:
                    speakers.append({
                        'speaker': int(current_speaker),
                        'start': float(start_time),
                        'end': float(frame_time[-1])
                    })

                # 合并相邻的相同说话人片段
                merged_speakers = []
                if speakers:
                    current = speakers[0]
                    for next_segment in speakers[1:]:
                        if next_segment['speaker'] == current['speaker']:
                            # 合并片段
                            current['end'] = next_segment['end']
                        else:
                            # 添加当前片段并移动到下一个
                            merged_speakers.append(current)
                            current = next_segment
                    # 添加最后一个片段
                    merged_speakers.append(current)

                return merged_speakers
            except ImportError:
                logger.warning("sklearn或scipy未安装，无法执行高级聚类")
                # 尝试使用基本的K-means
                return self._diarize_with_kmeans(y, sr)
        except Exception as e:
            logger.error(f"使用librosa执行说话人分离失败: {e}")
            return []

    def _diarize_with_kmeans(self, y, sr):
        """
        使用基本的K-means进行说话人分离（回退方法）

        Args:
            y: 音频数据
            sr: 采样率

        Returns:
            list: 说话人列表
        """
        try:
            from sklearn.cluster import KMeans

            # 提取基本MFCC特征
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfccs_transposed = mfccs.T

            # 估计说话人数量
            n_speakers = min(3, len(mfccs_transposed) // 100 + 1)

            # 执行聚类
            kmeans = KMeans(n_clusters=n_speakers, random_state=0).fit(mfccs_transposed)
            labels = kmeans.labels_

            # 将标签转换为时间段
            frame_time = librosa.frames_to_time(np.arange(len(labels)), sr=sr)

            # 合并连续的相同标签
            speakers = []
            current_speaker = labels[0]
            start_time = frame_time[0]

            for i in range(1, len(labels)):
                if labels[i] != current_speaker:
                    speakers.append({
                        'speaker': int(current_speaker),
                        'start': float(start_time),
                        'end': float(frame_time[i])
                    })
                    current_speaker = labels[i]
                    start_time = frame_time[i]

            # 添加最后一个说话人
            speakers.append({
                'speaker': int(current_speaker),
                'start': float(start_time),
                'end': float(frame_time[-1])
            })

            return speakers
        except Exception as e:
            logger.error(f"使用K-means执行说话人分离失败: {e}")
            return []

    def _diarize_audio_simple(self, audio_file_path):
        """
        执行简单的说话人分离（回退方案）

        Args:
            audio_file_path: 音频文件路径

        Returns:
            list: 说话人列表，每个元素包含说话人ID和时间段
        """
        try:
            # 获取音频长度
            duration = 60.0  # 默认值

            if LIBROSA_AVAILABLE:
                try:
                    y, sr = librosa.load(audio_file_path, sr=None)
                    duration = float(len(y) / sr)
                except Exception:
                    pass

            # 简单地将音频分成几个部分，每个部分分配一个说话人
            n_speakers = 2  # 默认两个说话人
            segment_duration = duration / n_speakers

            speakers = []
            for i in range(n_speakers):
                speakers.append({
                    'speaker': i,
                    'start': i * segment_duration,
                    'end': (i + 1) * segment_duration
                })

            return speakers
        except Exception as e:
            logger.error(f"执行简单说话人分离失败: {e}")
            return [
                {
                    'speaker': 0,
                    'start': 0.0,
                    'end': 60.0  # 假设音频长度为60秒
                }
            ]

    def _assign_speaker(self, speakers, start_time, end_time):
        """
        分配说话人

        Args:
            speakers: 说话人列表
            start_time: 开始时间
            end_time: 结束时间

        Returns:
            int: 说话人ID
        """
        # 计算重叠时间最长的说话人
        max_overlap = 0
        max_speaker = 0

        for speaker in speakers:
            speaker_start = speaker.get('start', 0)
            speaker_end = speaker.get('end', 0)

            # 计算重叠时间
            overlap_start = max(start_time, speaker_start)
            overlap_end = min(end_time, speaker_end)
            overlap = max(0, overlap_end - overlap_start)

            if overlap > max_overlap:
                max_overlap = overlap
                max_speaker = speaker.get('speaker', 0)

        return max_speaker
