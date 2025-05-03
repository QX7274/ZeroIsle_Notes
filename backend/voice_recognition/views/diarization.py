"""
说话人分离视图
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from voice_recognition.models import Transcription
from voice_recognition.services import DiarizationService

logger = logging.getLogger('backend')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_diarization(request):
    """
    处理说话人分离
    """
    try:
        # 获取参数
        transcription_id = request.data.get('transcription_id')
        force_mode = request.data.get('mode')  # 可选值：online, offline
        
        if not transcription_id:
            return Response(
                {'error': '未提供转录ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 检查转录是否存在
        try:
            transcription = Transcription.objects.get(id=transcription_id)
        except Transcription.DoesNotExist:
            return Response(
                {'error': f'转录 {transcription_id} 不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 检查权限
        if transcription.user != request.user:
            return Response(
                {'error': '您没有权限处理此转录'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # 检查状态
        if transcription.status != 'completed':
            return Response(
                {'error': f'转录状态不是已完成: {transcription.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 处理说话人分离
        service = DiarizationService()
        transcription = service.process_diarization(transcription_id, force_mode)
        
        # 返回结果
        return Response({
            'message': '说话人分离处理成功',
            'transcription_id': str(transcription.id),
            'is_speaker_diarization': transcription.is_speaker_diarization,
            'segments_count': len(transcription.segments)
        })
    except Exception as e:
        logger.error(f"处理说话人分离失败: {e}")
        return Response(
            {'error': f'处理说话人分离失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_diarization_status(request):
    """
    获取说话人分离服务状态
    """
    try:
        service = DiarizationService()
        status_info = service.get_service_status()
        
        return Response(status_info)
    except Exception as e:
        logger.error(f"获取说话人分离服务状态失败: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
