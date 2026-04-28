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

    def _normalize_text(self, text: str) -> str:
        """规范化建议文本并进行基本校验。
        - 去除首尾空白、折叠连续空白
        - 转为小写（英文场景去重）
        - 长度限制：<= 100
        - 必须包含至少一个中英文或数字字符
        返回规范化后的文本；无效则返回空字符串。
        """
        import re
        if text is None:
            return ""
        # 去首尾空白并折叠空白
        norm = re.sub(r"\s+", " ", str(text).strip())
        # 转小写（不影响中文）
        norm = norm.lower()
        # 基本有效性：至少包含一个可读字符（中/英/数字）
        if not re.search(r"[A-Za-z0-9\u4e00-\u9fa5]", norm):
            return ""
        # 长度限制
        if len(norm) > 100:
            return ""
        return norm

    def add_suggestion(self, text, user=None, is_global=False):
        """
        添加搜索建议

        Args:
            text: 建议文本
            user: 用户对象，如果为None则为全局建议
            is_global: 是否全局建议

        Returns:
            tuple[SearchSuggestion, bool] | None: (建议对象, 是否新建)。无效文本返回 None。
        """
        try:
            # 规范化与校验
            normalized = self._normalize_text(text)
            if not normalized:
                return None

            # 全局建议必须无用户维度
            if is_global:
                user = None

            # 查找现有建议（按规范化后的文本）
            suggestion = SearchSuggestion.objects(user=user, text=normalized).first()

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
                    text=normalized,
                    is_global=is_global,
                    frequency=1
                )
                suggestion.save()
                created = True

            return suggestion, created
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
