import json
import types
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.test import override_settings
from django.contrib.auth import get_user_model


@pytest.mark.django_db
class TestAIProcess:
    def setup_method(self):
        self.client = APIClient()
        User = get_user_model()
        self.user = User.objects.create_user(username='u1', password='p1', email='u1@example.com')
        self.client.force_authenticate(user=self.user)
        self.url = '/api/v1/ai-assistant/process/'

    def test_generate_non_stream_success(self, monkeypatch):
        from ai_assistant.services.openai_service import OpenAIService

        def fake_gen(**kwargs):
            return {'content': '生成结果', 'usage': {'prompt_tokens': 10, 'completion_tokens': 20}}

        monkeypatch.setattr(OpenAIService, 'generate_content', lambda self, **kw: fake_gen(**kw))

        resp = self.client.post(self.url, data={'tool': 'generate', 'prompt': '写一段介绍'}, format='json')
        assert resp.status_code == 200
        data = resp.json()
        assert data.get('code') == 0
        assert data.get('data', {}).get('content') == '生成结果'

    def test_text_summarize_success(self, monkeypatch):
        from ai_assistant.services.text_processing_service import TextProcessingService

        def fake_process(**kwargs):
            return {'result': '摘要结果', 'task': 'summarize'}

        monkeypatch.setattr(TextProcessingService, 'process_text', lambda self, **kw: fake_process(**kw))

        resp = self.client.post(self.url, data={'tool': 'summarize', 'text': '这是一段很长的文本'}, format='json')
        assert resp.status_code == 200
        data = resp.json()
        assert data.get('code') == 0
        assert data.get('data', {}).get('result') == '摘要结果'

    def test_generate_stream_sse(self, monkeypatch):
        # 构造流式分片对象，模拟 openai v1 SDK chunk
        class Delta:  # noqa: D401
            def __init__(self, content):
                self.content = content
        class Choice:
            def __init__(self, content):
                self.delta = Delta(content)
        class Chunk:
            def __init__(self, content):
                self.choices = [Choice(content)]

        from ai_assistant.services.openai_service import OpenAIService
        def fake_chat_completion(self, **kwargs):
            return iter([Chunk('甲'), Chunk('乙'), Chunk('丙')])
        monkeypatch.setattr(OpenAIService, 'chat_completion', fake_chat_completion)

        resp = self.client.post(self.url, data={'tool': 'generate', 'prompt': '流式', 'stream': True}, format='json')
        # StreamingHttpResponse
        assert resp.status_code == 200
        assert getattr(resp, 'streaming', False)
        content = b''.join(resp.streaming_content).decode('utf-8')
        # 断言SSE格式片段
        # json.dumps会转义非ascii字符，并可能产生空格
        assert '"content": "\u7532"' in content
        assert '"content": " \u4e59"' in content
        assert '"content": "\u4e19"' in content

    @override_settings(REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'users.jwt_auth.CustomJWTAuthentication',
        ),
        'DEFAULT_PERMISSION_CLASSES': (
            'rest_framework.permissions.IsAuthenticated',
        ),
        'DEFAULT_THROTTLE_CLASSES': [
            'rest_framework.throttling.UserRateThrottle',
        ],
        'DEFAULT_THROTTLE_RATES': {
            'user': '2/min',  # 降低阈值方便测试
        },
    })
    def test_minute_throttling(self, monkeypatch):
        from ai_assistant.services.openai_service import OpenAIService
        monkeypatch.setattr(OpenAIService, 'generate_content', lambda self, **kw: {'content': 'ok', 'usage': {}})

        # 第1、2次请求成功
        assert self.client.post(self.url, data={'tool': 'generate', 'prompt': 'a'}, format='json').status_code == 200
        assert self.client.post(self.url, data={'tool': 'generate', 'prompt': 'b'}, format='json').status_code == 200
        # 第3次应命中限流
        resp = self.client.post(self.url, data={'tool': 'generate', 'prompt': 'c'}, format='json')
        assert resp.status_code == 429

