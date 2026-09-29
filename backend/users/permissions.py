"""用户权限

定义用户模块使用的自定义权限类。
"""

from rest_framework import permissions

from common.mongo_user import get_mongo_user


def _stable_pk(user_like):
    """取稳定主键字符串（MongoUser.id / Django User.pk），取不到返回 None。"""
    if user_like is None:
        return None
    pk = getattr(user_like, 'pk', None)
    if pk is None:
        pk = getattr(user_like, 'id', None)
    return None if pk is None else str(pk)


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    对象级权限，只允许对象的所有者或管理员编辑它。

    RISK-BE-015：历史实现用 obj.user == request.user 比较 mongoengine 的
    MongoUser 与 Django auth User —— 两者类型不同，普通用户恒为 False，
    导致本人访问自己的资料详情/更新也是 403（retrieve/update/destroy 全中招）。

    现在统一身份口径：
    1. 管理员（is_staff / is_superuser）直接放行（语义不变）；
    2. obj.user 若为 mongoengine Document（MongoUser 引用，如 UserProfile /
       UserSettings / UserDevice / ThirdPartyAccount），把 request.user 解析成
       MongoUser（复用 common.mongo_user.get_mongo_user，优先中间件注入的
       request.mongo_user，其次按 username 查找，不做创建）后按稳定主键比较；
    3. obj.user 若为 Django ORM 用户（ForeignKey），保持既有语义：与 request.user
       按稳定主键比较；
    4. obj 本身就是用户（Django User）时，同样按稳定主键与 request.user 比较。

    拒绝方式保持项目现状：权限不通过时 DRF 仍返回 403（不改成 404）。
    注意非 owner 的详情路由在本项目里会先被 get_queryset() 过滤成 404，
    这是「不泄露对象是否存在」的既有行为，本次不动。
    """

    def has_object_permission(self, request, view, obj):
        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return False

        # 管理员始终有权限
        if getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
            return True

        # 对象带 user 引用时按引用类型分流；引用可能已失效（DoesNotExist），
        # 此时按无权处理而不是让请求 500。
        try:
            obj_user = getattr(obj, 'user', None)
        except Exception:
            obj_user = None

        if obj_user is not None:
            obj_pk = _stable_pk(obj_user)
            if obj_pk is None:
                return False
            # mongoengine Document（MongoUser）→ 与解析出的 MongoUser 比主键
            if hasattr(obj_user, '_fields'):
                mongo_user = get_mongo_user(request)
                return mongo_user is not None and obj_pk == _stable_pk(mongo_user)
            # Django ORM 用户 → 与 request.user 比主键（保持既有语义）
            return obj_pk == _stable_pk(user)

        # 对象本身就是用户：按稳定主键比较
        obj_pk = _stable_pk(obj)
        user_pk = _stable_pk(user)
        return obj_pk is not None and obj_pk == user_pk
