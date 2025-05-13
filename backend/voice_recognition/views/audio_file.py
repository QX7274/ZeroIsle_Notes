"""
音频文件视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from mongoengine.queryset.visitor import Q

from voice_recognition.mongodb_models import AudioFile
from voice_recognition.serializers import (
    AudioFileSerializer,
    AudioFileListSerializer,
    AudioFileDetailSerializer,
    AudioFileCreateSerializer
)
from voice_recognition.services import AudioService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class AudioFileViewSet(viewsets.ModelViewSet):
    """音频文件视图集"""
    serializer_class = AudioFileSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['audio_type', 'is_processed']
    search_fields = ['file_name']
    ordering_fields = ['created_at', 'file_size', 'duration']
    ordering = ['-created_at']

    def get_queryset(self):
        """获取查询集"""
        return AudioFile.objects(
            user=self.request.user,
            is_deleted=False
        )

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return AudioFileListSerializer
        elif self.action == 'retrieve':
            return AudioFileDetailSerializer
        elif self.action == 'create':
            return AudioFileCreateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        """创建音频文件时设置用户"""
        # 使用音频服务创建音频文件
        audio_service = AudioService()

        # 获取文件和音频类型
        file = self.request.data.get('file')
        audio_type = serializer.validated_data.get('audio_type', 'upload')

        # 根据音频类型创建音频文件
        if audio_type == 'url':
            source_url = serializer.validated_data.get('source_url')
            audio_file = audio_service.create_audio_file_from_url(
                url=source_url,
                user=self.request.user
            )
        else:
            audio_file = audio_service.create_audio_file(
                file=file,
                user=self.request.user,
                audio_type=audio_type
            )

        # 返回创建的音频文件
        return audio_file

    def perform_destroy(self, instance):
        """删除音频文件"""
        # 使用音频服务删除音频文件
        audio_service = AudioService()
        audio_service.delete_audio_file(
            audio_file_id=instance.id,
            user=self.request.user
        )

    @action(detail=False, methods=['post'])
    def from_url(self, request):
        """从URL创建音频文件"""
        url = request.data.get('url')

        if not url:
            return Response(
                {"detail": "URL不能为空"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 使用音频服务从URL创建音频文件
            audio_service = AudioService()
            audio_file = audio_service.create_audio_file_from_url(
                url=url,
                user=request.user
            )

            serializer = AudioFileDetailSerializer(audio_file)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
