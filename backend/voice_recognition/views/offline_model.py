"""
离线模型视图
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from voice_recognition.services import WhisperService

logger = logging.getLogger('backend')


def is_network_available():
    """Check if network is available by pinging a known host."""
    import socket
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=3)
        return True
    except OSError:
        return False


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_service_status(request):
    """
    获取语音服务状态
    """
    try:
        service = WhisperService()
        status_info = service.get_service_status()
        
        return Response(status_info)
    except Exception as e:
        logger.error(f"获取语音服务状态失败: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_offline_models(request):
    """
    获取可用的离线模型列表
    """
    try:
        service = WhisperService()
        models = service.offline_service.get_available_models()
        
        return Response(models)
    except Exception as e:
        logger.error(f"获取离线模型列表失败: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def download_offline_model(request):
    """
    下载离线模型
    """
    try:
        model_name = request.data.get('model_name')
        if not model_name:
            return Response(
                {'error': '未提供模型名称'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = WhisperService()
        success = service.offline_service._download_model(model_name)
        
        if success:
            return Response({'message': f'模型 {model_name} 下载成功'})
        else:
            return Response(
                {'error': f'模型 {model_name} 下载失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        logger.error(f"下载离线模型失败: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def delete_offline_model(request):
    """
    删除离线模型
    """
    try:
        model_name = request.data.get('model_name')
        if not model_name:
            return Response(
                {'error': '未提供模型名称'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = WhisperService()
        success = service.offline_service.delete_model(model_name)
        
        if success:
            return Response({'message': f'模型 {model_name} 删除成功'})
        else:
            return Response(
                {'error': f'模型 {model_name} 删除失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        logger.error(f"删除离线模型失败: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def change_offline_model(request):
    """
    更改当前使用的离线模型
    """
    try:
        model_name = request.data.get('model_name')
        if not model_name:
            return Response(
                {'error': '未提供模型名称'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = WhisperService()
        success = service.offline_service.change_model(model_name)
        
        if success:
            return Response({'message': f'已切换到模型 {model_name}'})
        else:
            return Response(
                {'error': f'切换到模型 {model_name} 失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    except Exception as e:
        logger.error(f"更改离线模型失败: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_service_mode(request):
    """
    切换服务模式（在线/离线）
    """
    try:
        mode = request.data.get('mode')
        if mode not in ['auto', 'online', 'offline']:
            return Response(
                {'error': '无效的模式，可选值: auto, online, offline'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = WhisperService()
        
        if mode == 'auto':
            # 自动模式，根据网络状态决定
            service.use_api = service.api_key and is_network_available()
        elif mode == 'online':
            service.use_api = True
        else:  # offline
            service.use_api = False
        
        return Response({
            'message': f'已切换到{mode}模式',
            'current_mode': 'online' if service.use_api else 'offline'
        })
    except Exception as e:
        logger.error(f"切换服务模式失败: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
