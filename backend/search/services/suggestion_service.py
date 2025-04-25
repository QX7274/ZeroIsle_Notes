"""
搜索建议服务
"""

import logging
from django.db.models import F
from search.models import SearchSuggestion

logger = logging.getLogger('backend')

class SuggestionService:
    """
    搜索建议服务类
    处理搜索建议的业务逻辑
    """
    
    def add_suggestion(self, text, user=None, is_global=False):
        """
        添加搜索建议
        
        Args:
            text: 建议文本
            user: 用户对象，如果为None则为全局建议
            is_global: 是否全局建议
            
        Returns:
            SearchSuggestion: 创建的建议对象
        """
        try:
            if not text:
                return None
            
            # 如果是全局建议，用户必须为None
            if is_global:
                user = None
            
            # 创建或更新建议
            suggestion, created = SearchSuggestion.objects.update_or_create(
                user=user,
                text=text,
                defaults={
                    'is_global': is_global,
                    'frequency': F('frequency') + 1 if not created else 1
                }
            )
            
            # 如果是更新，需要重新获取对象以获取更新后的频率
            if not created:
                suggestion.refresh_from_db()
            
            return suggestion
        except Exception as e:
            logger.error(f"添加搜索建议失败: {e}")
            raise
    
    def get_suggestions(self, prefix, user=None, limit=10, include_global=True):
        """
        获取搜索建议
        
        Args:
            prefix: 前缀
            user: 用户对象
            limit: 限制数量
            include_global: 是否包含全局建议
            
        Returns:
            list: 建议列表
        """
        try:
            # 构建查询
            if user and include_global:
                # 用户建议和全局建议
                suggestions = SearchSuggestion.objects.filter(
                    text__istartswith=prefix
                ).filter(
                    user=user
                ) | SearchSuggestion.objects.filter(
                    text__istartswith=prefix,
                    is_global=True
                )
            elif user:
                # 只有用户建议
                suggestions = SearchSuggestion.objects.filter(
                    text__istartswith=prefix,
                    user=user
                )
            else:
                # 只有全局建议
                suggestions = SearchSuggestion.objects.filter(
                    text__istartswith=prefix,
                    is_global=True
                )
            
            # 排序并限制数量
            suggestions = suggestions.order_by('-frequency', '-last_used')[:limit]
            
            # 转换为列表
            return list(suggestions.values('id', 'text', 'frequency', 'is_global'))
        except Exception as e:
            logger.error(f"获取搜索建议失败: {e}")
            raise
    
    def delete_suggestion(self, suggestion_id, user=None):
        """
        删除搜索建议
        
        Args:
            suggestion_id: 建议ID
            user: 用户对象
            
        Returns:
            bool: 是否成功
        """
        try:
            # 构建查询
            query = SearchSuggestion.objects.filter(id=suggestion_id)
            
            # 如果提供了用户，只能删除自己的建议
            if user:
                query = query.filter(user=user)
            
            # 删除建议
            deleted, _ = query.delete()
            
            return deleted > 0
        except Exception as e:
            logger.error(f"删除搜索建议失败: {e}")
            raise
    
    def clear_suggestions(self, user=None, is_global=False):
        """
        清除搜索建议
        
        Args:
            user: 用户对象
            is_global: 是否全局建议
            
        Returns:
            int: 删除数量
        """
        try:
            # 构建查询
            query = SearchSuggestion.objects.all()
            
            if user:
                query = query.filter(user=user)
            
            if is_global:
                query = query.filter(is_global=True)
            
            # 删除建议
            deleted, _ = query.delete()
            
            return deleted
        except Exception as e:
            logger.error(f"清除搜索建议失败: {e}")
            raise
