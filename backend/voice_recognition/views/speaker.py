"""
说话人视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from voice_recognition.models import Speaker
from voice_recognition.serializers import SpeakerSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class SpeakerViewSet(viewsets.ModelViewSet):
    """说话人视图集"""
    serializer_class = SpeakerSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """获取查询集"""
        return Speaker.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """创建说话人时设置用户"""
        serializer.save(user=self.request.user)
