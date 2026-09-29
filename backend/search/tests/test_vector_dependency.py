"""向量搜索依赖组合回归（RISK-SEARCH-001 / RISK-BE-013）。

背景：sentence-transformers 2.2.2 在 import 阶段需要 huggingface_hub.cached_download；
huggingface-hub >= 0.26 移除了该 API，而 requirements 之前没有钉 huggingface_hub，
环境里被升到 0.36.2 ⇒ import sentence_transformers 直接 ImportError，
EnhancedVectorService 实际不可用，backend/users/tests 里 4 条用例被 importorskip 掩盖。

现在 backend/requirements.txt 显式钉 huggingface_hub==0.25.2
（transformers 4.36.2 允许 huggingface-hub<1.0,>=0.19.3；tokenizers 0.15.2 允许 >=0.16.4,<1.0）。
本文件把该依赖组合锁死，避免以后又被静默跳过。
"""

import os

import pytest
from packaging.version import Version


def _installed_version(distribution_name):
    from importlib.metadata import version

    return version(distribution_name)


def test_vector_dependencies_importable():
    import huggingface_hub  # noqa: F401
    import sentence_transformers
    import torch  # noqa: F401
    import transformers  # noqa: F401

    assert sentence_transformers.__version__ == '2.2.2'


def test_huggingface_hub_still_provides_cached_download():
    """sentence-transformers 2.2.2 的导入路径依赖这个符号 —— 一旦消失就是本回归。"""
    import huggingface_hub

    assert hasattr(huggingface_hub, 'cached_download'), (
        'huggingface_hub 缺少 cached_download：sentence-transformers 2.2.2 将无法 import '
        '（当前 %s）' % huggingface_hub.__version__
    )


def test_pinned_version_ranges_stay_compatible():
    huggingface_hub_version = Version(_installed_version('huggingface-hub'))
    transformers_version = Version(_installed_version('transformers'))
    sentence_transformers_version = Version(_installed_version('sentence-transformers'))
    torch_version = Version(_installed_version('torch'))

    # cached_download 存在于 <0.26；同时满足 transformers 的 >=0.19.3,<1.0
    assert Version('0.19.3') <= huggingface_hub_version < Version('0.26')
    assert sentence_transformers_version == Version('2.2.2')
    assert transformers_version.release[:2] == (4, 36)
    assert torch_version.release[:2] == (2, 1)


def test_enhanced_vector_service_code_path_runs_offline(settings):
    """用代码自带的 TF-IDF + 内存存储跑通服务代码路径（不需要模型权重）。"""
    settings.VECTOR_MODEL_TYPE = 'tfidf'
    settings.VECTOR_STORE_TYPE = 'memory'

    from search.services.enhanced_vector_service import EnhancedVectorService

    saved_instance = EnhancedVectorService._instance
    EnhancedVectorService._instance = None
    try:
        service = EnhancedVectorService.get_instance()
        service.index_documents([
            {'id': 'dependency-1', 'title': 'Python 入门', 'content': 'Python 是一门编程语言'},
            {'id': 'dependency-2', 'title': '向量检索', 'content': '语义搜索使用向量相似度'},
        ])

        stats = service.get_stats()
        assert stats['total_documents'] >= 2
        results = service.semantic_search('Python', top_k=2)
        assert isinstance(results, list)
    finally:
        EnhancedVectorService._instance = saved_instance


@pytest.mark.skipif(
    os.environ.get('RUN_VECTOR_MODEL_TESTS') != '1',
    reason=(
        '需要下载真实模型权重 paraphrase-multilingual-MiniLM-L12-v2（联网访问 Hugging Face）；'
        '默认环境离线不可用，设 RUN_VECTOR_MODEL_TESTS=1 后可跑'
    ),
)
def test_real_sentence_transformer_loads_and_encodes():
    """外部条件用例：有网络/已有权重缓存时验证真实模型路径。"""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    vectors = model.encode(['测试句子'], convert_to_numpy=True)

    assert vectors.shape[1] == model.get_sentence_embedding_dimension()
