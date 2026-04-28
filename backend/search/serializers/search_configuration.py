"""
搜索配置序列化器
"""

from rest_framework import serializers
from search.mongodb_models import SearchConfiguration

class SearchConfigurationSerializer(serializers.Serializer):
    """
    序列化SearchConfiguration模型。
    """
    fusion_weight = serializers.FloatField(min_value=0.0, max_value=1.0)
    vector_score_threshold = serializers.FloatField(min_value=0.0, max_value=1.0)
    default_page_size = serializers.IntegerField(min_value=1, max_value=100)
    available_indices = serializers.ListField(child=serializers.CharField())

    def update(self, instance, validated_data):
        """更新配置实例"""
        instance.fusion_weight = validated_data.get('fusion_weight', instance.fusion_weight)
        instance.vector_score_threshold = validated_data.get('vector_score_threshold', instance.vector_score_threshold)
        instance.default_page_size = validated_data.get('default_page_size', instance.default_page_size)
        instance.available_indices = validated_data.get('available_indices', instance.available_indices)
        instance.save()
        return instance

    def create(self, validated_data):
        """创建配置实例 - 理论上不应被调用，因为我们使用get_config"""
        return SearchConfiguration.objects.create(**validated_data)
