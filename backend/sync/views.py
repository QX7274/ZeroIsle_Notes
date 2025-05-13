"""
数据同步视图
处理前端数据与MongoDB Atlas云数据库的同步API

同步策略：
1. 关键数据（用户信息、设置）：自动同步，无需用户手动操作
2. 非关键数据（笔记、提醒等）：用户手动触发同步或在特定条件下自动同步
"""

import logging
from datetime import datetime
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from .services.sync_service import SyncService
from .services.mongodb_service import mongodb_service

# 设置日志
logger = logging.getLogger(__name__)

class SyncDataView(APIView):
    """
    数据同步视图
    处理前端数据与MongoDB Atlas的同步
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        同步数据到云端

        请求体格式:
        {
            "notes": [...],
            "reminders": [...],
            "settings": {...},
            "timestamp": "2023-01-01T00:00:00.000Z"
        }
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取请求数据
            data = request.data
            client_timestamp = data.get('timestamp')

            # 同步所有数据
            result = SyncService.sync_all_data(user_id, data)

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"数据同步失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        """
        获取云端最新数据

        查询参数:
        - since: 上次同步时间 (ISO格式)
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取查询参数
            since = request.query_params.get('since')

            # 获取最新数据
            notes = SyncService.get_latest_notes(user_id, since)
            reminders = SyncService.get_latest_reminders(user_id, since)
            settings = SyncService.get_user_settings(user_id)

            return Response({
                'success': True,
                'data': {
                    'notes': notes,
                    'reminders': reminders,
                    'settings': settings,
                },
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新数据失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SyncKeyDataView(APIView):
    """
    关键数据同步视图
    专门用于同步用户关键数据（用户信息和设置）
    这些数据会自动同步，无需用户手动操作
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        同步关键数据到云端

        请求体格式:
        {
            "user": {...},
            "settings": {...},
            "timestamp": "2023-01-01T00:00:00.000Z"
        }
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取请求数据
            data = request.data

            # 同步关键数据
            result = SyncService.sync_key_data(user_id, data)

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"关键数据同步失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        """
        获取云端最新关键数据

        查询参数:
        - since: 上次同步时间 (ISO格式)
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取查询参数
            since = request.query_params.get('since')

            # 获取最新关键数据
            settings = SyncService.get_user_settings(user_id)

            # 获取用户信息
            user = None
            try:
                users_collection = mongodb_service.db.users
                user_data = users_collection.find_one({'_id': user_id})
                if user_data and '_id' in user_data:
                    user_data['_id'] = str(user_data['_id'])
                user = user_data
            except Exception as user_error:
                logger.error(f"获取用户信息失败: {str(user_error)}")

            return Response({
                'success': True,
                'data': {
                    'settings': settings,
                    'user': user,
                },
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新关键数据失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyncNotesView(APIView):
    """
    笔记同步视图
    用于手动同步笔记数据
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        同步笔记到云端

        请求体格式:
        {
            "notes": [...],
            "timestamp": "2023-01-01T00:00:00.000Z"
        }
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取请求数据
            data = request.data
            notes = data.get('notes', [])
            client_timestamp = data.get('timestamp')

            # 同步笔记
            result = SyncService.sync_notes(user_id, notes, client_timestamp)

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"笔记同步失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        """
        获取云端最新笔记

        查询参数:
        - since: 上次同步时间 (ISO格式)
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取查询参数
            since = request.query_params.get('since')

            # 获取最新笔记
            notes = SyncService.get_latest_notes(user_id, since)

            return Response({
                'success': True,
                'data': notes,
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新笔记失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SyncRemindersView(APIView):
    """
    提醒同步视图
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        同步提醒到云端

        请求体格式:
        {
            "reminders": [...],
            "timestamp": "2023-01-01T00:00:00.000Z"
        }
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取请求数据
            data = request.data
            reminders = data.get('reminders', [])
            client_timestamp = data.get('timestamp')

            # 同步提醒
            result = SyncService.sync_reminders(user_id, reminders, client_timestamp)

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"提醒同步失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        """
        获取云端最新提醒

        查询参数:
        - since: 上次同步时间 (ISO格式)
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取查询参数
            since = request.query_params.get('since')

            # 获取最新提醒
            reminders = SyncService.get_latest_reminders(user_id, since)

            return Response({
                'success': True,
                'data': reminders,
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新提醒失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SyncSettingsView(APIView):
    """
    设置同步视图
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        同步设置到云端

        请求体格式:
        {
            "settings": {...},
            "timestamp": "2023-01-01T00:00:00.000Z"
        }
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取请求数据
            data = request.data
            settings = data.get('settings', {})

            # 同步设置
            result = SyncService.sync_user_settings(user_id, settings)

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"设置同步失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        """
        获取云端设置
        """
        try:
            # 获取用户ID
            user_id = str(request.user.id)

            # 获取设置
            settings = SyncService.get_user_settings(user_id)

            return Response({
                'success': True,
                'data': settings,
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取设置失败: {str(e)}")
            return Response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)