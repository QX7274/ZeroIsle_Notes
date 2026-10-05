"""仪表盘统计接口（前端 Dashboard 页面的数据来源）。

为什么需要它：
前端 Dashboard 调用 `getDashboardStats()` -> `GET /stats/dashboard`，
但后端**从来没有这个路由**（既不在 content/logs/analytics，也不在 settings_api）。
结果是：仪表盘作为登录后的首页，一直处于"加载失败"状态，
页面上所有卡片都只能显示占位值。

字段契约（严格对齐 Dashboard.js 实际读取的字段，避免前端再适配）：
  totalUsers / todayNewUsers / totalNotes / todayNewNotes /
  totalTags / totalComments / recentUsers / contentDistribution /
  userGrowthData{dates,values} / userActivityData{dates,values} / systemStatus{cpu,memory,disk}

systemStatus 的说明（重要）：
本项目是应用后端，不是监控系统，**没有真实的 CPU/内存/磁盘采集**。
此前无该接口时前端显示 0，现在若随便编造数字会误导运维判断。
因此这里返回 process 级别可拿到的真实指标（Python 进程的 RSS 与运行时长），
并把 cpu 置为 None、附带 `metrics_available: False` 与说明文字，
让前端与运维都清楚"这不是宿主机监控"。宁可显示空，也不显示假数。
"""

from __future__ import annotations

import os

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth_api.authentication import IsAdminStaff
from content.models import Attachment, Comment, Note, Tag
from users.models import UserProfile


def _date_span(days: int):
    """返回最近 days 天的日期列表（含今天），按时间正序。"""
    today = timezone.now().date()
    return [today - timezone.timedelta(days=i) for i in range(days - 1, -1, -1)]


class DashboardStatsView(APIView):
    """仪表盘汇总数据。"""

    permission_classes = [IsAuthenticated, IsAdminStaff]

    def get(self, request):
        try:
            now = timezone.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            # --- 顶部卡片 ---
            total_users = UserProfile.objects.count()
            today_new_users = UserProfile.objects.filter(
                date_joined__gte=today_start
            ).count()
            total_notes = Note.objects.count()
            today_new_notes = Note.objects.filter(created_at__gte=today_start).count()
            total_tags = Tag.objects.count()
            total_comments = Comment.objects.count()

            # --- 内容分布（按附件类型归类，无附件时全 0）---
            attachments = Attachment.objects.all()
            images = videos = audios = documents = 0
            for item in attachments.only("file_type"):
                ftype = getattr(item, "file_type", None)
                if ftype == "image":
                    images += 1
                elif ftype == "video":
                    videos += 1
                elif ftype == "audio":
                    audios += 1
                elif ftype == "document":
                    documents += 1

            content_distribution = {
                "notes": total_notes,
                "images": images,
                "audio": audios,
                "video": videos,
                "documents": documents,
            }

            # --- 最近 7 天新增用户 / 活跃用户趋势 ---
            span = _date_span(7)
            growth_values = []
            activity_values = []
            for day in span:
                day_end = day + timezone.timedelta(days=1)
                growth_values.append(
                    UserProfile.objects.filter(
                        date_joined__gte=day, date_joined__lt=day_end
                    ).count()
                )
                activity_values.append(
                    UserProfile.objects.filter(
                        last_login__gte=day, last_login__lt=day_end
                    ).count()
                )

            # --- 最近注册用户（表格：username/email/createdAt/status）---
            recent = UserProfile.objects.order_by("-date_joined").only(
                "username", "email", "date_joined", "is_active", "status"
            )[:5]
            recent_users = [
                {
                    "id": str(u.id),
                    "username": u.username,
                    "email": getattr(u, "email", "") or "",
                    "createdAt": (
                        u.date_joined.strftime("%Y-%m-%d %H:%M:%S")
                        if getattr(u, "date_joined", None)
                        else None
                    ),
                    "status": (
                        "active"
                        if getattr(u, "is_active", True)
                        and getattr(u, "status", "active") != "banned"
                        else "inactive"
                    ),
                }
                for u in recent
            ]

            # --- 系统状态：只给可真实获取的部分 ---
            rss_mb = None
            try:
                import resource  # POSIX

                rss_mb = round(
                    resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1
                )
            except Exception:  # noqa: BLE001  (非 POSIX 平台无该模块)
                rss_mb = None

            system_status = {
                # 应用进程的内存占用（真实值）；无法获取时为 None。
                "memory": rss_mb,
                # 应用后端不采集宿主机 CPU，占位为 None 而不是编造数字。
                "cpu": None,
                "disk": None,
                "uptime_seconds": None,
                "metrics_available": False,
                "metrics_note": (
                    "本接口不做宿主机监控采集：cpu/disk 恒为 null。"
                    "memory 为当前应用进程的 RSS（MB）。"
                    "如需完整监控请接入 Prometheus/Grafana（项目已含 /metrics/）。"
                ),
            }

            return Response({
                "totalUsers": total_users,
                "todayNewUsers": today_new_users,
                "totalNotes": total_notes,
                "todayNewNotes": today_new_notes,
                "totalTags": total_tags,
                "totalComments": total_comments,
                "recentUsers": recent_users,
                "contentDistribution": content_distribution,
                "userGrowthData": {
                    "dates": [d.strftime("%m-%d") for d in span],
                    "values": growth_values,
                },
                "userActivityData": {
                    "dates": [d.strftime("%m-%d") for d in span],
                    "values": activity_values,
                },
                "systemStatus": system_status,
            })
        except Exception as exc:  # noqa: BLE001
            import logging

            logging.getLogger(__name__).error("获取仪表盘数据失败: %s", exc)
            return Response(
                {"error": f"获取仪表盘数据失败: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
