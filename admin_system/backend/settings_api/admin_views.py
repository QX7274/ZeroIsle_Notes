"""管理员与角色管理接口（AdminManagement 页面的后端支撑）。

背景与设计口径
--------------
前端 SystemSettings/AdminManagement.js 调用 /settings/admins 与 /settings/roles，
但后端此前**完全没有这两个接口**（本轮四次端点扫描确认），
页面只能靠内部 mock 兜底 —— 用户看到的是一份假数据。

为什么不再引入独立的"管理员表"：
方案 B 已确定管理员身份口径 = users 集合中 is_staff=True（或 is_superuser=True）的用户，
登录校验用的正是这一标记。若再建一张 admins 表，就会重新出现"两套身份 + 一套映射"的老问题
（这正是阶段4 评估里明确要避免的）。
因此这里把 /settings/admins 实现为 users 集合的**受控视图**：
  - 列表/详情只返回 is_staff 或 is_superuser 的用户；
  - "新增管理员" = 把已有用户提升为管理员（置 is_staff=True），而不是新建账号；
  - "删除管理员" = 取消其管理员标记（降级为普通用户），**不删除用户本身**，
    避免误删业务账号及其笔记数据。

角色（roles）的处置：
本项目当前**没有可用的细粒度角色模型**（permissions.py 已改回按"是否管理员"判定，
因为 Django 权限表在本项目根本不可用）。因此 /settings/roles 返回
基于 is_staff / is_superuser 推导出的**只读**角色视图，
并明确标注不支持自定义角色 —— 宁可如实返回两档，也不假装有精细权限模型。
"""

from __future__ import annotations

import logging

from django.contrib.auth.hashers import make_password
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from auth_api.authentication import IsAdminStaff
from common.filters import MongoFilterBackend, MongoSearchFilter
from rest_framework import filters
from users.models import UserProfile, UserActivity

logger = logging.getLogger(__name__)


def _role_of(user):
    """由 is_superuser / is_staff 推导角色名（本项目只有这两档）。"""
    if getattr(user, "is_superuser", False):
        return "superadmin"
    if getattr(user, "is_staff", False):
        return "admin"
    return "viewer"


def _serialize_admin(user):
    """按前端期望的字段输出（对齐其 mockAdmins 的形状，避免前端再改）。"""
    return {
        "id": str(user.id),
        "username": user.username,
        "email": getattr(user, "email", "") or "",
        "nickname": getattr(user, "nickname", "") or "",
        "role": _role_of(user),
        # 前端 status 用 active/inactive；本项目沿用的是 users.status 字段，
        # 同时兼顾 is_active，二者任一表示禁用即视为 inactive。
        "status": (
            "active"
            if getattr(user, "is_active", True)
            and getattr(user, "status", "active") != "banned"
            else "inactive"
        ),
        "lastLogin": (
            user.last_login.strftime("%Y-%m-%d %H:%M:%S")
            if getattr(user, "last_login", None)
            else None
        ),
        "createdAt": (
            user.date_joined.strftime("%Y-%m-%d")
            if getattr(user, "date_joined", None)
            else None
        ),
    }


class AdminUserViewSet(viewsets.ViewSet):
    """管理员视图集：users 集合中 is_staff/is_superuser 的受控视图。"""

    permission_classes = [IsAuthenticated, IsAdminStaff]
    filter_backends = [MongoSearchFilter, filters.OrderingFilter]
    search_fields = ["username", "email", "nickname"]
    ordering_fields = ["date_joined", "last_login", "username"]
    ordering = ["-date_joined"]

    def _base_queryset(self):
        """管理员 = is_staff 或 is_superuser。"""
        from mongoengine.queryset.visitor import Q as MongoQ

        return UserProfile.objects.filter(
            MongoQ(is_staff=True) | MongoQ(is_superuser=True)
        )

    def list(self, request):
        """管理员列表，支持 keyword（模糊搜索）与 role / status 过滤。"""
        queryset = self._base_queryset()

        keyword = request.query_params.get("keyword")
        if keyword:
            from mongoengine.queryset.visitor import Q as MongoQ

            queryset = queryset.filter(
                MongoQ(username__icontains=keyword)
                | MongoQ(email__icontains=keyword)
                | MongoQ(nickname__icontains=keyword)
            )

        role = request.query_params.get("role")
        if role == "superadmin":
            queryset = queryset.filter(is_superuser=True)
        elif role == "admin":
            queryset = queryset.filter(is_staff=True, is_superuser=False)

        st = request.query_params.get("status")
        if st == "active":
            queryset = queryset.filter(is_active=True)
        elif st == "inactive":
            queryset = queryset.filter(is_active=False)

        ordering = request.query_params.get("ordering") or "-date_joined"
        try:
            queryset = queryset.order_by(ordering)
        except Exception:  # noqa: BLE001
            queryset = queryset.order_by("-date_joined")

        page = request.query_params.get("page")
        page_size = request.query_params.get("page_size") or request.query_params.get("pageSize")
        total = queryset.count()

        if page:
            try:
                page_no = max(1, int(page))
                size = int(page_size) if page_size else 10
            except (TypeError, ValueError):
                page_no, size = 1, 10
            size = max(1, min(size, 200))
            start = (page_no - 1) * size
            items = list(queryset[start : start + size])
        else:
            items = list(queryset)

        return Response({
            "count": total,
            "results": [_serialize_admin(u) for u in items],
        })

    def create(self, request):
        """新增管理员：把**已有用户**提升为管理员。

        刻意不新建账号 —— 管理员就是业务用户，账号体系只有一套。
        若传入的 username 不存在，则明确报错并提示先创建用户。
        """
        username = (request.data or {}).get("username")
        if not username:
            return Response(
                {"error": "请提供 username"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = UserProfile.objects(username=username).first()
        if user is None:
            return Response(
                {
                    "error": (
                        f"用户 {username} 不存在。管理员必须是已存在的用户；"
                        "请先在用户管理中创建该用户，再提升为管理员。"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        role = (request.data or {}).get("role", "admin")
        update = {"is_staff": True}
        if role == "superadmin":
            update["is_superuser"] = True
        UserProfile.objects(id=user.id).update(**update)

        UserActivity(
            user=user,
            activity_type="admin_granted",
            description=f"管理员 {getattr(request.user, 'username', '')} 将用户 {username} 设为 {role}",
            ip_address=request.META.get("REMOTE_ADDR", ""),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        ).save()

        refreshed = UserProfile.objects(id=user.id).first()
        return Response(
            {"status": "success", "data": _serialize_admin(refreshed)},
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, pk=None):
        user = UserProfile.objects(id=pk).first()
        if user is None or _role_of(user) == "viewer":
            return Response(
                {"error": "管理员不存在"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(_serialize_admin(user))

    def update(self, request, pk=None):
        user = UserProfile.objects(id=pk).first()
        if user is None:
            return Response(
                {"error": "管理员不存在"}, status=status.HTTP_404_NOT_FOUND
            )

        data = request.data or {}
        update = {}

        if "role" in data:
            role = data["role"]
            if role == "superadmin":
                update["is_staff"] = True
                update["is_superuser"] = True
            elif role in ("admin", "editor"):
                # 本项目没有 editor 档；如实降级为 admin，避免假装存在该角色
                update["is_staff"] = True
                update["is_superuser"] = False
            else:
                update["is_staff"] = False
                update["is_superuser"] = False

        if "status" in data:
            update["is_active"] = data["status"] == "active"

        if "email" in data:
            update["email"] = data["email"]
        if "nickname" in data:
            update["nickname"] = data["nickname"]

        # 不允许把当前登录的管理员自己降级，避免把自己锁在外面
        if str(getattr(request.user, "id", "")) == str(user.id) and update.get("is_staff") is False:
            return Response(
                {"error": "不能取消自己的管理员权限"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if update:
            UserProfile.objects(id=user.id).update(**update)

        refreshed = UserProfile.objects(id=user.id).first()
        return Response({"status": "success", "data": _serialize_admin(refreshed)})

    def destroy(self, request, pk=None):
        """移除管理员：只取消管理员标记，**不删除用户**。"""
        user = UserProfile.objects(id=pk).first()
        if user is None:
            return Response(
                {"error": "管理员不存在"}, status=status.HTTP_404_NOT_FOUND
            )

        if str(getattr(request.user, "id", "")) == str(user.id):
            return Response(
                {"error": "不能移除自己的管理员权限"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        UserProfile.objects(id=user.id).update(is_staff=False, is_superuser=False)

        UserActivity(
            user=user,
            activity_type="admin_revoked",
            description=f"管理员 {getattr(request.user, 'username', '')} 取消了 {user.username} 的管理员权限",
            ip_address=request.META.get("REMOTE_ADDR", ""),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        ).save()

        return Response({"status": "success", "message": "已移除管理员权限（用户本身保留）"})

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        """重置该管理员的密码（复用与用户管理一致的口径）。"""
        user = UserProfile.objects(id=pk).first()
        if user is None:
            return Response(
                {"error": "管理员不存在"}, status=status.HTTP_404_NOT_FOUND
            )

        import secrets
        import string

        alphabet = string.ascii_letters + string.digits
        new_password = "".join(secrets.choice(alphabet) for _ in range(12))
        UserProfile.objects(id=user.id).update(
            password=make_password(new_password),
            password_reset_at=timezone.now(),
            password_reset_by=getattr(request.user, "username", "") or "admin",
        )
        return Response({
            "status": "success",
            "message": f"已重置 {user.username} 的密码",
            "new_password": new_password,
        })


class RoleViewSet(viewsets.ViewSet):
    """角色视图集（只读）。

    本项目没有可用的细粒度角色模型：Django 权限表在 dummy 引擎下不可用，
    analytics/permissions.py 也已改为按"是否管理员"判定。
    因此这里如实返回两档角色，并标注 can_customize=False，
    而不是伪造一套角色 CRUD 让前端以为可以自定义。
    """

    permission_classes = [IsAuthenticated, IsAdminStaff]

    ROLES = [
        {
            "id": "superadmin",
            "name": "超级管理员",
            "description": "拥有全部权限，包括管理员与角色管理",
            "permissions": ["*"],
        },
        {
            "id": "admin",
            "name": "管理员",
            "description": "可管理用户、内容、日志与分析",
            "permissions": [
                "users.*",
                "content.*",
                "logs.*",
                "analytics.*",
                "settings.*",
            ],
        },
    ]

    def list(self, request):
        return Response({
            "count": len(self.ROLES),
            "results": self.ROLES,
            "can_customize": False,
            "note": (
                "当前系统只有超级管理员与管理员两档角色，不支持自定义角色。"
                "如需细粒度权限，需要先在数据层建立权限模型。"
            ),
        })

    def create(self, request):
        return Response(
            {
                "error": (
                    "当前系统不支持自定义角色。角色由 is_staff / is_superuser 推导，"
                    "如需新增角色请先建立权限模型。"
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def update(self, request, pk=None):
        return self.create(request)

    def destroy(self, request, pk=None):
        return self.create(request)
