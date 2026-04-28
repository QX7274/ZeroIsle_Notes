import ast
import unittest

from django.conf import settings
import django

if not settings.configured:
    settings.configure(
        SECRET_KEY='test-key',
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'rest_framework',
        ],
        REST_FRAMEWORK={},
        USE_TZ=True,
    )
    django.setup()

from sync.urls import urlpatterns
from sync.views import (
    SyncDataView,
    SyncKeyDataView,
    SyncNotesView,
    SyncRemindersView,
    SyncSettingsView,
)


class SyncUrlsContractTests(unittest.TestCase):
    """Sync 路由契约一致性测试。"""

    def test_sync_urlpatterns_map_to_expected_view_classes(self):
        expected = {
            'sync_data': ('data/', SyncDataView),
            'sync_key_data': ('key-data/', SyncKeyDataView),
            'sync_notes': ('notes/', SyncNotesView),
            'sync_reminders': ('reminders/', SyncRemindersView),
            'sync_settings': ('settings/', SyncSettingsView),
        }

        actual = {
            pattern.name: (str(pattern.pattern), getattr(pattern.callback, 'view_class', None))
            for pattern in urlpatterns
        }

        for route_name, (route_path, view_cls) in expected.items():
            self.assertIn(route_name, actual)
            self.assertEqual(actual[route_name][0], route_path)
            self.assertIs(actual[route_name][1], view_cls)

    def test_project_root_urls_include_sync_module(self):
        with open('backend/urls.py', 'r', encoding='utf-8') as f:
            content = f.read()

        tree = ast.parse(content)
        include_sync_found = False

        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue

            if not isinstance(node.func, ast.Attribute):
                continue

            if not isinstance(node.func.value, ast.Name):
                continue

            if node.func.value.id != 'urlpatterns' or node.func.attr != 'append':
                continue

            if not node.args:
                continue

            arg0 = node.args[0]
            if not isinstance(arg0, ast.Call):
                continue

            if not isinstance(arg0.func, ast.Name) or arg0.func.id != 'path':
                continue

            has_sync_include = False
            for sub in ast.walk(arg0):
                if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id == 'include':
                    if sub.args and isinstance(sub.args[0], ast.Constant) and sub.args[0].value == 'sync.urls':
                        has_sync_include = True
                        break

            if has_sync_include:
                include_sync_found = True
                break

        self.assertTrue(include_sync_found, 'backend/urls.py 必须包含 include(\'sync.urls\') 的 sync 主路由挂载')

    def test_project_root_api_prefix_and_sync_path_contract(self):
        with open('backend/urls.py', 'r', encoding='utf-8') as f:
            content = f.read()

        tree = ast.parse(content)

        api_prefix_value = None
        has_sync_path_with_api_prefix = False

        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == 'api_prefix':
                        if isinstance(node.value, ast.Constant):
                            api_prefix_value = node.value.value

            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'path':
                if not node.args:
                    continue

                first_arg = node.args[0]
                if not isinstance(first_arg, ast.JoinedStr):
                    continue

                raw_segments = []
                for seg in first_arg.values:
                    if isinstance(seg, ast.Constant) and isinstance(seg.value, str):
                        raw_segments.append(seg.value)
                    elif isinstance(seg, ast.FormattedValue) and isinstance(seg.value, ast.Name):
                        raw_segments.append('{' + seg.value.id + '}')

                joined = ''.join(raw_segments)
                if joined == '{api_prefix}sync/':
                    for sub in ast.walk(node):
                        if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id == 'include':
                            if sub.args and isinstance(sub.args[0], ast.Constant) and sub.args[0].value == 'sync.urls':
                                has_sync_path_with_api_prefix = True
                                break

        self.assertEqual(api_prefix_value, 'api/v1/')
        self.assertTrue(has_sync_path_with_api_prefix, "sync 主路由必须通过 api_prefix 拼接为 /api/v1/sync/")

    def test_sync_url_route_names_and_paths_are_unique(self):
        route_names = [pattern.name for pattern in urlpatterns]
        route_paths = [str(pattern.pattern) for pattern in urlpatterns]

        self.assertEqual(len(route_names), len(set(route_names)), 'sync 子路由 name 不应重复')
        self.assertEqual(len(route_paths), len(set(route_paths)), 'sync 子路由 path 不应重复')

        self.assertEqual(
            set(route_names),
            {'sync_data', 'sync_key_data', 'sync_notes', 'sync_reminders', 'sync_settings'},
        )




if __name__ == '__main__':
    unittest.main()

