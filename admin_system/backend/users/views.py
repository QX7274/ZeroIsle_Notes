from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from .models import UserProfile
from .serializers import (
    UserProfileSerializer,
    UserProfileListSerializer,
    UserProfileCreateSerializer,
    UserProfileUpdateSerializer
)

class UserProfileViewSet(viewsets.ModelViewSet):
    """用户资料视图集"""
    queryset = UserProfile.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['username', 'email', 'phone', 'nickname']
    ordering_fields = ['created_at', 'last_login']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return UserProfileListSerializer
        elif self.action == 'create':
            return UserProfileCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserProfileUpdateSerializer
        return UserProfileSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = UserProfile.objects.all()

        # 按创建时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        # 按最后登录时间范围筛选
        last_login_start = self.request.query_params.get('last_login_start')
        last_login_end = self.request.query_params.get('last_login_end')
        if last_login_start:
            queryset = queryset.filter(last_login__gte=last_login_start)
        if last_login_end:
            queryset = queryset.filter(last_login__lte=last_login_end)

        return queryset

    @action(detail=True, methods=['post'])
    def ban(self, request, pk=None):
        """禁用用户"""
        user = self.get_object()
        user.status = 'banned'
        user.save()
        return Response({
            'status': 'success',
            'message': f'用户 {user.username} 已被禁用'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活用户"""
        user = self.get_object()
        user.status = 'active'
        user.save()
        return Response({
            'status': 'success',
            'message': f'用户 {user.username} 已被激活'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """用户统计信息"""
        total_users = UserProfile.objects.count()
        active_users = UserProfile.objects.filter(status='active').count()
        inactive_users = UserProfile.objects.filter(status='inactive').count()
        banned_users = UserProfile.objects.filter(status='banned').count()

        return Response({
            'status': 'success',
            'data': {
                'total_users': total_users,
                'active_users': active_users,
                'inactive_users': inactive_users,
                'banned_users': banned_users
            }
        }, status=status.HTTP_200_OK)
