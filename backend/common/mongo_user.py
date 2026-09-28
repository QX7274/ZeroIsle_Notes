"""请求用户统一解析：Django auth User → mongoengine MongoUser（供 notes 的 Realm 视图集复用）。

背景
----
notes 的 Realm 文档模型（Note / Category / Tag）用 mongoengine ReferenceField 引用
users.mongodb_models.User（下称 MongoUser）；而 DRF 的 request.user 是 Django auth User。
两者由 users/signals.py 的 post_save 镜像关联（MongoUser.django_user_id）。
把 Django user 直接传给 mongoengine：创建会抛 InvalidDocument（无法编码 Django 模型），
查询也匹配不到 —— 这是生产缺陷，本模块把解析逻辑收敛到一处，避免第三个副本。

降级语义（与 realm_note.py 原有实现逐字对齐）
--------------------------------------------
1. 优先使用中间件注入的 request.mongo_user；
2. 否则用 request.user.username 查 MongoUser（查不到只告警，不创建）；
3. 未登录 / 查不到 / 异常 → 返回 None，由调用方决定 401 或只读公开数据，
   绝不静默退化成「空列表」或「按 Django user 查询」。
"""

import logging

from rest_framework import status
from rest_framework.response import Response

from users.mongodb_models import User as MongoUser

logger = logging.getLogger(__name__)


def get_mongo_user(request):
    """把请求解析成对应的 MongoUser；解析不到返回 None（语义见模块 docstring）。"""
    if request is None:
        return None

    # 优先使用中间件注入的 mongo_user
    injected = getattr(request, 'mongo_user', None)
    if injected:
        return injected

    # 降级方案：手动查找（兼容旧代码）
    try:
        django_user = getattr(request, 'user', None)
        if not django_user or not getattr(django_user, 'is_authenticated', False):
            return None
        mongo_user = MongoUser.objects(username=django_user.username).first()
        if not mongo_user:
            logger.warning(f"未找到对应的MongoDB用户: {django_user.username}")
        return mongo_user
    except Exception as e:
        logger.error(f"获取 MongoDB 用户失败: {e}", exc_info=True)
        return None


def mongo_user_required_response():
    """解析不到 MongoUser 时的统一响应（与 realm_note 的 401 文案一致，不静默）。"""
    return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)
