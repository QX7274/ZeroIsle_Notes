"""
搜索配置模型
"""

from mongoengine import Document, FloatField, ListField, StringField, IntField

class SearchConfiguration(Document):
    """
    存储搜索相关配置的单例模型。
    """
    # 融合搜索中向量搜索的权重 (0.0 to 1.0)
    # 最终得分 = (keyword_score * (1 - fusion_weight)) + (vector_score * fusion_weight)
    fusion_weight = FloatField(default=0.5, min_value=0.0, max_value=1.0)

    # 向量搜索的最低相似度阈值
    vector_score_threshold = FloatField(default=0.75, min_value=0.0, max_value=1.0)

    # 向量搜索中，从关键词预筛阶段获取的最大候选集数量
    max_candidates = IntField(default=200, min_value=10, max_value=1000)

    # 默认搜索返回的结果数量
    default_page_size = IntField(default=20, min_value=1, max_value=100)

    # 可以在前端动态选择的索引类型
    available_indices = ListField(StringField(), default=['notes', 'files', 'knowledge_base'])

    meta = {
        'collection': 'search_configuration',
        'max_documents': 1,  # 确保这是一个单例集合
        'indexes': [
            {'fields': ['$**'], 'default_language': 'english'}
        ]
    }

    @classmethod
    def get_config(cls):
        """获取或创建唯一的配置实例"""
        config = cls.objects.first()
        if not config:
            config = cls.objects.create()
        return config
