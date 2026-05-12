from django.test import SimpleTestCase
from django.urls import resolve

from code_editor.views import CodeRunView, CodeSnippetViewSet


class CodeEditorUrlContractTests(SimpleTestCase):
    def test_code_run_route_is_mounted_under_api_v1(self):
        match = resolve('/api/v1/code/run/')
        self.assertIs(match.func.view_class, CodeRunView)

    def test_code_snippet_router_is_mounted_under_api_v1(self):
        match = resolve('/api/v1/code/snippets/')
        self.assertIs(match.func.cls, CodeSnippetViewSet)
