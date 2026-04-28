# -*- coding: utf-8 -*-
"""验证 users.models 导出的模型命名与别名约定"""

def test_users_models_exports():
    import importlib

    m = importlib.import_module('users.models')

    # 默认导出的 User 应该是 Django ORM 模型别名
    assert hasattr(m, 'User'), 'users.models 应导出 User'
    assert hasattr(m, 'DjangoUser'), 'users.models 应导出 DjangoUser'

    # 显式 MongoEngine 文档模型别名
    assert hasattr(m, 'MongoUser'), 'users.models 应导出 MongoUser 别名'
    assert hasattr(m, 'MongoVerificationCode'), 'users.models 应导出 MongoVerificationCode 别名'
    assert hasattr(m, 'MongoUserProfile'), 'users.models 应导出 MongoUserProfile 别名'
    assert hasattr(m, 'MongoUserSettings'), 'users.models 应导出 MongoUserSettings 别名'

    # 常用模型
    for name in (
        'VerificationCode', 'ThirdPartyAccount', 'UserProfile', 'UserSettings', 'UserDevice', 'LoginAttempt',
    ):
        assert hasattr(m, name), f'缺少导出: {name}'

