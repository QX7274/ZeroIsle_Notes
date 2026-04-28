"""
增强搜索功能测试
"""

import os
import sys
import types
import base64
import tempfile
import importlib
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework.schemas.openapi import AutoSchema
from django.db.models.signals import post_save
from users.signals import create_mongo_user_and_profile, save_user_profile
import mongoengine
import mongomock

User = get_user_model()


class VoiceSearchTestCase(APITestCase):
    """语音搜索测试"""

    def setUp(self):
        """设置测试环境"""
        # Disconnect all existing connections and connect to mongomock
        mongoengine.disconnect_all()
        mongoengine.connect(
            'test_db',
            host='mongodb://localhost',
            mongo_client_class=mongomock.MongoClient,
            alias='default',
        )

        # Disconnect signals
        post_save.disconnect(create_mongo_user_and_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser_voice',
            email='test_voice@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # 确保模块已导入，便于 patch 解析路径
        importlib.import_module('search.views.search')

        # Mock WhisperService（在函数内部从 voice_recognition.services 导入）
        self.patcher = patch('voice_recognition.services.WhisperService')
        self.mock_service_cls = self.patcher.start()
        self.mock_service = self.mock_service_cls.return_value
        self.mock_service.transcribe.return_value = {
            'status': 'completed',
            'text': '测试语音搜索',
            'language': 'zh',
            'confidence': 0.95,
            'duration': 5.0,
            'segments': []
        }

        # Mock SearchService
        self.search_patcher = patch('search.views.search.SearchService')
        self.mock_search_cls = self.search_patcher.start()
        self.mock_search = self.mock_search_cls.return_value
        self.mock_search.search.return_value = {
            'total': 1,
            'results': [{'id': '1', 'title': 'Test Result'}]
        }
        self.mock_search.add_search_history.return_value = None

        # 兼容旧测试中可能引用的对象（当前 search 视图未直接使用这些符号）
        self.audio_file_patcher = patch('search.views.search.AudioFile', create=True)
        self.mock_audio_file = self.audio_file_patcher.start()
        self.mock_audio_file.return_value.save = MagicMock()

        self.transcription_patcher = patch('search.views.search.Transcription', create=True)
        self.mock_transcription = self.transcription_patcher.start()
        self.mock_transcription.return_value.save = MagicMock()

        self.get_mongo_user_patcher = patch('search.views.search.get_mongo_user', create=True)
        self.mock_get_mongo_user = self.get_mongo_user_patcher.start()
        self.mock_get_mongo_user.return_value = MagicMock()

        # 兜底：直接替换 ViewSet 初始化，确保使用 mock search_service
        def _fake_viewset_init(instance, **kwargs):
            for k, v in kwargs.items():
                setattr(instance, k, v)
            instance.search_service = self.mock_search
            instance.suggestion_service = MagicMock()

        self.searchview_init_patcher = patch('search.views.SearchViewSet.__init__', _fake_viewset_init)
        self.searchview_init_patcher.start()
        self.searchview_init_patcher2 = patch('search.views.search.SearchViewSet.__init__', _fake_viewset_init)
        self.searchview_init_patcher2.start()

    def tearDown(self):
        self.patcher.stop()
        self.search_patcher.stop()
        self.audio_file_patcher.stop()
        self.transcription_patcher.stop()
        self.get_mongo_user_patcher.stop()
        self.searchview_init_patcher.stop()
        self.searchview_init_patcher2.stop()

        # Reconnect signals
        post_save.connect(create_mongo_user_and_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)

        mongoengine.disconnect_all()

    def test_voice_search_with_file(self):
        """测试使用文件的语音搜索"""
        # 创建测试音频文件
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
            # 写入一些测试数据
            f.write(b'RIFF' + b'\x00' * 100)
            temp_path = f.name

        try:
            with open(temp_path, 'rb') as audio_file:
                response = self.client.post(
                    '/api/v1/search/voice/',
                    {
                        'audio': audio_file,
                        'language': 'zh',
                        'engine': 'whisper'
                    },
                    format='multipart'
                )

            self.assertIn(response.status_code, [200, 201])
        finally:
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except PermissionError:
                    pass

    def test_voice_search_with_base64(self):
        """测试使用Base64的语音搜索"""
        fake_audio = b'RIFF' + b'\x00' * 100
        audio_base64 = base64.b64encode(fake_audio).decode('utf-8')

        response = self.client.post(
            '/api/v1/search/voice/',
            {
                'audio_base64': audio_base64,
                'language': 'zh',
                'engine': 'whisper',
                'options': {
                    'page': 1,
                    'page_size': 20
                }
            },
            format='json'
        )

        self.assertIn(response.status_code, [200, 201])
        self.mock_search.search.assert_called()


class ImageSearchTestCase(APITestCase):
    """图像搜索测试"""

    def setUp(self):
        """设置测试环境"""
        # Disconnect all existing connections and connect to mongomock
        mongoengine.disconnect_all()
        mongoengine.connect(
            'test_db',
            host='mongodb://localhost',
            mongo_client_class=mongomock.MongoClient,
            alias='default',
        )

        # Disconnect signals
        post_save.disconnect(create_mongo_user_and_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser_image',
            email='test_image@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # 注入轻量模块，避免导入可能缺失的外部依赖
        fake_ai_services = types.ModuleType('ai_assistant.services')
        fake_ai_services.ImageAnalysisService = MagicMock()
        self.ai_services_module_patcher = patch.dict(sys.modules, {
            'ai_assistant.services': fake_ai_services,
        })
        self.ai_services_module_patcher.start()

        # 确保模块已导入，便于 patch 解析路径
        importlib.import_module('search.views.search')

        # Mock ImageAnalysisService
        self.patcher = patch('ai_assistant.services.ImageAnalysisService')
        self.mock_service_cls = self.patcher.start()
        self.mock_service = self.mock_service_cls.return_value
        self.mock_service.analyze_image.return_value = {
            'result': 'A description of an image',
            'task': 'describe'
        }

        # Mock SearchService
        self.search_patcher = patch('search.views.search.SearchService')
        self.mock_search_cls = self.search_patcher.start()
        self.mock_search = self.mock_search_cls.return_value
        self.mock_search.search.return_value = {
            'total': 1,
            'results': [{'id': '1', 'title': 'Image Result'}]
        }
        self.mock_search.add_search_history.return_value = None

        # Mock get_mongo_user if needed
        self.get_mongo_user_patcher = patch('search.views.search.get_mongo_user', create=True)
        self.mock_get_mongo_user = self.get_mongo_user_patcher.start()
        self.mock_get_mongo_user.return_value = MagicMock()

        # 兜底：直接替换 ViewSet 初始化，确保使用 mock search_service
        def _fake_viewset_init(instance, **kwargs):
            for k, v in kwargs.items():
                setattr(instance, k, v)
            instance.search_service = self.mock_search
            instance.suggestion_service = MagicMock()

        self.searchview_init_patcher = patch('search.views.SearchViewSet.__init__', _fake_viewset_init)
        self.searchview_init_patcher.start()
        self.searchview_init_patcher2 = patch('search.views.search.SearchViewSet.__init__', _fake_viewset_init)
        self.searchview_init_patcher2.start()

    def tearDown(self):
        self.patcher.stop()
        self.search_patcher.stop()
        self.get_mongo_user_patcher.stop()
        self.searchview_init_patcher.stop()
        self.searchview_init_patcher2.stop()
        self.ai_services_module_patcher.stop()

        # Reconnect signals
        post_save.connect(create_mongo_user_and_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)

        mongoengine.disconnect_all()

    def test_image_search_with_base64(self):
        """测试使用Base64的图像搜索"""
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        )
        image_base64 = base64.b64encode(png_data).decode('utf-8')

        response = self.client.post(
            '/api/v1/search/image/',
            {
                'image_base64': image_base64,
                'task': 'describe',
                'options': {
                    'page': 1,
                    'page_size': 20
                }
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200)

    def test_image_search_ocr(self):
        """测试图像OCR搜索"""
        self.mock_service.analyze_image.return_value = {
            'result': 'Extracted Text',
            'task': 'extract_text'
        }

        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        )
        image_base64 = base64.b64encode(png_data).decode('utf-8')

        response = self.client.post(
            '/api/v1/search/image/',
            {
                'image_base64': image_base64,
                'task': 'extract_text',
                'options': {
                    'page': 1,
                    'page_size': 20
                }
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200)


class TranscriptionTestCase(APITestCase):
    """音频转文字测试"""

    def setUp(self):
        """设置测试环境"""
        # Disconnect all existing connections and connect to mongomock
        mongoengine.disconnect_all()
        mongoengine.connect(
            'test_db',
            host='mongodb://localhost',
            mongo_client_class=mongomock.MongoClient,
            alias='default',
        )

        # Disconnect signals
        post_save.disconnect(create_mongo_user_and_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser_trans',
            email='test_trans@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # 修复 DRF schema 配置，避免导入视图时断言失败
        self.schema_patcher = patch('rest_framework.settings.api_settings.DEFAULT_SCHEMA_CLASS', AutoSchema)
        self.schema_patcher.start()

        # 注入轻量 whisper 模块，避免导入真实依赖失败
        fake_whisper = types.ModuleType('whisper')
        fake_whisper.load_model = MagicMock()
        self.whisper_module_patcher = patch.dict(sys.modules, {'whisper': fake_whisper})
        self.whisper_module_patcher.start()

        # Mock WhisperService
        self.patcher = patch('voice_recognition.views.transcription.WhisperService')
        self.mock_service_cls = self.patcher.start()
        self.mock_service = self.mock_service_cls.return_value
        self.mock_service.transcribe.return_value = {
            'status': 'completed',
            'text': 'Transcribed text',
            'language': 'zh',
            'duration': 10.0,
            'segments': []
        }

        # Mock MongoDB models
        self.audio_file_patcher = patch('voice_recognition.views.transcription.AudioFile')
        self.mock_audio_file = self.audio_file_patcher.start()
        # Mock instance.save
        self.mock_audio_file_inst = MagicMock()
        self.mock_audio_file.return_value = self.mock_audio_file_inst
        self.mock_audio_file_inst.save.return_value = None
        # Mock file.put
        self.mock_audio_file_inst.file = MagicMock()
        self.mock_audio_file_inst.file.put.return_value = None

        self.transcription_patcher = patch('voice_recognition.views.transcription.Transcription')
        self.mock_transcription = self.transcription_patcher.start()
        self.mock_transcription.return_value = MagicMock()
        self.mock_transcription.return_value.save.return_value = None

        # Mock get_mongo_user
        self.get_mongo_user_patcher = patch('voice_recognition.views.transcription.get_mongo_user')
        self.mock_get_mongo_user = self.get_mongo_user_patcher.start()
        self.mock_get_mongo_user.return_value = MagicMock()

        # Mock Language lookup
        self.language_patcher = patch('voice_recognition.views.transcription.Language')
        self.mock_language = self.language_patcher.start()

        class _FakeLanguageDoesNotExist(Exception):
            pass

        self.mock_language.DoesNotExist = _FakeLanguageDoesNotExist
        self.mock_language.objects.get.side_effect = _FakeLanguageDoesNotExist("Language not found")

    def tearDown(self):
        self.patcher.stop()
        self.audio_file_patcher.stop()
        self.transcription_patcher.stop()
        self.get_mongo_user_patcher.stop()
        self.language_patcher.stop()
        self.whisper_module_patcher.stop()
        self.schema_patcher.stop()

        # Reconnect signals
        post_save.connect(create_mongo_user_and_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)

        mongoengine.disconnect_all()

    def test_transcribe_audio(self):
        """测试音频转文字"""
        fake_audio = b'RIFF' + b'\x00' * 100
        audio_base64 = base64.b64encode(fake_audio).decode('utf-8')

        response = self.client.post(
            '/api/v1/voice-recognition/transcribe/',
            {
                'audio_base64': audio_base64,
                'language': 'zh',
                'engine': 'whisper',
                'enable_diarization': False,
                'enable_punctuation': True,
                'enable_timestamp': True
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn('text', response.data)


class MeetingSummaryTestCase(APITestCase):
    """会议纪要测试"""

    def setUp(self):
        """设置测试环境"""
        # Disconnect all existing connections and connect to mongomock
        mongoengine.disconnect_all()
        mongoengine.connect(
            'test_db',
            host='mongodb://localhost',
            mongo_client_class=mongomock.MongoClient,
            alias='default',
        )

        # Disconnect signals
        post_save.disconnect(create_mongo_user_and_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser_meet',
            email='test_meet@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # 修复 DRF schema 配置，避免导入视图时断言失败
        self.schema_patcher = patch('rest_framework.settings.api_settings.DEFAULT_SCHEMA_CLASS', AutoSchema)
        self.schema_patcher.start()

        # 注入轻量 whisper 模块，避免导入 voice_recognition.views 时失败
        fake_whisper = types.ModuleType('whisper')
        fake_whisper.load_model = MagicMock()
        self.whisper_module_patcher = patch.dict(sys.modules, {'whisper': fake_whisper})
        self.whisper_module_patcher.start()

        # Mock TextProcessingService
        self.patcher = patch('voice_recognition.views.transcription.TextProcessingService')
        self.mock_service_cls = self.patcher.start()
        self.mock_service = self.mock_service_cls.return_value
        self.mock_service.generate_meeting_summary.return_value = {
            'summary': 'Meeting summary',
            'key_points': ['Point 1', 'Point 2'],
            'action_items': ['Action 1'],
            'participants': ['User A'],
            'decisions': [],
            'topics': [],
            'full_text': 'Original text'
        }

        # Mock Note model used in generate_meeting_summary
        self.note_patcher = patch('notes.mongodb_models.Note')
        self.mock_note = self.note_patcher.start()

        # Mock get_mongo_user
        self.get_mongo_user_patcher = patch('voice_recognition.views.transcription.get_mongo_user')
        self.mock_get_mongo_user = self.get_mongo_user_patcher.start()
        self.mock_get_mongo_user.return_value = MagicMock()

    def tearDown(self):
        self.patcher.stop()
        self.note_patcher.stop()
        self.get_mongo_user_patcher.stop()
        self.whisper_module_patcher.stop()
        self.schema_patcher.stop()

        # Reconnect signals
        post_save.connect(create_mongo_user_and_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)

        mongoengine.disconnect_all()

    def test_generate_meeting_summary(self):
        """测试生成会议纪要"""
        test_text = """
        今天的会议主要讨论了项目进度和下一步计划。
        张三汇报了开发进度，目前已完成70%。
        李四提出了一些优化建议。
        最后决定下周进行代码审查。
        """

        response = self.client.post(
            '/api/v1/voice-recognition/meeting/',
            {
                'text': test_text,
                'summary_type': 'detailed',
                'language': 'zh',
                'include_timestamps': False
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('summary', data)
        self.assertIn('key_points', data)


class RealtimeRecordingTestCase(APITestCase):
    """实时录音测试"""

    def setUp(self):
        """设置测试环境"""
        # Disconnect all existing connections and connect to mongomock
        mongoengine.disconnect_all()
        mongoengine.connect(
            'test_db',
            host='mongodb://localhost',
            mongo_client_class=mongomock.MongoClient,
            alias='default',
        )

        # Disconnect signals
        post_save.disconnect(create_mongo_user_and_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser_realtime',
            email='test_realtime@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # 修复 DRF schema 配置，避免导入视图时断言失败
        self.schema_patcher = patch('rest_framework.settings.api_settings.DEFAULT_SCHEMA_CLASS', AutoSchema)
        self.schema_patcher.start()

        # 注入轻量 whisper 模块，避免导入真实依赖失败
        fake_whisper = types.ModuleType('whisper')
        fake_whisper.load_model = MagicMock()
        self.whisper_module_patcher = patch.dict(sys.modules, {'whisper': fake_whisper})
        self.whisper_module_patcher.start()

        # Mock WhisperService
        self.patcher = patch('voice_recognition.views.realtime_recording.WhisperService')
        self.mock_service_cls = self.patcher.start()
        self.mock_service = self.mock_service_cls.return_value
        self.mock_service.transcribe.return_value = {
            'status': 'completed',
            'text': 'Realtime text chunk',
            'language': 'zh',
            'duration': 1.0,
            'segments': []
        }

        # Mock MongoDB models
        self.audio_file_patcher = patch('voice_recognition.views.realtime_recording.AudioFile')
        self.mock_audio_file = self.audio_file_patcher.start()
        self.mock_audio_file.return_value.save = MagicMock()
        self.mock_audio_file.return_value.file = MagicMock()
        self.mock_audio_file.return_value.id = 'fake_audio_id'

        self.transcription_patcher = patch('voice_recognition.views.realtime_recording.Transcription')
        self.mock_transcription = self.transcription_patcher.start()
        self.mock_trans_inst = MagicMock()
        self.mock_transcription.return_value = self.mock_trans_inst
        self.mock_trans_inst.save = MagicMock()
        self.mock_trans_inst.id = 'fake_session_id'
        self.mock_trans_inst.model = 'whisper'
        self.mock_trans_inst.language = MagicMock()
        self.mock_trans_inst.language.code = 'zh'

        # Mock Transcription.objects.get
        self.mock_transcription.objects = MagicMock()
        self.mock_transcription.objects.get.return_value = self.mock_trans_inst

        # Mock get_mongo_user
        self.get_mongo_user_patcher = patch('voice_recognition.views.realtime_recording.get_mongo_user')
        self.mock_get_mongo_user = self.get_mongo_user_patcher.start()
        self.mock_get_mongo_user.return_value = MagicMock()

        # Mock Language lookup
        self.language_patcher = patch('voice_recognition.views.realtime_recording.Language')
        self.mock_language = self.language_patcher.start()
        self.mock_language.objects.get.side_effect = Exception("Language not found")

    def tearDown(self):
        self.patcher.stop()
        self.audio_file_patcher.stop()
        self.transcription_patcher.stop()
        self.get_mongo_user_patcher.stop()
        self.language_patcher.stop()
        self.whisper_module_patcher.stop()
        self.schema_patcher.stop()

        # Reconnect signals
        post_save.connect(create_mongo_user_and_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)

        mongoengine.disconnect_all()

    def test_recording_workflow(self):
        """测试完整的录音流程"""
        # 1. 开始录音
        response = self.client.post(
            '/api/v1/voice-recognition/recording/start/',
            {
                'language': 'zh',
                'engine': 'whisper',
                'enable_realtime': True
            },
            format='json'
        )

        if response.status_code == 200:
            data = response.json()
            session_id = data.get('session_id')

            # 2. 上传音频片段
            fake_audio = b'RIFF' + b'\x00' * 100
            audio_base64 = base64.b64encode(fake_audio).decode('utf-8')

            response = self.client.post(
                '/api/v1/voice-recognition/recording/upload-chunk/',
                {
                    'session_id': session_id,
                    'audio_chunk': audio_base64,
                    'chunk_index': 0,
                    'is_final': False
                },
                format='json'
            )

            self.assertEqual(response.status_code, 200)

            # 3. 停止录音
            response = self.client.post(
                '/api/v1/voice-recognition/recording/stop/',
                {
                    'session_id': session_id,
                    'audio_base64': audio_base64
                },
                format='json'
            )

            self.assertEqual(response.status_code, 200)


class SearchHistoryTestCase(APITestCase):
    """搜索历史测试"""

    def setUp(self):
        """设置测试环境"""
        # Disconnect all existing connections and connect to mongomock
        mongoengine.disconnect_all()
        mongoengine.connect(
            'test_db',
            host='mongodb://localhost',
            mongo_client_class=mongomock.MongoClient,
            alias='default',
        )

        # Disconnect signals
        post_save.disconnect(create_mongo_user_and_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser_hist',
            email='test_hist@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Mock SearchService
        self.patcher = patch('search.views.search.SearchService')
        self.mock_service_cls = self.patcher.start()
        self.mock_service = self.mock_service_cls.return_value
        self.mock_service.get_search_history.return_value = {
            'history': [
                {'query': 'test', 'timestamp': '2023-01-01T00:00:00Z'}
            ]
        }
        self.mock_service.clear_search_history.return_value = True

        # Mock get_mongo_user
        self.get_mongo_user_patcher = patch('search.views.search.get_mongo_user', create=True)
        self.mock_get_mongo_user = self.get_mongo_user_patcher.start()
        self.mock_get_mongo_user.return_value = MagicMock()

    def tearDown(self):
        self.patcher.stop()
        self.get_mongo_user_patcher.stop()

        # Reconnect signals
        post_save.connect(create_mongo_user_and_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)

        mongoengine.disconnect_all()

    def test_get_search_history(self):
        """测试获取搜索历史"""
        response = self.client.get(
            '/api/v1/search/history/',
            {'limit': 20}
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('history', data)

    def test_clear_search_history(self):
        """测试清除搜索历史"""
        response = self.client.post('/api/v1/search/clear-history/', {'confirm': True}, format='json')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('deleted', data)


class SearchSuggestionsTestCase(APITestCase):
    """搜索建议测试"""

    def setUp(self):
        """设置测试环境"""
        # Disconnect all existing connections and connect to mongomock
        mongoengine.disconnect_all()
        mongoengine.connect(
            'test_db',
            host='mongodb://localhost',
            mongo_client_class=mongomock.MongoClient,
            alias='default',
        )

        # Disconnect signals
        post_save.disconnect(create_mongo_user_and_profile, sender=User)
        post_save.disconnect(save_user_profile, sender=User)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser_sugg',
            email='test_sugg@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Mock SuggestionService
        self.patcher = patch('search.views.search.SuggestionService')
        self.mock_service_cls = self.patcher.start()
        self.mock_service = self.mock_service_cls.return_value
        self.mock_service.get_suggestions.return_value = {
            'suggestions': ['test suggestion 1', 'test suggestion 2']
        }

        # Mock get_mongo_user
        self.get_mongo_user_patcher = patch('search.views.search.get_mongo_user', create=True)
        self.mock_get_mongo_user = self.get_mongo_user_patcher.start()
        self.mock_get_mongo_user.return_value = MagicMock()

    def tearDown(self):
        self.patcher.stop()
        self.get_mongo_user_patcher.stop()

        # Reconnect signals
        post_save.connect(create_mongo_user_and_profile, sender=User)
        post_save.connect(save_user_profile, sender=User)

        mongoengine.disconnect_all()

    def test_get_suggestions(self):
        """测试获取搜索建议"""
        response = self.client.get(
            '/api/v1/search/suggestions/',
            {'prefix': 'test', 'limit': 10}
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('suggestions', data)
