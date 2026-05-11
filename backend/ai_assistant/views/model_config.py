"""
模型配置视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from ai_assistant.models import ModelConfig
from ai_assistant.serializers import ModelConfigSerializer
from ai_assistant.services import OpenAIService

class ModelConfigViewSet(viewsets.ModelViewSet):
    """模型配置视图集"""
    serializer_class = ModelConfigSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['provider', 'is_default', 'supports_functions', 'supports_vision']
    ordering_fields = ['name', 'provider']
    ordering = ['provider', 'name']

    def get_queryset(self):
        # Delay MongoEngine collection access until request handling so startup checks
        # do not force a live Mongo connection in testing / offline verification.
        return ModelConfig.objects.filter(is_active=True)
    
    def get_permissions(self):
        """根据操作类型设置权限"""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'sync']:
            return [IsAdminUser()]
        return [IsAuthenticated()]
    
    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def sync(self, request):
        """同步OpenAI模型"""
        openai_service = OpenAIService()
        models = openai_service.get_available_models()
        
        created_count = 0
        updated_count = 0
        
        for model_data in models:
            model_id = model_data['id']
            
            # 检查模型是否已存在
            existing_model = ModelConfig.objects.filter(
                name=model_id,
                provider='openai'
            ).first()
            
            # 设置默认参数
            defaults = {
                'description': model_data.get('description', ''),
                'max_tokens': 4096,  # 默认值
                'token_limit': 8192,  # 默认值
                'is_active': True
            }
            
            # 根据模型类型设置特定参数
            if 'gpt-4' in model_id:
                defaults.update({
                    'max_tokens': 4096,
                    'token_limit': 8192,
                    'price_per_1k_tokens_input': 0.03,
                    'price_per_1k_tokens_output': 0.06,
                    'supports_functions': True
                })
                
                if 'vision' in model_id:
                    defaults['supports_vision'] = True
            
            elif 'gpt-3.5-turbo' in model_id:
                defaults.update({
                    'max_tokens': 4096,
                    'token_limit': 4096,
                    'price_per_1k_tokens_input': 0.0015,
                    'price_per_1k_tokens_output': 0.002,
                    'supports_functions': True
                })
            
            # 创建或更新模型
            if existing_model:
                for key, value in defaults.items():
                    setattr(existing_model, key, value)
                existing_model.save()
                updated_count += 1
            else:
                ModelConfig.objects.create(
                    name=model_id,
                    provider='openai',
                    **defaults
                )
                created_count += 1
        
        return Response({
            "created": created_count,
            "updated": updated_count,
            "total": len(models)
        })
    
    @action(detail=False, methods=['get'])
    def providers(self, request):
        """获取提供商列表"""
        providers = ModelConfig.objects.filter(
            is_active=True
        ).values_list('provider', flat=True).distinct()
        
        return Response(list(providers))
