"""
管理后台通用序列化器基类。

背景（问题）
------------
管理系统后端使用 mongoengine 作为 ODM，但此前的序列化器全部继承 DRF 的
`rest_framework.serializers.ModelSerializer`。DRF 的 ModelSerializer 是为
Django ORM 设计的，它会访问 `model._meta.concrete_model`、`_meta.get_field()`、
`_meta.parents`、`_meta.unique_together` 等 Django 专有属性，而 mongoengine 的
`Document._meta` 是 `MetaDict`，不具备这些属性，因此在**实例化序列化器时**即抛
`AttributeError: 'MetaDict' object has no attribute 'concrete_model'`。
这使得管理系统后端连 `manage.py check` 都无法通过，更无法启动。

同时，mongoengine 也**不会**像 Django ORM 那样为带 `choices` 的字段自动生成
`get_<field>_display()` 方法，因此此前序列化器里形如
`serializers.CharField(source='get_status_display')` 的写法在 mongoengine 下
会取不到值（运行时静默失败或抛 AttributeError）。

解决方案
--------
1. 统一继承 `rest_framework_mongoengine.serializers.DocumentSerializer`，
   它按 mongoengine 文档的字段定义来构建序列化字段，不再依赖 Django 的 `_meta`。
2. 提供 `MongoDocumentSerializer`，额外为带 `choices` 的字段补齐
   `get_<field>_display()` 语义：把 `source='get_xxx_display'` 的字段自动改写成
   `SerializerMethodField`，从字段的 `choices` 里查表返回显示名。
   这样既修复了运行时取值，又不必逐个改动各 app 的序列化器写法。

使用方式
--------
    from common.serializers import MongoDocumentSerializer

    class FooSerializer(MongoDocumentSerializer):
        class Meta:
            model = Foo          # mongoengine Document
            fields = '__all__'

注意：仅适用于 mongoengine Document。面向 Django ORM 模型（如
`django.contrib.auth.models.User`）的序列化器应继续使用 DRF 的 ModelSerializer。
"""

from rest_framework_mongoengine import serializers as mongo_serializers
from rest_framework import serializers as drf_serializers


# 形如 get_status_display / get_note_type_display 的 source
_DISPLAY_SOURCE_SUFFIX = '_display'


def _field_for_source(model, source):
    """把 `get_xxx_display` 形式的 source 解析为 mongoengine 字段对象。

    返回值：命中的字段对象；若 source 不是 `get_xxx_display` 或字段不存在，返回 None。
    """
    if not isinstance(source, str) or not source.startswith('get_') or not source.endswith(_DISPLAY_SOURCE_SUFFIX):
        return None
    field_name = source[len('get_'):-len(_DISPLAY_SOURCE_SUFFIX)]
    fields = getattr(model, '_fields', None)
    if not fields or field_name not in fields:
        return None
    return fields[field_name]


def _make_display_method(field):
    """为带 choices 的 mongoengine 字段生成取显示名的取值函数。"""
    choices = getattr(field, 'choices', None) or ()
    mapping = dict(choices)

    def _get_display(self, obj):
        value = getattr(obj, field.name, None)
        if value is None:
            return None
        # 未命中映射时回退为原始值，避免显示为空白
        return mapping.get(value, value)

    return _get_display


class MongoDocumentSerializer(mongo_serializers.DocumentSerializer):
    """mongoengine 文档序列化器基类。

    除继承 DocumentSerializer 外，自动把 `source='get_xxx_display'` 的字段
    改写为 SerializerMethodField，使其在 mongoengine 下也能正确返回显示名。
    """

    def get_fields(self):
        fields = super().get_fields()
        model = getattr(getattr(self, 'Meta', None), 'model', None)
        if model is None:
            return fields

        for name, field in list(fields.items()):
            source = getattr(field, 'source', None)
            model_field = _field_for_source(model, source)
            if model_field is None:
                continue
            # 保留原标题、read_only 等语义，仅替换取值方式
            method = _make_display_method(model_field)
            method.__name__ = f'get_{name}'
            method.__doc__ = f'{model_field.name} 的显示名'
            replacement = drf_serializers.SerializerMethodField(read_only=True)
            replacement.method_name = method.__name__
            setattr(self, method.__name__, method.__get__(self, type(self)))
            fields[name] = replacement

        return fields
