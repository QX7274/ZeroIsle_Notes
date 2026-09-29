"""RISK-BE-007 守护：notes.serializers 必须解析到「包」，包旁不得再出现同名遮蔽模块。

背景：仓库曾同时存在 backend/notes/serializers.py（302 行死代码）与 backend/notes/serializers/ 包。
Python 导入时**包优先**，因此 serializers.py 永远不可达 —— 「看起来在维护的实现」其实从不生效。
本文件锁定三件事，防止回归：
1. notes.serializers.__file__ 必须指向 .../notes/serializers/__init__.py；
2. .../notes/serializers.py 不得存在（防止再放一个同名模块把包遮蔽/被包遮蔽）；
3. 仓库里每个 from notes.serializers import … 的符号都能 getattr 到（符号名由 AST 扫描收集，不用手写清单）。
"""

import ast
from pathlib import Path

from django.test import SimpleTestCase

REPO_ROOT = Path(__file__).resolve().parents[3]
SERIALIZERS_PACKAGE = REPO_ROOT / 'backend' / 'notes' / 'serializers'
SHADOWING_MODULE = REPO_ROOT / 'backend' / 'notes' / 'serializers.py'
SKIP_DIR_PARTS = frozenset({'node_modules', '.git', '__pycache__', '.venv', 'venv', '.mypy_cache'})
SERIALIZERS_MODULES = ('notes.serializers', 'backend.notes.serializers')


def _iter_python_files():
    for path in REPO_ROOT.rglob('*.py'):
        if any(part in SKIP_DIR_PARTS for part in path.parts):
            continue
        yield path


def _collect_imported_symbols():
    """AST 扫描仓库，收集所有 from notes.serializers import … 的符号名。"""
    symbols = set()
    for path in _iter_python_files():
        try:
            tree = ast.parse(path.read_text(encoding='utf-8'))
        except (SyntaxError, UnicodeDecodeError):
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.ImportFrom) or node.level:
                continue
            if node.module not in SERIALIZERS_MODULES:
                continue
            for alias in node.names:
                symbols.add(alias.name)
    return symbols


class SerializersPackageGuardTests(SimpleTestCase):
    def test_serializers_resolves_to_package(self):
        import notes.serializers as serializers_package

        resolved = Path(serializers_package.__file__).resolve()
        self.assertEqual(resolved.name, '__init__.py', 'notes.serializers 必须解析到包的 __init__.py')
        self.assertEqual(resolved.parent, SERIALIZERS_PACKAGE.resolve())

    def test_no_shadowing_module_next_to_package(self):
        self.assertFalse(
            SHADOWING_MODULE.exists(),
            '%s 又出现了：包与同名模块并存时只有一个生效，另一个是死代码（RISK-BE-007）'
            % SHADOWING_MODULE,
        )

    def test_every_imported_symbol_is_exported_by_package(self):
        import notes.serializers as serializers_package

        symbols = _collect_imported_symbols()
        # 防止「扫描不到任何 import」导致守护空过
        self.assertGreaterEqual(len(symbols), 10, 'AST 未收集到足够的导入符号，守护可能失效')

        missing = sorted(name for name in symbols if not hasattr(serializers_package, name))
        self.assertEqual(missing, [], '以下符号被 import 但包里没有：%s' % missing)

    def test_abandoned_ocr_serializers_are_not_part_of_package(self):
        """RISK-BE-007 判定：OCR 序列化器已废弃，随死文件删除（依据见任务报告）。

        依据：仓库内零引用；无 OCRModel/OCRTrainingData 模型；notes/services/ocr_service.py 不存在
        （services/__init__.py 里只剩注释掉的导入）；无 OCR 路由/客户端调用。
        若将来真的要恢复 OCR 能力，请连同 model/路由一起设计，并同步更新本用例。
        """
        import notes.serializers as serializers_package

        for name in ('OCRModelSerializer', 'OCRTrainingDataSerializer'):
            self.assertFalse(hasattr(serializers_package, name))
