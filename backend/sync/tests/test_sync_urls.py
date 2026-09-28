import ast
import unittest
from pathlib import Path

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

# Django 项目包位于 <repo>/backend/backend/，仓库里**没有** backend/urls.py。
# 以前的用例硬编码相对路径 'backend/urls.py'，导致从任何工作目录运行都会 FileNotFoundError。
# 这里改为基于 __file__ 解析，避免依赖调用方的工作目录。
ROOT_URLS_PATH = Path(__file__).resolve().parents[2] / 'backend' / 'urls.py'

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
        content = ROOT_URLS_PATH.read_text(encoding='utf-8')

        tree = ast.parse(content)

        # 根 URLconf 目前有两种挂载风格，二者都应被接受：
        # 1) 直接 include('sync.urls')；
        # 2) 在「路由表」中以 (f'{api_prefix}sync/', 'sync.urls') 元组登记，再由循环 include(module_path)。
        #    历史用例只认第 1 种字面量写法，URLconf 重构后会误报「sync 未挂载」。
        include_sync_found = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'include':
                if node.args and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'sync.urls':
                    include_sync_found = True
                    break
            if isinstance(node, (ast.Tuple, ast.List)):
                for element in node.elts:
                    if isinstance(element, ast.Constant) and element.value == 'sync.urls':
                        include_sync_found = True
                        break
            if include_sync_found:
                break

        self.assertTrue(include_sync_found, 'backend/backend/urls.py 必须在根 URLconf 中挂载 sync.urls（include 或路由表登记）')

    def test_project_root_api_prefix_and_sync_path_contract(self):
        content = ROOT_URLS_PATH.read_text(encoding='utf-8')

        tree = ast.parse(content)

        api_prefix_value = None
        has_sync_path_with_api_prefix = False

        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == 'api_prefix':
                        if isinstance(node.value, ast.Constant):
                            api_prefix_value = node.value.value

            # 风格 2：路由表登记 (f'{api_prefix}sync/', 'sync.urls')，
            # 实际 path() 由循环 path(route, include(module_path)) 构造，因此不能在 path() 上找字面量。
            if isinstance(node, (ast.Tuple, ast.List)) and len(node.elts) == 2:
                route_node, module_node = node.elts
                if (
                    isinstance(module_node, ast.Constant)
                    and module_node.value == 'sync.urls'
                    and isinstance(route_node, ast.JoinedStr)
                ):
                    raw_segments = []
                    for seg in route_node.values:
                        if isinstance(seg, ast.Constant) and isinstance(seg.value, str):
                            raw_segments.append(seg.value)
                        elif isinstance(seg, ast.FormattedValue) and isinstance(seg.value, ast.Name):
                            raw_segments.append('{' + seg.value.id + '}')
                    if ''.join(raw_segments) == '{api_prefix}sync/':
                        has_sync_path_with_api_prefix = True

            # 风格 1：path(f'{api_prefix}sync/', include('sync.urls'))
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

                if ''.join(raw_segments) != '{api_prefix}sync/':
                    continue

                for sub in ast.walk(node):
                    if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Name) and sub.func.id == 'include':
                        if sub.args and isinstance(sub.args[0], ast.Constant) and sub.args[0].value == 'sync.urls':
                            has_sync_path_with_api_prefix = True
                            break

        self.assertEqual(api_prefix_value, 'api/v1/')
        self.assertTrue(
            has_sync_path_with_api_prefix,
            "sync 主路由必须通过 api_prefix 拼接为 /api/v1/sync/（include 或路由表登记）",
        )

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

