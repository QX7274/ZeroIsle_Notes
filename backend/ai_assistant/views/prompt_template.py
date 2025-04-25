"""
提示词模板视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ai_assistant.models import PromptTemplate
from ai_assistant.serializers import (
    PromptTemplateSerializer,
    PromptTemplateListSerializer,
    PromptTemplateDetailSerializer
)
from ai_assistant.services import PromptService
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class PromptTemplateViewSet(viewsets.ModelViewSet):
    """提示词模板视图集"""
    serializer_class = PromptTemplateSerializer
    permission_classes = [IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_public', 'is_featured']
    search_fields = ['title', 'description', 'tags']
    ordering_fields = ['created_at', 'updated_at', 'usage_count']
    ordering = ['-usage_count', '-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return PromptService.get_templates(self.request.user)
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return PromptTemplateListSerializer
        elif self.action == 'retrieve':
            return PromptTemplateDetailSerializer
        return self.serializer_class
    
    def perform_create(self, serializer):
        """创建模板时设置用户"""
        # 提取变量
        content = serializer.validated_data.get('content', '')
        variables = PromptService.extract_variables(content)
        
        serializer.save(
            user=self.request.user,
            variables=variables
        )
    
    @action(detail=True, methods=['post'])
    def render(self, request, pk=None):
        """渲染模板"""
        template = self.get_object()
        variables = request.data.get('variables', {})
        
        try:
            rendered_content = PromptService.render_template(
                template_id=template.id,
                variables=variables,
                user=request.user
            )
            
            return Response({
                "content": rendered_content
            })
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """获取分类列表"""
        categories = [
            {"value": choice[0], "label": choice[1]}
            for choice in PromptTemplate.CATEGORY_CHOICES
        ]
        
        return Response(categories)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """获取推荐模板"""
        queryset = self.get_queryset().filter(is_featured=True)
        serializer = PromptTemplateListSerializer(queryset, many=True)
        
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """获取热门模板"""
        queryset = self.get_queryset().order_by('-usage_count')[:10]
        serializer = PromptTemplateListSerializer(queryset, many=True)
        
        return Response(serializer.data)
