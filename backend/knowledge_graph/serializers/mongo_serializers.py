"""
知识图谱MongoDB序列化器
"""

from rest_framework import serializers
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge, KnowledgeGraph, Concept, Entity, Relation

class MongoKnowledgeNodeSerializer(serializers.Serializer):
    """
    知识节点MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=255, required=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    type = serializers.ChoiceField(choices=KnowledgeNode.NODE_TYPES, default='concept')
    note = serializers.CharField(required=False, allow_null=True)
    x = serializers.FloatField(default=0)
    y = serializers.FloatField(default=0)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    size = serializers.IntegerField(default=20)
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)
    properties = serializers.DictField(required=False, default=dict)
    is_public = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def create(self, validated_data):
        """创建节点"""
        # 获取MongoDB用户模型
        from users.mongodb_models import User as MongoUser

        # 获取Django用户
        django_user = self.context['request'].user

        # 查找对应的MongoDB用户
        mongo_user = MongoUser.objects(username=django_user.username).first()
        if not mongo_user:
            raise serializers.ValidationError("未找到对应的MongoDB用户")

        # 处理note字段
        note_id = validated_data.pop('note', None)
        from notes.mongodb_models import Note
        note = None
        if note_id:
            note = Note.objects(id=note_id).first()

        # 创建节点
        node = KnowledgeNode(
            user=mongo_user,
            note=note,
            **validated_data
        )
        node.save()
        return node

    def update(self, instance, validated_data):
        """更新节点"""
        # 处理note字段
        note_id = validated_data.pop('note', None)
        if note_id:
            from notes.mongodb_models import Note
            note = Note.objects(id=note_id).first()
            instance.note = note

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    def to_representation(self, instance):
        """转换为表示形式"""
        data = {
            'id': str(instance.id),
            'user': str(instance.user.id),
            'title': instance.title,
            'description': instance.description or '',
            'type': instance.type,
            'x': instance.x,
            'y': instance.y,
            'color': instance.color or '',
            'size': instance.size,
            'icon': instance.icon or '',
            'properties': instance.properties,
            'is_public': instance.is_public,
            'created_at': instance.created_at,
            'updated_at': instance.updated_at
        }

        # 添加note信息
        if instance.note:
            data['note'] = str(instance.note.id)
            data['note_title'] = instance.note.title
        else:
            data['note'] = None
            data['note_title'] = None

        return data

class MongoKnowledgeEdgeSerializer(serializers.Serializer):
    """
    知识边MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    source = serializers.CharField(required=True)
    target = serializers.CharField(required=True)
    type = serializers.ChoiceField(choices=KnowledgeEdge.EDGE_TYPES, default='related')
    label = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    weight = serializers.FloatField(default=1.0)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    properties = serializers.DictField(required=False, default=dict)
    is_public = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def validate(self, data):
        """验证数据"""
        source_id = data.get('source')
        target_id = data.get('target')

        # 验证源节点和目标节点
        source = KnowledgeNode.objects(id=source_id).first()
        target = KnowledgeNode.objects(id=target_id).first()

        if not source:
            raise serializers.ValidationError({'source': '源节点不存在'})

        if not target:
            raise serializers.ValidationError({'target': '目标节点不存在'})

        if source == target:
            raise serializers.ValidationError('源节点和目标节点不能相同')

        # 将节点对象添加到验证后的数据中
        data['source_obj'] = source
        data['target_obj'] = target

        return data

    def create(self, validated_data):
        """创建边"""
        # 获取MongoDB用户模型
        from users.mongodb_models import User as MongoUser

        # 获取Django用户
        django_user = self.context['request'].user

        # 查找对应的MongoDB用户
        mongo_user = MongoUser.objects(username=django_user.username).first()
        if not mongo_user:
            raise serializers.ValidationError("未找到对应的MongoDB用户")

        source = validated_data.pop('source_obj')
        target = validated_data.pop('target_obj')
        validated_data.pop('source')
        validated_data.pop('target')

        # 创建边
        edge = KnowledgeEdge(
            user=mongo_user,
            source=source,
            target=target,
            **validated_data
        )
        edge.save()
        return edge

    def update(self, instance, validated_data):
        """更新边"""
        # 处理source和target字段
        if 'source_obj' in validated_data:
            instance.source = validated_data.pop('source_obj')
            validated_data.pop('source', None)

        if 'target_obj' in validated_data:
            instance.target = validated_data.pop('target_obj')
            validated_data.pop('target', None)

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    def to_representation(self, instance):
        """转换为表示形式"""
        return {
            'id': str(instance.id),
            'user': str(instance.user.id),
            'source': str(instance.source.id),
            'source_title': instance.source.title,
            'target': str(instance.target.id),
            'target_title': instance.target.title,
            'type': instance.type,
            'label': instance.label or '',
            'description': instance.description or '',
            'weight': instance.weight,
            'color': instance.color or '',
            'properties': instance.properties,
            'is_public': instance.is_public,
            'created_at': instance.created_at,
            'updated_at': instance.updated_at
        }

class MongoKnowledgeGraphSerializer(serializers.Serializer):
    """
    知识图谱MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255, required=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    nodes = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    edges = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    settings = serializers.DictField(required=False, default=dict)
    thumbnail = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_public = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def validate(self, data):
        """验证数据"""
        # 验证节点和边
        node_ids = data.get('nodes', [])
        edge_ids = data.get('edges', [])

        # 将节点和边对象添加到验证后的数据中
        if node_ids:
            nodes = KnowledgeNode.objects(id__in=node_ids)
            data['node_objs'] = list(nodes)

        if edge_ids:
            edges = KnowledgeEdge.objects(id__in=edge_ids)
            data['edge_objs'] = list(edges)

        return data

    def create(self, validated_data):
        """创建图谱"""
        # 获取MongoDB用户模型
        from users.mongodb_models import User as MongoUser

        # 获取Django用户
        django_user = self.context['request'].user

        # 查找对应的MongoDB用户
        mongo_user = MongoUser.objects(username=django_user.username).first()
        if not mongo_user:
            raise serializers.ValidationError("未找到对应的MongoDB用户")

        node_objs = validated_data.pop('node_objs', [])
        edge_objs = validated_data.pop('edge_objs', [])
        validated_data.pop('nodes', None)
        validated_data.pop('edges', None)

        # 创建图谱
        graph = KnowledgeGraph(
            user=mongo_user,
            nodes=node_objs,
            edges=edge_objs,
            **validated_data
        )
        graph.save()
        return graph

    def update(self, instance, validated_data):
        """更新图谱"""
        # 处理nodes和edges字段
        if 'node_objs' in validated_data:
            instance.nodes = validated_data.pop('node_objs')
            validated_data.pop('nodes', None)

        if 'edge_objs' in validated_data:
            instance.edges = validated_data.pop('edge_objs')
            validated_data.pop('edges', None)

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    def to_representation(self, instance):
        """转换为表示形式"""
        return {
            'id': str(instance.id),
            'user': str(instance.user.id),
            'name': instance.name,
            'description': instance.description or '',
            'nodes': [str(node.id) for node in instance.nodes],
            'edges': [str(edge.id) for edge in instance.edges],
            'node_count': len(instance.nodes),
            'edge_count': len(instance.edges),
            'settings': instance.settings,
            'thumbnail': instance.thumbnail or '',
            'is_public': instance.is_public,
            'created_at': instance.created_at,
            'updated_at': instance.updated_at
        }

class MongoConceptSerializer(serializers.Serializer):
    """
    概念MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255, required=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    parent = serializers.CharField(required=False, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def validate(self, data):
        """验证数据"""
        # 验证父概念
        parent_id = data.get('parent')
        if parent_id:
            parent = Concept.objects(id=parent_id).first()
            if not parent:
                raise serializers.ValidationError({'parent': '父概念不存在'})
            data['parent_obj'] = parent

        return data

    def create(self, validated_data):
        """创建概念"""
        parent = validated_data.pop('parent_obj', None) if 'parent_obj' in validated_data else None
        validated_data.pop('parent', None)

        # 创建概念
        concept = Concept(
            parent=parent,
            **validated_data
        )
        concept.save()
        return concept

    def update(self, instance, validated_data):
        """更新概念"""
        # 处理parent字段
        if 'parent_obj' in validated_data:
            instance.parent = validated_data.pop('parent_obj')
            validated_data.pop('parent', None)

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    def to_representation(self, instance):
        """转换为表示形式"""
        data = {
            'id': str(instance.id),
            'name': instance.name,
            'description': instance.description or '',
            'created_at': instance.created_at,
            'updated_at': instance.updated_at
        }

        # 添加parent信息
        if instance.parent:
            data['parent'] = str(instance.parent.id)
            data['parent_name'] = instance.parent.name
        else:
            data['parent'] = None
            data['parent_name'] = None

        return data

class MongoEntitySerializer(serializers.Serializer):
    """
    实体MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=255, required=True)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    concept = serializers.CharField(required=False, allow_null=True)
    properties = serializers.DictField(required=False, default=dict)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def validate(self, data):
        """验证数据"""
        # 验证概念
        concept_id = data.get('concept')
        if concept_id:
            concept = Concept.objects(id=concept_id).first()
            if not concept:
                raise serializers.ValidationError({'concept': '概念不存在'})
            data['concept_obj'] = concept

        return data

    def create(self, validated_data):
        """创建实体"""
        concept = validated_data.pop('concept_obj', None) if 'concept_obj' in validated_data else None
        validated_data.pop('concept', None)

        # 创建实体
        entity = Entity(
            concept=concept,
            **validated_data
        )
        entity.save()
        return entity

    def update(self, instance, validated_data):
        """更新实体"""
        # 处理concept字段
        if 'concept_obj' in validated_data:
            instance.concept = validated_data.pop('concept_obj')
            validated_data.pop('concept', None)

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    def to_representation(self, instance):
        """转换为表示形式"""
        data = {
            'id': str(instance.id),
            'name': instance.name,
            'description': instance.description or '',
            'properties': instance.properties,
            'created_at': instance.created_at,
            'updated_at': instance.updated_at
        }

        # 添加concept信息
        if instance.concept:
            data['concept'] = str(instance.concept.id)
            data['concept_name'] = instance.concept.name
        else:
            data['concept'] = None
            data['concept_name'] = None

        return data

class MongoRelationSerializer(serializers.Serializer):
    """
    关系MongoDB序列化器
    """
    id = serializers.CharField(read_only=True)
    source = serializers.CharField(required=True)
    target = serializers.CharField(required=True)
    relation_type = serializers.CharField(max_length=50, required=True)
    weight = serializers.FloatField(default=1.0)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def validate(self, data):
        """验证数据"""
        source_id = data.get('source')
        target_id = data.get('target')

        # 验证源实体和目标实体
        source = Entity.objects(id=source_id).first()
        target = Entity.objects(id=target_id).first()

        if not source:
            raise serializers.ValidationError({'source': '源实体不存在'})

        if not target:
            raise serializers.ValidationError({'target': '目标实体不存在'})

        if source == target:
            raise serializers.ValidationError('源实体和目标实体不能相同')

        # 将实体对象添加到验证后的数据中
        data['source_obj'] = source
        data['target_obj'] = target

        return data

    def create(self, validated_data):
        """创建关系"""
        source = validated_data.pop('source_obj')
        target = validated_data.pop('target_obj')
        validated_data.pop('source')
        validated_data.pop('target')

        # 创建关系
        relation = Relation(
            source=source,
            target=target,
            **validated_data
        )
        relation.save()
        return relation

    def update(self, instance, validated_data):
        """更新关系"""
        # 处理source和target字段
        if 'source_obj' in validated_data:
            instance.source = validated_data.pop('source_obj')
            validated_data.pop('source', None)

        if 'target_obj' in validated_data:
            instance.target = validated_data.pop('target_obj')
            validated_data.pop('target', None)

        # 更新其他字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    def to_representation(self, instance):
        """转换为表示形式"""
        return {
            'id': str(instance.id),
            'source': str(instance.source.id),
            'source_name': instance.source.name,
            'target': str(instance.target.id),
            'target_name': instance.target.name,
            'relation_type': instance.relation_type,
            'weight': instance.weight,
            'created_at': instance.created_at,
            'updated_at': instance.updated_at
        }
