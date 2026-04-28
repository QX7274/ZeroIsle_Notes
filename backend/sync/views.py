"""
数据同步视图
处理前端数据与MongoDB Atlas云数据库的同步API

同步策略：
1. 关键数据（用户信息、设置）：自动同步，无需用户手动操作
2. 非关键数据（笔记、提醒等）：用户手动触发同步或在特定条件下自动同步
"""

import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication


def _parse_limit_param(query_params, default=100, min_value=1, max_value=500):
    """
    解析并校验分页 limit 参数。

    Returns:
        tuple[int|None, str|None]: (limit, error_message)
    """
    raw_limit = query_params.get('limit', default)
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        return None, 'limit 必须是整数'

    if limit < min_value or limit > max_value:
        return None, f'limit 必须在 {min_value} 到 {max_value} 之间'

    return limit, None


def _build_error_response(code, message):
    """构建统一错误响应结构，兼容 error 与 errors 字段。"""
    error_item = {'code': code, 'message': message}
    return {
        'success': False,
        'error': error_item,
        'errors': [error_item],
        'timestamp': timezone.now().isoformat()
    }

from .services.sync_service import SyncService

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
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"数据同步失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def get(self, request):
        """
        获取云端最新数据（游标模式）
        """
        try:
            user_id = str(request.user.id)
            notes_cursor = request.query_params.get('notes_cursor')
            reminders_cursor = request.query_params.get('reminders_cursor')
            limit, limit_error = _parse_limit_param(request.query_params)
            if limit_error:
                return Response(
                    _build_error_response('SYNC_400_INVALID_LIMIT', limit_error),
                    status=status.HTTP_400_BAD_REQUEST
                )
            notes_resp = SyncService.pull_notes(user_id, notes_cursor, limit)
            reminders_resp = SyncService.pull_reminders(user_id, reminders_cursor, limit)
            settings_resp = SyncService.get_user_settings(user_id)

            all_errors = notes_resp.get('errors', []) + reminders_resp.get('errors', []) + settings_resp.get('errors', [])

            # Safely extract data and cursors
            notes_data = notes_resp.get('data', {})
            reminders_data = reminders_resp.get('data', {})
            settings_data = settings_resp.get('data', {})

            response_data = {
                'notes': notes_data.get('items', []),
                'reminders': reminders_data.get('items', []),
                'settings': settings_data,
                'cursors': {
                    'next_notes_cursor': notes_data.get('next_cursor'),
                    'next_reminders_cursor': reminders_data.get('next_cursor'),
                }
            }

            return Response({
                'success': not all_errors,
                'data': response_data,
                'errors': all_errors,
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新数据失败: {str(e)}")
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"获取最新数据失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
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
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"关键数据同步失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def get(self, request):
        """
        获取云端最新关键数据
        """
        try:
            user_id = str(request.user.id)
            # 'since' 参数仅用于兼容旧客户端入参，当前服务逻辑不依赖该值。
            request.query_params.get('since')

            settings_resp = SyncService.get_user_settings(user_id)
            user_resp = SyncService.get_user_data(user_id)

            all_errors = settings_resp.get('errors', []) + user_resp.get('errors', [])

            response_data = {
                'settings': settings_resp.get('data', {}),
                'user': user_resp.get('data', {}) or {},
            }

            return Response({
                'success': not all_errors,
                'data': response_data,
                'errors': all_errors,
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新关键数据失败: {str(e)}")
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"获取最新关键数据失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"笔记同步失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def get(self, request):
        """
        获取云端最新笔记（游标模式）
        """
        try:
            user_id = str(request.user.id)
            cursor = request.query_params.get('cursor')
            limit, limit_error = _parse_limit_param(request.query_params)
            if limit_error:
                return Response(
                    _build_error_response('SYNC_400_INVALID_LIMIT', limit_error),
                    status=status.HTTP_400_BAD_REQUEST
                )
            result = SyncService.pull_notes(user_id, cursor, limit)

            # The service now returns the standardized response, so we pass it directly.
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新笔记失败: {str(e)}")
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"获取最新笔记失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
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
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"提醒同步失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def get(self, request):
        """
        获取云端最新提醒（游标模式）
        """
        try:
            user_id = str(request.user.id)
            cursor = request.query_params.get('cursor')
            limit, limit_error = _parse_limit_param(request.query_params)
            if limit_error:
                return Response(
                    _build_error_response('SYNC_400_INVALID_LIMIT', limit_error),
                    status=status.HTTP_400_BAD_REQUEST
                )
            result = SyncService.pull_reminders(user_id, cursor, limit)

            # The service now returns the standardized response, so we pass it directly.
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取最新提醒失败: {str(e)}")
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"获取最新提醒失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
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
            return Response(
                _build_error_response('SYNC_500_INTERNAL_SERVER_ERROR', f"设置同步失败: {str(e)}"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def get(self, request):
        """
        获取云端设置
        """
        user_id = str(request.user.id)
        result = SyncService.get_user_settings(user_id)
        # The service now returns the standardized response, so we pass it directly.
        return Response(result, status=status.HTTP_200_OK)