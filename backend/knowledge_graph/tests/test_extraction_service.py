import pytest

from knowledge_graph.services.extraction_service import ExtractionService


@pytest.fixture(scope="module")
def service():
    return ExtractionService()


def _find_relation(relations, relation_type):
    for r in relations:
        if r["relation"] == relation_type:
            return r
    return None


def test_kg_case_er_001_entity_recognizes_domain_terms(service):
    """用例ID: KG-ER-001"""
    text = "深度学习是人工智能的核心技术。"
    entities = service.extract_entities(text)
    names = {e["name"] for e in entities}
    assert "深度学习" in names
    assert "人工智能" in names


def test_kg_case_re_001_relation_should_not_cross_comma_clause(service):
    """用例ID: KG-RE-001"""
    text = "深度学习属于人工智能，并用于图像识别。"
    relations = service.extract_relations(text)

    belongs_to = _find_relation(relations, "belongs_to")
    assert belongs_to is not None
    assert belongs_to["subject"] == "深度学习"
    # 关键断言：关系客体不应跨越逗号到下一分句
    assert belongs_to["object"] == "人工智能"


def test_kg_case_abn_001_invalid_input_type_raises(service):
    """用例ID: KG-ABN-001"""
    with pytest.raises(TypeError):
        service.extract_relations(None)


class _FakeRunResult:
    def __init__(self, payload):
        self._payload = payload

    def data(self):
        return self._payload


class _FakeGraph:
    def __init__(self):
        self.last_query = None
        self.last_params = None

    def run(self, query, **kwargs):
        self.last_query = query
        self.last_params = kwargs
        return _FakeRunResult([
            {
                "id": "n3",
                "title": "目标节点",
                "type": "concept",
                "distance": 2,
                "intermediate_path": ["A", "B", "C"],
            }
        ])


class _FakeNeo4jService:
    def __init__(self):
        self.graph = _FakeGraph()

    def is_connected(self):
        return True


def test_kg_case_inf_001_transitive_inference_clamps_invalid_depth():
    """用例ID: KG-INF-001"""
    from knowledge_graph.services.inference_service import InferenceService

    svc = InferenceService(neo4j_service=_FakeNeo4jService())
    result = svc.infer_transitive_relations(node_id="n1", relation_type="RELATED_TO", max_depth=1)

    assert len(result) == 1
    # 关键判定：max_depth<2 时，应被钳制为 2，避免生成非法路径范围
    assert "*2..2" in svc.neo4j.graph.last_query
