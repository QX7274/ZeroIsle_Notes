from rest_framework import serializers
from .models import SearchHistory, SearchResult


class SearchResultSerializer(serializers.ModelSerializer):
    """
    搜索结果序列化器
    """
    class Meta:
        model = SearchResult
        fields = ('id', 'result_type', 'result_id', 'title', 'preview', 'relevance', 'created_at')


class SearchHistorySerializer(serializers.ModelSerializer):
    """
    搜索历史序列化器
    """
    results = SearchResultSerializer(many=True, read_only=True)
    
    class Meta:
        model = SearchHistory
        fields = ('id', 'query', 'search_type', 'created_at', 'results')


class TextSearchSerializer(serializers.Serializer):
    """
    文本搜索序列化器
    """
    query = serializers.CharField(required=True, max_length=255)
    types = serializers.ListField(
        child=serializers.CharField(max_length=20),
        required=False,
        default=['note', 'tag', 'knowledge']
    )
    use_knowledge_graph = serializers.BooleanField(required=False, default=True)
    limit = serializers.IntegerField(required=False, default=20)


class VoiceSearchSerializer(serializers.Serializer):
    """
    语音搜索序列化器
    """
    audio = serializers.FileField(required=True)
    types = serializers.ListField(
        child=serializers.CharField(max_length=20),
        required=False,
        default=['note', 'tag', 'knowledge']
    )
    use_knowledge_graph = serializers.BooleanField(required=False, default=True)
    limit = serializers.IntegerField(required=False, default=20)


class ImageSearchSerializer(serializers.Serializer):
    """
    图像搜索序列化器
    """
    image = serializers.ImageField(required=True)
    types = serializers.ListField(
        child=serializers.CharField(max_length=20),
        required=False,
        default=['note', 'tag', 'knowledge']
    )
    use_knowledge_graph = serializers.BooleanField(required=False, default=True)
    limit = serializers.IntegerField(required=False, default=20)


class KnowledgeGraphSearchSerializer(serializers.Serializer):
    """
    知识图谱搜索序列化器
    """
    query = serializers.CharField(required=True, max_length=255)
    limit = serializers.IntegerField(required=False, default=20)
