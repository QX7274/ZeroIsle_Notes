"""
语言视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend

from voice_recognition.models import Language
from voice_recognition.serializers import LanguageSerializer

class LanguageViewSet(viewsets.ModelViewSet):
    """语言视图集"""
    serializer_class = LanguageSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['code', 'name', 'native_name']
    ordering_fields = ['name', 'code']
    ordering = ['name']

    def get_queryset(self):
        return Language.objects.filter(is_active=True)
    
    def get_permissions(self):
        """根据操作类型设置权限"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
