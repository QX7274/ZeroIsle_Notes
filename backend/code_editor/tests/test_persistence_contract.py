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

    def test_code_snippet_update_persists_tags_list(self):
        request = self.factory.put('/api/v1/code/snippets/snippet-1/', {
            'title': 'updated',
            'description': 'next',
            'code': 'print(2)',
            'language': 'python',
            'tags': ['tag-b', 'tag-c'],
            'is_public': True,
        }, format='json')
        request.user = self.request_user
        request.mongo_user = self.mongo_user
        request.data = {
            'title': 'updated',
            'description': 'next',
            'code': 'print(2)',
            'language': 'python',
            'tags': ['tag-b', 'tag-c'],
            'is_public': True,
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

        with mock.patch.object(view, 'get_object', return_value=snippet):
            response = view.update(request, pk='snippet-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(snippet.tags, ['tag-b', 'tag-c'])
        self.assertTrue(snippet.is_public)
        snippet.save.assert_called_once()

    def test_code_snippet_by_language_requires_query_param(self):
        request = self.factory.get('/api/v1/code/snippets/by_language/')
        request.user = self.request_user
        request.mongo_user = self.mongo_user
        request.query_params = {}

        view = CodeSnippetViewSet()
        view.request = request

        response = view.by_language(request)

        self.assertEqual(response.status_code, 400)

    def test_code_snippet_by_tag_uses_filtered_queryset(self):
        request = self.factory.get('/api/v1/code/snippets/by_tag/?tag=tag-a')
        request.user = self.request_user
        request.mongo_user = self.mongo_user
        request.query_params = {'tag': 'tag-a'}

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
        )
        queryset = mock.Mock()
        queryset.filter.return_value = [snippet]

        view = CodeSnippetViewSet()
        view.request = request
        with mock.patch.object(view, 'get_queryset', return_value=queryset):
            response = view.by_tag(request)

        self.assertEqual(response.status_code, 200)
        queryset.filter.assert_called_once_with(tags='tag-a')
        self.assertEqual(response.data['results'][0]['id'], 'snippet-1')

    def test_code_execution_retrieve_returns_not_found_for_other_user(self):
        request = self.factory.get('/api/v1/code/executions/execution-1/')
        request.user = self.request_user
        request.mongo_user = self.mongo_user

        view = CodeExecutionViewSet()
        view.request = request
        with mock.patch.object(view, 'get_object', return_value=None):
            response = view.retrieve(request, pk='execution-1')

        self.assertEqual(response.status_code, 404)

    def test_code_execution_rerun_resets_fields_before_execute(self):
        request = self.factory.post('/api/v1/code/executions/execution-1/rerun/')
        request.user = self.request_user
        request.mongo_user = self.mongo_user

        execution = SimpleNamespace(
            id='execution-1',
            user=self.mongo_user,
            code='print(1)',
            language='python',
            input_data='',
            output='old',
            error='boom',
            execution_time=9.9,
            memory_usage=3.3,
            status='failed',
            save=mock.Mock(),
        )

        view = CodeExecutionViewSet()
        view.request = request
        with mock.patch.object(view, 'get_object', return_value=execution):
            with mock.patch('code_editor.views.code_execution.CodeExecutionService') as service_cls:
                def _rerun_side_effect(obj):
                    self.assertEqual(obj.status, 'pending')
                    self.assertEqual(obj.output, '')
                    self.assertEqual(obj.error, '')
                    self.assertEqual(obj.execution_time, 0)
                    self.assertEqual(obj.memory_usage, 0)
                    obj.status = 'completed'
                    return obj

                service_cls.return_value.execute_code.side_effect = _rerun_side_effect
                response = view.rerun(request, pk='execution-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(execution.status, 'completed')
        self.assertGreaterEqual(execution.save.call_count, 1)
