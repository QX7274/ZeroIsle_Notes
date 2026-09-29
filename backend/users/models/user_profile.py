"""用户资料模型（RISK-BE-012：同一个集合只由一个 Document 定义）。

历史问题
========
本模块曾定义了一个与 users.mongodb_models.UserProfile **同名、同集合
（user_profiles）但 schema 不同**的 Document：它没有 django_user_id
（signals/utils/mongo_auth 依赖的映射字段），却多了 company/position/bio_extended。
于是 views/profile.py 与 signals/utils 对同一份文档的字段认知不一致，
profile 侧写入可能丢掉 django_user_id 等映射字段。

现状
====
规范模型统一为 users.mongodb_models.UserProfile（已并入轻量侧的三个字段），
本模块只做转发，保证 users.models.UserProfile is users.mongodb_models.UserProfile，
既有 from users.models import UserProfile 的导入路径不受影响。
"""

from ..mongodb_models import UserProfile  # noqa: F401  (re-export，保持既有导入路径)

__all__ = ['UserProfile']
