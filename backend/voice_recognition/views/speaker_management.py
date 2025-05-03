"""
说话人管理视图
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from voice_recognition.models import Speaker, Transcription
from voice_recognition.services import SpeakerRecognitionService

logger = logging.getLogger('backend')


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def rename_speaker(request):
    """
    重命名说话人
    """
    try:
        # 获取参数
        speaker_id = request.data.get('speaker_id')
        new_name = request.data.get('new_name')
        
        if not speaker_id or not new_name:
            return Response(
                {'error': '未提供说话人ID或新名称'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 检查说话人是否存在
        try:
            speaker = Speaker.objects.get(id=speaker_id)
        except Speaker.DoesNotExist:
            return Response(
                {'error': f'说话人 {speaker_id} 不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 检查权限
        if speaker.user != request.user:
            return Response(
                {'error': '您没有权限修改此说话人'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # 重命名说话人
        service = SpeakerRecognitionService()
        updated_speaker = service.rename_speaker(speaker_id, new_name)
        
        if not updated_speaker:
            return Response(
                {'error': '重命名说话人失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # 更新转写中的说话人名称
        transcription_id = request.data.get('transcription_id')
        if transcription_id:
            try:
                transcription = Transcription.objects.get(id=transcription_id)
                
                # 检查权限
                if transcription.user != request.user:
                    return Response(
                        {'error': '您没有权限修改此转写'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # 更新分段信息中的说话人名称
                segments = transcription.segments
                for segment in segments:
                    if segment.get('speaker') == str(speaker_id):
                        segment['speaker_name'] = new_name
                
                transcription.segments = segments
                transcription.save(update_fields=['segments'])
            except Transcription.DoesNotExist:
                logger.warning(f"转写 {transcription_id} 不存在，无法更新说话人名称")
        
        # 返回结果
        return Response({
            'message': '重命名说话人成功',
            'speaker': {
                'id': str(updated_speaker.id),
                'name': updated_speaker.name,
                'display_name': updated_speaker.display_name
            }
        })
    except Exception as e:
        logger.error(f"重命名说话人失败: {e}")
        return Response(
            {'error': f'重命名说话人失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merge_speakers(request):
    """
    合并多个说话人
    """
    try:
        # 获取参数
        speaker_ids = request.data.get('speaker_ids', [])
        new_name = request.data.get('new_name')
        
        if not speaker_ids or len(speaker_ids) < 2:
            return Response(
                {'error': '至少需要两个说话人ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 检查说话人是否存在
        speakers = list(Speaker.objects.filter(id__in=speaker_ids))
        if len(speakers) < 2:
            return Response(
                {'error': '找不到足够的说话人'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 检查权限
        for speaker in speakers:
            if speaker.user != request.user:
                return Response(
                    {'error': '您没有权限修改某些说话人'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # 合并说话人
        service = SpeakerRecognitionService()
        merged_speaker = service.merge_speakers(speaker_ids, new_name)
        
        if not merged_speaker:
            return Response(
                {'error': '合并说话人失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # 更新转写中的说话人ID
        transcription_id = request.data.get('transcription_id')
        if transcription_id:
            try:
                transcription = Transcription.objects.get(id=transcription_id)
                
                # 检查权限
                if transcription.user != request.user:
                    return Response(
                        {'error': '您没有权限修改此转写'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # 更新分段信息中的说话人ID和名称
                segments = transcription.segments
                for segment in segments:
                    if segment.get('speaker') in speaker_ids:
                        segment['speaker'] = str(merged_speaker.id)
                        segment['speaker_name'] = merged_speaker.display_name or merged_speaker.name
                
                transcription.segments = segments
                transcription.save(update_fields=['segments'])
            except Transcription.DoesNotExist:
                logger.warning(f"转写 {transcription_id} 不存在，无法更新说话人信息")
        
        # 返回结果
        return Response({
            'message': '合并说话人成功',
            'speaker': {
                'id': str(merged_speaker.id),
                'name': merged_speaker.name,
                'display_name': merged_speaker.display_name
            }
        })
    except Exception as e:
        logger.error(f"合并说话人失败: {e}")
        return Response(
            {'error': f'合并说话人失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_speakers(request):
    """
    获取用户的所有说话人
    """
    try:
        # 获取用户的所有说话人
        speakers = Speaker.objects.filter(
            user=request.user,
            is_active=True
        ).order_by('-is_favorite', 'name')
        
        # 构建响应数据
        speaker_list = []
        for speaker in speakers:
            speaker_list.append({
                'id': str(speaker.id),
                'name': speaker.name,
                'display_name': speaker.display_name,
                'description': speaker.description,
                'avatar': speaker.avatar,
                'is_favorite': speaker.is_favorite,
                'recognition_count': speaker.recognition_count,
                'total_speaking_time': speaker.total_speaking_time,
                'created_at': speaker.created_at.isoformat(),
                'updated_at': speaker.updated_at.isoformat()
            })
        
        return Response(speaker_list)
    except Exception as e:
        logger.error(f"获取说话人列表失败: {e}")
        return Response(
            {'error': f'获取说话人列表失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
