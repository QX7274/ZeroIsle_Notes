"""
搜索建议服务
"""

import logging
from search.mongodb_models import SearchSuggestion
from django.utils import timezone

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

            # 查找现有建议
            suggestion = SearchSuggestion.objects(user=user, text=text).first()

            if suggestion:
                # 更新现有建议
                suggestion.frequency += 1
                suggestion.last_used = timezone.now()
                suggestion.save()
                created = False
            else:
                # 创建新建议
                suggestion = SearchSuggestion(
                    user=user,
                    text=text,
                    is_global=is_global,
                    frequency=1
                )
                suggestion.save()
                created = True

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
                user_suggestions = SearchSuggestion.objects(
                    text__istartswith=prefix,
                    user=user
                )
                global_suggestions = SearchSuggestion.objects(
                    text__istartswith=prefix,
                    is_global=True
                )
                # 合并结果
                suggestions = list(user_suggestions) + list(global_suggestions)
            elif user:
                # 只有用户建议
                suggestions = list(SearchSuggestion.objects(
                    text__istartswith=prefix,
                    user=user
                ))
            else:
                # 只有全局建议
                suggestions = list(SearchSuggestion.objects(
                    text__istartswith=prefix,
                    is_global=True
                ))

            # 排序
            suggestions.sort(key=lambda x: (-x.frequency, -x.last_used.timestamp() if x.last_used else 0))

            # 限制数量
            suggestions = suggestions[:limit]

            # 转换为列表
            return [
                {
                    'id': str(suggestion.id),
                    'text': suggestion.text,
                    'frequency': suggestion.frequency,
                    'is_global': suggestion.is_global
                }
                for suggestion in suggestions
            ]
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
            if user:
                # 如果提供了用户，只能删除自己的建议
                suggestion = SearchSuggestion.objects(id=suggestion_id, user=user).first()
            else:
                suggestion = SearchSuggestion.objects(id=suggestion_id).first()

            # 删除建议
            if suggestion:
                suggestion.delete()
                return True

            return False
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
            query = {}

            if user:
                query['user'] = user

            if is_global:
                query['is_global'] = True

            # 删除建议
            result = SearchSuggestion.objects(**query).delete()

            # 返回删除数量
            return result
        except Exception as e:
            logger.error(f"清除搜索建议失败: {e}")
            raise
