"""
实时转写视图
"""

import logging
import json
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from voice_recognition.services import RealtimeTranscriptionService

logger = logging.getLogger('backend')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_session(request):
    """
    创建实时转写会话
    """
    try:
        # 获取参数
        language = request.data.get('language', 'zh')
        
        # 创建会话
        service = RealtimeTranscriptionService()
        session_id = service.create_session(request.user.id, language)
        
        if not session_id:
            return Response(
                {'error': '创建会话失败，实时转写功能不可用'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # 返回结果
        return Response({
            'session_id': session_id,
            'message': '创建会话成功'
        })
    except Exception as e:
        logger.error(f"创建实时转写会话失败: {e}")
        return Response(
            {'error': f'创建实时转写会话失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_audio_chunk(request):
    """
    添加音频块
    """
    try:
        # 获取参数
        session_id = request.data.get('session_id')
        audio_chunk = request.data.get('audio_chunk')
        
        if not session_id or not audio_chunk:
            return Response(
                {'error': '未提供会话ID或音频数据'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 添加音频块
        service = RealtimeTranscriptionService()
        success = service.add_audio_chunk(session_id, audio_chunk)
        
        if not success:
            return Response(
                {'error': '添加音频块失败'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 返回结果
        return Response({
            'success': True,
            'message': '添加音频块成功'
        })
    except Exception as e:
        logger.error(f"添加音频块失败: {e}")
        return Response(
            {'error': f'添加音频块失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_results(request):
    """
    获取转写结果
    """
    try:
        # 获取参数
        session_id = request.query_params.get('session_id')
        
        if not session_id:
            return Response(
                {'error': '未提供会话ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取结果
        service = RealtimeTranscriptionService()
        results = service.get_results(session_id)
        
        # 返回结果
        return Response({
            'results': results,
            'count': len(results)
        })
    except Exception as e:
        logger.error(f"获取转写结果失败: {e}")
        return Response(
            {'error': f'获取转写结果失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finish_session(request):
    """
    结束会话
    """
    try:
        # 获取参数
        session_id = request.data.get('session_id')
        
        if not session_id:
            return Response(
                {'error': '未提供会话ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 结束会话
        service = RealtimeTranscriptionService()
        final_result = service.finish_session(session_id)
        
        # 返回结果
        return Response({
            'success': True,
            'message': '会话已结束',
            'final_result': final_result
        })
    except Exception as e:
        logger.error(f"结束会话失败: {e}")
        return Response(
            {'error': f'结束会话失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_session_status(request):
    """
    获取会话状态
    """
    try:
        # 获取参数
        session_id = request.query_params.get('session_id')
        
        if not session_id:
            return Response(
                {'error': '未提供会话ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取会话状态
        service = RealtimeTranscriptionService()
        status_info = service.get_session_status(session_id)
        
        # 返回结果
        return Response(status_info)
    except Exception as e:
        logger.error(f"获取会话状态失败: {e}")
        return Response(
            {'error': f'获取会话状态失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
