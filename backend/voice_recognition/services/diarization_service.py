"""
说话人分离服务
"""

import logging
import os
import numpy as np
from django.db import transaction
from voice_recognition.models import Transcription, Speaker

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

logger = logging.getLogger('backend')

class DiarizationService:
    """
    说话人分离服务类
    处理音频中的说话人分离
    """

    def __init__(self):
        """初始化"""
        pass

    def process_diarization(self, transcription_id):
        """
        处理说话人分离

        Args:
            transcription_id: 转录ID

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

            # 获取音频文件路径
            audio_file_path = transcription.audio_file.file.path

            # 检查文件是否存在
            if not os.path.exists(audio_file_path):
                logger.error(f"音频文件不存在: {audio_file_path}")
                return transcription

            # 执行说话人分离
            speakers = self._diarize_audio(audio_file_path)

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
                    segment['speaker'] = speaker_id

                transcription.segments = segments
                transcription.save(update_fields=['segments'])

            return transcription
        except Transcription.DoesNotExist:
            logger.error(f"转录 {transcription_id} 不存在")
            raise
        except Exception as e:
            logger.error(f"处理说话人分离失败: {e}")
            raise

    def _diarize_audio(self, audio_file_path):
        """
        执行说话人分离

        Args:
            audio_file_path: 音频文件路径

        Returns:
            list: 说话人列表，每个元素包含说话人ID和时间段
        """
        try:
            # 检查是否安装了librosa
            if not LIBROSA_AVAILABLE:
                logger.warning("Librosa未安装，无法执行说话人分离")
                # 返回一个默认的说话人分离结果
                return [
                    {
                        'speaker': 0,
                        'start': 0.0,
                        'end': 60.0  # 假设音频长度为60秒
                    }
                ]

            # 加载音频文件
            y, sr = librosa.load(audio_file_path, sr=None)

            # 提取特征
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)

            # 简单聚类（实际应用中应使用更复杂的算法）
            # 这里仅作为示例，实际应用中应使用专业的说话人分离库
            try:
                from sklearn.cluster import KMeans

                # 转置特征矩阵
                mfccs_transposed = mfccs.T

                # 估计说话人数量（实际应用中应使用更复杂的方法）
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
            except ImportError:
                logger.warning("sklearn未安装，无法执行聚类")
                # 返回一个默认的说话人分离结果
                return [
                    {
                        'speaker': 0,
                        'start': 0.0,
                        'end': float(len(y) / sr)  # 使用音频长度
                    }
                ]
        except Exception as e:
            logger.error(f"执行说话人分离失败: {e}")
            return []

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
