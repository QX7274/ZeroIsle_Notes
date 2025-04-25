"""
提示词服务
"""

import logging
from ai_assistant.models import PromptTemplate

logger = logging.getLogger('backend')

class PromptService:
    """
    提示词服务类
    处理提示词模板相关的业务逻辑
    """
    
    @staticmethod
    def get_templates(user, category=None, is_public=None, is_featured=None):
        """
        获取提示词模板
        
        Args:
            user: 用户对象
            category: 分类
            is_public: 是否公开
            is_featured: 是否推荐
            
        Returns:
            QuerySet: 提示词模板查询集
        """
        # 基础查询：用户自己的模板 或 公开的模板
        queryset = PromptTemplate.objects.filter(
            user=user
        ) | PromptTemplate.objects.filter(
            is_public=True
        )
        
        # 应用过滤条件
        if category:
            queryset = queryset.filter(category=category)
        
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public)
        
        if is_featured is not None:
            queryset = queryset.filter(is_featured=is_featured)
        
        return queryset.distinct()
    
    @staticmethod
    def create_template(user, data):
        """
        创建提示词模板
        
        Args:
            user: 用户对象
            data: 模板数据
            
        Returns:
            PromptTemplate: 创建的模板
        """
        try:
            template = PromptTemplate.objects.create(
                user=user,
                title=data['title'],
                description=data.get('description', ''),
                content=data['content'],
                category=data.get('category', 'other'),
                tags=data.get('tags', ''),
                variables=data.get('variables', []),
                is_public=data.get('is_public', False)
            )
            
            return template
        except Exception as e:
            logger.error(f"创建提示词模板失败: {e}")
            raise
    
    @staticmethod
    def render_template(template_id, variables, user):
        """
        渲染提示词模板
        
        Args:
            template_id: 模板ID
            variables: 变量字典
            user: 用户对象
            
        Returns:
            str: 渲染后的内容
        """
        try:
            # 获取模板
            template = PromptTemplate.objects.get(id=template_id)
            
            # 检查权限
            if template.user != user and not template.is_public:
                raise ValueError("无权访问此模板")
            
            # 渲染模板
            rendered_content = template.render(variables)
            
            # 增加使用次数
            template.increment_usage()
            
            return rendered_content
        except PromptTemplate.DoesNotExist:
            logger.error(f"提示词模板不存在: {template_id}")
            raise ValueError("提示词模板不存在")
        except Exception as e:
            logger.error(f"渲染提示词模板失败: {e}")
            raise
    
    @staticmethod
    def extract_variables(content):
        """
        提取变量
        
        Args:
            content: 模板内容
            
        Returns:
            list: 变量列表
        """
        import re
        
        # 匹配{{变量名}}格式的变量
        pattern = r'\{\{([^}]+)\}\}'
        matches = re.findall(pattern, content)
        
        # 去重
        variables = list(set(matches))
        
        return variables
