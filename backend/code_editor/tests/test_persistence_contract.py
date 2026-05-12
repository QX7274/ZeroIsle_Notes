from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from code_editor.serializers import CodeExecutionRequestSerializer, CodeSnippetSerializer
from code_editor.services.code_execution_service import CodeExecutionService
from code_editor.views import CodeExecutionViewSet, CodeSnippetViewSet


class CodeEditorMongoContractTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.mongo_user = SimpleNamespace(
            id='mongo-user-1',
            username='mongo-user',
            email='mongo@example.com',
            phone='',
            first_name='',
            last_name='',
            nickname='',
            avatar='',
            wechat_avatar='',
            qq_avatar='',
            is_active=True,
            date_joined=None,
            last_login=None,
        )
        self.request_user = SimpleNamespace(
            id='django-user-1',
            username='django-user',
            is_authenticated=True,
        )

    def test_code_execution_request_serializer_accepts_legacy_input_field(self):
        serializer = CodeExecutionRequestSerializer(
            data={'code': 'print(1)', 'language': 'python', 'input': 'abc'}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['input_data'], 'abc')

    def test_code_snippet_serializer_represents_tags_list_for_mongo_document(self):
        snippet = SimpleNamespace(
            id='snippet-1',
            user=self.mongo_user,
            title='demo',
            description='desc',
            code='print(1)',
            language='python',
            is_public=False,
            is_favorite=False,
            tags=['tag-a', 'tag-b'],
            view_count=0,
            created_at=None,
            updated_at=None,
        )

        data = CodeSnippetSerializer(snippet).data

        self.assertEqual(data['tags'], ['tag-a', 'tag-b'])
        self.assertEqual(data['tags_list'], ['tag-a', 'tag-b'])

    def test_code_execution_service_uses_plain_save_for_mongo_document(self):
        execution = mock.Mock()
        execution.code = 'print(1)'
        execution.language = 'python'
        execution.input_data = ''
        execution.save = mock.Mock()

        service = CodeExecutionService()
        with mock.patch.object(service.code_service, 'run_code', return_value={
            'output': '1',
            'error': '',
            'execution_time': 0.01,
            'memory_usage': 1.2,
        }):
            service.execute_code(execution)

        self.assertGreaterEqual(execution.save.call_count, 2)
        for call in execution.save.call_args_list:
            self.assertEqual(call.kwargs, {})

    def test_code_execution_viewset_create_uses_request_mongo_user(self):
        request = self.factory.post('/api/v1/code/executions/execute/', {
            'code': 'print(1)',
            'language': 'python',
            'input': '',
        }, format='json')
        request.user = self.request_user
        request.mongo_user = self.mongo_user
        request.data = {
            'code': 'print(1)',
            'language': 'python',
            'input': '',
        }

        execution = SimpleNamespace(
            id='execution-1',
            output='1',
            error='',
            execution_time=0.01,
            memory_usage=1.2,
            status='completed',
            save=mock.Mock(),
        )

        view = CodeExecutionViewSet()
        view.request = request

        with mock.patch('code_editor.views.code_execution.CodeExecution') as execution_model:
            execution_model.return_value = execution
            with mock.patch('code_editor.views.code_execution.CodeExecutionService') as service_cls:
                service_cls.return_value.execute_code.return_value = execution

                response = view.execute(request)

        self.assertEqual(response.status_code, 200)
        self.assertIs(execution_model.call_args.kwargs['user'], self.mongo_user)

    def test_code_snippet_viewset_create_uses_request_mongo_user(self):
        request = self.factory.post('/api/v1/code/snippets/', {
            'title': 'demo',
            'description': 'desc',
            'code': 'print(1)',
            'language': 'python',
            'tags': ['tag-a'],
        }, format='json')
        request.user = self.request_user
        request.mongo_user = self.mongo_user
        request.data = {
            'title': 'demo',
            'description': 'desc',
            'code': 'print(1)',
            'language': 'python',
            'tags': ['tag-a'],
        }

        snippet = SimpleNamespace(
            id='snippet-1',
            user=self.mongo_user,
            title='demo',
            description='desc',
            code='print(1)',
            language='python',
            is_public=False,
            is_favorite=False,
            tags=['tag-a'],
            view_count=0,
            created_at=None,
            updated_at=None,
            save=mock.Mock(),
        )

        view = CodeSnippetViewSet()
        view.request = request

        with mock.patch('code_editor.views.code_snippet.CodeSnippet') as snippet_model:
            snippet_model.return_value = snippet
            response = view.create(request)

        self.assertEqual(response.status_code, 201)
        self.assertIs(snippet_model.call_args.kwargs['user'], self.mongo_user)
