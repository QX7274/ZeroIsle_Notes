"""用户资料序列化器（RISK-BE-014）。

历史缺陷
========
这里原先用 DRF 的 ModelSerializer 去序列化 mongoengine 的 Document，
运行时抛 AttributeError: 'MetaDict' object has no attribute 'concrete_model'
（ModelSerializer 只支持 Django ORM 模型）；而且 fields 里的 avatar/bio
在任何 UserProfile 上都不存在 —— /profiles 端点在序列化阶段必定 500。

现状
====
改用 rest_framework_mongoengine 的 DocumentSerializer，字段以
users.mongodb_models.UserProfile（user_profiles 集合唯一 Document）的真实字段为准。
tests/test_profile_api.py 里有「序列化器字段 ⊆ 模型字段」的守护，
防止 avatar/bio 这类幽灵字段再次出现。
"""

from rest_framework_mongoengine import serializers as mongo_serializers

from users.mongodb_models import UserProfile


class UserProfileSerializer(mongo_serializers.DocumentSerializer):
    """canonical UserProfile 的序列化器（mongoengine Document）。"""

    class Meta:
        model = UserProfile
        fields = [
            'id',
            'user',            # MongoUser 引用（只读：视图在创建时注入）
            'django_user_id',  # Django 用户映射字段（只读：由 signals/utils 维护）
            'nickname',
            'gender',
            'birthday',
            'location',
            'website',
            'company',
            'position',
            'bio_extended',
            'social_links',
            'education',
            'work',
            'skills',
            'interests',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'django_user_id', 'created_at', 'updated_at']
