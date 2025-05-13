"""
说话人识别服务
提供说话人声纹识别和管理功能
"""

import os
import logging
import numpy as np
import tempfile
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from voice_recognition.models import Speaker, SpeakerProfile, SpeakerEmbedding
from voice_recognition.utils.netcheck import is_network_available

logger = logging.getLogger('backend')

# 尝试导入必要的库
try:
    import librosa
    import torch
    from resemblyzer import VoiceEncoder, preprocess_wav
    SPEAKER_RECOGNITION_AVAILABLE = True
except ImportError:
    SPEAKER_RECOGNITION_AVAILABLE = False
    # 仅在调试级别记录，避免在每次启动时显示警告
    logger.debug("未安装说话人识别所需的库，声纹识别功能不可用")


class SpeakerRecognitionService:
    """
    说话人识别服务类
    提供说话人声纹识别和管理功能
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
                cls._instance = super(SpeakerRecognitionService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        """初始化"""
        # 避免重复初始化
        if getattr(self, '_initialized', False):
            return

        # 声纹编码器
        self.encoder = None

        # 初始化声纹编码器
        if SPEAKER_RECOGNITION_AVAILABLE:
            try:
                self.encoder = VoiceEncoder()
                logger.info("声纹编码器初始化成功")
            except Exception as e:
                logger.error(f"声纹编码器初始化失败: {e}")

        # 初始化完成标记
        self._initialized = True

    def extract_embedding(self, audio_path):
        """
        提取音频的声纹特征向量

        Args:
            audio_path: 音频文件路径

        Returns:
            numpy.ndarray: 声纹特征向量
        """
        if not SPEAKER_RECOGNITION_AVAILABLE or self.encoder is None:
            logger.warning("声纹识别功能不可用")
            return None

        try:
            # 预处理音频
            wav = preprocess_wav(audio_path)

            # 提取声纹特征
            embedding = self.encoder.embed_utterance(wav)

            return embedding
        except Exception as e:
            logger.error(f"提取声纹特征失败: {e}")
            return None

    def identify_speaker(self, audio_path, user_id, threshold=0.75):
        """
        识别说话人

        Args:
            audio_path: 音频文件路径
            user_id: 用户ID
            threshold: 相似度阈值，超过该值则认为是同一个说话人

        Returns:
            tuple: (speaker, similarity, is_new)
        """
        if not SPEAKER_RECOGNITION_AVAILABLE or self.encoder is None:
            logger.warning("声纹识别功能不可用")
            return None, 0.0, False

        try:
            # 提取声纹特征
            embedding = self.extract_embedding(audio_path)
            if embedding is None:
                return None, 0.0, False

            # 获取用户的所有说话人
            speakers = Speaker.objects.filter(user_id=user_id, is_active=True)
            if not speakers.exists():
                # 如果没有说话人记录，创建一个新的
                return self._create_new_speaker(user_id, embedding, audio_path), 0.0, True

            # 计算与每个说话人的相似度
            max_similarity = 0.0
            best_match = None

            for speaker in speakers:
                # 获取说话人档案
                profile = speaker.get_profile()
                if profile is None or not profile.embeddings:
                    continue

                # 计算与每个声纹特征的相似度
                similarities = []
                for emb_doc in profile.embeddings:
                    emb = np.array(emb_doc.embedding)
                    similarity = self._compute_similarity(embedding, emb)
                    similarities.append(similarity)

                # 取最大相似度
                if similarities:
                    speaker_similarity = max(similarities)
                    if speaker_similarity > max_similarity:
                        max_similarity = speaker_similarity
                        best_match = speaker

            # 如果最大相似度超过阈值，返回匹配的说话人
            if max_similarity >= threshold and best_match is not None:
                # 更新说话人档案
                self._update_speaker_profile(best_match, embedding, audio_path)
                return best_match, max_similarity, False

            # 否则创建一个新的说话人
            return self._create_new_speaker(user_id, embedding, audio_path), max_similarity, True

        except Exception as e:
            logger.error(f"识别说话人失败: {e}")
            return None, 0.0, False

    def _compute_similarity(self, embedding1, embedding2):
        """
        计算两个声纹特征向量的相似度

        Args:
            embedding1: 第一个声纹特征向量
            embedding2: 第二个声纹特征向量

        Returns:
            float: 相似度，范围[0, 1]
        """
        # 确保是numpy数组
        emb1 = np.array(embedding1)
        emb2 = np.array(embedding2)

        # 计算余弦相似度
        similarity = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))

        return float(similarity)

    def _create_new_speaker(self, user_id, embedding, audio_path=None):
        """
        创建新的说话人

        Args:
            user_id: 用户ID
            embedding: 声纹特征向量
            audio_path: 音频文件路径

        Returns:
            Speaker: 新创建的说话人
        """
        try:
            # 获取音频时长
            audio_duration = 0.0
            if audio_path and os.path.exists(audio_path):
                try:
                    y, sr = librosa.load(audio_path, sr=None)
                    audio_duration = float(len(y) / sr)
                except Exception:
                    pass

            # 创建说话人档案
            profile = SpeakerProfile(
                user_id=user_id,
                name=f"说话人 {timezone.now().strftime('%Y%m%d%H%M%S')}",
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 添加声纹特征
            profile.add_embedding(
                embedding=embedding.tolist(),
                source='auto_recognition',
                audio_duration=audio_duration,
                confidence=0.8
            )

            profile.save()

            # 创建说话人记录
            with transaction.atomic():
                speaker_count = Speaker.objects.filter(user_id=user_id).count()
                speaker = Speaker.objects.create(
                    user_id=user_id,
                    name=f"说话人 {speaker_count + 1}",
                    display_name=f"说话人 {speaker_count + 1}",
                    profile_id=profile.id,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )

            return speaker

        except Exception as e:
            logger.error(f"创建说话人失败: {e}")
            return None

    def _update_speaker_profile(self, speaker, embedding, audio_path=None):
        """
        更新说话人档案

        Args:
            speaker: 说话人对象
            embedding: 声纹特征向量
            audio_path: 音频文件路径

        Returns:
            SpeakerProfile: 更新后的说话人档案
        """
        try:
            # 获取说话人档案
            profile = speaker.get_profile()
            if profile is None:
                # 如果没有档案，创建一个新的
                profile = SpeakerProfile(
                    id=speaker.profile_id if speaker.profile_id else None,
                    user_id=speaker.user_id,
                    name=speaker.name,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                profile.save()

                # 更新说话人记录
                speaker.profile_id = profile.id
                speaker.save()

            # 获取音频时长
            audio_duration = 0.0
            if audio_path and os.path.exists(audio_path):
                try:
                    y, sr = librosa.load(audio_path, sr=None)
                    audio_duration = float(len(y) / sr)
                except Exception:
                    pass

            # 添加声纹特征
            profile.add_embedding(
                embedding=embedding.tolist(),
                source='recognition_update',
                audio_duration=audio_duration,
                confidence=0.9
            )

            # 更新统计信息
            speaker.update_stats(speaking_time=audio_duration)

            return profile

        except Exception as e:
            logger.error(f"更新说话人档案失败: {e}")
            return None

    def rename_speaker(self, speaker_id, new_name):
        """
        重命名说话人

        Args:
            speaker_id: 说话人ID
            new_name: 新名称

        Returns:
            Speaker: 更新后的说话人
        """
        try:
            # 获取说话人
            speaker = Speaker.objects.get(id=speaker_id)

            # 更新名称
            speaker.display_name = new_name
            speaker.updated_at = timezone.now()
            speaker.save()

            # 更新档案
            profile = speaker.get_profile()
            if profile:
                profile.display_name = new_name
                profile.updated_at = timezone.now()
                profile.save()

            return speaker

        except Speaker.DoesNotExist:
            logger.error(f"说话人不存在: {speaker_id}")
            return None
        except Exception as e:
            logger.error(f"重命名说话人失败: {e}")
            return None

    def merge_speakers(self, speaker_ids, new_name=None):
        """
        合并多个说话人

        Args:
            speaker_ids: 说话人ID列表
            new_name: 合并后的名称

        Returns:
            Speaker: 合并后的说话人
        """
        if not speaker_ids or len(speaker_ids) < 2:
            return None

        try:
            # 获取说话人
            speakers = list(Speaker.objects.filter(id__in=speaker_ids))
            if len(speakers) < 2:
                return None

            # 确保所有说话人属于同一用户
            user_id = speakers[0].user_id
            if not all(s.user_id == user_id for s in speakers):
                logger.error("不能合并不同用户的说话人")
                return None

            # 选择第一个说话人作为主说话人
            main_speaker = speakers[0]

            # 如果提供了新名称，更新主说话人的名称
            if new_name:
                main_speaker.display_name = new_name
                main_speaker.updated_at = timezone.now()
                main_speaker.save()

            # 获取主说话人的档案
            main_profile = main_speaker.get_profile()
            if not main_profile:
                # 如果没有档案，创建一个新的
                main_profile = SpeakerProfile(
                    id=main_speaker.profile_id if main_speaker.profile_id else None,
                    user_id=main_speaker.user_id,
                    name=main_speaker.name,
                    display_name=main_speaker.display_name,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                main_profile.save()

                # 更新主说话人记录
                main_speaker.profile_id = main_profile.id
                main_speaker.save()

            # 合并其他说话人的档案
            for speaker in speakers[1:]:
                profile = speaker.get_profile()
                if profile and profile.embeddings:
                    # 合并声纹特征
                    for emb_doc in profile.embeddings:
                        main_profile.embeddings.append(emb_doc)

                    # 更新统计信息
                    main_speaker.recognition_count += speaker.recognition_count
                    main_speaker.total_speaking_time += speaker.total_speaking_time

                    # 删除旧档案
                    profile.delete()

                # 标记说话人为非活动
                speaker.is_active = False
                speaker.updated_at = timezone.now()
                speaker.save()

            # 保存主档案
            main_profile.updated_at = timezone.now()
            main_profile.save()

            # 保存主说话人
            main_speaker.updated_at = timezone.now()
            main_speaker.save()

            return main_speaker

        except Exception as e:
            logger.error(f"合并说话人失败: {e}")
            return None
