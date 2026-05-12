"""
代码执行服务
"""

import logging
from code.models import CodeExecution
from code.services.code_service import CodeService

logger = logging.getLogger('backend')

class CodeExecutionService:
    """
    代码执行服务类
    处理代码执行相关的业务逻辑
    """
    
    def __init__(self):
        """初始化"""
        self.code_service = CodeService()
    
    def execute_code(self, execution):
        """
        执行代码
        
        Args:
            execution: 代码执行对象
            
        Returns:
            CodeExecution: 更新后的代码执行对象
        """
        try:
            # 更新状态
            execution.status = 'running'
            execution.save()
            
            # 执行代码
            result = self.code_service.run_code(
                code=execution.code,
                language=execution.language,
                input_data=execution.input_data
            )
            
            # 更新结果
            execution.output = result.get('output', '')
            execution.error = result.get('error', '')
            execution.execution_time = result.get('execution_time', 0)
            execution.memory_usage = result.get('memory_usage', 0)
            execution.status = 'completed' if not result.get('error') else 'failed'
            execution.save()
            
            return execution
        except Exception as e:
            logger.error(f"执行代码失败: {e}")
            
            # 更新错误信息
            execution.error = str(e)
            execution.status = 'failed'
            execution.save()
            
            return execution
    
    def get_execution_history(self, user, language=None, limit=10):
        """
        获取执行历史
        
        Args:
            user: 用户对象
            language: 语言过滤
            limit: 限制数量
            
        Returns:
            QuerySet: 执行历史查询集
        """
        try:
            mongo_user = user
            if getattr(user, 'is_authenticated', False):
                from users.utils import get_mongo_user_from_django

                mongo_user = get_mongo_user_from_django(user)
            if not mongo_user:
                return []

            # 构建查询
            query = CodeExecution.objects.filter(user=mongo_user)
            
            if language:
                query = query.filter(language=language)
            
            # 排序并限制数量
            return query.order_by('-created_at')[:limit]
        except Exception as e:
            logger.error(f"获取执行历史失败: {e}")
            return []
